# 插件市场设计（Plugin Market）

> 目标：在后台管理「插件管理」页加入「插件市场」入口，可浏览、安装、更新、卸载适配 `.plugins.js` 的二进制插件与 Node 服务插件包，并管理安装状态、版本、名称描述。

---

## 一、现状盘点（实现本设计所依赖的事实）

### 1.1 插件的定义与运行（已存在，市场复用，不改动核心）

- 配置层：根目录 `.plugins.js`（用户，自动生成）→ 数组 `{ name, path, params, desc, active }`，可选 `runtime: 'node'`、`entry`、`env`、`id`；缺省回退 `.plugins.example.js`。
- 运行层：`utils/pluginManager.js` 在 `index.js` 启动时 `startAllPlugins()` 一次性拉起所有 `active: true` 的插件，支持两种形态：
  - **二进制插件**：`plugins/<name>/<name>-<platform>[.exe]`（req-proxy / pvideo / pup-sniffer / mediaProxy，Go 交叉编译）；
  - **Node 服务插件**：`runtime:'node'` + `entry`（lxserver），首次启动自动 `npm install --production`（`installPluginDeps`）+ native binding 兜底（`ensureNativeBindings`）。
- 进程句柄存于 `index.js` 的局部变量 `pluginProcs = {}`；`stopAllPlugins` 在优雅退出时 SIGTERM→3s→SIGKILL。
- **管理界面只读写 `.plugins.js`**：`controllers/admin/pluginsController.js` 三个 API（GET/POST `/api/admin/plugins`、POST `/plugins/restore`），改 `active` 后必须重启服务才生效，**没有运行时启停**。

### 1.2 可复用的既有设施

| 设施 | 位置 | 用途 |
|---|---|---|
| GitHub Release 拉取 + ghproxy 加速 | `controllers/github.js`（`/gh/release`，`https://github.catvod.com/` 前缀） | 市场源/下载加速的参考实现 |
| 路径安全校验 | `utils/pathGuard.js`（`safePath`：拒绝对路径、限制 PROJECT_ROOT 内、黑名单） | Zip Slip 防护思路来源 |
| chmod 兜底 | `utils/binHelper.js`（`ensureExecutable`） | 解压出的二进制补执行权限 |
| Node 依赖自动安装 | `pluginManager.js`（`installPluginDeps` / `ensureNativeBindings`） | Node 型插件装完即走存量首启逻辑，市场安装无需关心依赖 |
| 管理端鉴权 | `controllers/admin.js` preHandler BasicAuth（覆盖 `/api/admin/*`） | 新 API 自动受保护 |
| 前端插件页 | `drpy-node-admin/src/views/Plugins.vue`（卡片列表/编辑弹窗/搜索/未保存提示） | 市场入口宿主页面 |
| axios | 主项目依赖 | 市场源与插件包下载 |

### 1.3 缺口（本设计要补的）

1. 无插件包规范与市场源协议；
2. 无下载/解压/落位/卸载（项目当前**没有 zip 解压依赖**）；
3. 无版本与安装状态管理；
4. 无运行时启停（装完必须重启服务）。

---

## 二、目标与非目标

**目标**
- P0：市场浏览（多源聚合）、安装、更新、卸载；安装状态与版本展示；与 `.plugins.js` 双向兼容（存量插件不破坏）。
- P1：运行时启动/停止/重启 + 运行状态展示，装完即可用，无需重启服务。

**非目标（明确不做）**
- 不改 `pluginManager.js` 的启动/停止语义（市场只负责"把包放进 plugins/ 并登记进 .plugins.js"）；
- 不做插件签名/信任链（P2 可选 sha256 校验）；不做评分评论等社区功能；
- 不引入数据库表——安装状态以磁盘为准（见 §四）。

---

## 三、插件包规范（分发格式）

### 3.1 包结构（两种分发形态）

**形态 A — 市场规范包**：zip 根目录含 `plugin.json`：

```
req-proxy-1.0.0.zip
├── plugin.json
├── req-proxy-win.exe
├── req-proxy-linux
├── req-proxy-darwin
└── (node 型则是 package.json + index.js + 源码)
```

**形态 B — 上游原始包**（主流场景，实测 lxserver v2.0.0 即此类）：上游项目原样 release 的 zip，**没有 plugin.json**，且顶层可能带一个目录壳：

```
lx-music-sync-server-v2.0.0-server.zip
└── lx-music-sync-server/          ← 顶层目录壳，落位时剥掉
    ├── package.json
    ├── index.js
    ├── node_modules/              ← 上游可能自带依赖，此时无需 npm install
    └── public/
```

两类包走同一条安装管线，差别只在 manifest 来源与剥壳（见 §5.2）。

### 3.2 `plugin.json` manifest

```json
{
  "name": "req-proxy",
  "version": "1.0.0",
  "title": "请求代理服务",
  "desc": "为源提供请求代理能力",
  "author": "hjdhnx",
  "runtime": "binary",
  "entry": "index.js",
  "params": "-p 57571",
  "env": {},
  "binaries": {
    "win32": "req-proxy-win.exe",
    "linux": "req-proxy-linux",
    "darwin": "req-proxy-darwin",
    "android": "req-proxy-linux"
  },
  "homepage": "https://github.com/xxx/req-proxy"
}
```

- `name`：全局唯一 id，同时决定二进制默认命名（与现有 `<name>-<platform>` 约定一致）；
- `runtime`：`binary`（默认）| `node`；`node` 型 `entry` 必填；
- `params`/`env`：**默认值**，落位进 `.plugins.js` 后用户可在管理页改；
- `binaries` 可省略——省略时按现有 `getPluginBinary` 的 `<name>-<platform>[.exe]` 约定探测，完全兼容现有 4 个二进制插件日后补 manifest 进市场；
- **manifest 来源优先级**：包内 `plugin.json`（形态 A）> 市场清单条目（形态 B，清单字段与 manifest 同构，name/version/desc/runtime 都在清单里）。形态 B 安装时由安装器**用清单条目生成 `plugin.json` 落盘**到插件目录——否则重启后"已安装版本"无从读取，§4.2 的磁盘即真相模型会失效。

### 3.3 与存量插件/手工放置的兼容

- 目录存在但无 `plugin.json` → 视为「本地已安装（未托管）」，版本显示"未知"，市场不可对它做更新/卸载外的操作时降级提示；不阻塞、不报错。**注意边界**：此判定只针对用户手工解包放置的情况；**经市场安装的包即使原始 zip 无 manifest，安装器也会落盘 plugin.json（§3.2），故一律算已安装（installed）**。
- `.plugins.js` 里已有同名条目 → 安装时**保留用户已改的 `params`/`env`/`active`**，仅补齐缺失字段（见 §五合并规则）。

---

## 四、市场源协议与本地状态模型

### 4.1 市场源

`config/market.json`（可后台编辑）：

```json
{
  "sources": [
    "https://raw.githubusercontent.com/hjdhnx/drpy-plugins/main/market.json"
  ],
  "ghProxy": "https://github.catvod.com/"
}
```

远端 `market.json`（插件目录清单）：

```json
{
  "updated": "2026-08-29T00:00:00Z",
  "plugins": [
    {
      "name": "req-proxy",
      "version": "1.0.0",
      "title": "请求代理服务",
      "desc": "…",
      "author": "…",
      "runtime": "binary",
      "platforms": ["win32", "linux", "darwin"],
      "download": "https://github.com/xxx/releases/download/v1.0.0/req-proxy-1.0.0.zip",
      "sha256": "…",
      "homepage": "…"
    }
  ]
}
```

- 聚合规则：多源按 `name` 去重，先注册的源优先；单源拉取失败不阻塞其他源，失败源在响应中带 `errors` 提示；
- 下载 URL 命中 github.com 时自动尝试 `ghProxy + url` 兜底重试（复用 `/gh/release` 的加速约定）。

### 4.2 状态模型：磁盘即真相（关键决策）

**不引入第二个状态文件/数据库表。** 安装状态与版本实时推导：

| 状态 | 判定 |
|---|---|
| `not_installed` | `plugins/<name>/` 不存在 |
| `installed` | 目录存在 + 有 `plugin.json`（版本 = manifest.version） |
| `local_only`（未托管） | 目录存在 + 无 `plugin.json` |
| `update_available` | 已安装且 manifest.version < 市场最新 version（semver 比较用 20 行手写比较即可，不引依赖） |
| 运行状态（P1） | 运行时注册表中有存活进程 → `running`/`stopped`/`failed` |

好处：卸载重装、手工解包、备份恢复天然一致；没有双写不一致问题。

---

## 五、后端设计

### 5.1 新增依赖

- `adm-zip`（纯 JS zip 解压，零 native，多平台/ARM/Docker/Vercel 安全）——项目当前无任何解压能力，此项不可避免。
- semver 比较不引库，手写。

### 5.2 新模块 `utils/pluginMarket.js`

职责单一函数集（无类、无状态，便于测试）：

- `fetchMarketIndex(sources, ghProxy)` → 聚合清单；
- `getInstalledManifest(pluginDir)` → 读 `plugin.json` 或 null；
- `compareVersions(a, b)` → -1/0/1；
- `installPlugin({ url, sha256, expectedName, expectedManifest })` 流程（实测校准过——lxserver v2.0.0 上游原始包即走此路径）：
  1. axios 流式下载到 `data/market-tmp/<name>-<ts>.zip`（Content-Length 与流累计双重上限，默认 500MB；超时 10min）；
  2. 可选 sha256 校验（清单提供了才校验）；
  3. `AdmZip` 读条目 → **Zip Slip 防护**：每个 entry 的 resolve 结果必须落在目标目录内且 entry 名不含 `..`/盘符/绝对路径（参考 `pathGuard` 语义，针对压缩包实现独立校验函数 `safeZipEntryName`）；
  4. **剥壳判定**（先在条目名列表上做，不落盘）：根级含 `plugin.json` → 无壳，根即插件根；根级仅一个目录且无根级文件 → 剥掉该顶层目录壳，其内容即插件根（上游原始包常态）；其余结构 → 报「包结构无法识别」并保留下载文件供排查；
  5. 解压到 `plugins/<name>/`：目录已存在时**先解压到临时目录再原子换名**（`fs.renameSync` 换入，旧目录改名 `.bak` 保留，成功后删除——失败可回滚）；
  6. **manifest 落定**：包内有 `plugin.json` → 读取并校验 `name === expectedName`；没有（形态 B）→ 用市场清单条目 `expectedManifest` 生成 `plugin.json` 写入插件目录（§3.2 来源优先级），保证磁盘即真相；
  7. **装后完整性校验**：node 型断言 `entry` 文件存在；binary 型按 `<name>-<platform>[.exe]` 约定或 `binaries` 映射可探测到至少一个二进制（当前平台缺失只警告不阻断——上游可能只出了部分平台包，前端已有提示）；校验失败则回滚换名并报错；
  8. 二进制文件统一 `ensureExecutable`；
  9. 合并登记进 `.plugins.js`（`path` 生成规则固定为 `plugins/<name>`，见合并规则）并返回安装结果。
- `uninstallPlugin(name)` / `registerOrUpdatePluginsConfig(...)`（写回 `.plugins.js`，格式沿用 `pluginsController.savePlugins` 的生成模板）。

`.plugins.js` 合并规则：同名条目存在 → 仅当缺字段时补 `path/runtime/entry/params/env/desc`（用户已显式设置的不覆盖）；不存在 → 追加 `{...manifest 映射, path: 'plugins/<name>', active: install 请求的 active 参数（默认 false）}`。「装完即常驻启用」场景（如实测的 lxserver）由 `active: true` 表达，`start: true`（P1）则表达「本次立即拉起」，二者独立。

### 5.3 进程注册表抽取（P1 前置小改）

`index.js` 的 `pluginProcs` 局部变量抽到 `utils/pluginRegistry.js`（导出单例字典 + `getProc(key)`），`pluginManager` 增加：

- `startPluginByKey(key)` / `stopPluginByKey(key)`：按 key 找配置（复用已加载的 `plugins` 数组）启/停单个插件，`stopPlugin` 逻辑完全复用；
- `getRuntimeStatus()` → `{ key: { running, pid, startedAt, exitCode } }`（监听 exit 事件更新）；
- 已知上限：Node 型插件首次启动的 `installPluginDeps` 是 **spawnSync 阻塞最长 10 分钟**，直接放进 HTTP 请求会挂死连接。处理：start API 先查 `node_modules` 是否存在，缺失则返回 202「后台安装依赖中」，用 `child_process.exec`（异步）装完再拉起，前端轮询状态。给该处加 `ponytail:` 注释标注天花板与升级路径。

### 5.4 新控制器 `controllers/admin/pluginMarketController.js` 与 API

在 `controllers/admin.js` 注册（自动受 BasicAuth 保护）：

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/admin/market/list` | 聚合市场清单 ⊕ 本地状态（§4.2 五态），返回合并后的卡片数据 |
| GET | `/api/admin/market/sources` / POST | 读写 `config/market.json` |
| POST | `/api/admin/market/install` | `{ name, version?, active?, start? }` 安装（缺省装最新）；`active:true` 登记为随服务启动常驻；`start:true` 且 P1 就绪时装完即启 |
| POST | `/api/admin/market/update` | `{ name }` = 停进程（P1）→ install 覆盖 → 按原运行状态决定是否重启 |
| POST | `/api/admin/market/uninstall` | `{ name }` 运行中且 P1 就绪则先停；未就绪时若在运行则提示"先停止或重启服务后再卸载" |
| GET | `/api/admin/plugins/status` | P1：运行状态（供已安装页状态灯轮询） |
| POST | `/api/admin/plugins/start` / `stop` / `restart` | P1：`{ name }` 单插件运行时控制 |

错误约定沿用现有 `{ success, error }`；安装类操作互斥（模块级简单布尔锁，并发第二个请求直接 409「已有安装任务进行中」）。

---

## 六、前端设计（drpy-node-admin）

### 6.1 入口形态（推荐）

**在插件管理页头部按钮组加「插件市场」按钮，页内切换两个 tab：「已安装」/「插件市场」。**

理由：语义归属插件管理；安装完成可直接联动已安装列表；不动 router/Sidebar，改动面最小。侧边栏加独立菜单作为备选（若日后市场要长出分类/搜索/详情大页再拆）。

### 6.2 `PluginMarket.vue`（新视图，由 Plugins.vue 引为 tab 组件）

- 市场卡片：`title` + `name@version`、`desc`、author、runtime 徽标（二进制/Node 服务）、平台覆盖提示（`binaries`/`platforms` 不含当前平台时标灰提示"当前平台无可用二进制"，node 型不受限）、更新时间；
- 卡片按钮随状态切换：`安装` / `更新`（高亮） / `卸载`（二次确认） / `已安装 ✓`（灰）；
- 安装中：按钮转 loading，整页禁用其他安装按钮（对应后端互斥锁）；
- 顶部：市场源管理入口（折叠面板：源列表增删 + 刷新）；来源失败的错误条；
- 筛选：全部 / 可更新 / 未安装；搜索沿用现有样式。

### 6.3 `Plugins.vue` 已安装页增量

- 卡片标题旁显示已装版本（读 `plugin.json` 的值由后端 GET `/api/admin/plugins` 顺带合并返回，未托管显示"未知"）；
- P1：卡片加运行状态点（绿=运行中/灰=已停止/红=失败，hover 显示 pid）与 启动/停止/重启 按钮；
- 市场安装/卸载后自动 `fetchPlugins()` 刷新。

### 6.4 `api/admin.js`

按 §5.4 表逐条加方法（`getMarketList`、`installMarketPlugin`、`updateMarketPlugin`、`uninstallMarketPlugin`、`getMarketSources`、`saveMarketSources`、`getPluginStatus`、`startPlugin`、`stopPlugin`、`restartPlugin`）。

---

## 七、边界与风险

| 风险 | 对策 |
|---|---|
| Zip Slip（恶意压缩包逃逸写文件） | §5.2 entry 名逐条校验，拒绝 `..`、绝对路径、盘符；解压目标限定 `plugins/<name>/`（name 本身过 `safePath` 语义校验） |
| 上游原始包结构多样（无 manifest/带目录壳/多目录歧义） | §5.2 剥壳判定三分类（根级 plugin.json / 单目录壳 / 报错）+ manifest 落盘 + 装后入口完整性校验，失败回滚 |
| 恶意/超大包 | sha256 可选校验 + 500MB 双重上限 + 仅 admin 鉴权可达 |
| 平台不匹配 | 清单 `platforms` 前端提示；二进制缺失时启动失败已有日志兜底 |
| Windows 路径/权限 | `ensureExecutable` 仅非 win32 生效（存量逻辑）；zip 内路径统一 posix→platform 转换 |
| 端口冲突 | manifest 的 params 只是默认值；已安装页可编辑（复用现有编辑弹窗） |
| 市场源不可达 | 单源失败不阻塞聚合；全部失败时市场页降级为"仅本地"并展示错误 |
| 覆盖安装失败 | 临时目录 + 旧目录 `.bak` 回滚（§5.2.4） |
| Node 型首启装依赖阻塞 | §5.3 已知上限处理（202 + 后台安装 + 轮询） |

---

## 八、实施分期与验收

**P0 — 市场闭环（无运行时控制）**
1. `adm-zip` 依赖 + `utils/pluginMarket.js` + 对应 `.test.js`（Zip Slip 校验、剥壳判定三分类、版本比较、`.plugins.js` 合并规则四组用例）；
2. `pluginMarketController` + 路由注册 + `docs/admin_api.md`、`docs/apiList.md` 补文档；
3. 前端：Plugins.vue 加市场入口/tab + `PluginMarket.vue` + api 方法；
4. 验收：从市场源安装一个 binary 型与一个 node 型插件（**node 型直接用 lxserver v2.0.0 上游原始包做真实验收——无 manifest、带目录壳、自带 node_modules**，预期落位 `plugins/lxserver`、manifest 落盘、9527 端口拉起）→ 出现在已安装列表（含版本）→ 卸载干净；存量 4 个二进制插件列表/编辑/保存不受影响。
5. 备份迁移无需额外设计：`backupController` 默认 `BACKUP_PATHS` 已含 `plugins` 与 `.plugins.js`，市场安装的插件天然纳入备份。

**P1 — 运行时启停**
1. `pluginRegistry` 抽取 + `startPluginByKey/stopPluginByKey/getRuntimeStatus` + start/stop/restart/status API；
2. 前端状态灯与启停按钮；安装/更新流程接 `start` 参数；
3. 验收：安装→启动→改 params→重启插件进程生效，全程不重启主服务；停服务时注册表内进程被 `stopAllPlugins` 正常回收（回归优雅退出）。

**P2 — 增强（按需）**
多源管理 UI 完善、安装日志实时输出（复用 logs websocket）、`minAppVersion` 拦截、本地 zip 上传安装（复用文件管理）。

---

## 九、测试要求（遵循 AGENTS.md）

- `utils/pluginMarket.test.js`：`safeZipEntryName`（构造含 `../` 恶意条目的 zip 断言拒绝）、剥壳判定（根级 plugin.json / 单目录壳 / 多目录歧义报错三分类）、`compareVersions`（1.0.0 < 1.0.10 等）、`.plugins.js` 合并（不覆盖用户已改 params/active）；
- 运行时启停逻辑若抽公共函数，同规范补测；改动后 `npm test && npm run check` 通过再提交。
