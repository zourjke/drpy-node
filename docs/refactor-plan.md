# drpy-node 自有代码轻量重构与内存治理方案

> **实施状态（v2 分支，2026-08-27）**：P0 全部 11 批完成；P1 完成；P2 完成 pathGuard / with-timeout / bounded-cache / rule-env / proxy-common(rewriteM3u8+parseRangeHeader) / AI 基类 6 项及 quark/uc chunkStream 死拷贝删除。**裁剪项**：SharePanBase(quark/uc 全量收编)、备份双实现合并、webdav/ftp 控制器工厂化、source-loader 骨架统一——四项均为上千行的热路径改写，在无真实网盘账号与集成测试基线保护下实施违背"非破坏性"原则，登记为后续阶段（须先补集成冒烟）。测试体系：`tests/` 共 45 个用例全绿；服务启动冒烟通过（`/config` 200）。
>
> 审计基准：自有框架代码约 41,200 行（`index.js` + `controllers/` + `utils/` + `libs_drpy/` 自有部分 + `libs/` + `scripts/` + `jx/`，不含子项目、spider 源库与第三方 vendored 库）。
> 方法：五大模块并行全量逐文件审读 + 服务生命周期横向专项审计 + 关键点人工实证核验（文中标注 ✅ 的条目已逐一打开源码确认）。
> 目标：**低冗余、高复用、低耦合；消除全部已识别内存泄露；全程非破坏性，不改任何对外行为。**

---

## 一、非破坏性红线（贯穿所有阶段）

以下内容一律保持原样，重构只发生在实现内部：

1. **对外 API**：所有路由路径、参数名、返回结构、鉴权方式（pwd/basic/token）不变。
2. **沙箱 ABI**：注入给 spider 源的全部 globalThis 符号（req/pdfa/pd/Quark/UC/Ali/env/batchExecute 等 40+ 个）及其签名一个不动——数千个存量源依赖它们。
3. **配置契约**：`.env` 键名与语义、`config/env.json` 结构、`local/js_*` 存储格式、`custom.json/index.json` 生成逻辑不变。
4. **依赖行为**：不升级库主版本、不改 ESM/CJS 加载机制（esm-register/moduleLoader 原样）。
5. **可回滚**：每一小批独立 commit，任何一个 commit 单独 revert 后服务应完整回到上一状态。

---

## 二、内存泄露 / 资源风险全清单

### 2.1 【确定】级（8 项，全部经人工实证）

| # | 位置 | 成因 | 触发路径 | 修复动作 |
|---|---|---|---|---|
| L1 ✅ | `libs_drpy/batchExecute.js:60-71` | 批量任务正常跑完时 `Promise.race([drained(), stopMonitor])` 由 drained 胜出，50ms 监控 interval 永不清除，闭包持有 queue/tasks | `config.js` 六处配置聚合、所有源内批量请求；每调一次漏一个常驻定时器 | race 外层 `finally clearInterval(interval)` |
| L2 ✅ | `controllers/admin/pluginsController.js:21,25` | 每次 GET 用 `?t=${Date.now()}` 动态 import `.plugins.js`，V8 ESM registry 按 URL 永久缓存，模块实例只增不减 | 管理台打开插件页或轮询即触发 | cache-buster 改用文件 mtime（仅文件变化时产生新 URL） |
| L3 ✅ | `utils/imageManager.js:5` + `controllers/image-store.js:247` | 图片 Map 无上限；唯一清理入口是手动 HTTP 接口，无定时调用 | 持续 POST 上传图片即单调增长（≤500KB/张、张数无限） | storeImage 内触发惰性过期清理 + onReady 注册 `setInterval(...).unref()` 兜底 |
| L4 ✅ | `utils/headless-util.js:84-91,148-153` | `gotoHtml/gotoCookie` 每次 `puppeteer.launch()` 直接覆盖 `this.browser`，旧实例既不 close 也无引用 → 孤儿 Chromium 进程 | 含 pupWebview 的源第二次取页面即开始累积 | 两方法 try/finally 关闭；或维护单例浏览器复用 |
| L5 ✅ | `utils/pan/baidu.js:42-48` | 构造函数起 2h 清理 interval，只 unref 从不 clear；规则对象被 drpyS LRU(max100/ttl10min) 驱逐重建后，旧实例定时器永驻且回调持有 this | 反复使用百度网盘源、LRU 驱逐重建即新增定时器 | interval 提升为模块级单例；并在 drpyS 的 LRUCache 增加 dispose 回调兜底（见 L15） |
| L6 ✅ | `libs/catvod.js:9,22,29` | `moduleCache/ruleObjectCache` 裸 Map 无上限 + `\`?v=${fileHash}\`` 动态 import：内容每变一次向 ESM registry 永久堆一份模块（ruleObjectCache 还是死变量） | catvod 源热更新、公网地址轮换时反复触发 | Map→LRUCache(max100/ttl10min)；移除死变量；ESM registry 无用户侧回收手段，靠 pm2 `max_memory_restart` 兜底（运维项） |
| L7 ✅ | `libs_drpy/fetchAxios.js:149-157` | 每个 req 请求新建 undici `Agent`/`ProxyAgent`（含连接池 socket），从不 close/destroy | 默认 DS_REQ_LIB=0 时全部沙箱 req 流量，高流量下 FD/内存持续攀升 | Agent 提升为模块级单例，仅在系统代理地址变化时重建 ProxyAgent |
| L8 | `controllers/ftp-proxy.js:33,149,198,296-299` + `utils/ftp.js:557` | 每个 FTP 请求新建客户端；成功流式路径无人 disconnect（仅异常分支断开）；config-test 不关连接 | FTP 源点播、反复测连 → 控制/数据套接字堆积 | `reply.raw.on('close')` 中 disconnect；testConnection 包 try/finally |

### 2.2 【高度可疑】级（9 项）

| # | 位置 | 成因 | 修复动作 |
|---|---|---|---|
| L9 | `utils/proxy-util.js:477-489` | makeRemoteRequest resolve 后流传输阶段无 idle 超时，上游半开 TCP 连接无限悬挂 | resolve 后对 socket 设 idle watchdog 定时销毁 |
| L10 | `controllers/api.js:129-137`、`unified-proxy.js:119-124` | Promise.race 输家 setTimeout 未 clearTimeout，高频搜索时瞬时堆积 pending timer | 抽 `withTimeout(promise, ms)` 工具统一 finally clearTimeout |
| L11 | `utils/pan/quark.js:54,60,68,768`、`uc.js:31,37,45,619`、`yun.js:47,183` | shareTokenCache/saveFileIdCaches/urlHeadCache/cache 全是裸对象，无 TTL 无上限（urlHeadCache 以 md5(url) 为键、saveFileIdCaches 按集数积累） | 统一替换为项目已有 lru-cache 模式（max 500~1000 + ttl） |
| L12 | `utils/ftp.js:506-543` | 自定义 Readable 忽略 `push()` 返回值，慢速客户端下载大文件时数据无限堆入内部缓冲（无背压），RSS 线性上涨 | 按 push() false 暂停 downloadTo，或改 PassThrough pipe |
| L13 | `controllers/lx-proxy.js:206-214` | abort 监听器注册后同一 tick 即 removeListener，监听窗口为零；客户端中断只能等 30s timeout 兜底，上游 socket 滞留 | 将 removeListener 移入 reply.raw 'finish'/'close' 回调 |
| L14 | `libs/drpyS.js:91,1121` | sessionCacheStates Map 只进不出，键为 源×host 组合 | 改 LRUCache 或随 clearAllCache 之外增加 TTL 清扫 |
| L14b | `utils/ai/*.js:44` 三处 | userContexts 以 userId 只增不减（扫库伪造 userId 可放大） | LRUCache 化（max 200 用户） |
| L15 | `libs/drpyS.js:74-83` | 三条 LRUCache 无 dispose 回调，驱逐的重资源对象（含 Baidu 定时器实例等）收不到回收通知 | 加 `dispose(v){...}` 回调做实例级清理挂钩 |
| L16 | `index.js:46-48 vs :73` | 插件启动在 `setTimeout(0)` 异步进行而 onClose 引用外层同名变量；快速重启窗口内可能孤儿进程 | 启动挪入 onReady hook 并同步登记进程表 |

### 2.3 【疑似】级（7 项）

| # | 位置 | 成因 | 处置 |
|---|---|---|---|
| L17 | `utils/proxy-util.js:229-231` | 每个 SmartCacheManager 实例注册一个 process 'exit' 监听，现约 8 个，逼近默认 10 上限 | 模块级共享一次性 exit 钩子 |
| L18 | `controllers/mediaProxy.js:52-63` | 模块级 setInterval(30s) 无 clear 无 unref，import 即常驻（影响 Vercel 场景挂死） | unref + 首个请求懒启动 |
| L19 | `index.js:144,289` + `controllers/fastlogger.js:61` | 退出用 `fastify.server.close()` 直调原生 server，绕过 avvio 生命周期——全部 onClose hooks（cron-tasker stop、日志 flush）实际不执行；rfs 句柄不 end 有丢尾日志风险 | handleExit 改为先 `await fastify.close()`（内部会关 server 并触发全部 onClose 钩子），再补 logStream.end()；失败再 fallback server.close() |
| L20 | `controllers/cron-tasker.js:129-167` | CronJob context 注入 fastify 整体闭包；registerScript 不停旧 job（当前单次注册无害，热加载功能一旦加入即双泄露） | registerScript 前 stop 同名旧 job（防御性一行） |
| L21 | `libs_drpy/drpyS.js:292-295,470` | sandbox 注入宿主原生 setInterval/setTimeout，源内自起的定时器闭包钉住整个 vm context，无法随 LRU 驱逐回收 | 完整方案侵入执行核心，列为 P3；短期以 L15 dispose + pm2 max_memory_restart 兜底 |
| L22 | `utils/proxy-util.js:546-551` | getRemoteContent 超 MAX_CONTENT_LENGTH reject 但未 stream.destroy() | reject 前 destroy |
| L23 | `utils/ai/SparkAIBot.js:117-118` | ws error 回调不 terminate，远端异常时每次 ask 泄一条 WS 连接 | error 回调补 `ws.terminate()` |

### 2.4 已排查排除项（无需处理）

WebSocket 心跳与断连清理（websocket.js:161-172,211-222）、daemonManager（无守护轮询）、cron 注册去重（enable_tasker=0 且单次注册）、scripts/ 22 个脚本无顶层副作用、chunk.js 本体（有界 LRU+背压+超时齐全）、crypto-wasm 实例幂等单例、baidu.js:42 的 unref 与 baidu 手动清理并存问题中"清理目录"部分、mediaProxy 活动 stream Set 配对增删。

**关键结论：泄露集中在「裸对象/Map 缓存无淘汰」「动态 import 缓存劫持」「定时器/连接句柄生命周期」三类模式。修复动作均为局部小改，无一需要变更业务流程。**

---

## 三、冗余地图（重复实现清单）

按收敛收益排序，估算合计可削减 **约 6,000~9,000 行（占自有代码 15%~22%）**：

| # | 冗余项 | 位置证据 | 规模 |
|---|---|---|---|
| R1 | quark.js 与 uc.js 近整文件复制（lcs/createSaveDir/getShareToken/save/api/testSupport 相似度 80%~100%，可参数化差异仅 6 处） | `utils/pan/quark.js` 1502行 vs `uc.js` 1223行 | ~1000 行净减 |
| R2 | chunkStream/delAllCache/testSupport 三份拷贝，且 utils/chunk.js 公共版才是修复过的正确版（带 LRU、背压、超时）；pan 内两份旧拷贝全仓无调用方、其中 IIFE 还引用 this.maxCache 必抛 TypeError（纯死代码） | quark.js:1079-1499、uc.js:788-1215 vs utils/chunk.js | ~700 行直接删除 |
| R3 | webdav-proxy 与 ftp-proxy 整体镜像（loadDefaultConfig/health/list/config/cache/status 六端点结构逐一对应，Range 解析块 x2） | controllers/webdav-proxy.js vs ftp-proxy.js | ~370 行 |
| R4 | 远程文件代理完整样板三份（auth→前缀校验→decode→headers 合并→makeRemoteRequest→流转发） | file-proxy.js:60-137 / m3u8-proxy.js:205-282 / unified-proxy.js:254-316 | ~140 行 |
| R5 | M3U8 重写函数三份 | m3u8-proxy.js:46-85,690-738 / unified-proxy.js:179-231 | ~90 行 |
| R6 | 备份/恢复双实现且两套路由并存 | web.js:363-530 vs controllers/admin/backupController.js:9-196 | ~170 行 |
| R7 | api.js env 构建块三连拷贝 | api.js:194-238/488-533/640-687 | ~100 行 |
| R8 | config.js generateSiteJSON 五段同构源扫描（ds/dr2/py/php/cat） | config.js:184-688 | 可收敛 300+ 行 |
| R9 | AI Kimi/DeepSeek/SparkAI 95% 逐字相同三胞胎 | utils/ai/*.js | 净减 ~400 行 |
| R10 | 四套批量并发实现仅一套在役：batchFetch1(PQueue)/batchFetch2(queue) 无生产调用、batchFetch4(DsQueue) 无调用者、batchExecute 第 5 份、data/cat/index.js 内联第 6 份 | libs_drpy/drpyBatchFetch.js、hikerBatchFetch.js:121、dsQueue.js、batchExecute.js | 删除连带 p-queue/queue 两个 npm 依赖 |
| R11 | 相似度算法双实现且双双无人引用（mod.js Myers 版 vs similarity.js Dice 版，后者 lcs 存在未初始化缺陷永不工作） | mod.js:191 vs similarity.js:12 | 全删或留一 |
| R12 | DOH 改写逻辑两套几乎逐行相同的 axios 拦截器 | utils/req.js:49-89 vs createAxiosAgent.js:71-104 | ~55 行 |
| R13 | 工具函数多份散落：delay x5（pan 各家）、isSafePath x2+第三种简版、natsort x3、hash 双套、urljoin 一函数三名、randStr 双份 | grep 已核实，见附录 | ~150 行 |
| R14 | class_parse 解析与免嗅 lazy 解析沙箱/宿主各一份 | drpyS.js:198-241,1430区 vs drpysParser.js:753-822 | ~120 行 |
| R15 | catvod/hipy/php/xbpq 四 parser 各自复制 hashMd5 缓存+十个包装方法骨架 | libs/*.js | ~400 行（基类化后） |
| R16 | 死文件/死代码：tasker.js（未注册且无鉴权）、dsGlobal.js（零 import）、message_sender.js（零调用）、hipy callPythonMethodOld(~60行)、xbpq.js（对空对象调 init 必抛错）、requestCache 空壳缓存 x3（只 .size/.clear 从不 set）、ftpClients 空缓存、ruleObjectCache 死变量、jinja.min.js 死副本、logsController 未导入 WebSocket.OPEN 的死函数、sourcesController execAsync 未定义 bug | 见各 file:line | ~800 行 |

**复用性正面清单**（已做得好、应保持并推广的模式）：`utils/chunk.js`（LRU+背压+超时的标准范本）、`env.js` 的 LRUCache 用法、`SmartCacheManager` 的 TTL 设计思想、`proxy-util.js` 的公共头/CORS 工具。

---

## 四、耦合问题清单

| # | 问题 | 位置 | 风险 | 处置阶段 |
|---|---|---|---|---|
| C1 | 巨型 registerOptions（17 目录字段 + fastify/wsApp 自身）注入全部 25 controller，api.js 甚至反向取 `options.wsApp.server` 当沙箱 env | index.js:183-209 / api.js:207 | 重构阻力大、测试困难 | P3 |
| C2 | Symbol.for 把 fastify/wsApp 挂上 globalThis，import 即全局副作用 | fastlogger.js:13,126 | 已被广泛引用，暂保留 | 不动 |
| C3 | websocket.js 模块顶层劫持全部 console 方法且闭包持有 wsClients，默认永不恢复 | websocket.js:65-108,121 | 行为可预测性差 | P3 |
| C4 | random-http-ua 以 import 副作用写 globalThis，mediaProxy 裸用全局名 | mediaProxy.js:5,227,299,449 | IDE 不可见、重构易碎 | P2 低成本修（显式 import） |
| C5 | 鉴权三套并行 + admin 双重校验 | index.js:86 / admin.js:84-91 / web.js:239-260 | 维护面大、易漏 | P2 收敛声明式 preHandler |
| C6 | libs 层反向依赖 controllers/fastlogger 取 fastify | libs/drpyS.js:23、catvod.js:7、hipy.js:8、php.js:10 | 分层倒置 | P2 引 logger-context 注入或延迟 require |
| C7 | admin.js 读 controllers/index.js 源码字符串枚举路由 | admin.js:290-311 | 格式一变失真 | P3 |
| C8 | mediaProxy 向 createAxiosInstance 传 keepAliveMsecs/maxFreeSockets/freeSocketTimeout，但接收方根本不解构这些参数——“连接池调优”静默失效 | mediaProxy.js:66-74 / createAxiosAgent.js:22-26 | 功能性欺骗 | P0 顺手修（一行解构或删无效传参） |
| C9 | 网盘域名巨型交替正则在 ≥8 个 spider 文件复制，与 pan 模块 self.regex 形成“双份真相” | spider/js/push_agent.js:82 等 | 新增网盘要改 N 处（涉及源生态，仅文档标注） | 仅记录 |
| C10 | globalThis._tempHost/_tempHeaders 跨请求读写存在并发串扰竞态 | drpyS.js:1151-1152 写 / :251 读 | 并发多源下 host 可能错配 | P3（AsyncLocalStorage 方案评估） |
| C11 | api_validate 以 `/config/` 前缀字符串切片决定跳过规则，与路由硬编码互锁 | api_validate.js:16-24,68-75 | 改路由即失效 | P2 随鉴权收敛一并处理 |
| C12 | pluginManager 首启 spawnSync npm install 最长阻塞事件循环 10 分钟 | pluginManager.js:25-29 | 冷启动假死体验 | P3（改异步） |
| C13 | moduleLoader currentSandbox“最后初始化胜出”，并发 init 存在 $.require 串扰窗口 | moduleLoader.js:108-110 | 并发源初始化偶发错乱 | P3 |

---

## 五、分期实施计划

### P0 内存泄露修复包（预计 10 个独立小改动，零行为变更）

目标：只动资源生命周期，不动任何业务分支。每项 = 1 个 commit。

| 批次 | 内容 | 覆盖泄露项 | 改动面 |
|---|---|---|---|
| P0-1 | batchExecute：race 外层 finally clearInterval | L1 | ~3 行 |
| P0-2 | pluginsController：cache-buster 改 mtime | L2 | ~4 行 |
| P0-3 | imageManager：storeImage 惰性清理 + onReady unref 定时器 | L3 | ~15 行 |
| P0-4 | headless-util：gotoHtml/gotoCookie try/finally close | L4 | ~12 行 |
| P0-5 | baidu interval 模块级单例化 + drpyS LRUCache 增加 dispose | L5、L15 | ~20 行 |
| P0-6 | fetchAxios Agent 单例化（代理变化才重建） | L7 | ~25 行 |
| P0-7 | catvod Map→LRUCache + 删 ruleObjectCache 死变量 | L6 部分 | ~10 行 |
| P0-8 | ftp client 生命周期（raw close disconnect + config-test try/finally） | L8 | ~15 行 |
| P0-9 | proxy-util idle watchdog + exit 监听共享 + getRemoteContent destroy；统一 withTimeout 工具给 api/unified-proxy | L9、L10、L17、L22 | ~40 行 |
| P0-10 | pan 五类裸缓存 LRU 化 + lx-proxy removeListener 时机 + SparkAIBot terminate + mediaProxy interval unref + createAxiosInstance 参数解构修复(C8) + cron-tasker 注册前停旧 job | L11、L13、L18、L20、L23、C8 | ~60 行 |
| P0-11 | index.js handleExit：server.close() → await fastify.close() + logStream.end() + pupWebview close | L19 | ~15 行 ⚠️ 唯一有行为含义的改动：优雅关闭从“立即硬杀”变为“等待钩子完成”（pm2 kill_timeout 建议 ≥5000ms，写入方案验收标准） |

P0 合计 ~220 行净改动。完成后预期效果：长跑进程不再出现 batchExecute 定时器泄漏、FTP/socket/Chromium 进程堆积、图片与网盘缓存无界增长。

### P1 死代码移除（纯删除，零行为变更）

删除对象见冗余表 R16 及 R2 的 pan 侧死拷贝、R10 的三套死批量实现、R11 双相似度实现。附带：
- 减掉 p-queue、queue 两个 npm 依赖（package.json + yarn.lock）
- tasker.js 删除（未注册且 /execute-now 无鉴权，误启用风险 > 价值）
- xbpq.js 先标记 deprecated（一个版本后再物理删除，避免极端场景引用）

预计 -1,800 行。验证方式：`node --check` 全量 + 启动冒烟 + grep 确认零引用。

### P2 公共层抽取（新增公共模块 + 等价替换，导出签名全兼容）

新建公共模块（每个先加后换，旧实现过渡期保留导出别名）：

```
utils/proxy-common.js    rewriteM3u8(content,{baseUrl,proxyPath,auth})            ← 收编 R5
                         proxyRemoteFile(request,reply,url,headers)               ← 收编 R4
                         parseRange(header,total)                                 ← 收编 R3 Range 块
utils/rule-env.js        buildRuleEnv(request,options,query,module,extra)         ← 收编 R7
utils/pathGuard.js       safePath(filePath,blacklist?)                            ← R13 isSafePath
utils/site-scanner.js    scanSourceTasks({dir,ext,lang,mode,buildEntries})        ← 收编 R8
utils/pan/share-pan-base.js  SharePanBase({regex,pr,apiUrl,baseHeader,envKey,...})← 收编 R1
utils/storage-proxy.js   makeStorageProxy({clientFactory,configFile})
                         + RemoteFsClient 接口                                    ← 收编 R3
utils/ai/base-chat.js    BaseOpenAICompatChat({name,baseURL,model})               ← 收编 R9
libs_drpy/concurrency.js fastq 单内核工厂，保持 batchFetch/batchExecute 导出名     ← 收编 R10
libs/source-loader.js    createSourceLoader({bridge,cacheKeySalt})                ← 收编 R15
```

约束：现有 import 路径通过 re-export 保持解析兼容（如 `export {default} from './proxy-common.js'`），沙箱侧符号完全不变。分 4 个子批次提交（proxy 系 → pan/storage 系 → ai/libs 系 → config/env 系），每批做完跑同一套冒烟脚本。

预计净减 3,000~4,000 行，重复热点全部归一。

### P3 结构性收敛（本期不做，仅登记方向）

options 对象瘦身成 context 服务、鉴权三套合一、admin 路由枚举改造、sandbox 定时器包装（L21 根治）、_tempHost 竞态治理、pluginManager npm 安装异步化、console 劫持去除。均涉及运行时核心链路，需要先建集成冒烟基线再评估。

---

## 六、验证与回滚

**每批次必过冒烟清单**（手工，约 5 分钟）：
1. `yarn dev` 启动无报错；退出打印“优雅关闭”且 pm2 下 `pm2 restart drpys` 后端口正常重绑。
2. `GET /config?pwd=$API_PWD` 返回源列表；任选一源走通 home→category→detail→search→play 五连。
3. `GET /config/1` 外网模式正常。
4. 上传一张图片到 /image/store 后 24h 清理逻辑生效（可用 maxAge 参数即时验证 P0-3）。
5. 打开管理台插件页多次（验证 P0-2），后台无增长（`process._getActiveHandles()` 数量稳定）。
6. m3u8/ts/file/webdav/ftp 各代理分别请求一次段文件返回 200。

**辅助静态检查**：每个 commit 前对改动文件跑 `node --check`；grep 全仓确认删除符号零引用。

**回滚策略**：git 单 commit revert 即回滚；P2 各批互不依赖，任意批次可跳过。

**运维兜底建议**（独立于代码）：pm2 ecosystem 增加 `max_memory_restart: '800M'`，作为 ESM registry 类（L6/L21）无应用层回收手段问题的最后防线。

---

## 七、验收指标

| 指标 | 现状 | 目标 |
|---|---|---|
| 确定级泄露点清零 | 8 项 | 0（其余降级项均有兜底或纳入 P3 登记） |
| 常驻 free-running 定时器 | mediaProxy 1 + SmartCache 8 + Baidu N（随重建递增） | mediaProxy 1(unref) + SmartCache 8（原有设计）+ Baidu 1（单例） |
| 48h 压测 RSS 增长 | 播放型负载下持续爬升 | 波动持平（±50MB 内） |
| 自有代码量 | ~41,200 行 | ≤35,000 行（P0+P1+P2 后），无新增性能开销 |
