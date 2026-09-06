#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
完备重构版 T4 守护进程（修正版）
- 修复：确保从文件导入时把文件所在目录加入 sys.path（支持 package/relative import）
- 修复：_parse_env 仅从 JSON 的 ext 字段读取 ext，解析失败则 ext = ""
其他设计点请参见之前说明。
"""

import hashlib
import importlib
import importlib.util
import json
import logging
import os
import pickle
import signal
import struct
import threading
import time
import traceback
from collections import OrderedDict
from pathlib import Path
from urllib.parse import quote
from socketserver import ThreadingMixIn, TCPServer, StreamRequestHandler
import sys

# =========================
# 可选：pympler 统计深度内存；无则退化到 sys.getsizeof
# =========================
try:
    from pympler import asizeof as _asizeof  # type: ignore


    def _deep_sizeof(obj) -> int:
        try:
            return int(_asizeof.asizeof(obj))
        except Exception:
            return int(sys.getsizeof(obj))
except Exception:
    def _deep_sizeof(obj) -> int:
        return int(sys.getsizeof(obj))

# =========================
# 配置常量（可按需调整）
# =========================
HOST = "127.0.0.1"
PORT = 57570

# BRIDGE_PACKET_MAX / BRIDGE_TIMEOUT 与 Node 侧 spider/py/core/bridge.js 同名变量对应
# （daemonManager 以 {...process.env} 启动本进程，环境变量可直接透传）；
# 默认值=历史硬编码，不配置则行为不变
MAX_MSG_SIZE = int(os.environ.get("BRIDGE_PACKET_MAX", 60 * 1024 * 1024))  # 60MB
MAX_CACHED_INSTANCES = 100  # 最大缓存实例数
INIT_TIMEOUT = 100  # init 超时（秒）
REQUEST_TIMEOUT = int(os.environ.get("BRIDGE_TIMEOUT", 30 * 1000)) / 1000  # 单次请求 socket 超时（秒）
IDLE_EXPIRE = 30 * 60  # 实例空闲过期（秒）
CLEAN_INTERVAL = 5 * 60  # 清理间隔（秒）
MAX_CONCURRENT_INITS = 8  # 并发初始化上限（可按需调大/调小）

LOG_LEVEL = os.environ.get("T4_LOG_LEVEL", "INFO").upper()
LOG_FILE = os.environ.get("T4_LOG_FILE")  # 若未设置则打到控制台
PID_FILE = os.environ.get("T4_PID_FILE")  # 若设置则写入PID

# =========================
# 日志配置
# =========================
logger = logging.getLogger("t4_daemon")
logger.setLevel(getattr(logging, LOG_LEVEL, logging.INFO))
fmt = logging.Formatter("%(asctime)s | %(levelname)s | %(message)s")

sh = logging.StreamHandler()
sh.setFormatter(fmt)
logger.addHandler(sh)

if LOG_FILE:
    fh = logging.FileHandler(LOG_FILE, encoding="utf-8")
    fh.setFormatter(fmt)
    logger.addHandler(fh)

if PID_FILE:
    try:
        Path(PID_FILE).write_text(str(os.getpid()), encoding="utf-8")
        logger.info("PID saved to %s", PID_FILE)
    except Exception as e:
        logger.warning("Save PID failed: %s", e)

# =========================
# 方法映射（保持兼容）
# =========================
METHOD_MAP = {
    'init': 'init',
    'home': 'homeContent',
    'homeVod': 'homeVideoContent',
    'category': 'categoryContent',
    'detail': 'detailContent',
    'search': 'searchContent',
    'play': 'playerContent',
    'proxy': 'localProxy',
    'action': 'action',
}


# =========================
# 工具：长度前缀协议（recv_exact/send_packet/recv_packet）
# =========================
def recv_exact(rfile, n: int) -> bytes:
    """从 rfile 精确读取 n 字节，若对端关闭或超限则抛异常。"""
    chunks = []
    remaining = n
    while remaining > 0:
        chunk = rfile.read(remaining)
        if not chunk:
            raise ConnectionError("peer closed during read")
        chunks.append(chunk)
        remaining -= len(chunk)
    return b"".join(chunks)


def send_packet(wfile, obj: dict):
    payload = pickle.dumps(obj, protocol=pickle.HIGHEST_PROTOCOL)
    if len(payload) > MAX_MSG_SIZE:
        raise ValueError(f"payload too large:{len(payload)} > {MAX_MSG_SIZE}")
    wfile.write(struct.pack(">I", len(payload)))
    wfile.write(payload)
    wfile.flush()


def recv_packet(rfile) -> dict:
    header = recv_exact(rfile, 4)
    (length,) = struct.unpack(">I", header)
    if length <= 0 or length > MAX_MSG_SIZE:
        raise ValueError("invalid length")
    payload = recv_exact(rfile, length)
    try:
        return json.loads(payload.decode("utf-8"))
    except Exception:
        return pickle.loads(payload)


# =========================
# 辅助：格式化字节大小
# =========================
def _format_bytes(n: int) -> str:
    units = ['B', 'KiB', 'MiB', 'GiB', 'TiB']
    size = float(n)
    for u in units:
        if size < 1024.0 or u == units[-1]:
            return f"{size:.2f} {u}"
        size /= 1024.0


# =========================
# Spider 管理数据结构
# =========================
class SpiderInstance:
    """
    缓存中的健康实例（仅在 init 成功后才会创建并加入缓存）
    - spider: 实例对象
    - module_name: 如果是从文件导入，则记录 module_name 用于卸载
    - estimated_size: 初始化时估算一次大小，后续通过加减维护全局估算
    """
    __slots__ = ("spider", "module_name", "estimated_size", "initialized", "init_event", "last_used", "lock")

    def __init__(self, spider, module_name: str | None = None):
        self.spider = spider
        self.module_name = module_name
        self.estimated_size = 0
        self.initialized = True
        self.init_event = threading.Event()
        self.init_event.set()
        self.last_used = time.time()
        self.lock = threading.RLock()


class _InflightInit:
    """
    初始化占位符：
    - spider: 尚未入缓存的实例对象（已创建但未 init）
    - event: 用于等待 init 完成或失败
    - error: init 期间发生的错误字符串（若发生）
    - start_ts: 初始化开始时间
    - timed_out: 若主线程等待超时并放弃该 inflight，则设置为 True，背景线程完成时会放弃 commit
    """
    __slots__ = ("spider", "event", "error", "start_ts", "timed_out", "module_name")

    def __init__(self, spider, module_name: str | None = None):
        self.spider = spider
        self.event = threading.Event()
        self.error = None
        self.start_ts = time.time()
        self.timed_out = False
        self.module_name = module_name


# =========================
# SpiderManager（核心）
# =========================
class SpiderManager:
    def __init__(self, logger):
        self.logger = logger
        # 使用 OrderedDict 实现 LRU：最近使用的移动到末尾，淘汰时 popitem(last=False)
        self._instances: "OrderedDict[str, SpiderInstance]" = OrderedDict()
        self._inflight: dict[str, _InflightInit] = {}
        # 可重入锁保护此二表与全局统计
        self._lock = threading.RLock()
        # 并发初始化信号量
        self._init_semaphore = threading.Semaphore(MAX_CONCURRENT_INITS)
        # 估算缓存内存（仅采用 commit 时估算并累加，不做全量深度扫描）
        self._estimated_total_bytes = 0
        # 统计计数（简单）
        self.metrics = {
            "commits": 0,
            "evictions": 0,
            "init_failures": 0,
            "inflight_count": 0,
        }
        self._running = True
        self._cleaner = threading.Thread(target=self._cleanup_loop, daemon=True)
        self._cleaner.start()

    # ---------- 后台清理线程：过期实例 ----------
    def _cleanup_loop(self):
        while self._running:
            time.sleep(CLEAN_INTERVAL)
            now = time.time()
            to_evict = []
            with self._lock:
                for k, inst in list(self._instances.items()):
                    if (now - inst.last_used) > IDLE_EXPIRE:
                        to_evict.append(k)
                for k in to_evict:
                    inst = self._instances.pop(k, None)
                    if inst:
                        self.logger.info("Cleaned idle instance: %s", k[:16])
                        self._evict_instance_resources(k, inst)

    def stop(self):
        """停止 manager：停止 cleaner，并尝试清理所有实例资源"""
        self._running = False
        # 清理缓存实例的资源
        with self._lock:
            keys = list(self._instances.keys())
        for k in keys:
            with self._lock:
                inst = self._instances.pop(k, None)
            if inst:
                self._evict_instance_resources(k, inst)

    # ---------- Env 解析（严格：仅从 JSON 的 ext 字段读取 ext） ----------
    @staticmethod
    def _parse_env(env_str):
        """
        解析 env 配置字符串或字典，返回 (proxyUrl, ext)
        """
        if not env_str:
            return "", ""

        # 标准化为 dict
        if isinstance(env_str, str):
            try:
                data = json.loads(env_str)
            except (json.JSONDecodeError, TypeError):
                return "", ""
        elif isinstance(env_str, dict):
            data = env_str
        else:
            return "", ""

        proxy_url = str(data.get("proxyUrl") or "")
        ext = data.get("ext", "")

        # 如果 ext 是 dict 或 list，转为 JSON 字符串
        if isinstance(ext, (dict, list)):
            ext = json.dumps(ext, ensure_ascii=False)

        if proxy_url and not '&extend=' in proxy_url:
            proxy_url += f'&extend={quote(ext)}'

        return proxy_url, str(ext or "")

    # ---------- 生成唯一实例 key ----------
    def _instance_key(self, script_path: str, env_str: str) -> str:
        proxy_url, ext = self._parse_env(env_str)
        key_data = f"{Path(script_path).resolve()}|{proxy_url}|{ext}"
        return hashlib.sha256(key_data.encode("utf-8")).hexdigest()

    @staticmethod
    def compute_file_hash(file_path, algorithm='sha256', chunk_size=8192):
        hash_func = hashlib.new(algorithm)
        with open(file_path, 'rb') as f:
            while chunk := f.read(chunk_size):
                hash_func.update(chunk)
        return hash_func.hexdigest()

    # ---------- 动态导入：返回 (module, module_name 或 None) ----------
    def _load_module_from_file_old(self, file_path: Path):
        """从文件加载模块，使用基于绝对路径哈希的唯一 module_name 避免冲突
        并将文件所在目录加入 sys.path，保证模块内部的 package/relative import 能成功
        """
        abs_path = str(file_path.resolve())
        module_name = "t4_spider_" + hashlib.sha256(abs_path.encode("utf-8")).hexdigest()[:16]
        # 使用时间戳确保模块名唯一,如果不唯一会存在共享类变量问题,但是会产生很多副本不合理，所以最好确保被调用的模块写法规范不存在类共享变量
        timestamp = str(time.time()).replace('.', '')
        module_name = "t4_spider_" + hashlib.sha256((abs_path + timestamp).encode("utf-8")).hexdigest()[:16]
        # 下面没用，导入的时候即使按文件hash来算，也不会重新导入
        # module_name = "t4_spider_" + hashlib.sha256(self.compute_file_hash(abs_path).encode("utf-8")).hexdigest()[:16]
        # 确保项目根目录（文件所在目录）在 sys.path 中，支持 import base.xxx 之类的包导入
        project_root = file_path.parent
        if str(project_root) not in sys.path:
            # 插入到 sys.path 前端，保证本地包优先
            sys.path.insert(0, str(project_root))
            logger.info("Added %s to sys.path", project_root)
        # 如果已存在相同 module_name 且来源路径相同，则复用
        existing = sys.modules.get(module_name)
        if existing is not None:
            return existing, module_name
        spec = importlib.util.spec_from_file_location(module_name, abs_path)
        if spec is None or spec.loader is None:
            raise ImportError(f"Failed to load module from {file_path}")
        module = importlib.util.module_from_spec(spec)
        # 把 module 注册到 sys.modules，避免后续重复加载产生多个副本
        sys.modules[module_name] = module
        spec.loader.exec_module(module)
        return module, module_name

    def _load_module_from_file(self, file_path: Path):
        """从文件加载模块，每次实时导入避免模块状态共享问题"""
        abs_path = str(file_path.resolve())

        # 确保项目根目录在 sys.path 中
        project_root = file_path.parent
        if str(project_root) not in sys.path:
            sys.path.insert(0, str(project_root))
            logger.info("Added %s to sys.path", project_root)

        # 使用时间戳确保模块名唯一，避免缓存问题
        timestamp = str(time.time()).replace('.', '')
        module_name = f"t4_spider_{hashlib.sha256((abs_path + timestamp).encode('utf-8')).hexdigest()[:16]}"

        # 直接从文件加载模块，不检查缓存
        spec = importlib.util.spec_from_file_location(module_name, abs_path)
        if spec is None or spec.loader is None:
            raise ImportError(f"Failed to load module from {file_path}")

        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)

        # 不将模块注册到 sys.modules，避免缓存
        # 这样每次都会创建新的模块实例，确保状态隔离
        # return module, None  # 返回 None 作为 module_name，表示不需要缓存
        return module, module_name

    def _import_spider_module(self, script_path: str):
        """
        如果 script_path 指向文件，则加载为唯一 module_name 并返回 (module, module_name)
        否则按模块名 import 并返回 (module, None)
        """
        p = Path(script_path)
        if p.exists() and p.is_file() and p.suffix == ".py":
            return self._load_module_from_file(p)
        module = importlib.import_module(script_path)
        return module, None

    def _create_spider(self, script_path: str, env_str: str):
        """创建 spider 实例（仅实例化，不进行 init）"""
        try:
            module, module_name = self._import_spider_module(script_path)
            if not hasattr(module, "Spider"):
                raise AttributeError(f"{script_path} missing class 'Spider'")
            proxy_url, _ = self._parse_env(env_str)
            self.logger.info(f'_create_spider with t4_api={proxy_url} module={module_name}')
            spider = module.Spider(t4_api=proxy_url)
            return spider, module_name
        except Exception as e:
            self.logger.error("Create Spider failed: %s", e)
            raise

    def _spider_init(self, spider, ext: str):
        """执行 Spider 初始化：setExtendInfo / getDependence / init（耗时、放锁外运行）"""
        try:
            if hasattr(spider, "setExtendInfo"):
                spider.setExtendInfo(ext)
            depends = []
            if hasattr(spider, "getDependence"):
                depends = spider.getDependence() or []
            modules = []
            for lib in depends:
                try:
                    m = importlib.import_module(lib)
                    if hasattr(m, "Spider"):
                        modules.append(m.Spider(t4_api=ext))
                        self.logger.info("Loaded dependence: %s", lib)
                except Exception as e:
                    self.logger.warning("Dependence load failed %s: %s", lib, e)
            if hasattr(spider, "init"):
                self.logger.info(f"[_spider_init] spider.extend: {getattr(spider, 'extend', None)}")
                self.logger.info(f"[_spider_init] spider.init({modules})")
                return spider.init(modules)
            return {"status": "no init"}
        except Exception as e:
            self.logger.error("Spider init failed: %s", e)
            raise

    # ---------- 内存估算（仅在 commit 时对单个实例计算一次） ----------
    def _estimate_instance_size(self, spider) -> int:
        try:
            return _deep_sizeof(spider)
        except Exception:
            return int(sys.getsizeof(spider))

    # ---------- 淘汰单个实例资源（调用 close、卸载模块、调整估算） ----------
    def _evict_instance_resources(self, key: str, inst: SpiderInstance):
        # 调用 spider.close()（若有），并尝试从 sys.modules 卸载 module_name
        try:
            if hasattr(inst.spider, "close") and callable(inst.spider.close):
                try:
                    inst.spider.close()
                except Exception as e:
                    self.logger.warning("Error closing spider for %s: %s", key[:16], e)
        except Exception:
            pass
        # 从估算总量中减去
        with self._lock:
            try:
                self._estimated_total_bytes -= getattr(inst, "estimated_size", 0) or 0
            except Exception:
                pass
            self.metrics["evictions"] += 1
        # 尝试卸载模块（若记录 module_name）
        module_name = getattr(inst, "module_name", None)
        if module_name:
            try:
                if module_name in sys.modules:
                    del sys.modules[module_name]
                    self.logger.info("Unloaded module %s from sys.modules", module_name)
            except Exception as e:
                self.logger.debug("Failed to unload module %s: %s", module_name, e)

    # ---------- LRU 淘汰若超过阈值（使用 OrderedDict） ----------
    def _evict_if_needed(self):
        with self._lock:
            while len(self._instances) > MAX_CACHED_INSTANCES:
                old_key, old_inst = self._instances.popitem(last=False)  # pop oldest
                self.logger.info("Evicting LRU instance: %s", old_key[:16])
                # 清理资源（会做估算减法和 close）
                self._evict_instance_resources(old_key, old_inst)

    # ---------- 将已成功初始化的 spider 放入缓存（统一入口） ----------
    def _commit_instance(self, key: str, spider, module_name: str | None = None) -> SpiderInstance:
        """
        commit 只在 init 成功且调用方确认未 timeout 的情况下执行
        - 估算实例大小一次并累加到 _estimated_total_bytes
        - 将实例放入 OrderedDict 的末尾（最近使用）
        """
        inst = SpiderInstance(spider, module_name)
        # estimate size once
        try:
            size = self._estimate_instance_size(spider)
            inst.estimated_size = size
        except Exception:
            inst.estimated_size = 0
        inst.last_used = time.time()
        with self._lock:
            self._instances[key] = inst
            # move to end to mark most recently used
            try:
                self._instances.move_to_end(key, last=True)
            except Exception:
                pass
            self._estimated_total_bytes += inst.estimated_size or 0
            self.metrics["commits"] += 1
            # LRU 控制
            self._evict_if_needed()
            cache_count = len(self._instances)
            approx_mem = self._estimated_total_bytes
            self.logger.info(
                "New Spider instance: %s | cache_count=%d | approx_cache_mem=%s | extend=%s",
                key[:16], cache_count, _format_bytes(approx_mem), spider.extend
            )
        return inst

    # ---------- 统一调用入口（核心逻辑） ----------
    def call(self, script_path: str, method_name: str, env_str: str, args_list):
        """
        高级流程：
        1) 尝试缓存命中（key 级别）
        2) 若未命中并且已有 inflight（占位），等待该 inflight 的 event（带超时）
        3) 若未命中且无 inflight，则创建 spider（实例化 only），放 inflight 占位
           - 如果 method == "init": 当前线程同步执行 init（会受并发限制）
           - 否则：在后台线程执行 init（会受并发限制），当前线程等待 event（带超时）
        4) init 成功且未超时则 commit；否则返回错误。后台线程在完成后会清理 inflight 并 set event。
        """
        _, ext = self._parse_env(env_str)
        self.logger.info(f'call method:{method_name} with args_list:{args_list}')
        key = self._instance_key(script_path, env_str)

        # -------- A. 尝试缓存命中（短临界区） --------
        with self._lock:
            inst = self._instances.get(key)
            if inst:
                # move to end (mark as recently used)
                try:
                    self._instances.move_to_end(key, last=True)
                except Exception:
                    pass

        if inst:
            inst.last_used = time.time()
            # 显式 init：再次执行 init（实例级锁串行）
            if method_name == "init":
                with inst.lock:
                    try:
                        init_ext = (args_list[0] if args_list else ext) or ""
                        self.logger.info(f'call init with ext:{init_ext}, env:{env_str}')
                        # init 由实例自身的 lock 串行保护（锁外 init 操作）
                        ret = self._spider_init(inst.spider, init_ext)
                        print('self._spider_init: 482')
                        inst.last_used = time.time()
                        return ret
                    except Exception as e:
                        self.metrics["init_failures"] += 1
                        return {"success": False, "error": str(e), "traceback": traceback.format_exc()}
            # 其它方法：直接调用
            return self._invoke(inst, method_name, args_list)

        # -------- B. 未命中缓存：inflight 占位协调（短临界区） --------
        created_by_me = False
        with self._lock:
            inflight = self._inflight.get(key)
            if inflight is None:
                # create spider instance (instantiation only, no init)
                spider = None
                module_name = None
                try:
                    spider, module_name = self._create_spider(script_path, env_str)
                except Exception as e:
                    self.logger.error("Failed to create spider object: %s", e)
                    return {"success": False, "error": str(e), "traceback": traceback.format_exc()}
                inflight = _InflightInit(spider, module_name)
                self._inflight[key] = inflight
                created_by_me = True
                self.metrics["inflight_count"] = len(self._inflight)

        # -------- C. 由创建者决定同步/异步 init（均在锁外运行） --------
        if created_by_me:
            spider = inflight.spider
            module_name = inflight.module_name
            if method_name == "init":
                # 显式 init：当前线程同步初始化（受信号量控制）
                acquired = self._init_semaphore.acquire(timeout=INIT_TIMEOUT)
                if not acquired:
                    # 无初始化资源可用
                    with self._lock:
                        # 清理 inflight，标记失败
                        self._inflight.pop(key, None)
                        self.metrics["inflight_count"] = len(self._inflight)
                    inflight.error = "init resource busy"
                    inflight.event.set()
                    self.metrics["init_failures"] += 1
                    return {"success": False, "error": "init resource busy"}
                try:
                    try:
                        init_ext = (args_list[0] if args_list else ext) or ""
                        self.logger.info(f'[created_by_me] sync init_ext:{init_ext}')
                        ret = self._spider_init(spider, init_ext)
                        print('self._spider_init: 531')
                        # commit 成功（只要 inflight 未被主线程取消）
                        with self._lock:
                            # it's possible that inflight.timed_out was set by waiters; check it
                            if not inflight.timed_out:
                                inst = self._commit_instance(key, spider, module_name)
                            else:
                                # cancel commit and cleanup module if needed
                                self.logger.info("Init finished but inflight was timed out; discarding instance")
                                # attempt to unload module if any
                                if module_name and module_name in sys.modules:
                                    try:
                                        del sys.modules[module_name]
                                    except Exception:
                                        pass
                        # 清理 inflight 并通知等待者
                        with self._lock:
                            self._inflight.pop(key, None)
                            self.metrics["inflight_count"] = len(self._inflight)
                        inflight.event.set()
                        return ret
                    except Exception as e:
                        inflight.error = str(e)
                        with self._lock:
                            self._inflight.pop(key, None)
                            self.metrics["inflight_count"] = len(self._inflight)
                        inflight.event.set()
                        self.metrics["init_failures"] += 1
                        return {"success": False, "error": str(e), "traceback": traceback.format_exc()}
                finally:
                    try:
                        self._init_semaphore.release()
                    except Exception:
                        pass
            else:
                # 非 init：后台初始化 + 等待 INIT_TIMEOUT
                def _bg_init():
                    acquired = False
                    try:
                        # try acquire but wait reasonable time (防止永久阻塞)
                        acquired = self._init_semaphore.acquire(timeout=INIT_TIMEOUT)
                        if not acquired:
                            inflight.error = "init resource busy"
                            self.logger.warning("bg init cannot acquire semaphore for key %s", key[:16])
                            return
                        try:
                            self._spider_init(spider, ext)
                            print('self._spider_init: 576')
                            # commit only if not timed out/abandoned
                            with self._lock:
                                if not inflight.timed_out:
                                    self._commit_instance(key, spider, module_name)
                                else:
                                    # timed out: discard module if any
                                    self.logger.info("bg init finished but inflight was timed out; discarding")
                                    if module_name and module_name in sys.modules:
                                        try:
                                            del sys.modules[module_name]
                                        except Exception:
                                            pass
                        except Exception as e:
                            inflight.error = str(e)
                            self.metrics["init_failures"] += 1
                        finally:
                            # ensure inflight is removed and event set (safe pop)
                            with self._lock:
                                self._inflight.pop(key, None)
                                self.metrics["inflight_count"] = len(self._inflight)
                            inflight.event.set()
                    finally:
                        if acquired:
                            try:
                                self._init_semaphore.release()
                            except Exception:
                                pass

                threading.Thread(target=_bg_init, daemon=True).start()

        # -------- D. 等待 init 完成或超时（对创建者与非创建者统一） --------
        finished = inflight.event.wait(INIT_TIMEOUT)
        if not finished:
            # 超时：标记 inflight 为 timed_out 并移除（防止 bg 后续 commit）
            with self._lock:
                cur = self._inflight.get(key)
                if cur is inflight:
                    inflight.timed_out = True
                    self._inflight.pop(key, None)
                    self.metrics["inflight_count"] = len(self._inflight)
            return {"success": False, "error": "init timeout or failed"}
        # 完成后检查结果
        if inflight.error:
            return {"success": False, "error": inflight.error}
        # init 成功，则实例应已被 commit
        with self._lock:
            inst2 = self._instances.get(key)
            if inst2:
                # move to end as recently used
                try:
                    self._instances.move_to_end(key, last=True)
                except Exception:
                    pass
        if not inst2:
            return {"success": False, "error": "init completed but instance missing"}
        if method_name == "init":
            return {"status": "already initialized"}
        return self._invoke(inst2, method_name, args_list)

    # ---------- 调用 Spider 方法（对实例的真实调用入口） ----------
    def _invoke(self, inst: SpiderInstance, method_name: str, args_list):
        # 解析 args
        parsed_args = []
        for a in (args_list or []):
            if isinstance(a, (dict, list, int, float, bool, type(None))):
                parsed_args.append(a)
            elif isinstance(a, str):
                try:
                    parsed_args.append(json.loads(a))
                except Exception:
                    parsed_args.append(a)
            else:
                parsed_args.append(a)

        # 方法映射
        invoke = METHOD_MAP.get(method_name, method_name)
        if not hasattr(inst.spider, invoke):
            return {"success": False, "error": f"Spider missing method '{invoke}'"}

        try:
            inst.last_used = time.time()
            # move to end (recently used)
            with self._lock:
                try:
                    # find key and move to end; using search since OrderedDict keyed by key externally
                    for k, v in self._instances.items():
                        if v is inst:
                            self._instances.move_to_end(k, last=True)
                            break
                except Exception:
                    pass
            # self.logger.info('invoke method %s with extend: %s' % (invoke, inst.spider.extend))
            # self.logger.info('invoke method %s with host: %s' % (invoke, inst.spider.host))
            # self.logger.info('invoke method %s with parsed_args: %s' % (invoke, parsed_args))
            result = getattr(inst.spider, invoke)(*parsed_args)
            # self.logger.info('result:%s' % result)
            if result is not None and hasattr(inst.spider, "json2str"):
                try:
                    return inst.spider.json2str(result)
                except Exception:
                    return result
            return result
        except Exception as e:
            self.logger.error("Call '%s' failed: %s", invoke, e)
            return {"success": False, "error": str(e), "traceback": traceback.format_exc()}

    # ---------- 仅供监控/运维查看 ----------
    def stats(self):
        with self._lock:
            return {
                "cache_count": len(self._instances),
                "estimated_bytes": self._estimated_total_bytes,
                "inflight_count": len(self._inflight),
                **self.metrics
            }


# =========================
# Server RPC 层（保持协议兼容）
# =========================
_manager = SpiderManager(logger)


class T4Handler(StreamRequestHandler):
    def handle(self):
        self.request.settimeout(REQUEST_TIMEOUT)
        try:
            req = recv_packet(self.rfile)
            script_path = req.get("script_path", "")
            method_name = req.get("method_name", "")
            env = req.get("env", "") or ""
            args = req.get("args", []) or []
            logger.info("T4Handler start: script_path:%s method_name:%s", script_path, method_name)
            result = _manager.call(script_path, method_name, env, args)
            # 统一外层返回格式
            resp = {
                "success": not (isinstance(result, dict) and result.get("success") is False and "error" in result),
                "result": result if not (isinstance(result, dict) and result.get("success") is False) else None,
            }
            if isinstance(result, dict) and result.get("success") is False:
                # 为避免泄露过多内部信息，默认只返回 error 字段；如果需要调试，可打开日志
                resp["error"] = result.get("error")
                if result.get("traceback"):
                    # 在非调试模式下，不把 traceback 返回给客户端（但保留日志）
                    resp["traceback"] = result.get("traceback")

            send_packet(self.wfile, resp)
        except Exception as e:
            if "peer closed during read" in str(e).lower():
                logger.warning("Client connected then closed without sending data")
            else:
                logger.error("T4Handler error: %s", e)
            try:
                send_packet(self.wfile, {"success": False, "error": str(e)})
            except Exception:
                pass  # 对端已断开


class ThreadedTCPServer(ThreadingMixIn, TCPServer):
    daemon_threads = True
    allow_reuse_address = True


def run():
    def _stop(*_):
        logger.info("Stopping server ...")
        _manager.stop()
        # 让 serve_forever() 退出
        srv.shutdown()
        logger.info("The service has successfully exited")
        sys.exit(0)  # 保证退出码是 0

    if os.name == "posix":
        signal.signal(signal.SIGTERM, _stop)
        signal.signal(signal.SIGINT, _stop)

    global srv
    srv = ThreadedTCPServer((HOST, PORT), T4Handler)
    logger.info("T4 daemon listening on %s:%d", HOST, PORT)
    try:
        srv.serve_forever(poll_interval=0.5)
    finally:
        srv.server_close()
        logger.info("Server closed.")


if __name__ == "__main__":
    run()
