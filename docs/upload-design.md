# 源上传/删除 与 插件 zip 上传 设计

> 状态：已实施（T1-T8 全部完成，单测 11 项 + 端到端验收通过）
> 日期：2026-08-30
> 关联：`Sources.vue`、`PluginMarket.vue`、`sourcesController.js`、`pluginMarketController.js`、`utils/pluginMarket.js`、`utils/pathGuard.js`
> 实施备注：multipart 路由不可声明 JSON body schema（会触发 FST_ERR_VALIDATION）；同名运行中插件覆盖安装需先停止（Windows 目录 rename EBUSY），已采用与市场「更新」一致的先停后装模式；零依赖 Node 插件（无 package.json）需在三处依赖检查（installPluginDeps/prepareNodePluginDeps/startPluginByKey）跳过 npm install，否则 npm 会向上逃逸到主项目 package.json。

---

## 1. 背景与需求

| # | 需求 | 现状缺口 |
|---|------|----------|
| N1 | 源管理界面支持**上传源** | 只能查看列表 + 打开源编辑器改内容（编辑实际走 `files/write`），新源必须手工放服务器文件 |
| N2 | 源管理界面支持**删除源** | 无删除入口（`files/delete` 后端虽存在，但界面未暴露，且它的路径约束过宽——能删项目内任意非黑名单文件，不适合直接暴露在源管理语境） |
| N3 | 插件管理界面支持**上传插件 zip 包**安装 | 只能「市场安装」（需先在 market.json 配源）或手工放 `plugins/<name>/` 后改 `.plugins.js` 登记配置 |

## 2. 现状能力盘点（复用点）

### 2.1 源侧

- 源引擎目录五类（`controllers/api.js` ENGINES）：`spider/js`（DS）、`spider/js_dr2`（drpy2）、`spider/catvod`、`spider/php`、`spider/py`；
- `listSources` 目前只返回 js/catvod/php/py 四类，**漏了 js_dr2**——本设计顺带补齐；
- 校验能力现成：`.js` 走 vm 沙箱结构校验（validateSpider）、`.php -l`、`python -m py_compile`（checkSyntax），**上传后可直接自动校验**；
- `index.json` 无需干预：`/config*` 每次请求都会重新生成并覆写缓存（`controllers/config.js`），源增删后壳子下次拉配置自动生效；
- 路径安全：`utils/pathGuard.js` 的 `safePath` + 本设计新增的「源目录白名单」双层约束。

### 2.2 插件侧

- `utils/pluginMarket.js` 的 `installPlugin({entry, ...})` 已实现完整安装管线：ZipSlip 防护 → 剥壳（resolveZipRoot）→ `plugin.json` 落盘 → 完整性校验（node 型查入口 / binary 型按 binaries 映射或命名约定）→ `.plugins.js` 登记（mergePluginEntry 保留用户已改 params/env/active）→ 回滚机制；
- 管线中**唯一与本需求不匹配的环节是「下载」**：`installPlugin` 从 `entry.download` URL 下载 zip。本地上传场景 = 用「接收到的 zip 临时文件」替换「下载的 zip」，其余全部复用；
- `installTask` 单任务模型（互斥 409 + 进度轮询 `/market/install/status`）与前端进度 UI 可整体复用；
- 同名已安装 → installPlugin 天然支持「换名保留旧目录 → 覆盖 → 失败回滚」的更新语义。

### 2.3 上传通道选型

| 候选 | 结论 |
|------|------|
| 源上传走 JSON body（文本 content） | ✅ 源是文本文件，复用 `files/write` 同款模式；路由级 `bodyLimit: 5MB`（fastify 默认全局 1MB，按路由覆盖即可） |
| 插件 zip 走 JSON + base64 | ❌ 33% 体积膨胀且整包驻留内存（插件可达数百 MB），放弃 |
| **插件 zip 走 `@fastify/multipart` 流式写盘** | ✅ 标准方案；新依赖 `@fastify/multipart`（纯 JS，多平台 ✓），流式写入临时目录，内存占用恒定；路由级 `bodyLimit` 与市场下载上限（500MB）对齐 |

## 3. 方案总览

```
源管理页                          插件管理页
 ├ 上传源（选引擎+选文件）           ├ 上传插件 zip（multipart 流式落盘 TMP）
 │   └► POST /sources/upload       │   └► POST /plugins/upload
 │       路径白名单+扩展名校验         │       校验 zip → 走 installPlugin 管线
 │       自动语法校验（fail-soft）    │       （剥壳/manifest/登记/回滚 全复用）
 ├ 删除源（确认弹窗）                │   └► 返回 taskId → 复用现有进度轮询 UI
 │   └► POST /sources/delete
 │       目录白名单+扩展名校验
 ▼
index.json 由 /config 请求自动重建，无需失效干预
```

## 4. 源上传 / 删除设计

### 4.1 引擎目录映射（含补齐 js_dr2）

| engine 值 | 目录 | 允许扩展名 | 校验方式 |
|-----------|------|-----------|----------|
| `js` | `spider/js` | `.js` | vm 沙箱 + 结构校验 |
| `dr2` | `spider/js_dr2` | `.js` | vm 沙箱 + 结构校验 |
| `catvod` | `spider/catvod` | `.js` | vm 沙箱 + 结构校验 |
| `php` | `spider/php` | `.php` | `php -l`（phpEnv 不可用时跳过，fail-soft） |
| `py` | `spider/py` | `.py` | `python -m py_compile`（python 不可用时跳过） |

映射表以常量 `SOURCE_ENGINES` 收敛在 sourcesController 中（listSources 与 upload/delete 共用，顺带修复 listSources 漏 js_dr2）。

### 4.2 API

**POST `/api/admin/sources/upload`**（body JSON，路由级 bodyLimit 5MB）

```jsonc
// 请求
{ "engine": "js", "filename": "新源.js", "content": "源文件全文", "overwrite": false }
// 响应
{ "success": true, "data": { "path": "spider/js/新源.js", "check": { "ok": true, "message": "语法检查通过" } } }
```

校验顺序（任一失败即 4xx）：
1. `engine` 在 SOURCE_ENGINES 白名单；
2. `filename` 取 `basename` 后匹配该引擎扩展名、不含路径分隔符与 `..`；
3. `content` 为非空字符串、长度 ≤ 5MB；
4. 目标文件已存在且 `overwrite !== true` → **409**（前端检测同名后带 `overwrite: true` 二次提交，覆盖需确认弹窗）；
5. 落盘路径 = `path.join(PROJECT_ROOT, SOURCE_ENGINES[engine].dir, basename)`，再走 `safePath` 终检。

落盘成功后自动执行 checkSyntax（**fail-soft**：校验失败仍保留文件，响应里带 `check.ok = false` 与错误信息，前端黄色提示，由用户决定去编辑器修改或删除）。

**POST `/api/admin/sources/delete`**（body JSON：`{ path }`）

校验顺序：
1. `path` 必须以 `SOURCE_ENGINES` 五个源目录之一为前缀（比 safePath 更严——**删除只允许发生在源目录内**，防止借道删除项目其他文件）；
2. `basename` 扩展名在该引擎允许列表内；
3. 文件存在（否则 404）；
4. 删除执行 `fs.unlink`（仅文件，不允许目录）。

响应：`{ success: true, data: { path, engine } }`；path 不合法 → 403 带具体原因（复用 files 侧「源目录白名单」的提示风格）。

### 4.3 前端交互（Sources.vue）

- PageHeader actions 新增 **「上传源」** 主按钮：页面内对话框（复用 `useDialog().form` 或 AppDialog）：
  - 引擎下拉（USelect，五类，默认当前 tab 的引擎）；
  - 文件选择（隐藏 `input[type=file][accept=...]` + 文件名展示；支持拖拽文件到对话框命中区——加分项，可后置）；
  - 同名检测：选中文件后即时探测目标是否存在（`listSources` 已含全部名字），存在则显示「将覆盖现有源」黄色提示 + 确认词；
- 每行操作区（验证源按钮旁）新增 **删除按钮**（trash 图标，`text-danger`）：`dialog.confirm({ danger: true, requireText: 源文件名 })` 强制输入文件名确认，防误删；
- 上传/删除成功后刷新列表 + toast；上传带语法校验结果提示（失败可一键「打开编辑器」跳 SourceEditor 修改）。

### 4.4 拖拽与批量（加分项，可后置到 P2）

- 列表面板整体作为拖拽落区：按扩展名自动归类引擎目录；
- 多文件批量上传：循环调用 upload 接口，进度条汇总展示。

## 5. 插件 zip 上传设计

### 5.1 依赖与配置

- 新依赖 `@fastify/multipart`（纯 JS）；注册于 `controllers/admin.js`（`fastify.register(multipart)`）；
- 上传临时文件落在 `utils/pluginMarket.js` 已有的 `TMP_DIR`（`data/market-tmp/`），命名 `upload-{Date.now()}.zip`，处理后删除——与市场安装的临时 zip 同生命周期。

### 5.2 API

**POST `/api/admin/plugins/upload`**（`multipart/form-data`，流式落盘）

| 字段 | 说明 |
|------|------|
| `file` | zip 文件（必填，`.zip` 扩展名，大小 ≤ 500MB 与市场下载上限一致） |
| `active` | 选填，登记为随服务启动（默认 false） |
| `start` | 选填，安装完成后立即启动（默认 false） |
| `sha256` | 选填，浏览器端 `crypto.subtle` 预计算的哈希，服务端校验传输完整性（与市场包 sha256 校验同机制） |

行为：

1. 流式落盘 → 跳过下载、直接进入 `installPlugin` 管线（sha256 有传则校验）；
2. 插件名从**包内 `plugin.json`** 解析（installPlugin 现有逻辑），无需用户输入；包内无 manifest 的「上游原始包」同样支持（自动剥壳 + 从文件名推断 name 生成 manifest，与市场安装行为一致）；
3. 同名已安装 = **覆盖安装/更新语义**（installPlugin 换名回滚机制天然支持）；运行中先由前端引导手动停止（或后续版本自动停止，本期沿用市场安装的现有行为）；
4. 与市场安装共用 **installTask 单任务互斥**（taskBusy → 409）与 **`GET /market/install/status` 进度轮询**——前端进度条组件零改动复用。

响应：`{ success: true, data: { taskId } }`（异步，轮询同市场安装）。

### 5.3 installPlugin 的最小改造

`utils/pluginMarket.js` 的 `installPlugin(opts)` 增加可选 `zipPath`：

```js
// entry.download 与 opts.zipPath 二选一；zipPath 提供时跳过下载阶段，
// 直接以该文件为安装包（sha256 仍按 opts.entry.sha256 有无决定是否校验）
```

进度回调里 `download` 阶段在 zipPath 模式下直接置 70%。下载→校验→剥壳→manifest→完整性→登记的其余流程不动。

### 5.4 前端交互（Plugins.vue）

- 头部新增 **「上传插件」** 按钮（与「从市场安装」并列）：对话框内
  - zip 文件选择（`accept=".zip"`）；
  - 两个开关：随服务启动（USwitch）/ 安装后启动（USwitch），默认均关；
  - 提交即进入**现有安装任务进度面板**（轮询 `/market/install/status`，复用现有 stage/percent/logs 渲染，零改动）；
- 409（任务互斥）时 toast 提示「已有安装任务进行中」；
- 上传完成后刷新插件列表（`getPlugins` 已合并 manifest 版本信息）。

## 6. 安全考量汇总

| 面 | 措施 |
|----|------|
| 路径穿越 | 上传/删除均 `basename` 化文件名 + 源目录前缀白名单 + `safePath` 终检（双层） |
| 文件类型 | 引擎目录扩展名白名单；zip 仅接受 `.zip` |
| 大小 | 源 ≤5MB（路由级 bodyLimit）；zip ≤500MB（multipart 流式，内存恒定） |
| 覆盖 | 同名源需 `overwrite:true` 且前端确认弹窗；插件覆盖走 installPlugin 回滚机制 |
| 删除 | 仅允许源目录内的单文件，`dialog.confirm(danger + requireText=文件名)` |
| 鉴权 | 全部在 `/api/admin/*` 下，自动继承全局 Basic Auth |
| DoS | zip 大小上限 + 单任务互斥 + multipart 流式（不驻留内存） |

## 7. 测试与验收

**单测**（`tests/unit/source-upload.test.js`，纯函数抽取）：

- 源文件名校验：扩展名/路径穿越/空名/超长名；
- 引擎映射完整性（SOURCE_ENGINES 五类）；
- 删除路径前缀判定：`spider/js/x.js` ✓、`spider/js_bad/x.js` ✗、`controllers/index.js` ✗、`spider/js/../../.env` ✗。

**API 级验收**（curl，带 Basic Auth）：

- 上传正常 js 源 → 200 + check.ok；同名不带 overwrite → 409；带 overwrite → 200 覆盖；
- 上传 `engine=js&filename=evil.sh` → 400；`path=../` 穿越 → 403；
- 删除刚上传的源 → 200，列表不再出现；删除不存在 → 404；
- 插件上传：构造最小合法 zip（plugin.json + index.js）→ 200 taskId → 轮询至 done → 插件列表出现且 `.plugins.js` 登记；再传一次 → 覆盖安装成功；zip 内带 `../` 恶意条目 → 安装失败且回滚（ZipSlip 用例）；
- Swagger `/json` 收录三个新端点。

**页面**（浏览器）：

- 源管理：上传 → 列表出现 → 自动校验提示 → 删除（requireText 确认）→ 列表消失；
- 插件：上传最小 zip → 进度面板走完 → 列表出现新插件 → 启动/停止正常；
- 暗亮主题、移动端（390px）对话框不溢出。

## 8. 任务拆分

| # | 任务 | 涉及文件 | 规模 |
|---|------|----------|------|
| T1 | SOURCE_ENGINES 收敛 + listSources 补 dr2 分类 + upload/delete 控制器 | `sourcesController.js` | M |
| T2 | installPlugin 增加 zipPath 入口（跳过下载） | `utils/pluginMarket.js` | S |
| T3 | `@fastify/multipart` 引入 + plugins/upload 控制器（流式落盘 + 管线复用） | `controllers/admin/pluginsController.js` 或 pluginMarketController、`controllers/admin.js` | M |
| T4 | 路由 schema（Swagger 收录） | admin.js 注册处 | S |
| T5 | 源管理前端：上传对话框 + 删除按钮 + 列表刷新 | `Sources.vue` | M |
| T6 | 插件管理前端：上传对话框 + 进度复用 | `Plugins.vue` | M |
| T7 | 单测 + 端到端验收（含 ZipSlip 恶意包用例） | `tests/unit/` | M |
| T8 | `yarn admin:build` 产物入库 | apps/admin | S |

依赖顺序：T2/T3 后端先行 → T1 → T5/T6 → T7 → T8。整体预估 1.5~2 个开发日。

## 9. 未来扩展（记录不做承诺）

- 源批量上传/拖拽整目录导入；源市场（分享源清单订阅，复用插件市场模式）；
- 插件上传支持 `.mcpb`/多文件表单；上传断点续传（当前 500MB 上限内一次传输）；
- 删除源进回收站（软删除 + 恢复）。
