# 开工文档：工程质量修复 + 可维护性收口 + 代理优化方案A实施

> 日期：2026-08-30
> 前置文档：`docs/issues-and-proxy-design.md`（问题评估与代理设计，本文档是其可执行开工版）
> 用户裁决（2026-08-30）：
> - 评估文档 1.1 安全与鉴权类问题（S1-S6）**确认为有意设计，全部不做**；
> - 1.2 工程质量修复 + 1.4 可维护性收口 + 代理优化方案A **纳入本轮实施**；
> - 硬性要求：**兼容既有正常执行逻辑，不出现业务回归 bug**。

---

## 1. 两个关键判定的解释（应要求补充证据）

### 1.1 为什么 libs/hipy.js 的 callPythonMethodOld / callPythonMethod 是死代码

> **勘误（2026-08-30，经项目作者指正）**：本文初稿曾以"JSON5 未注入、调用即 ReferenceError"作为辅助证据，**该论证错误**。实际注入链路为：`libs_drpy/drpyCustom.js:9` side-effect import 单文件 UMD 库 `libs_drpy/_dist/json5.js`（`global.JSON5 = factory()` 挂到 globalThis），而 drpyCustom 被服务启动必经的 `libs/drpyS.js:45`、`libs/drpysParser.js:13` 引用——**服务就绪后 `globalThis.JSON5` 一定可用**。`git diff --stat v1 main` 确认 `libs/hipy.js`、`libs_drpy/_dist/json5.js`、`libs_drpy/drpyCustom.js` 三文件在重构前后零差异，json5 单文件从未丢失。特此修正，死代码判定改由调用链证据独立支撑。

**判定依据（调用链证据，充分且必要）**：`libs/hipy.js:177-182` 给源对象绑定方法时，唯一的调用路径是：

```js
spiderProxy[method] = async (...args) => {
    return netCallPythonMethod(filePath, method, env, ...args);  // L180，唯一实路
};
```

`callPythonMethodOld`（L41-105）与 `callPythonMethod`（L107-168）在文件内**没有任何调用点**（仅 L179 有一行注释掉的旧调用）。无论它们是否为作者预留的备用桥接（直连 PythonShell / daemon 子进程两条旧通道），"全项目零调用点"这一事实即意味着删除不影响任何运行路径；且 git 历史可随时找回。

**随之可删的 import**：`python-shell`（`PythonShell/PythonShellError` 仅死代码引用）与 `daemon`（`daemonManager` 实例，仅死代码的 `callPythonMethod` 引用；index.js 自己仍会 import daemon 启动守护进程，删此处 import 无副作用）。

**附带发现**：hipy.js 里大量 `log(...)` 调用没有本地定义，靠 `libs_drpy/drpyInject.js:714` 的 `globalThis.log = console.log` 副作用才工作——属隐式全局依赖（与 JSON5 同类机制、同样能正常工作），本轮将其本地化为 `const log = console.log;`（输出完全等价，零行为差异），消除对加载顺序的脆弱依赖。

### 1.2 为什么 php.js 的 SitesMap 处理叫"空壳"，以及正确的修复定位

1. **空壳实锤**：`libs/php.js:126-131` 是一个**空 if 块**：
   ```js
   let SitesMap = getSitesMap(_config_path);
   if (moduleExt && SitesMap[moduleName]) {
       // ... logic for compressed ext ...
       // Simplified for now, assuming plain string or handled by caller
   }
   ```
   条件成立时什么都不做，只有注释占位。
2. **上游也不会让它成立**：`controllers/config.js` 生成 php 站点时 **ext 恒为 `''`**（php_tasks 内 `let ext = ''`，全段无任何赋值，仅把空串 push 进 sites）。即 `/config` 下发的 php 源永远没有 extend，`moduleExt && SitesMap[moduleName]` **永假**——这段代码连被触及的机会都没有，还让每次 php init 白白扫一遍 config 目录（getSitesMap 有缓存，但仍是无效开销）。
3. **修复定位（重要）**：因此**不是**"补全 hipy 式 SitesMap 逻辑"（补全等于激活一条从未运行、无真实需求场景的路径，反而制造回归风险），而是**删除空壳与无效调用**，让 `moduleExt` 按现状直接透传给源 `init`。行为与今天完全等价。若未来 php 生态真需要 ext 模板源，届时按真实需求重新设计（评估文档 E3 已改为该定位）。

---

## 2. 兼容性红线（全程遵守）

| 红线 | 说明 |
|------|------|
| 存量源返回格式不变 | hipy 3/4 元组返回、`[302,...,{Location}]` 老写法、ds/cat proxy_rule 全部语义保持原样 |
| toBytes 存量语义不变 | `1`=base64 转字节、`2`=302→mediaProxy 的现有分支一字不动，只**新增** `3` |
| 鉴权行为不变 | validatePwd/validateBasicAuth 的放行逻辑、各路由现状不动（用户确认 1.1 为有意设计） |
| 默认参数不变 | 所有新增配置（BRIDGE_TIMEOUT 等）**默认值 = 现状值**，不配置 = 行为零变化 |
| daemon 协议不变 | bridge 的 4 字节长度前缀 + pickle 帧格式不动；超时/上限仅从硬编码改为"env 可覆写" |
| 每批一提交 | 每个批次独立 git commit（中文提交信息），可单独审阅/单独 revert |
| 提交门槛 | 每批 `npm test && npm run check` 全绿 + 冒烟通过才进下一批 |

---

## 3. 批次明细

### 批次 1：hipy.js 死代码清理（评估文档 E1/E2）

**文件**：`libs/hipy.js`

1. 删除 `callPythonMethodOld`（L41-105）与 `callPythonMethod`（L107-168）两个死函数；
2. 删除随之失效的 import：`python-shell`（PythonShell/PythonShellError）、`../utils/daemonManager.js`（daemon）；
3. 删除死变量 `ruleObjectCache`（L14）；
4. 文件顶部新增 `const log = console.log;`（替代隐式 globalThis.log 依赖，输出等价）；
5. 其余逻辑（moduleCache 的 hash+proxyUrl 双校验、getRule/各方法、netCallPythonMethod 调用）**一行不动**。

**兼容性论证**：删除的代码全项目零调用点（见 1.1 勘误后的判定依据），保留路径零改动。**`python-shell` 依赖必须保留**（复核确认：`utils/daemonManager.js:11,224` 用 `new PythonShell(...)` 启动 t4 守护进程，是核心路径；`isPythonAvailable` 版本检测走 exec 与该依赖无关），本批次只删 hipy.js 文件内的 import，不动 package.json。
**验证**：`npm run check`；启动服务访问任一 hipy 源（如 `/api/哔哩哔哩?do=py`，pwd 按需）home 正常返回；`/proxy/哔哩哔哩?do=py&...` 不 500。

### 批次 2：php.js 修复（E3/E5 + 基类默认值）

**文件**：`libs/php.js`、`spider/php/lib/spider.php`、`utils/with-timeout.js`

1. php.js：删除空壳 SitesMap 段（L126-131）及仅为其存在的 `getSitesMap` import、`_config_path` 常量（已核实二者在 php.js 内仅此一处引用；`__dirname` 因 `_bridge_path` 仍在用而保留）；`moduleExt` 保持直接透传给 `init`；
2. php.js：`callPhpMethod` 的 execFile 选项增加 `timeout`：
   ```js
   timeout: (parseInt(process.env.API_TIMEOUT || '20') + 5) * 1000,  // 比 Node 侧 withTimeout 多 5s 宽限
   killSignal: 'SIGTERM',
   ```
3. **`utils/with-timeout.js` 输家加固**（为第 2 项铺路，按"改共享函数收敛"原则一处修复全部调用点）：race 前给业务 promise 挂 noop 分支 `promise.catch(() => {})`。原因：execFile 加 timeout 后，php 进程被 kill 会使 `execFileAsync` reject；若此时 Node 侧 `withTimeout`（20s）已先超时放弃，该 rejection 成为 race 输家 → 触发 unhandledRejection。现状 `index.js:129` 有进程级兜底（不崩溃）但每条超时都会打一条"未处理的Promise拒绝"错误日志；加固后输家错误静默（超时放弃本就意味着不再关心输家结果），惠及全部 20+ 个 withTimeout 调用点（api.js 各接口的 bridge 输家同理受益）。`timeoutMs<=0` 透传路径无 race、不受影响。
4. php.js：删除 env 里的 `PYTHONIOENCODING`（复制粘贴痕迹，php 无关）；
5. `spider/php/lib/spider.php`：`localProxy` 默认返回 `null` 改为 `[404, 'text/plain', 'not found']`。

**兼容性论证**：
- 空壳段永假（见 1.2），删除等价；
- timeout 只影响"本来就超时失败"的场景：现状 Node 侧 20s 先放弃、php 进程继续跑完（孤儿）；改后 php 进程 25s 被杀。正常请求（<20s）零差异；孤儿进程被清理属收益非回归；
- `localProxy` 默认值：已 grep 确认 `spider/php/*.php` 无任何源 override localProxy，基类默认值改动触达为零；且改后把 `/proxy` 对 php 源空代理的 500（`backRespList[0]` 空指针）变为正常 404，更合理；
- with-timeout 输家加固：不改赢/输家判定与超时错误抛出路径，仅让"已被超时放弃的输家"的后续 rejection 不再触发 unhandledRejection 日志；`timeoutMs<=0` 不限时路径原样透传，无行为变化；现有 `tests/unit/with-timeout.test.js` 5 个用例需保持全绿，并补 1 个"输家 reject 不产生 unhandledRejection"的用例。
**验证**：`npm run check`；php 可用环境下访问任一 php 源 home 正常；`/proxy/某php源?do=php` 返回 404 JSON 而非 500。

### 批次 3：bridge/daemon 超时与上限配置化（E6）

**文件**：`spider/py/core/bridge.js`、`spider/py/core/t4_daemon.py`、`spider/py/core/t4_daemon_lite.py`、`docs/envdoc.md`

| 常量 | 现状 | 改为 |
|------|------|------|
| bridge.js `MAX_MSG_SIZE` | 硬编码 10MB | `Number(process.env.BRIDGE_PACKET_MAX) \|\| 10*1024*1024` |
| bridge.js `TIMEOUT` | 硬编码 30000ms | `Number(process.env.BRIDGE_TIMEOUT) \|\| 30000` |
| t4_daemon.py `MAX_MSG_SIZE` | 硬编码 60MB | `int(os.environ.get('BRIDGE_PACKET_MAX', 60*1024*1024))` |
| t4_daemon.py `REQUEST_TIMEOUT` | 硬编码 30s | `int(os.environ.get('BRIDGE_TIMEOUT', 30000)) / 1000` |
| t4_daemon_lite.py 同两项 | 10MB / 30s | 同模式，默认值各自保持现状（10MB/30s） |

环境变量透传已确认可行：`utils/daemonManager.js:213-216` 以 `env: {...process.env}` 启动守护进程，python 侧直接读 `os.environ` 即可，daemonManager 零改动。

**兼容性论证**：所有默认值 = 现状值，不配置环境变量时**行为逐字节等价**；lite/full 的默认上限差异也原样保留。仅新增"可覆写"能力。
**验证**：`npm test`（现有测试全绿）；启动服务后 py 源正常工作；`BRIDGE_TIMEOUT=5000 yarn dev` 冒烟确认覆写生效后恢复。

### 批次 4：源模块缓存统一（E2 残留 + M3）

**文件**：`libs/hipy.js`、`libs/php.js`、`libs/xbpq.js`

1. 三处 `const moduleCache = new Map()` 统一替换为 `lru-cache` 的 `LRUCache`（对齐 `libs/catvod.js:6,14` 既有用法，依赖已在依赖树中）：
   ```js
   import {LRUCache} from 'lru-cache';
   const moduleCache = new LRUCache({max: 200, ttl: 600000});  // 200 个源 / 10 分钟
   ```
2. `get/set` 改为 `moduleCache.get(key)` / `moduleCache.set(key, value)`——LRUCache 的 get/set 与 Map 同签名，命中判断 `has()` 同名，调用点改动极小；
3. `utils/chunk.js` 的手写 LRU **保留不动**（有上限、有注释、带"命中移位"业务语义，换实现无收益）。

**兼容性论证**：LRU 淘汰的后果仅是"该源下次调用重新 init 一次"（与 refresh 等价路径），功能等价；max=200 覆盖当前 py(~60)+php(~15)+xbpq(~30) 单引擎存量上限，正常不会触发淘汰；catvod.js 同模式已在线上运行。hipy 缓存 value 中的 proxy 方法对象无句柄，淘汰即回收，无泄露。**API 兼容已核实**：三处调用点均为 `has/get/set` 三件套（`hipy.js:219-238`、`php.js:135-155`、`xbpq.js:75-89`），与 LRUCache 同名兼容；TTL 过期后 `has()` 返回 false 走重新 init 分支，等价于缓存 miss，语义无变化。
**验证**：`npm test && npm run check`；连续访问 3 个不同 py 源 + 重复访问同一源（第二次应命中缓存、耗时明显更短）。

### 批次 5：代理优化方案A（长视频落地：服务端通路 + 源侧辅助方法）

#### 5.0 长视频三类场景与通路（本批次解决什么）

localProxy 代理长视频（数 GB / 1 小时+）按源的能力分三类，通路与达成情况：

| 场景 | 特征 | 通路 | 方案A后 |
|------|------|------|---------|
| C1 直链大文件 | mp4/HLS 直链，可能带防盗链 header（UA/Referer/Cookie） | localProxy 只算 URL+headers，返回 `[..., mediaProxy地址, headers, 2或3]`，数据面由 mediaProxy 原生 pipe | ✅ 达成 |
| C2 m3u8 改写 | manifest（KB 级文本）需 python/php 改写；分片（单个 2-10MB）逐个取流 | manifest 改写留在源侧（文本量不触 10MB/20s 上限）；**分片出口从"播放器直连/回环 localProxy"改为拼 mediaProxy 地址** | ✅ 达成 |
| C3 源必须逐块变换 | 加密流需会话密钥解密、每 chunk 动态签名 | 需方案B daemon relay | ❌ 不在本轮；此类存量源行为不变（仍走全量回传上限），不回归 |

> 存量问题对照：`AppGet.py` 的 `Mproxy` 把嵌套 m3u8 拼回 `t4_api`（回环 localProxy 改写，文本小，可保留）；但 TS 分片是补全域名后**播放器直连上游**——自定义 header 全丢，防盗链站 403。C2 的修复就是把分片出口换成 mediaProxy 地址（服务端带 header 拉流）。`AppHs.py` 的 `[302,...,{Location}]` 直跳上游是同一问题的另一形态。

#### 5a 服务端通路（A2 能力注入 + A3 toBytes=3）

**文件**：`controllers/api.js`、`controllers/mediaProxy.js`

**A2 能力注入**（`api.js` `/proxy/:module/*` 路由，L475-496 附近）：

```js
// 在 fastify.log.info(try proxy...) 之后、apiEngine.proxy 调用之前：
query.__range = request.headers.range || '';      // 客户端 Range 头
query.__mediaProxy = env.mediaProxyUrl;           // 服务端流式代理基址（py/php 源此前拿不到）
```

- 影响面：四个引擎的 proxy params 都会多这两个保留字段；ds（proxyParse 只读 `params.url`）、cat（源不读即无感）、xbpq（同）均无行为变化；双下划线前缀声明为框架保留字，文档注明。

**A3 toBytes=3**：

1. `mediaProxy.js` 顶层 `proxyStreamMedia`（L282）加 `export`（纯导出，函数体不动）；
2. `api.js` 响应分支在 toBytes=2 之后新增：

```js
// toBytes=3：服务端内联流式 pipe（不 302，规避播放器跳转丢 header / 不支持 302 的客户端）
else if (toBytes === 3 && content.startsWith('http')) {
    return await proxyStreamMedia(content, headers || {}, request, reply, 0);
}
```

3. `api.js` 顶部 `import {proxyStreamMedia} from './mediaProxy.js'`（模块单例复用，不会重复注册路由）。

#### 5b py 基类辅助方法（源侧一行接入）

**文件**：`spider/py/base/spider.py`（新增两个方法，不改任何现有方法）

```python
def proxy_media_url(self, url, headers=None, base=''):
    """把媒体直链包装为服务端 mediaProxy 流式地址（长视频/大文件专用，C1/C2 通用）。
    base 缺省时回退 url 原样返回（未注入 __mediaProxy 的旧环境优雅降级为直连）。"""
    base = base or getattr(self, '_media_proxy_base', '')
    if not base:
        return url
    qs = f"?url={self.e64(url)}&form=base64&stream=1"       # stream=1 纯 pipe，起播最快
    if headers:
        qs += f"&header={self.e64(json.dumps(headers, ensure_ascii=False))}"
    return f"{base}{qs}"

def rewrite_m3u8_to_proxy(self, m3u8_text, m3u8_url, headers=None, base=''):
    """m3u8 文本改写：逐行补全相对 URL 后包装为 mediaProxy 流式地址（C2 专用）。
    # 开头的标签行原样保留；逻辑与存量源（AppGet.localProxy）一致，仅替换分片出口。"""
    lines = []
    last_r = m3u8_url[:m3u8_url.rfind('/')]
    for line in m3u8_text.strip().split('\n'):
        line = line.strip()
        if not line or line.startswith('#'):
            lines.append(line)
            continue
        if 'http' not in line:
            line = (last_r if line.count('/') < 2
                    else m3u8_url.split('/')[0] + '//' + m3u8_url.split('/')[2]) + \
                   ('' if line.startswith('/') else '/') + line
        lines.append(self.proxy_media_url(line, headers, base))
    return '\n'.join(lines)
```

源侧用法（localProxy 三个典型写法，全部 ≤5 行）：

```python
def localProxy(self, params):
    base = params.get('__mediaProxy', '')
    # C1 直链大文件：服务端 302 到 mediaProxy（推荐，HTTP 语义最简单）
    return [302, "text/html", self.proxy_media_url(self.d64(params['url']), self.play_headers, base), {}, 2]
    # C1 变体：客户端不跟随 302 时用内联流式
    # return [200, "video/mp4", self.proxy_media_url(url, headers, base), {}, 3]
    # C2 m3u8 改写：manifest 在 python 改，分片走 mediaProxy
    # text = self.fetch(m3u8_url, headers=self.play_headers).text
    # return [200, "application/vnd.apple.mpegurl", self.rewrite_m3u8_to_proxy(text, m3u8_url, self.play_headers, base)]
```

#### 5c php 基类辅助方法

**文件**：`spider/php/lib/spider.php`（新增方法 + 批次 2 的 localProxy 默认值）

```php
public function proxyMediaUrl($url, array $headers = [], $base = '') {
    if (!$base) return $url;                       // 未注入时降级直连
    $qs = '?url=' . urlencode(base64_encode($url)) . '&form=base64&stream=1';
    if ($headers) $qs .= '&header=' . urlencode(base64_encode(json_encode($headers, JSON_UNESCAPED_UNICODE)));
    return $base . $qs;
}
```

#### 批次 5 兼容性与验证

**兼容性论证**：
- 存量源不可能返回 toBytes=3 → 新分支对存量流量**不可达**，零回归面；toBytes=1/2 原分支一字不动；
- 基类新增方法对存量源零影响（不调用即不存在）；`proxy_media_url` 在 `__mediaProxy` 未注入（旧客户端/旧路由场景）时原样返回 url，**优雅降级不报错**；
- `proxyStreamMedia` 本身就是 `/mediaProxy?stream=1` 的线上实现（Range 透传、206、8MB 预读、60s 空闲语义），只复用不改造；
- 流式 pipe 发生在 `withTimeout`（20s，只包"拿到五元组"）**之后**，长播不受 API_TIMEOUT 约束；GB 级文件全程 pipe，内存 O(1)；
- 存量 `AppGet`/`AppHs` 等源**不需要任何改动**即可继续工作（老写法保持），仅当作者想修复丢 header 问题时按 5b 模板迁移。

**验证**：
1. `tests/unit/proxy-stream.test.js`：本地 http 桩吐 1GB 顺序字节流 → 断言 `curl -r` 三个 Range 区间字节一致、峰值 heap 增量 <100MB、客户端断连后桩连接归零、timer 无泄露（沿用 `tests/helpers/timers.js`）；
2. 基类辅助方法单测：`rewrite_m3u8_to_proxy` 对相对/绝对/嵌套 m3u8 行为对拍（零依赖，纯函数）；
3. 冒烟：临时 hipy 测试源返回 `[200,'video/mp4','http://127.0.0.1:<桩>/file',{},3]` 与 C2 模板 m3u8 源，播放器/curl 实播校验。

### 批次 6：console.log 收口（M1，分 3 小批）

**新增**：`utils/log.js`

```js
import util from 'util';
import {fastify} from '../controllers/fastlogger.js';

// 语义等价 console.log 的格式化（util.format 即 console.log 的格式化引擎），输出进 fastlogger 统一治理
export const log = (...args) => fastify.log.info(util.format(...args));
export const logWarn = (...args) => fastify.log.warn(util.format(...args));
export const logError = (...args) => fastify.log.error(util.format(...args));
```

依赖方向安全：fastlogger 仅依赖第三方包（无 utils/controllers 反向依赖），且 `utils/env.js`、`libs/*.js` 已有 import fastlogger 先例。

**替换策略**（现状 `console.log` 共约 391 处）：

| 小批 | 范围 | 数量级 |
|------|------|--------|
| 6a | 代理/播放 hot path：`controllers/mediaProxy.js`(24)、`utils/proxy-util.js`(4)、`controllers/api.js`(4)、`libs/hipy.js`、`controllers/m3u8-proxy.js`、`controllers/unified-proxy.js` 等 | ~60 |
| 6b | 其余 controllers/ + utils/ | ~150 |
| 6c | libs/ + libs_drpy/ + index.js | ~180 |

- 规则：`console.log(`→`log(`、`console.error(`→`logError(`、`console.warn(`→`logWarn(`，逐文件加 import；用一次性 codemod 脚本（`scripts/codemod-console.js`，跑完可删）+ 人工抽查；
- **误伤防护**：codemod 按文件逐个执行，替换后 `git diff` 抽查 + 全局 `grep -rn "console\.log" controllers/ utils/ libs/ libs_drpy/` 清零核对，防止字符串字面量内的 "console.log(" 被误改（`npm run check` 兜底语法）；
- **例外保留**：`spider/` 源码沙箱内与 `spider/py/core/*.py` 不在范围（python 侧 log 另有去处）；`docs/`、测试文件不动；无例外白名单文件——启动横幅也统一收口（fastlogger 在模块加载即创建实例，启动早期调用安全，且 `onReady` 时的 `🚀 Server started` 输出时 fastify 早已就绪）。

**兼容性论证**：`util.format` 与 console.log 是同一格式化引擎，文本输出等价；差异仅是日志同时进 rotating file（治理目标本身）；无任何业务逻辑消费 console 输出（已核查，桥接/子进程读的是 stdout 的**协议数据**，均来自 python/php 进程，与 Node 侧 console 无关）。
**验证**：每小批后 `npm run check`（119 文件语法）+ `npm test` + 冒烟（`/config`、home、代理）；最终人工抽查日志文件轮转正常。

### 批次 7：文档收尾（M2 + 评估文档状态回写）

1. `docs/t4api.md` 新增「代理接口与 toBytes 协议」章节：五元组语义表（含新增的 3）、**长视频三类场景（C1 直链 / C2 m3u8 改写 / C3 逐块变换）指引与源侧模板**（引用批次 5b/5c 基类辅助方法）、ds/cat/py/php 四生态示例、`__range`/`__mediaProxy` 注入说明、302 直跳上游的反模式提示；
2. `spider/py/base_spider.py` 的 `localProxy`（L325）：**只加注释块**说明 toBytes 协议与推荐写法，demo 返回值一字不动（所有未 override 的 py 源都靠这个 demo 返回，改值即回归）；
3. `docs/issues-and-proxy-design.md` 头部回写实施状态：1.1 标注"经确认属有意设计，不做修改"；E3 定位修订为"清理空壳"（见本文档 1.2）；
4. `docs/envdoc.md` 登记 `BRIDGE_TIMEOUT`、`BRIDGE_PACKET_MAX`。

**验证**：文档批次无代码影响，`npm test` 照跑即可。

---

## 4. 总验证矩阵与回滚

| 里程碑 | 必过项 | 冒烟项 |
|--------|--------|--------|
| 每批次提交前 | `npm test`（45+ 用例）&& `npm run check`（119 文件语法） | 服务启动无异常栈 |
| 批次 1/2 后 | 同上 | hipy 源 home/play；php 源 home；`/proxy` 空代理 404 |
| 批次 3 后 | 同上 | py 源全链路（bridge 参数未变时行为等价） |
| 批次 4 后 | 同上 | 同源二次访问命中缓存（日志无重复 Loading module） |
| 批次 5 后 | 同上 + 新增 proxy-stream 单测 + 基类辅助方法单测 | curl Range 校验 206；临时 toBytes=3 源可播；C2 模板 m3u8 源分片经 mediaProxy 出流 |
| 批次 6 各小批后 | 同上 | `/config`、home、代理三链路 + 日志文件有输出 |

**回滚方式**：每批独立 commit，出问题 `git revert <该批 commit>` 即可，批间无耦合（批次 5 依赖批次 1/2 的 import 清理已合入，但功能本身独立可 revert）。

## 5. 明确不做清单

| 项 | 理由 |
|----|------|
| 1.1 安全鉴权全部（S1-S6） | 用户确认为有意设计 |
| E7 pickle 替换 | 随方案 B（P2）一起做，本轮不动 daemon 协议 |
| 方案 B/C（daemon relay、php stdout 流） | P2 范围，待方案 A 上线观察后另立开工文档；期间 C3 场景（加密流/逐块签名）的存量源保持现状行为（全量回传上限内），**不回归也不承诺达成**，见批次 5.0 场景表 |
| php 常驻 worker（E4 长期解法） | 架构级改动，另立项 |
| `utils/chunk.js` 手写 LRU 替换 | 有上限有注释，行为正确，无收益不动 |
| R1-R3 平台事实（new Promise 崩溃、Node 版本窗口、Windows 编码） | 存量已知，文档已记载 |

---

## 6. 二审复查记录（2026-08-30，应用户要求全面复核改动点安全性）

| 复查点 | 结论 | 文档动作 |
|--------|------|---------|
| `python-shell` 依赖是否还在用 | **在用，且是核心路径**：`utils/daemonManager.js:11,224` 用 `new PythonShell(...)` 启动 t4 守护进程；`isPythonAvailable` 版本检测走 exec（与该依赖无关）。hipy.js 内的 4 处引用（L7/L56/L94/L137）全部位于死代码段 | 批次 1 论证改为"依赖必须保留，只删文件内 import"；评估文档 E1 同步修正（原"评估卸载依赖"表述有误） |
| JSON5 全局注入 | 存在：`drpyCustom.js:9` → `libs_drpy/_dist/json5.js`（UMD 挂 globalThis），启动必经；v1/main 三相关文件零差异 | 1.1 节已勘误（上一轮） |
| execFile 加 timeout 的次生风险 | php 被 kill → `execFileAsync` reject → 若 Node 侧 20s 已先放弃则成为 race 输家 → unhandledRejection（有 `index.js:129` 进程级兜底不会崩溃，但每条超时打一条错误日志） | 批次 2 新增第 3 项：with-timeout.js 输家 noop 加固，一处修复覆盖全部 20+ 调用点，并补 1 个测试用例 |
| LRUCache 与三处 moduleCache 的 API 兼容 | 三处调用点均为 `has/get/set` 三件套（hipy:219-238 / php:135-155 / xbpq:75-89），与 lru-cache 同名兼容；TTL 过期等价缓存 miss | 批次 4 论证补充核实结论 |
| php.js 删 `_config_path` 的连带影响 | 仅 L127 一处引用；`__dirname` 因 `_bridge_path`（L19）仍在用而保留 | 批次 2 第 1 项已注明 |
| py 基类辅助方法的依赖 | `base/spider.py` L10 已 `import json`，`e64/base64Encode` 基类已有，无新增依赖 | 批次 5b 无需额外 import |
| toBytes=3 分支与 fastify 响应语义 | `proxyStreamMedia` 全函数自带 try/catch（内部处理错误、不向外抛），与 api.js 现有 catch 无双写响应冲突；`/mediaProxy?stream=1` 同模式已在线上 | 批次 5a 维持"只导出不改造" |
| withTimeout 与流式 pipe 的边界 | 流式发生在 `withTimeout`（只包"取五元组"）之后，长播不受 20s 约束 | 批次 5.0/5a 已写明 |
| codemod 字符串误伤风险 | 存在低概率（文案里含 "console.log(" ） | 批次 6 补"替换后 grep 清零核对 + git diff 抽查" |
| race 输家 reject 的现状面 | **存量已存在**（bridge 30s reject 晚于 Node 20s 超时的场景同理），本次加固属于顺带收敛的存量问题，非批次 2 新引入 | 同批次 2 第 3 项 |
