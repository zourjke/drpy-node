# drpy-node 项目问题全面评估 与 hipy/php T4 代理流式化设计

> 日期：2026-08-30
> 范围：框架层自有代码（不含 drpy-node-admin / drpy-node-mcp 子项目）
> 性质：设计文档（已按 `docs/kickoff-impl-plan.md` 完成实施，见下方状态）
> 关联文档：`docs/refactor-plan.md`（重构与内存泄露治理，已完成）、`docs/t4api.md`（T4 接口文档）、`docs/issue.md`（历史问题）
>
> **实施状态（2026-08-30，v2.0.1）**：
> - 1.1 安全与鉴权（S1-S6）：经项目作者确认**均为有意设计，不做修改**；
> - 1.2/1.4 修复与收口（E1-E6、M1-M3）：已完成（E7 pickle 替换随方案B另立项）；
> - 第 3 章方案 A（A1 契约文档 / A2 能力注入 `__range`、`__mediaProxy` / A3 toBytes=3 内联流式 / py·php 基类辅助方法）：已完成，协议文档见 `docs/t4api.md`；
> - 方案 B/C（daemon relay、php stdout 流）：未实施，待方案 A 上线观察后另立项；
> - E3 定位修订：php.js SitesMap 空壳按"清理"处理（上游 config.js 对 php 源 ext 恒为空，补全逻辑反而引入未测试路径）。

---

## 0. 结论摘要（TL;DR）

1. **hipy/php 源无法代理大文件的根因是架构性的，不是参数性的**：二者的 `proxy`（py 侧 `localProxy` / php 侧 `localProxy`）走「子进程 RPC + 全量缓冲 + 单包回传」模型，数据链路上存在三层硬上限（Node 侧 20s 超时 / bridge 10MB 单包 / python 守护进程 30s socket 超时），且整个响应体要经历 `python requests 缓冲 → pickle 序列化 → TCP → Node 反序列化 → reply.send` 的多次全量内存拷贝。把上限调到几个 GB 等于把整个文件堆进内存，方向就是错的。
2. **ds/cat 源"代理什么都没问题"的本质**：`proxy_rule` 在 Node 进程内原生执行，源只返回**轻量描述**（URL + headers + toBytes 语义），重量级数据由服务端原生流式组件承接——`toBytes=2` 时 302 重定向到 `/mediaProxy`，由 mediaProxy 直接 `pipe` 转发上游流，天然支持 Range/206、GB 级体积、1 小时以上时长。**hipy/php 的优化方向就是把这条"决策面/数据面分离"的通路对齐过来，而不是修补 RPC 通道本身。**
3. 推荐分三期实施：
   - **方案 A（P1，收益最大、改动最小）**：把 ds 已有的 `toBytes` 返回契约作为跨引擎统一协议写进文档并注入源所需能力（Range 头、mediaProxyUrl），新增 `toBytes=3`（服务端内联流式 pipe，不 302，防播放器跳转丢 header）。做完 A，hipy/php 即可代理 GB 级、1 小时+媒体。
   - **方案 B（P2，兜底少数场景）**：python 守护进程内置 127.0.0.1 本地流式回源 relay，供"必须由 Python 逐块变换数据"（加密流/动态签名）的场景，HTTP 语义透传、天然背压。
   - **方案 C（P2 可选）**：php 桥接增加 stdout 流式模式（`spawn` 直通管道），让 php 源也能原地吐流。
4. 全面评估另发现 5 项安全/鉴权类问题（`/mediaProxy` 等代理路由完全无鉴权、`/proxy` 与 `/api` 鉴权不一致、57575 端口 `/ws` 实时日志无鉴权等）、7 项 hipy/php 引擎工程质量问题（含 hipy.js 约 128 行死代码、php 每请求 spawn 进程导致登录态丢失、超时孤儿进程等），详见第 1 章。

---

## 1. 项目明显问题全面评估

> 分级说明：🔴 高（安全/正确性）、🟡 中（可靠性/性能）、🔵 低（可维护性）。

### 1.1 安全与鉴权

全局 `preHandler` hook（`index.js:75-105`）只覆盖：`/apps/`、`/api/admin/`（Basic Auth）、`/js/`、`/py/`（pwd）、`/lx`、`/music`（Basic Auth）。**其余所有路由不在全局鉴权范围内**；且 `validatePwd` / `validateBasicAuth` 在未配置对应环境变量时直接放行（`utils/api_validate.js:63-67`、`:11-15`），即默认全开放。

| # | 级别 | 问题 | 位置 | 说明与建议 |
|---|------|------|------|-----------|
| S1 | 🔴 | `/mediaProxy?url=<任意URL>` 是完全无鉴权的通用 HTTP 代理 | `controllers/mediaProxy.js:79` | 可被用作 SSRF 跳板（探测内网、借服务器出口流量）。`/hgProxy`（`mediaProxy.js:165`）同理。建议：支持 HMAC 时效签名（token 由源侧 proxyUrl 拼接时下发），或至少提供 `media_proxy_token` 环境变量开关。播放器不支持 Basic Auth，所以**不能用 HTTP Basic**，要用 URL 签名。 |
| S2 | 🔴 | `/proxy/:module/*` 无 `validatePwd`，而 `/api/:module` 有 | `controllers/api.js:444` vs `:164` | 未授权者可直接触发各源的 proxy 逻辑。两套路由鉴权不一致，属漏配。补 `preHandler: validatePwd` 即可，但要注意播放器访问代理 URL 时需要带上 pwd（与 `/api` 同策略）。 |
| S3 | 🔴 | `/parse/:jx` 无鉴权 | `controllers/api.js:574` | 未授权调用解析脚本（脚本会向任意 URL 发请求并可执行 jx/ 目录内代码逻辑）。 |
| S4 | 🔴 | 57575 端口 `/ws` 实时日志 WebSocket 无鉴权 | `controllers/websocket.js:134` | 任何能访问该端口的客户端可订阅全部服务日志（含源地址、错误堆栈、可能的密钥参数）。同文件 `/ws/status`、`/ws/broadcast` 反而有 BasicAuth（`:229`、`:242`），鉴权策略自相矛盾。 |
| S5 | 🟡 | webdav/ftp/captcha/lx/file-proxy/m3u8-proxy/unified-proxy 全部无鉴权 | `controllers/webdav-proxy.js`、`ftp-proxy.js` 等（全部路由无 preHandler） | 其中 `/webdav/file`、`/ftp/list` 可读取服务器本地已配置的网盘/FTP 内容，风险高于纯转发类。建议按「本地回环放行 + 远程需签名」分级。 |
| S6 | 🟡 | 默认开放无提示 | `utils/api_validate.js` | 未配置 `API_PWD`/`API_AUTH_NAME` 时静默放行。建议启动日志打印一行安全提示（当前鉴权状态摘要），成本一行代码。 |

> 说明：这类端点是"功能即代理"的设计（播放器只会裸 GET），S1/S5 的落地建议统一走 **URL 签名**方案：服务端持有密钥，源侧拼代理 URL 时由框架附带 `&sign=xxx&expires=xxx`，代理路由校验。可作为独立小改动排期，不在本设计的代理流式化主线内。

### 1.2 hipy/php 引擎工程质量

| # | 级别 | 问题 | 位置 | 说明与建议 |
|---|------|------|------|-----------|
| E1 | 🟡 | hipy.js 约 128 行死代码 | `libs/hipy.js:41-168` | `callPythonMethodOld`（PythonShell 整段）与 `callPythonMethod` 均未被调用，实际走 `netCallPythonMethod`（`:180`）。随之 hipy.js 文件内的 `python-shell` import（`:7`）仅剩死引用，可一并删除；**注意 `python-shell` 依赖本身必须保留**——`utils/daemonManager.js:11,224` 正在使用它启动 Python 守护进程（Python 版本检测 `isPythonAvailable` 用的是 exec，与该依赖无关）。 |
| E2 | 🟡 | hipy.js 死变量 + 无界缓存 | `libs/hipy.js:13-14` | `ruleObjectCache` 声明后从未使用；`moduleCache` 为无界 `Map`（条目小、增长慢，低危），建议与 `libs/catvod.js` 的 LRU 化口径对齐。 |
| E3 | 🔴 | php.js 的 SitesMap/moduleExt 处理是空壳 | `libs/php.js:127-131` | 注释自述 "Simplified for now"，带 ext 的 PHP 源（需要站点参数的模板源）初始化参数会错乱。属于**功能性缺失**而非优化项。 |
| E4 | 🟡 | php 每次调用 spawn 全新进程，Spider 实例无状态延续 | `libs/php.js:55-104`（`execFileAsync` per call） | 需要登录态的 PHP 源**每个接口调用都重新登录**（慢 + 易触发站点风控），这是 php 源"不稳定"的直接来源之一。python 侧守护进程缓存实例（`t4_daemon.py` `MAX_CACHED_INSTANCES=100`）无此问题。长期方向：php 也走常驻 worker（见 3.5），短期至少在文档中明示该约束。 |
| E5 | 🟡 | php 调用超时后进程孤儿化 | `libs/php.js:76-84`（execFile 未设 `timeout`） | Node 侧 `withTimeout`（默认 20s）只放弃等待，**php 进程本身会继续跑完整个抓取**。每次播放超时都可能遗留一个孤儿 php 进程。修复：`execFileAsync` 传 `timeout` 并监听 kill，或 Node 侧超时后 `child.kill()`。另 `:81` 的 `PYTHONIOENCODING` 是复制粘贴痕迹。 |
| E6 | 🟡 | bridge/daemon/路由三层超时与上限不一致 | `spider/py/core/bridge.js:6-7`（10MB/30s）、`t4_daemon.py:51-54`（60MB/30s/INIT 100s）、`t4_daemon_lite.py:39`（10MB）、`controllers/api.js:117-134`（API_TIMEOUT 默认 20s） | 有效上限 = min(20s, 30s) + 10MB；且 `daemonMode` 切 lite/full 后单包上限行为不同（10MB vs 60MB）。应统一为一处配置（环境变量）+ 文档声明。 |
| E7 | 🔵 | pickle 作为跨语言序列化的健壮性 | `spider/py/core/bridge.js`（pickleparser 0.2.1） | `pickleparser` npm 包低维护，Python pickle 协议演进存在兼容风险。方案 B 落地时建议新通道直接用 length-prefix JSON，pickle 仅保留兼容旧通道。 |

### 1.3 可靠性与跨平台（存量已知，此处仅登记）

| # | 级别 | 问题 | 说明 |
|---|------|------|------|
| R1 | 🟡 | 源里 `new Promise(...)` 内部异常会崩进程 | 已在 README/AGENTS.md 记载；进程级 `uncaughtException` 兜底不退出，但写源规范仍需规避。 |
| R2 | 🟡 | Node 版本窗口窄（>17 <24） | `node:sqlite` 需 flag；跨发行版包（package.py）需持续跟进。 |
| R3 | 🔵 | Windows 直跑 `node index.js` 中文乱码 | 用 `yarn dev`（chcp 65001）。 |
| R4 | 🟡 | `json2str` 双重序列化放大传输体积 | `t4_daemon.py:700-704` 对结果先 `json.dumps` 再 pickle；Node 侧再 `JSON.parse`（`libs/hipy.js` `json2Object`）。大 payload 场景 = 3 次全量拷贝 + unicode escape 体积膨胀（中文场景可达 ~2-3 倍）。bytes 结果因 `json.dumps` 抛 TypeError 走 pickle 直通（`_invoke` 的 try/except 兜底），行为正确但属隐式依赖。 |

### 1.4 可维护性

| # | 级别 | 问题 | 说明与建议 |
|---|------|------|-----------|
| M1 | 🔵 | console.log 散落约 391 处（controllers/utils/libs/libs_drpy） | fastlogger 已具备分级日志能力，建议按模块渐进收口，优先 hot path（proxy/搜索）。 |
| M2 | 🟡 | `/proxy` 接口与 toBytes 返回协议完全没有文档 | `docs/t4api.md` 未覆盖。写源作者（尤其 py/php 生态）不知道 `toBytes` 语义，导致大家各写各的全量回传——这正是本设计要补齐的核心（见 3.3）。 |
| M3 | 🔵 | 缓存实现多套并存 | bounded-cache / LRU / 手写 LRU（`utils/chunk.js`）等，`docs/refactor-plan.md` 已登记，不重复展开。 |

---

## 2. hipy/php T4 代理专项分析

### 2.1 四类源的 proxy 链路对照

```
ds   源: /proxy/:module/*?do=ds ──► libs/drpyS.js proxy ──► proxy_rule 在 Node 沙箱内执行（进程内）
cat  源: /proxy/:module/*?do=cat ─► libs/catvod.js proxy ─► 源 JS 在 Node 进程内执行
                          │
                          ▼
            返回 [code, mediaType, content, headers, toBytes]
                          │
        ┌─────────────────┴──────────────────┐
        ▼ toBytes=2 且 content 为 http       ▼ 其余
  302 重定向到 /mediaProxy?...          reply.send(content)（全量内存）
        │
        ▼
  mediaProxy 原生 pipe 流式转发（Range 透传 / 多线程分块 / 磁盘分块）

hipy 源: /proxy/:module/*?do=py ──► libs/hipy.js ──► TCP(127.0.0.1:57570) ──► t4_daemon.py
                                                                    │ localProxy(params)
                                                                    ▼
                                              python requests 全量缓冲 ──► pickle 单包回传 ──► Node
php  源: /proxy/:module/*?do=php ─► libs/php.js ──► spawn php _bridge.php（每请求新进程）
                                                                    │ localProxy($params)
                                                                    ▼
                                              php 全量缓冲 ──► stdout JSON（maxBuffer 10MB）──► Node
```

关键代码位置：

| 环节 | ds/cat | hipy | php |
|------|--------|------|-----|
| proxy 入口 | `controllers/api.js:444` | 同左 | 同左 |
| 引擎分发 | `utils/api_helper.js:66`（`do=ds/cat/py/php`） | 同左 | 同左 |
| 源方法执行 | `libs/drpyS.js:948` + `libs/drpysParser.js:736`（进程内）；`libs/catvod.js:214`（进程内） | `libs/hipy.js:281` → `spider/py/core/bridge.js:28`（TCP RPC） | `libs/php.js:200` → `spider/php/_bridge.php`（spawn） |
| 源侧方法 | `rule.proxy_rule` | `Spider.localProxy`（`t4_daemon.py:97` 方法映射；基类 `spider/py/base_spider.py:325`） | `BaseSpider::localProxy`（`spider/php/lib/spider.php:111`，默认返回 null） |
| 响应分支 | `controllers/api.js:499-557`（toBytes=1 base64 转字节 / toBytes=2 重定向 mediaProxy / 其余全量 send） | 同左（**协议通用，hipy/php 同样可触发 toBytes=2，但无文档、无人用**） | 同左 |

### 2.2 瓶颈定量

以目标场景（几个 GB、1 小时+媒体，即约 2-8 GB、持续 3600s+ 的流）为基准：

| 层 | 限制 | 位置 | 对目标场景的影响 |
|----|------|------|------------------|
| Node 路由超时 | **20s**（`API_TIMEOUT` 默认） | `controllers/api.js:117-134`，`:492-496` 包住 `apiEngine.proxy` | 20 秒后 Node 放弃等待并报 500，**这是最先命中的上限** |
| Node bridge 单包 | **10MB** | `spider/py/core/bridge.js:6`（`MAX_MSG_SIZE`） | 超 10MB 直接 `Invalid packet length` 拒收 |
| python daemon socket 超时 | **30s** | `t4_daemon.py:54`（`REQUEST_TIMEOUT`，`:738` settimeout） | 长传输中途夭折 |
| python daemon 单包 | 60MB（lite 模式 10MB） | `t4_daemon.py:51` / `t4_daemon_lite.py:39` | 即便其他层放开，60MB 也远小于 2GB |
| php stdout 缓冲 | **10MB** | `libs/php.js:78`（`maxBuffer`） | 超限 exec 直接报 `maxBuffer exceeded` |
| 内存模型 | 全量缓冲 ×3~4 次 | python requests 缓冲 → pickle → Node recvBuffer → reply.send | 2GB 文件 = 进程内存爆掉；不炸也把 TTFB 拖到全量下载完成之后 |
| Range 支持 | **无** | `/proxy` 路由只把 `Range` 用于 toBytes=2 重定向（`api.js:522`），不传给 hipy/php 的 params | 源无法感知 Range → 无法做 206 分段 → 播放器 seek 失效 |
| 时长模型 | 请求-响应一次性完成 | RPC 模型固有 | 1 小时的流根本不可能装进一个 20s 的请求 |

> 结论：**任何"调大上限"的组合都无法达成目标**。10GB 全量缓冲是 OOM，30s/20s 超时是架构约束，必须改为流式架构。

### 2.3 hipy/php 代理"不稳定"的根因清单

1. **三层超时相互踩踏**（E6）：Node 20s < bridge 30s < daemon 30s，任一先到即报错，且报错信息（"Python守护进程响应超时" vs "API 操作超时"）无法定位是哪层。
2. **php 无状态**（E4）：每请求新进程，登录态丢失，重复登录易触发风控/验证码，表现为"时好时坏"。
3. **php 孤儿进程**（E5）：超时后 php 进程继续跑，占用连接与内存。
4. **播放器 302 丢 header**：hipy 源目前的主流写法是 `localProxy` 返回 `[302, 'text/html', None, {'Location': url}]`（如 `spider/py/AppHs.py:263-265`），播放器跟随 Location 直连上游时**自定义 UA/Referer/Cookie 全部丢失**，防盗链站点直接 403——这是"hipy 源代理不稳定"在用户侧最常见的表象。ds 源用 `toBytes=2` 重定向到 mediaProxy（headers 编码进 query，由服务端带 header 拉流）规避了此问题。
5. **序列化链路脆弱**（R4/E7）：m3u8 文本 → json.dumps → pickle → JSON.parse 三跳，任何一环的编码问题（GBK、特殊字符）都表现为"偶尔乱码/解析失败"。
6. **m3u8 全量改写在 python 内完成**：如 `spider/py/AppGet.py:196-224` 在 python 里拉整个 m3u8 文本逐行改写。文本量小的时候可行，但每个 TS 分片的后续取流依赖改写后的 URL 结构，一旦 URL 需要服务端参与（签名/防盗链），就掉进 2.2 的全量缓冲陷阱。

### 2.4 ds/cat 为什么没问题（架构对照结论）

- `proxy_rule` 在 Node 进程内执行，**没有 RPC、没有序列化、没有进程生命周期问题**；
- 框架约定的正确用法是：proxy_rule 只做**轻量决策**（算出真实 URL + headers），返回 `toBytes=2` 把数据面交给 mediaProxy 原生 pipe——mediaProxy 已具备 Range 透传（`mediaProxy.js:322-324`）、206 直通（`:339-346`）、8MB 预读缓冲（`:392`）、多线程分块（`proxyStreamMediaMulti`）、磁盘分块（chunkStream）等能力，GB 级、1 小时+ 流媒体场景已被 ds 生态长期验证；
- 因此 hipy/php 的优化不是"把 python/php 变得能扛大流量"，而是**让它们也能把数据面甩给同一套原生流式承接层**。

---

## 3. 优化设计

### 3.1 设计目标与非目标

**目标**

- G1：hipy/php 源可稳定代理数 GB、时长 1 小时+ 的媒体资源（mp4 直链、HLS、需要自定义 header 的防盗链流）。
- G2：播放器 seek（Range/206）全程可用。
- G3：服务端内存占用与媒体体积无关（流式，O(1) 内存）。
- G4：对存量 ds/cat 源**零影响**；对存量 hipy/php 源**向后兼容**（旧返回格式继续可用）。

**非目标**

- 不改造 python/php 沙箱执行模型本身（一级/二级/搜索等仍走现有 RPC）。
- 不在本设计内实施鉴权签名体系（S1-S6 另行排期），但代理数据面的新通路上预留校验钩子。

### 3.2 总体原则：决策面 / 数据面分离

```
决策面（轻量，可跑在 python/php 里）：
    鉴权、签名、URL 解析、header 构造、m3u8 文本改写
        │  返回 [code, mediaType, content, headers, toBytes]
        ▼
数据面（重量，只跑在 Node 原生流式层）：
    toBytes=2 → 302 → /mediaProxy（客户端直连服务端代理）
    toBytes=3 → 服务端内联 pipe（新增，见 A3）
    toBytes=4 → 守护进程本地 relay 流（新增，见 B）【仅 py】
```

与 ds 生态对齐后，hipy/php 的能力上限 = ds 的能力上限，且共享同一套流式基础设施的后续演进（缓冲调优、分块策略等只改一处）。

### 3.3 方案 A：协议对齐 + 原生流式承接（P1，推荐立即实施）

#### A0 工程前置修复（半天）

1. 删除 `libs/hipy.js:41-168` 死代码与死变量（E1/E2），顺带消除 hot path 的大字符串日志。
2. `libs/php.js` execFile 增加 `timeout`（与 `API_TIMEOUT` 对齐）并 kill 子进程（E5）；删除 `PYTHONIOENCODING`。
3. 三层超时/上限统一为环境变量一处配置（E6）：`BRIDGE_PACKET_MAX`（默认 10MB）、`BRIDGE_TIMEOUT`（默认 30s），并在 `docs/envdoc.md` 登记；api.js 的 `API_TIMEOUT` 文档注明对 proxy 的含义。
4. php `localProxy` 默认返回值从 `null` 改为 `[404, 'text/plain', 'not found']`（`spider/php/lib/spider.php:111`），避免 api.js 空指针 500。

#### A1 代理返回契约 v1（跨引擎统一，纯文档 + 少量服务端补齐）

`localProxy`（py/php）与 `proxy_rule`（ds）统一返回五元组 `[code, mediaType, content, headers, toBytes]`：

| toBytes | content 语义 | 服务端行为 | 适用场景 |
|---------|-------------|-----------|---------|
| 缺省/0 | 文本或 Buffer | `reply.send(content)`（全量，小体积） | m3u8 文本改写、接口 JSON、图片 |
| 1 | base64（可带 `base64,` 前缀） | 解码为 Buffer 后 send | 二进制小对象 |
| 2 | http(s) URL | **302 → `/mediaProxy?url=...&headers=...`**（现状已通用支持，api.js:519-529） | 大文件直链、TS 分片、mp4 —— **主力通道** |
| 3 | http(s) URL | **服务端内联流式 pipe**（新增，见 A3） | 客户端不支持 302 跟随 / 需隐藏 mediaProxy 地址 / 防 302 丢 header |

配套动作：

- `docs/t4api.md` 增加「代理接口与 toBytes 协议」章节（补 M2），给 hipy/php 写源生态一份明确规范；
- `spider/py/base_spider.py` 的 `localProxy` 基类 demo 与 `spider/php/lib/spider.php` 基类注释改为展示 toBytes=2 用法；
- 存量 hipy 源的"302 直跳上游"写法（丢 header 根因）在文档中标记为反模式，给出 toBytes=2 改写示例（非破坏：旧写法继续可用）。

#### A2 能力注入：让 py/php 源"看得见"Range 与 mediaProxyUrl

现状：`/proxy` 路由的 `Range` 头只用于 toBytes=2 重定向拼装（`api.js:522`），不进 params；`env.mediaProxyUrl`（`utils/rule-env.js` 已构建）只传给 ds 沙箱，python daemon 的 `_parse_env` 只取 `proxyUrl`/`ext`，**py/php 源拿不到 mediaProxyUrl**。

设计（服务端约定注入，源侧零成本获取）：

- `api.js` `/proxy` 路由调用 `apiEngine.proxy(modulePath, env, query)` 前，向 `query` 追加两个双下划线保留字段：
  - `query.__range = request.headers.range || ''`（客户端原始 Range 头）
  - `query.__mediaProxy = env.mediaProxyUrl`（服务端流式代理基址）
- py 侧 `localProxy(self, params)` / php 侧 `localProxy($params)` 直接读 `params['__range']`、`params['__mediaProxy']`；
- 双下划线前缀 + 文档声明为框架保留字，避免与业务参数冲突；
- 向后兼容：旧源不读这些字段则完全无感。

源侧写法示例（py，返回 toBytes=2 把 2GB mp4 交给 mediaProxy）：

```python
def localProxy(self, params):
    url = self.d64(params['url'])
    headers = {"User-Agent": self.ua, "Referer": self.host}
    # headers 会被编码进 mediaProxy 的 query，由服务端带 header 拉流，规避 302 丢 header
    mp = params.get('__mediaProxy') or f"{self.t4_api.rsplit('/proxy', 1)[0]}/mediaProxy"
    target = f"{mp}?url={quote(url)}&headers={quote(json.dumps(headers))}"
    return [302, "text/html", target, {}, 2]
```

#### A3 `toBytes=3`：服务端内联流式 pipe

**动机**：部分客户端（老款盒子播放器）不跟随 302，或跟随时不带 Range；且 302 会把 mediaProxy 地址暴露给客户端侧日志。内联模式让客户端始终只面对 `/proxy/...` 一个 URL。

**设计**：

- `api.js` `/proxy` 路由响应分支增加：

```js
else if (toBytes === 3 && content.startsWith('http')) {
    // 复用 mediaProxy 的 proxyStreamMedia：Range 透传 + 上游 headers 直写 + 8MB 预读 pipe
    return await inlineStreamProxy(request, reply, content, headers || {});
}
```

- `controllers/mediaProxy.js` 将 `proxyStreamMedia` 导出为公共函数（或抽到 `utils/proxy-util.js`，与现有流式辅助同居），`/mediaProxy` 路由与 toBytes=3 分支共用同一实现——**数据面只有一个实现体**；
- 降级语义：上游 403/404 时回 502 并带上游状态，便于源侧排查；
- 超时语义：沿用 `proxy-util.js` 的 60s **空闲** watchdog（收不到上游字节才断），总时长不设限——1 小时流媒体天然支持。

**方案 A 完成后的效果**：hipy/php 源在 G1-G4 上与 ds 对齐；改动集中在 `api.js`（+15 行）、`mediaProxy.js`（导出既有函数）、文档与 py/php 基类注释；**不触碰 bridge/daemon 协议**，风险极低。

#### 方案 A 的边界（为什么还需要方案 B）

toBytes=2/3 的前提是源能给出一个**可直接 GET 的最终 URL**。少数场景做不到：

- 加密流：每个 TS 分片需要用会话密钥实时解密（解密逻辑在 python 里）；
- 动态签名：每个 chunk 请求都要 python 重新计算签名参数；
- 非 HTTP 上游协议：python 里实现的私有协议客户端。

这些场景需要"python 参与数据变换的流式通道"，即方案 B。

### 3.4 方案 B：python 守护进程本地流式回源 relay（P2）

**选型说明**：备选有「TCP 分帧流协议」与「本地 HTTP relay」两种。前者要在 bridge.js/t4_daemon 两侧造一套帧协议（meta/data/end/error 帧、背压、粘包处理），Node 侧还要自研解析；后者直接复用 HTTP 的 chunked/Range/断开传播/背压语义，Node 侧用现成的 `fetch`/`pipe`。**选本地 HTTP relay**（ponytail：能用 HTTP 就不造帧协议）。

#### 架构

```
播放器 ──► /proxy/模块?do=py ──► api.js ──► hipy.js ──► bridge(TCP) ──► t4_daemon.py
                                                                          │ localProxy(params)
                                                          返回 [200, mime, "http://127.0.0.1:57571/relay/<token>", headers, 4]
                                                                          │
                            api.js 校验目标为 127.0.0.1 白名单 + toBytes=4
                                                                          │
            播放器 ◄── pipe ── reply.raw ◄── fetch(relayURL) ◄── relay HTTP ◄── python 线程
                                                                          │
                                              spider 数据源（requests stream=True / 解密变换 / 私有协议）
```

#### 协议与生命周期

1. **relay 服务**：daemon 启动时在 `127.0.0.1:57571`（可配）起一个轻量 HTTP 服务（python 标准库 `http.server` 即可），仅绑定回环地址；
2. **触发**：`localProxy` 返回五元组且 `toBytes=4` 时，content 为 relay URL；
3. **Node 侧**：`api.js` 收到 toBytes=4 → 校验 `content` 以 `http://127.0.0.1:` 开头（硬白名单，防 SSRF 借道）→ 用 `undici`/`fetch` 拉取该 relay URL，`stream` pipeline 到 `reply.raw`；
4. **python 侧**：daemon 收到带 `__relay` 标记的 proxy 调用后，在独立线程执行源的流式生成逻辑，将 `iter_content(chunk)` 写入 relay 响应（chunked）；源的返回约定二选一：
   - 源返回生成器/可迭代对象（新基类辅助方法 `self.proxy_stream(gen, mime, headers)` 封装）；
   - 源在 `localProxy` 内自行起线程写 relay（进阶用法，文档给出模板）；
5. **断开传播**：播放器断开 → Node fetch abort → relay 连接断 → python 线程 `iter_content` 抛 `ConnectionError` 退出并清理；反向同理；
6. **背压**：TCP 天然背压——客户端消费慢 → relay socket 写阻塞 → python 侧不再拉取上游；
7. **超时语义**：relay 空闲 60s 无字节即断（与 Node 侧 idle watchdog 一致）；**不设总时长上限**；
8. **资源上限**：并发 relay 流数上限（默认 16，环境变量可配），超出返回 503；token 一次性、60s 未连接自动失效，防端口内被扫。

#### 效果与成本

- 效果：python 参与数据变换的场景也可无限时长流式；内存 O(chunk)；
- 成本：每并发流 1 个 python 线程 + 1 对本地 socket；relay 服务实现约 150-200 行 python + api.js 约 30 行；
- 风险与对策：Windows 上 127.0.0.1 绑定无特殊问题；多网卡/容器内部署不受影响（回环）。

### 3.5 方案 C：php stdout 流式（P2 可选）

php 无守护进程，走"每次 spawn"模型，但流式反而简单：

- `_bridge.php` 增加第 5 个保留参数 `--stream`：此时不走 `echo json_encode` 全量返回，而是把 `localProxy` 返回的 `toBytes=4`（约定同 B）content 当作**上游 URL 或生成器回调**，php 用 `fopen`/`stream_copy_to_stream` 直接向 STDOUT 吐字节；
- `libs/php.js` 对 toBytes=4 的调用改用 `spawn`（而非 `execFile`），把 `child.stdout.pipe(reply.raw)`，`maxBuffer` 限制不复存在；
- 生命周期：`reply.raw.close` → `child.kill()`（顺带修复 E5 的孤儿问题）；
- 局限：php 进程仍是每请求一个（登录态问题依旧，E4 的长期解法是 php 常驻 worker，另行立项，不在本设计展开）。

### 3.6 兼容性与降级矩阵

| 源写法 | 新版 Node | 旧版 Node（降级前） | 说明 |
|--------|----------|--------------------|------|
| hipy：返回 3 元组 `[200, mime, text]` | 正常（全量 send） | 正常 | 不变 |
| hipy：`[302, ..., None, {Location}]` 直跳 | 正常（不变，仍标记为反模式） | 正常 | 不破坏存量 |
| hipy：`[..., url, headers, 2]` | 302 → mediaProxy | **已支持**（api.js 通用分支） | 文档化即可 |
| hipy：`[..., url, headers, 3]` | 内联 pipe | 旧代码按普通字符串把 URL 发给客户端（可见但不可播） | 只在新版生态出现，无存量 |
| hipy：`[..., relayUrl, headers, 4]` | relay pipe | 同上 | 同上 |
| ds/cat 全部写法 | 零改动 | 零改动 | 协议是 ds 已有语义的超集 |

### 3.7 测试与验收

新增 `tests/` 用例（沿用现有 node:test 零依赖体系与 `tests/helpers/timers.js` 泄露断言）：

1. **协议单测**：五元组各 toBytes 分支的 api.js 响应行为（对拍 302 Location 编码、toBytes=3 的 header 透传）；
2. **流式回归**：本地桩服务吐 1GB 顺序字节流，hipy 源以 toBytes=3 代理 → `curl -r` 抽查 3 个 Range 区间字节一致；峰值 heap 增量 < 100MB（O(1) 内存证据）；
3. **长时稳定性**：桩服务限速模拟 1 小时 5Mbps 流（测试时可加速回放），断言无 idle 误杀（有数据流动时不超时）；
4. **断开传播**：客户端中途 abort → 桩服务连接数归零、python 侧线程退出（t4_daemon stats 断言）、无 timer 泄露；
5. **php stdout 流**：同 2/4 的 php 版本；
6. **降级兼容**：旧 3 元组返回在新区块下行为不变。

真实场景验收（手动）：4K 源 + 防盗链站点，播放/seek/暂停 10 分钟/倍速，观察服务端内存曲线平稳。

### 3.8 分期路线图

| 阶段 | 内容 | 改动量 | 前置依赖 |
|------|------|--------|---------|
| P1-A0 | 工程修复（E1/E2/E5/E6、php localProxy 默认值） | ~200 行（多为删除） | 无 |
| P1-A1 | 契约 v1 文档 + py/php 基类注释与示例 | 文档为主 | A0 |
| P1-A2 | `__range`/`__mediaProxy` 能力注入 | ~15 行 | A1 |
| P1-A3 | toBytes=3 内联流式（mediaProxy 公共化） | ~50 行 | A1 |
| P2-B | daemon relay 流式通道 + `self.proxy_stream` 基类辅助 | ~250 行（python 为主） | P1 全部 |
| P2-C | php `--stream` stdout 流式 | ~120 行 | A0 |
| P3 | 鉴权签名体系（S1-S6）、php 常驻 worker | 另行立项 | — |

---

## 4. 附录：涉及文件速查

| 文件 | 角色 |
|------|------|
| `controllers/api.js:444` | `/proxy/:module/*` 路由与五元组响应分支 |
| `controllers/api.js:117-134` | withTimeout 与 API_TIMEOUT |
| `utils/rule-env.js` | env 构建（mediaProxyUrl 等能力字段） |
| `utils/api_helper.js:66` | do=ds/cat/py/php 引擎分发 |
| `libs/hipy.js` | hipy 引擎（死代码清理对象） |
| `libs/php.js` | php 引擎（spawn/execFile） |
| `spider/py/core/bridge.js` | Node→daemon TCP RPC（10MB/30s） |
| `spider/py/core/t4_daemon.py` | python 守护进程（实例缓存/方法映射/localProxy） |
| `spider/py/base_spider.py:325` | `localProxy` 基类（协议示例改造点） |
| `spider/php/_bridge.php`、`spider/php/lib/spider.php:111` | php 桥与 `localProxy` 基类 |
| `controllers/mediaProxy.js` | 原生流式承接层（proxyStreamMedia 等，A3 公共化对象） |
| `utils/proxy-util.js` | 60s 空闲 watchdog 等流式辅助 |
| `docs/t4api.md` | 待补「代理接口与 toBytes 协议」章节 |
