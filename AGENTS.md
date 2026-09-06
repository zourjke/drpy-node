# AGENTS.md — drpyS (drpy-node) 工作区指引

## 项目概述

Node.js 版 drpy 影视/听书/漫画/小说「源」服务端（社区称 drpyS）。核心是 Fastify HTTP 服务 + 独立 WebSocket 服务，动态加载并沙箱执行多种运行时编写的爬虫源（JS 为主，另有 Python/PHP/CatVod）。

- 入口 `index.js`，ESM 项目（`"type": "module"`），主服务端口 **5757**，WebSocket 端口 **57575**。
- 包管理器锁定 yarn@1.22.22，Node 版本窗口窄：`>17 <24`（新版 SQLite 需 `--experimental-sqlite`）。

## 语言与沟通

- **始终使用中文**：回复、解释、计划、总结以及内部思考过程都用中文；代码注释、提交信息、文档也用中文。

## 开发准则

- **复用优先**：写新逻辑前先找现有实现（grep 工具函数/控制器），能复用就不重写；两处以上出现的逻辑抽到 `utils/` 公共模块（如 `pathGuard.js`、`pluginsConfigFile.js`）。
- **低冗余、低耦合、高可维护**：单文件职责单一、函数纯逻辑与 IO 分离（便于单测）；避免跨层直连（控制器不直接摸文件，走 utils 层）；禁止复制粘贴式"第二份实现"。
- **改公共行为先收敛**：修改被多处共享的函数时，改共享函数本身，不要在每个调用点打补丁。
- **最小改动**：理解真实链路后再动手；不加没被要求的功能/依赖；新依赖必须多平台可用（Windows/Linux/ARM/Docker/Vercel），优先纯 JS 包。
- **可验证**：非平凡逻辑留一个最小测试（node:test，零依赖框架）；业务代码内置模块导入用裸名（`import fs from 'fs'`），测试代码用 `node:` 前缀。
- **源测试统一走 drpy-node-coder skill**（严格约定）：新建/修改/诊断源之后，测试一律用 `~/.zcode/skills/drpy-node-coder` 自带 CLI（`cd scripts && node cli.js test|evaluate|debug|syntax|validate <源名>`，已 `setup` 指向本仓库），**不要手写一次性测试脚本**；仅算法级固定向量校验才落 `tests/unit/*.test.js`。
- 提交前：`npm test && npm run check` 全过；改了 `drpy-node-admin/` 还要 `yarn admin:build`（见下文）。

## 常用命令

```bash
yarn dev            # 启动服务（Windows 推荐，自动 chcp 65001 防中文乱码；直接 node index.js 会乱码）
yarn node22-win     # Node 22 下启动（带 --experimental-sqlite）
npm test            # 框架层测试（node:test 零依赖，见 tests/README.md；Node >= 18）
npm run check       # 对自有框架代码批量语法检查
yarn admin:install / admin:dev / admin:build   # 管理面板前端子项目
yarn bundle         # rolldown 打包 drpy-node-bundle 独立核心
yarn test:bundle    # bundle 本地验证脚本
python package.py   # 打包发行版（-g 绿色版 -z zip）；也可用 node package.js 系列
```

自 v2 分支起有 `tests/` 测试体系（单测/并发行为/内存泄露回归三类），新增公共模块必须带对应 `.test.js`；改动后先跑 `npm test && npm run check` 再提交。

### 管理面板打包必须用 `yarn admin:build`（即 `build:apps`），不要用普通 `vite build`

drpy-node-admin 是 **SPA（vue-router createWebHistory）**，由主服务托管在 `/apps/admin/` 子路径，后端对无扩展名的深层路由做了 history fallback。两条构建命令的差异：

- `npm run build:apps` = `vite build --mode production.apps` → 加载 `.env.production.apps` 的 `VITE_BASE_PATH=/apps/admin/`，产物资源引用为**绝对路径** `/apps/admin/assets/...`（正确，任意深层路由刷新都正常）。
- 普通 `vite build`（mode `production`）→ 没有 `VITE_BASE_PATH`，base 回退 `./` 相对路径 → 在 `/apps/admin/plugins` 这类深层路由刷新时资源解析成错误路径，**页面白屏**。

结论：改了 `drpy-node-admin/` 之后一律 `yarn admin:build` 重新构建托管产物，验证方式：`curl -u admin:xxx http://127.0.0.1:5757/apps/admin/plugins` 返回的 HTML 中资源应为 `/apps/admin/assets/...` 绝对路径。

## 目录与架构边界

- `index.js` — 启动、Fastify hooks（鉴权/query 解析/优雅退出）、目录定义。新增顶层能力时先看这里。
- `controllers/` — 全部路由控制器，在 `controllers/index.js` 的 `registerRoutes` 中注册；新 API 必须建 controller 并在此登记。
- `spider/js/` — DS 源主库（数量庞大）；`spider/js_dr2/` — drpy2 源；`spider/py|php|catvod|catLib|xbpq` — 其他运行时源。
- `libs_drpy/` — 源执行沙箱的注入库（请求封装 req-extend/fetchAxios、jinja 模板、crypto、jsonpath 等），供源代码 import 使用。
- `libs/` — 各类源的公共解析器（drpysParser、hipy、php、catvod 等）。
- `utils/` — 服务端工具：sqlite database、cookieManager、pluginManager（.plugins.js 子进程插件）、daemonManager（Python 守护进程）等。
- `drpy-node-admin/` — Vue3+Vite+Tailwind 管理面板（独立子项目，有自己的 package.json）；`build:apps` 产物由主服务托管到 `/apps/admin`。
- `drpy-node-mcp/` — MCP server 子项目（rollup 打包）。
- `apps/`、`public/`、`jx/`、`json/`、`config/` — 前端插件页、静态资源、解析器配置、运行配置。
- 运行时数据不手改：`index.json`/`custom.json` 为生成的源索引与自定义订阅，`.env` 存环境变量与真实密钥（勿提交、勿外传）。

## DS 源编写规范（易踩坑，写新源前必读）

引擎调用链（`libs/drpyS.js` + `controllers/api.js`）：HTTP 路由 → 前置 parse（`searchParse`/`cateParse`/`detailParse` 等）→ 才轮到源方法。**前置 parse 会因 rule 惯例字段缺失而直接放弃**，源方法根本不被执行——这是最隐蔽的坑。

- 源文件结构：头部 `/* @header({ searchable, filterable, title, lang: 'ds', ... }) */` 注释块声明元数据；主体为 CommonJS 风格 `var rule = {...}`，**没有 export**。
- **rule 内的所有方法禁止使用箭头函数**，必须 `function()` 或 `async function()`——箭头函数拿不到 this，无法访问注入的 `input`、`MY_URL`、`orId`、`requestHost` 等上下文变量。
- 全面异步写法（一级/二级/搜索等为 async 函数，返回 Promise）。
- **惯例字段必须占位（哪怕纯 API 源用不到）**：`rule.url` 与 `rule.searchUrl` 缺失时，`cateParse`/`searchParse` 直接 return → 分类/搜索**恒返回空对象 `{}`，源方法不被调用，源内 log() 探针也不输出**（无任何报错）。写 `url: '/category'`、`searchUrl: '/search/**'` 占位即可。
- **分类不能用 `rule.class` 直写**（home 返回空 class），必须 `class_parse: async function () { return {class: [{type_id, type_name}...], filters: {...}} }`。
- **一级/搜索的列表项是 TVBox 风格 `{title, img, desc, url}`**，由框架转成 vod_*；直接返回 `{vod_name, vod_pic...}` 会在转换中丢字段（表现为列表有条目但名称全空）。返回一律 `setResult(d)`（数组），不要自己拼 `{page, pagecount, list}`。
- **二级返回单个对象**（不是数组）：`{vod_name, vod_pic, vod_content, vod_play_from, vod_play_url}`；取详情 id 用 `this.orId`；`vod_play_url` 格式 `名称$id#名称$id`。**返回数组会丢 play 字段**。
- **lazy(flag, id) 的 id 是 `vod_play_url` 里 `$` 后面的值**；播放分流**不要依赖 flag**（壳子回传 vod_play_from 形态不可控：缺失/小写/改写），按 id 特征/白名单判别（如频道 id 与 32 位 hex 的 guid 天然不冲突）。
- 方法名清单：`class_parse`、`推荐`、`一级(tid, pg, filter, extend)`、`二级()`、`搜索(key, quick, pg)`、`lazy(flag, id, flags)`、`proxy_rule(params)`、`action`。中文方法名是引擎约定，不能改。
- **接口测试姿势**（少一个参数结果完全不同）：分类 `?ac=class&t=<tid>&pg=`；详情 `?ac=vod&ids=`；搜索 `?wd=`；播放 `?flag=&play=`；只传 `?tid=` 不带 `ac` 走默认 home（返回推荐，易误判）。
- **播放/大文件回流一律走主服务 proxy 门面**：lazy 用 `this.requestHost` 拼 `/proxy/<模块>/?do=xxx`（`/proxy/:module/*` 的通配段必须有落点，**尾部斜杠必需**），壳子必然可达主服务；直发插件/本机服务的 `127.0.0.1:端口` 地址壳子（在别的设备）无法访问。proxy_rule 转发本机插件/服务，文本直接回，二进制用 `toBytes=1`（base64，小文件）或 `toBytes=2`（302 到 /mediaProxy 流式转发，支持 Range/拖动，大文件用这个）。播放/分片 URL 尾部补伪后缀 `#.m3u8`/`#.ts`/`#.mp4` 帮嗅探型播放器识别（fragment 不发给服务器）。
- **沙箱 `req`/`request` 默认 timeout 5s**：慢操作（插件解密、长解析）必须显式 `{timeout: 120000}`。
- **调试方法论**：怀疑"源方法没被调用"时先检查惯例字段；`log()` 探针在方法未被执行时无效，**最可靠的定位方式是在 node 里模拟沙箱直接跑源文件**（用 `node scripts/debug-source.mjs <源文件> <方法> '[参数JSON]'` 打桩 request/log/setResult 后直接调用源方法），正常则问题在引擎层（缺字段/参数名），异常则在源逻辑。
- 接口协议参考 `docs/apidoc.md`、源属性说明 `docs/ruleAttr.md`；完整可运行范例：`spider/js/央视频.js`（点播+直播+proxy门面）、`spider/js/红果短剧[短].js`（SSR 数据提取+插件转发播放）。
- JS 源修改后**无需重启服务器**即可热生效；但客户端/壳子可能有配置缓存。

## 管理面板前端（drpy-node-admin）

管理面板为 Vue3+Vite+Tailwind3+Pinia 的 **SPA**，托管于 `/apps/admin/`。**必须用 `yarn admin:build`（即 build:apps，`--mode production.apps`）打包**——该模式注入 `VITE_BASE_PATH=/apps/admin/` 绝对 base，普通 `build` 的相对路径会导致深层路由刷新白屏。

前端已按 `docs/admin-ui-redesign.md` 完成「Instrument Panel」重构（暗色默认+亮色完整、hairline 分层、mono 眉题、StatusDot 呼吸灯）。改前端必须遵守：

- **禁止原生 `alert/confirm/prompt`**（grep 清零是硬验收）：通知用 `useToast().success/error/warning/info(msg)`；确认/表单用 `await useDialog().confirm({title,message,danger?,confirmText?,requireText?})`（高危操作传 `requireText:'XXX'` 强制输入确认词）或 `dialog.form({title,fields})`，均返回 Promise。
- 设计 token 在 `src/style.css`（CSS 变量双主题）+ `tailwind.config.js`（`bg-panel/text-hi/border-line/text-accent/text-ok` 等语义类）；**不要写死 gray-xxx/sky-xxx 颜色**，用语义类自动适配亮暗。
- 通用组件在 `src/components/ui/`（UButton/UInput/USelect/USwitch/UBadge/StatusDot/UTabs/USkeleton/UEmpty/PageHeader/StatCard/DataList/AppDrawer），已在 `main.js` 全局注册，模板直接用；弹窗迁移或新页面优先复用，别再手搓 modal。
- 布局：PC 固定侧栏 + Topbar；移动端底部 Tab +「更多」抽屉（导航数据在 `src/navigation.js`，Sidebar 与移动抽屉共用 `NavList.vue`）。触控目标 ≥40px，弹窗移动端转 bottom sheet。
- 字体：JetBrains Mono 自托管（`@fontsource/jetbrains-mono`），数字/代码/眉题用 `font-mono`；中文走系统栈。
- 构建产物 `apps/admin/` 需随前端改动一并提交（托管产物入库）。

## 插件市场与插件发布

插件市场（v2 新增）允许从远程源一键安装/更新/卸载「二进制插件」与「Node 服务插件」。**详细设计见 `docs/plugin-market-design.md`**，发布流程文档见发布仓库 README。关键事实：

### 架构（磁盘即真相）

- 安装状态/版本实时从 `plugins/<name>/plugin.json`（manifest，市场安装时落盘）+ `.plugins.js` 推导，**没有第二个状态文件**；手工放的目录（无 manifest）= local_only。
- 核心：`utils/pluginMarket.js`（下载/ghProxy 兜底/sha256/ZipSlip 防护/剥壳/manifest 落盘/安装卸载）、`utils/pluginRegistry.js`（子进程注册表，支持运行时单插件启停）、`utils/pluginManager.js`（startPluginByKey/stopPluginByName/reloadPluginsConfig）、`controllers/admin/pluginMarketController.js`（安装/更新为**后台任务**，前端轮询 `/api/admin/market/install/status` 渲染进度）。
- 前端：`PluginMarket.vue`（路由 `/plugins/market`，独立路由刷新不丢 tab）+ `Plugins.vue`（已安装列表）。**语义区分**：插件管理「删除」= 停进程+仅移除配置（目录保留）；插件市场「卸载」= 完整卸载（删目录）。更新按钮仅在市场版本 > 本地版本时出现。
- 安装/更新保存配置后必须 `reloadPluginsConfig()`（pluginManager 内存配置才会刷新）——已有此机制，新增写配置的入口要记得调用。
- **python 型插件的系统依赖**：venv 创建依赖系统 python3 自带 venv/ensurepip 模块——Ubuntu/Debian 服务器默认缺，需 `sudo apt install python3-venv python3-pip`（否则装市场 python 插件报「创建 venv 失败」，错误信息已带该指引）；依赖准备失败会自动清理半成品 .venv，修好系统依赖后重新点启动即可。

### 市场源

- `config/market.json`：`sources` 数组（远程 URL 或项目内 JSON 路径，先注册的源优先）+ `ghProxy`（GitHub 加速前缀，直连失败时兜底，只对 github 系域名生效）。
- 当前配置：远程源 `https://raw.githubusercontent.com/hjdhnx/drpy-plugin-dist/main/market.json`（官方分发）+ 内置兜底 `config/market-plugins.json`（lxserver）。
- 远端 raw 有分钟级 CDN 缓存，发版后用户端短暂滞后属正常（客户端已带 cache-buster，必要时手动「刷新」）。
- **市场「更新」接口自带先停后装**（按原运行状态重启）——调用它之前不要自己先 stop，否则 wasRunning 误判为 false，装完不会自动拉起。python 型更新后首次拉起会重建 venv（数分钟），期间 start 若失败按错误信息处理。

### 发布/更新插件（发布仓库 github.com/hjdhnx/drpy-plugin-dist）

```bash
# 本地 clone（本机会话曾在 /tmp/plugin-dist，临时目录可能被清理；不在就重新 clone）
git clone https://github.com/hjdhnx/drpy-plugin-dist && cd drpy-plugin-dist

# 一键发布（打包 zip + sha256 + 更新 market.json + push + 发 release）
./release.sh <插件名> <版本号> [本地插件目录，默认 E:/gitwork/drpy-node/plugins]
# 例：./release.sh req-proxy 1.0.2
```

- 前提：`gh auth login`；本地 `plugins/<name>/` 存在（含二进制；从市场安装过的自带 `plugin.json`，可直接作为包 manifest 基底）。
- tag/download 约定：**`<插件名>-v<版本号>`**（如 `req-proxy-v1.0.2`），download 必须是 `github.com/.../releases/download/...` 形态（ghProxy 兜底只认 github 域名）。
- 发布后用户端：市场「刷新」→ 出现黄色「更新到 vX.Y.Z」按钮 → 点击自动 停止旧进程→覆盖安装（保留用户 params/env/active）→按原状态重启。
- 新插件上架 = 同一脚本（market.json 无该条目时自动从包内 manifest 生成）。

### 组装型插件：captcha-bypass（ddddocr 验证码识别）

上游 Hiram-Wong/captcha-bypass 发布的是「每平台散装二进制 + 独立 models.zip」，不符合插件包规范，由 dist 仓库的 `prepare-captcha-bypass.sh` 组装后再 `release.sh` 发布（流程见 dist README）。已知的上游坑（脚本已处理，升级上游版本时注意复查）：

- **模型文件名不同步**：内置默认路径 `models/ocr_pp.onnx(.json)`，而 models.zip 实际是 `ocr_ppv5-cn.*`——需复制补齐，否则启动报误导性的 `WebAssembly.Module doesn't parse at byte 0`（实为模型路径 404）。
- **ort-wasm 释放不可靠**：onnxruntime 首启需释放 `ort-wasm/ort-wasm-simd-threaded.wasm`（约13MB）到二进制旁；Windows 上释放可能截断为 0 字节，且 ort 检测到文件存在就不重写 → 永久失败。脚本引导运行（健康检查通过为准，失败清残骸重试）后随包预置。
- 包体约 380MB（接近安装器 500MB 上限），仅 win/linux x64；运行内存在 300-500MB。

## 三端二进制编译经验（本机 Windows，win-x64 + linux-x64 + linux-arm64）

本机没有 g++，可用工具链与实测结论（做二进制插件/交叉编译时直接照抄，别再试错）：

- **win-x64**：本机有 VS2017 BuildTools（`C:\Program Files (x86)\Microsoft Visual Studio\2017\BuildTools`）。Git Bash 里直接调 `cl`/vcvars64 的引号转义必失败（`printf`/`echo -e` 还会把 `\2017` 吃成八进制转义），**用 `cat > /tmp/x.bat <<'EOF'` 写 bat 再 `cmd //c "$(cygpath -w ...)"` 执行**；关键 flags：`/MT`（静态 CRT，目标机免装 VC 运行库）、C++ 源含 UTF-8 注释会报 C4819 警告可忽略。
- **linux-x64 / linux-arm64**：下载官方 zig 自包含 zip（ziglang.org，~97MB，放 `logs/` 即用）。注意三点：① `zig cc` 编 .cpp 报 `<cstdint> not found`，**要用 `zig c++`**；② target 用 **musl 全静态**（`-target x86_64-linux-musl` / `aarch64-linux-musl`），产物在任何 glibc 版本的 linux（NAS/盒子/Docker）直接跑；③ strip 要**编译时加 `-s`**——zig 0.16 没有 strip 子命令、`objcopy --strip-debug` 对 ELF 报 unimplemented。产物 ~470KB。
- **NDK 的 clang 不能用来编普通 linux 二进制**（android/bionic target，glibc 环境跑不了）。
- 验证产物：`file x`（确认 statically linked / stripped）；zip 打包前记得 `chmod +x`（Git Bash 下打包的 linux 二进制保持可执行位）。

## 央视系（cntv）流媒体解密经验（cctv-h5e 插件 v1.1.x）

插件 `plugins/cctv-h5e`（市场已上架）= 解密二进制（源自 letr007/CCTVVideoDownloader，GPLv3，单头文件 `source/cctv_h5e_decrypt.hpp`，密钥内嵌 NAL 无外部取 key）+ node HTTP 壳。设计与实测全录：`docs/cctv-h5e-plugin-design.md`。要点：

- **UA 是生死线**：cntv CDN 按 UA 放行，必须 `User-Agent: Lavf/60.10.100` + `Referer: https://tv.cctv.com/`，浏览器 UA 一律 403。
- **点播链路**：`vdn.apps.cntv.cn/api/getHttpVideoInfo.do?pid=<guid>` → **`manifest.hls_h5e_url`**（在 manifest 子对象，hls_enc_url/hls_enc2_url 兜底；enc2 域名归一 `drm.cntv.vod.dnsv1.com`）→ master 换清晰度档 → 加密 ts。加密是 **NAL 层**（点播 type25 使能走新模式 TEA/type5+type1；直播 cdrm 走 classic TEA），同一解密器自动适配；输出与输入等长（AF stuffing 吸收），ffmpeg 可直接播。
- **直播链路**：老接口 `vdn.live.cntv.cn/api2/live.do` 现只下发音频+封面（video_protect=3），视频必须走 `vdnx.live.cntv.cn/api/v3/vdn/live?channel=<ch>&vn=1` + header `auth-key` = `${time}-${number}-${md5(channel+time+number+'a4220a71b31746908fa3e7fdd7a6852a')}` → `manifest.hls_cdrm`。17 个频道（cctv1~17）全通；variant 选档存在两种 CDN 形态：独立文件 `..._td.m3u8` 或同文件 `index.m3u8?BR=td`。**央视频 App（yangshipin）的直播是 CMG wasm 加密体系，不适用本方案**。
- **源对接模式**（详见 `spider/js/央视频.js`）：客户端只访问主服务端口，插件仅 127.0.0.1 通信——源 proxy_rule 做对外门面，转发插件时传 `base=<enc(/proxy回调前缀)>` 让 m3u8 里的 ts 行回流主服务。坑：① `/proxy/:module/*` 的通配段必须有落点，**URL 尾部斜杠必需**（`/proxy/模块/?do=...`）；② **播放分流别依赖 flag**（壳子回传 vod_play_from 形态不可控：缺失/小写/改写），按 id 白名单判别（频道 id 与点播 guid 32位hex 天然不冲突）；③ 嗅探型播放器靠 URL 后缀识别格式，播放/分片 URL 尾部补**伪后缀 `#.m3u8`/`#.ts`**（fragment 不发给服务器，零副作用）。
- **验证方法论**：解密产物用 `ffmpeg -v error -i x.ts -f null -` 校验；单分片解码报 `Reference N >= N` 是直播切片非 IDR 起切的跨分片参考缺失（固有现象），`error while decoding MB` 大面积出现才是解密失败——**用加密态 vs 解密态错误量级对照**判断（实测 122 条 → 3 条）。本机 ffmpeg/ffprobe 在 WinGet Links 可直接用。



- **在哪里写**：`docs/changelog/` 目录，**每个版本一个文件** `v{semver}.md`（如 `v2.0.0.md`），发新版本时新建对应文件；`updateRecord.md` 已归档，**不要再往里写**。
- **文件格式**：frontmatter 声明元数据（`date: YYYY-MM-DD` 必填、`type: major|minor|patch` 缺省 patch、`title` 一句话主题、`tags` 逗号分隔），正文用中文小节分组条目：`## 新功能` `## 修复` `## 优化` `## 重构` `## 安全` `## 文档`，每个 `- ` 列表项一条变更（单行一条）。完整规范与示例见 `docs/changelog-design.md`。
- **生效方式**：后台管理「更新日志」页与 `GET /api/admin/changelog` 按目录 mtime 实时读取——改完保存即生效，**无需重启服务**；数据格式由 `tests/unit/changelog.test.js` 校验（版本降序/日期/枚举），写错 `npm test` 会拦。
- **README 同步**：发版时 README「更新记录」段落需手工追加简版条目（首页 `public/index.html` 同步产物一并更新）。

## 已知平台坑

- **UMD 单文件库只能 side-effect 导入**：`libs_drpy/_dist/*.js`、`utils/marked.min.js`、`utils/random-http-ua.js` 等单文件 UMD 库在 `"type": "module"` 下按 ESM 解析，运行时 `typeof exports` 为 undefined，走「挂载 globalThis」分支，**没有任何 ESM 导出**。导入一律写 side-effect（如 `import '../utils/marked.min.js';`），代码里经全局标识符或 `globalThis.xxx` 使用；**禁止 `import x from '...'` 默认/命名导入**——会直接 SyntaxError 让服务无法启动（v2.0.3 前的 randomUa 事故）。npm 正规包（crypto-js 等）不受此限。
- Windows 终端直跑会中文乱码 → 用 `yarn dev` / `dev-win`。
- 源里 `new Promise(...)` 内部的异常无法被外层 try/catch 捕获，会让进程崩溃（进程级已兜底 uncaughtException 不退出，但仍要避免此写法）。
- 新增依赖需考虑多平台（Windows/Linux/ARM 盒子/Docker/Vercel）可用性；`node-pty` 为 optionalDependencies。
- Python 功能依赖守护进程（daemonManager），失败只降级不阻塞启动；PHP 有类似的可用性探测（phpEnv）。

## 改动前应读的文档

- 接口协议：`docs/apidoc.md`、`docs/apiList.md`
- 写源规范：`docs/ruleDesc.md`（模板规则）、`docs/ruleAttr.md`（源属性说明）
- 环境变量：`docs/envdoc.md`（实际值见根目录 `.env` / `.env.development`）
- 历史问题与坑：`docs/issue.md`；更新日志维护：见下方「更新日志维护」小节（数据源 `docs/changelog/`，`updateRecord.md` 已归档）
- 插件市场设计：`docs/plugin-market-design.md`；插件管理/市场 API：`docs/admin_api.md` 第 9/9A 节；发布流程：drpy-plugin-dist 仓库 README
