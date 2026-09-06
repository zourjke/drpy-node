#!/usr/bin/env python3
# -*- coding: utf-8 -*-

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
from pathlib import Path
from socketserver import ThreadingMixIn, TCPServer, StreamRequestHandler
import sys

# =========================
# 可选：pympler 统计深度内存；无则退化
# =========================
try:
    from pympler import asizeof as _asizeof  # type: ignore


    def _deep_sizeof(obj) -> int:
        return int(_asizeof.asizeof(obj))
except Exception:
    def _deep_sizeof(obj) -> int:
        return int(sys.getsizeof(obj))

# =========================
# 配置常量
# =========================
HOST = "127.0.0.1"
PORT = 57570

# BRIDGE_PACKET_MAX / BRIDGE_TIMEOUT 与 Node 侧 spider/py/core/bridge.js 同名变量对应
# （默认值=历史硬编码，不配置则行为不变）
MAX_MSG_SIZE = int(os.environ.get("BRIDGE_PACKET_MAX", 10 * 1024 * 1024))  # 10MB
MAX_CACHED_INSTANCES = 100  # ★ 最大缓存实例数
INIT_TIMEOUT = 10  # ★ 初始化超时（秒）
REQUEST_TIMEOUT = int(os.environ.get("BRIDGE_TIMEOUT", 30 * 1000)) / 1000  # ★ 单次请求 socket 超时（秒）

IDLE_EXPIRE = 30 * 60  # 实例空闲过期（秒）
CLEAN_INTERVAL = 5 * 60  # 清理间隔（秒）

LOG_LEVEL = os.environ.get("T4_LOG_LEVEL", "INFO").upper()
LOG_FILE = os.environ.get("T4_LOG_FILE")  # 若未设置则只打到控制台
PID_FILE = os.environ.get("T4_PID_FILE")  # 若设置则会写入PID

# =========================
# 日志
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
# 工具：长度前缀协议
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
# Spider 管理
# =========================
class SpiderInstance:
    """缓存中的健康实例：仅在 init 成功后才会创建并加入缓存。"""

    def __init__(self, spider):
        self.spider = spider
        self.initialized = True  # ★ 入缓存即视为已成功初始化
        self.initializing = False
        self.init_event = threading.Event()
        self.init_event.set()  # ★ 成功态
        self.last_used = time.time()
        self.lock = threading.RLock()  # 显式 init 时串行执行


class _InflightInit:
    """
    初始化占位符：用于并发时只有一个真实 init，其他请求等待事件。
    不进入缓存；init 完成后由调用方负责将 SpiderInstance 放入缓存。
    """

    def __init__(self, spider):
        self.spider = spider
        self.event = threading.Event()
        self.error = None  # 保存异常信息（字符串），成功则为 None
        self.start_ts = time.time()


class SpiderManager:
    def __init__(self, logger):
        self.logger = logger
        self._instances: dict[str, SpiderInstance] = {}  # 健康缓存
        self._inflight: dict[str, _InflightInit] = {}  # 初始化中的占位
        # ★ 改为可重入锁，避免同线程内重入造成死锁；同时我们也将耗时操作移到锁外
        self._lock = threading.RLock()  # 保护上述两表及 LRU
        self._running = True
        self._cleaner = threading.Thread(target=self._cleanup_loop, daemon=True)
        self._cleaner.start()

    # ---------- 后台清理：空闲过期 ----------
    def _cleanup_loop(self):
        while self._running:
            time.sleep(CLEAN_INTERVAL)
            now = time.time()
            with self._lock:
                keys = [
                    k for k, inst in self._instances.items()
                    if (now - inst.last_used) > IDLE_EXPIRE
                ]
                for k in keys:
                    self._instances.pop(k, None)
                    self.logger.info("Cleaned idle instance: %s", k[:16])

    def stop(self):
        self._running = False

    # ---------- Env 解析 ----------
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

        return proxy_url, str(ext or "")

    def _instance_key(self, script_path: str, env_str: str) -> str:
        proxy_url, ext = self._parse_env(env_str)
        key_data = f"{Path(script_path).resolve()}|{proxy_url}|{ext}"
        return hashlib.sha256(key_data.encode("utf-8")).hexdigest()

    # ---------- 动态导入 ----------
    def _load_module_from_file(self, file_path: Path):
        name = file_path.stem
        logger.info("_load_module_from_file %s", name)
        # 加入项目根目录到 sys.path，保证 base.* 可以被导入
        project_root = file_path.parent
        if str(project_root) not in sys.path:
            sys.path.insert(0, str(project_root))
            logger.info("Added %s to sys.path", project_root)
        spec = importlib.util.spec_from_file_location(name, str(file_path))
        if spec is None or spec.loader is None:
            raise ImportError(f"Failed to load module from {file_path}")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    def _import_spider_module(self, script_path: str):
        p = Path(script_path)
        if p.exists() and p.is_file() and p.suffix == ".py":
            return self._load_module_from_file(p)
        return importlib.import_module(script_path)

    def _create_spider(self, script_path: str, env_str: str):
        try:
            module = self._import_spider_module(script_path)
            if not hasattr(module, "Spider"):
                raise AttributeError(f"{script_path} missing class 'Spider'")
            proxy_url, _ = self._parse_env(env_str)
            self.logger.info(f'_create_spider with t4_api={proxy_url}')
            return module.Spider(t4_api=proxy_url)
        except Exception as e:
            self.logger.error("Create Spider failed: %s", e)
            raise

    def _spider_init(self, spider, ext: str):
        """执行 Spider 初始化：setExtendInfo / getDependence / init"""
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

    # ---------- 缓存内存统计 ----------
    def _cache_memory_bytes(self) -> int:
        total = 0
        for inst in self._instances.values():
            try:
                total += _deep_sizeof(inst.spider)
            except Exception:
                pass
        return total

    # ---------- LRU 淘汰 ----------
    def _evict_if_needed(self):
        while len(self._instances) > MAX_CACHED_INSTANCES:
            # 选择 last_used 最早的
            old_key, old_inst = min(self._instances.items(), key=lambda kv: kv[1].last_used)
            self._instances.pop(old_key, None)
            self.logger.info("Evicted LRU instance: %s", old_key[:16])

    # ---------- 将已成功初始化的 spider 放入缓存（统一入口） ----------
    def _commit_instance(self, key: str, spider) -> SpiderInstance:
        inst = SpiderInstance(spider)
        # ★ 注意：这里只做非常短的临界区操作（写缓存 + 统计），不会在锁内做任何耗时操作
        with self._lock:
            self._instances[key] = inst  # ★ 仅成功后加入缓存
            # LRU 控制
            self._evict_if_needed()
            # 打点日志：缓存数量 & 近似内存
            cache_count = len(self._instances)
            approx_mem = self._cache_memory_bytes()
            self.logger.info(
                "New Spider instance: %s | cache_count=%d | approx_cache_mem=%s",
                key[:16], cache_count, _format_bytes(approx_mem)
            )
        return inst

    # ---------- 统一调用入口 ----------
    def call(self, script_path: str, method_name: str, env_str: str, args_list):
        _, ext = self._parse_env(env_str)
        self.logger.info(f'call method:{method_name} with args_list:{args_list}')
        key = self._instance_key(script_path, env_str)

        # -------- A. 快速路径：缓存命中 --------
        with self._lock:
            inst = self._instances.get(key)
        if inst:
            inst.last_used = time.time()
            # 显式 init：无论过去是否初始化过，都再次执行
            if method_name == "init":
                with inst.lock:
                    try:
                        init_ext = (args_list[0] if args_list else ext) or ""
                        self.logger.info(f'call init with ext:{init_ext},env:{env_str}')
                        ret = self._spider_init(inst.spider, init_ext)  # ★ 锁外初始化（inst.lock只保护该实例的串行）
                        inst.last_used = time.time()
                        return ret
                    except Exception as e:
                        return {"success": False, "error": str(e), "traceback": traceback.format_exc()}
            # 其他方法：已初始化，可直接调用
            return self._invoke(inst, method_name, args_list)

        # -------- B. 未命中缓存：占位/初始化协调 --------
        # ★ 第一阶段（短临界区）：只做占位创建，不做任何耗时工作
        created_by_me = False
        with self._lock:
            inflight = self._inflight.get(key)
            if inflight is None:
                spider = self._create_spider(script_path, env_str)
                inflight = _InflightInit(spider)
                self._inflight[key] = inflight
                created_by_me = True

        # ★ 第二阶段：根据请求类型决定同步/异步初始化（全部在锁外执行）
        if created_by_me:
            spider = inflight.spider
            if method_name == "init":
                # 显式 init：当前线程同步做初始化（失败则不入缓存）
                try:
                    init_ext = (args_list[0] if args_list else ext) or ""
                    self.logger.info(f'[created_by_me] init_ext:{init_ext}')
                    ret = self._spider_init(spider, init_ext)  # ★ 锁外执行
                    # 成功：提交到缓存
                    self._commit_instance(key, spider)  # ★ 内部会短暂加锁
                    # 清理占位并通知等待者
                    with self._lock:
                        self._inflight.pop(key, None)
                    inflight.event.set()
                    return ret
                except Exception as e:
                    inflight.error = str(e)
                    with self._lock:
                        self._inflight.pop(key, None)
                    inflight.event.set()
                    return {"success": False, "error": str(e), "traceback": traceback.format_exc()}
            else:
                # 非 init：后台初始化 + 等待 INIT_TIMEOUT
                def _bg_init():
                    try:
                        self._spider_init(spider, ext)  # ★ 锁外执行
                        self._commit_instance(key, spider)  # ★ 内部短临界区
                    except Exception as e:
                        inflight.error = str(e)
                    finally:
                        with self._lock:
                            self._inflight.pop(key, None)
                        inflight.event.set()

                threading.Thread(target=_bg_init, daemon=True).start()

        # 走到这里：要么我们创建了占位并启动了 init，要么别人已在初始化
        # 等待初始化完成或超时
        finished = inflight.event.wait(INIT_TIMEOUT)
        if not finished:
            return {"success": False, "error": "init timeout or failed"}
        if inflight.error:
            return {"success": False, "error": inflight.error}

        # 初始化成功后应已入缓存，再取一次
        with self._lock:
            inst2 = self._instances.get(key)
        if not inst2:
            return {"success": False, "error": "init completed but instance missing"}
        if method_name == "init":
            # 显式 init 的并发者：已有别人完成了初始化，此时返回状态
            return {"status": "already initialized"}
        return self._invoke(inst2, method_name, args_list)

    # ---------- 调用 Spider 方法 ----------
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
            result = getattr(inst.spider, invoke)(*parsed_args)
            if result is not None and hasattr(inst.spider, "json2str"):
                try:
                    return inst.spider.json2str(result)
                except Exception:
                    return result
            return result
        except Exception as e:
            self.logger.error("Call '%s' failed: %s", invoke, e)
            return {"success": False, "error": str(e), "traceback": traceback.format_exc()}


# =========================
# Server
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

            result = _manager.call(script_path, method_name, env, args)
            resp = {
                "success": not (isinstance(result, dict) and result.get("success") is False and "error" in result),
                "result": result if not (isinstance(result, dict) and result.get("success") is False) else None,
            }
            if isinstance(result, dict) and result.get("success") is False:
                resp["error"] = result.get("error")
                if result.get("traceback"):
                    resp["traceback"] = result["traceback"]

            send_packet(self.wfile, resp)
        except Exception as e:
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
