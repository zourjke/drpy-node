# 源启用/停用 设计（源管理界面）

> 状态：设计稿（待评审 → 开发）
> 日期：2026-08-31
> 关联：`controllers/config.js`、`controllers/admin/sourcesController.js`、`drpy-node-admin/src/views/Sources.vue`、`utils/api_validate.js`
> 依赖现状：Basic Auth 全局鉴权、Sources.vue 已有列表/验证/编辑/上传/删除能力

---

## 1. 背景与需求

| # | 需求 | 验收口径 |
|---|------|----------|
| N1 | 源管理界面支持对单个源 启用/停用 | 每行开关，操作即时生效 |
| N2 | 支持批量启用/停用 | 勾选多个源一次性切换 |
| N3 | 新上传的源默认启用 | 不做任何操作即为启用 |
| N4 | 停用后：配置列表（/config*）不含停用源 | 壳子拉配置看不到停用源 |
| N5 | 停用后：订阅列表（/config?sub=订阅码）不含停用源 | 订阅分发同样排除 |
| N6 | 停用**不影响** healthy=0 的全源检测 | 检测器（`/config/1?sub=all&healthy=0`）仍能看到并检测全部源（含停用） |

## 2. 现状调研

### 2.1 源的发现与加载

- 引擎目录五类：`spider/js`（drpyS/dr2 由 `do` 参数区分）、`spider/py`、`spider/php`、`spider/catvod`；`_` 开头文件与 `base_*.py` 为约定排除。
- `/api/{module}` 直接调用走 `getApiEngine()` 按路径拼模块文件，**与目录扫描无关**（不做全局清单校验）。

### 2.2 /config 配置组装（`controllers/config.js` generateSiteJSON，1125 行）

- 各引擎分支各自 `readdirSync` + 过滤得到文件名列表，再组装 `sites`：
  - drpyS：L99 `valid_files`；App 模板分支复用该列表（L141 `valid_files.includes`）
  - dr2：L298 `dr2_valid_files`
  - py：L437 `py_valid_files`
  - php：L541 `php_valid_files`（排除 config/index/test_runner.php）
  - catvod：L597 `cat_valid_files`
- **xbpq 源不进 /config 的 sites**（config.js 无该分支，仅 /api 直接调用），本期不涉及。
- 订阅：`sub=订阅码` → `getSubs()` 匹配 → `sub.mode 0/1` 正则对 `valid_files` 与 `sites` 做包含/排除过滤——**与普通 /config 走同一条组装路径**，因此过滤实现放在 generateSiteJSON 内即可同时覆盖 N4/N5。
- healthy 参数：`healthy=1` 按 `data/source-checker/report.json` 过滤 `status==='error'` 的源；**`healthy=0` 不做任何过滤、全量输出**——这正是「源检测器」的数据来源（检测器拼 `/config/1?sub=all&healthy=0` 拉全量源清单后逐个测活）。

### 2.3 全源检测（`controllers/source-checker.js`）

- `GET /source-checker/config/default` 生成检测入口 URL：`/config/1?sub=all&healthy=0&pwd=...`；
- 检测端（apps 下检测页）拿该配置的全部 sites 逐个测活，报告 POST 回 `/source-checker/reports/save` 落 `data/source-checker/report.json`。
- **结论**：只要 healthy=0 的输出仍包含停用源，检测链路零改动即可满足 N6；可选增强为在输出条目上加 `disabled` 标记供检测报告展示。

### 2.4 缓存链

- `/config*` 每次请求实时组装并**覆写 `data/cat/index.json`**（`/1` 形态额外写 `custom.json`）；
- `GET /index` 直接读 index.json 返回——**若停用后不刷新，/index 仍是旧内容**，需要失效处理（见 §3.4）。

## 3. 方案设计

### 3.1 停用状态存储：`config/source-states.json`（选型对比）

| 候选 | 评价 |
|------|------|
| **独立文件 `config/source-states.json`（采纳）** | 职责单一；`{"disabled": ["spider/js/xxx.js", ...]}` 以**相对路径全称**记录停用源（跨引擎无歧义）；不在列表 = 启用，天然满足 N3；可手改；后台环境配置页不受干扰 |
| config/env.json 存列表 | env.json 是用户可编辑的全局变量面板，混入内部状态语义混乱；列表在管理 UI 上不可视 |
| 文件改名 `.disabled` 后缀 | 文件系统即真相很优雅，但目录扫描不到 → healthy=0 全量输出需要特殊找回逻辑，N6 实现反而变绕；且改名会让 Sources 上传/删除按文件名匹配的逻辑全部要多一份别名处理 |

工具模块收敛为 **`utils/sourceState.js`**（新增）：

```text
getDisabledSet()                    → Set<"spider/js/xxx.js">（缓存 + mtime 失效，接口热生效）
setEnabled(paths[], enabled)        → 增/删条目并落盘（写前合并去重）
removePaths(paths[])                → 删除源时同步清理残留（联动 deleteSource）
getDisabledFilenameSet(dirPrefix)   → 该引擎目录下的停用文件名 Set（供 config.js 过滤用）
```

文件不存在视为全启用（首次停用时自动创建，与 `config/env.json` 同逻辑：用户自定义数据不入库、不入分发包）；读写失败不抛断服务（停用是运营功能，降级为全启用并 logWarn）。

### 3.2 /config 过滤点（N4/N5）与 healthy=0 例外（N6）

- `generateSiteJSON(options, requestHost, sub, pwd, opts)` 增加第 5 参 `opts.includeDisabled`：
  - 路由层计算：`includeDisabled = (healthy === '0')`——**healthy=0（检测模式）跳过停用过滤，其余（含 healthy=1/缺省/订阅）一律过滤**；
- 过滤实现：函数开头取 `const disabledNames = includeDisabled ? null : getDisabledFilenameSet()`，在 5 处引擎分支的 valid_files 过滤链各追加一项：

```js
// drpyS 分支示例（dr2/py/php/cat 同型，替换各自变量名与目录前缀）
if (disabledNames) valid_files = valid_files.filter(f => !disabledNames.has(f));
```

- App 模板分支（L141）复用 drpyS 的 valid_files，自动生效，无需单独处理；
- **不拦截 `/api/{module}` 直接调用**：healthy=0 检测就是「拿全量清单后直接调源 API 测活」，停用源必须可被检测器直调（N6 的另一半）；停用的语义边界定义为「不进入配置分发」，文档明示。

### 3.3 index.json / custom.json 失效（缓存链）

停用/启用写盘成功后，**异步重新生成** index.json（与 `/1` 的 custom.json）：

- 内部复用 `/config` 的组装逻辑（generateSiteJSON + healthy 缺省 + `requestHost=http://127.0.0.1:PORT` 内部形态），或轻量做法：以内部参数直接调用一次组装函数并写盘；
- 采用异步（不阻塞 API 响应），失败仅 logWarn——下次任意 /config 请求仍会自然重建；
- 设计权衡说明：index.json 的 api 地址依赖生成时的 Host，内部形态（127.0.0.1）与外部请求形态可能不同——这是**既有行为**（index.json 本就是最后一次 /config 请求的缓存），本期不改变该语义。

### 3.4 API 设计（全部落在 `/api/admin/sources/*`，自动继承 Basic Auth）

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/admin/sources` | GET | **增强**：现有分组结构基础上，每个源对象增加 `enabled: boolean`（读 source-states）；前端直接驱动开关 |
| `/api/admin/sources/enabled` | POST | 批量设置：`{ "paths": ["spider/js/a.js", ...], "enabled": false }`；单操作即单元素数组（N1/N2 一个端点覆盖）；paths 做源目录白名单 + 扩展名校验（复用 upload/delete 的校验口径）；写盘后触发 §3.3 异步重建；返回 `{updated: n}` |
| `/api/admin/sources/delete` | POST | **联动增强**：删除成功后 `removePaths([path])` 清理 disabled 残留，避免脏数据 |
| `/api/admin/sources/upload` | POST | **无改动**：新源天然启用（不在 disabled 列表）；若覆盖一个已停用的同名源，**保持停用状态**（停用针对路径而非内容，符合直觉） |

路由 schema 全部补齐（tags: 源管理），Swagger 自动收录。

### 3.5 前端（Sources.vue）

- **每行开关**：操作区最前加 `USwitch`（绑定 `source.enabled`），切换调 `/sources/enabled`（单元素），成功 toast + 本地状态更新；
- **批量操作**：每行加复选框 + 表头全选（当前筛选结果的可见项）；工具行在勾选非空时出现「启用(n)/停用(n)」批量按钮；停用为高危语义操作，批量停用走 `dialog.confirm` 确认；
- **停用样式**：停用源行降透明度 + 名称旁「已停用」UBadge（tone=warn）；
- **筛选**：类型 chips 后追加一个「已停用」过滤项（与搜索框共存）；
- **上传**：上传对话框无需改动（新源默认启用）；删除按钮已存在，后端联动清理对前端透明；
- **统计条**：加「停用」计数卡（数值来自列表聚合）；
- 移动端：开关与复选框触控目标 ≥ 40px，批量按钮工具行换行堆叠。

### 3.6 检测器侧（source-checker）

零改动即可满足 N6（healthy=0 输出含停用源）。可选增强（本期不做承诺）：healthy=0 输出的停用源条目附 `disabled: 1` 字段，检测报告可展示「停用」状态而非「失败」，避免检测报告里停用源显示为 error 引起误解。

## 4. 边界与非目标

- 停用**不阻断** `/api/{module}` 直接调用（检测器依赖直调；直接构造 URL 的调用不受影响——停用语义 =「不进入配置分发」）；
- `_` 开头文件 / php 的 config|index|test_runner / py 的 `base_*`：既有约定排除，与停用正交，不进入本功能管理范围（界面列表本就不展示它们）；
- xbpq 源不进 /config sites，本期不支持其启停（界面列表也未包含该引擎）；
- 订阅码本身的状态（subs 里 status=0 禁用订阅码）与本功能正交；
- 不做多实例/分布式一致性（单机文件状态）。

## 5. 任务拆分

| # | 任务 | 涉及文件 | 规模 |
|---|------|----------|------|
| T1 | utils/sourceState.js（读写/缓存/白名单校验）+ 单测 | 新增 utils/sourceState.js、tests/unit/source-state.test.js | S |
| T2 | /api/admin/sources 列表增强 enabled + /sources/enabled 批量端点 + schema | sourcesController.js、admin.js | S |
| T3 | deleteSource 联动清理 | sourcesController.js | XS |
| T4 | config.js：generateSiteJSON 过滤（5 分支）+ includeDisabled 参数 + 路由层 healthy=0 判定 | config.js | M |
| T5 | 停用切换后异步重建 index.json/custom.json | config.js 或 sourcesController.js | S |
| T6 | Sources.vue：开关/批量/样式/筛选/统计 | Sources.vue | M |
| T7 | 端到端验收（见 §6）+ admin:build | — | M |

预估 1~1.5 开发日。依赖顺序：T1 → T2/T3（接口先行）→ T4（核心过滤）→ T5 → T6 → T7。

## 6. 测试与验收

**单测**（tests/unit/source-state.test.js）：disabled 集合增删/去重、文件缺失全启用、非法路径拒绝、并发写合并。

**API 级**（curl，Basic Auth）：
1. 停用 `spider/js/某源.js` → `GET /sources` 该源 enabled=false；
2. `curl /config?pwd=x`（与 `?sub=all`）的 sites 不含该源；`?sub=<订阅码>` 同样不含；
3. `curl '/config/1?sub=all&healthy=0&pwd=x'` 的 sites **仍含**该源（N6）；
4. 启用回 → 配置恢复包含；
5. 删除一个停用源 → source-states.json 无残留；
6. 上传新源 → 默认 enabled=true；
7. index.json 在停用/启用后 5 秒内被重建（内容反映最新状态）；
8. Swagger /json 收录新端点。

**页面**：开关切换即时反馈；批量勾选→批量停用（确认弹窗）→ 列表与配置接口同步；停用行样式与「已停用」筛选；暗亮主题、移动端 390px 不溢出。

## 7. 未来扩展（不做承诺）

- 停用源在检测报告中标记展示（§3.6 可选增强）；
- 拖拽排序 / 置顶（order_common.html 排序机制的界面化）；
- 按源的健康状态一键「停用全部失效源」。
