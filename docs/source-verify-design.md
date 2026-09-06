# 源验证重新设计：代码语法验证 + 接口全流程验证

> 状态：已实施（T1-T6 完成，单测 8 项 + 端到端验收全 PASS）
> 日期：2026-08-31
> 关联：`controllers/admin/sourcesController.js`（validateSpider/checkSyntax）、`apps/source-checker/index.html`（全流程检测的既有参照实现）、`utils/api_validate.js`（validatePwd：`process.env.API_PWD`）、`drpy-node-admin/src/views/Sources.vue`

---

## 1. 背景与现状问题

现有「验证源」（`validateSpider`）的验证内容：

| 源类型 | 现有行为 | 问题 |
|--------|----------|------|
| js | vm 沙箱执行源文件 → 检查 `rule` 对象存在 + `title/host/url` 非空 | 只证明「文件能执行、字段在」：host 可能早已失效、分类/搜索规则可能全挂，**接口能不能出数据完全不知道**——这就是鸡肋的根源 |
| php | `php -l` 语法检查 | 与 `checkSyntax` 完全重复 |
| py | `python -m py_compile` | 同上 |

对照 `apps/source-checker/index.html` 检测页（对全部源做 home/分类/详情/搜索四步真实请求验证），源管理页缺一个**针对单个源的深度功能验证**。

## 2. 目标形态：拆成两个功能

| 功能 | 定位 | 速度 | 实现基础 |
|------|------|------|----------|
| **A 代码语法验证** | 静态检查：文件能编译/解释 | 毫秒级 | 保留现有 `checkSyntax`（js vm 编译 / php -l / py compile），UI 上明确命名「语法检查」 |
| **B 接口全流程验证**（新） | 动态验证：对该源真实走一遍 首页→分类→详情→搜索（→播放） 协议链路 | 秒级（每步独立超时） | 新增 `POST /api/admin/sources/verify-flow`，服务端驱动 |

两个按钮并列在源行操作区，语义互补：A 验「代码写得对不对」，B 验「源还能不能用」。

## 3. 功能 B 设计：接口全流程验证

### 3.1 架构：服务端驱动（对比前端驱动）

source-checker 检测页是**前端 fetch 逐个调用**源 API。源管理的单源流程验证改用**服务端驱动**，理由：

1. `/api/{module}` 受 `validatePwd`（`process.env.API_PWD`）保护——服务端自调用直接带 pwd，无需向前端暴露；
2. 内部走 `http://127.0.0.1:PORT`，无外网回环、无 CORS/鉴权干扰，延迟更真实；
3. 结果结构化（每步耗时/数据量/sample）一次返回，前端只做展示。

### 3.2 API

`POST /api/admin/sources/verify-flow`（schema：tags 源管理）

```jsonc
// 请求
{
  "path": "spider/js/热门推荐.js",     // 源相对路径（matchSourceEngine 校验）
  "options": {
    "searchKeyword": "爱",            // 可选，搜索关键词，缺省 "爱"
    "perStepTimeoutMs": 10000,        // 可选，每步超时（上限 30s）
    "verifyPlay": false               // 可选，深度播放验证（默认关，见 §3.4）
  }
}
// 响应
{
  "success": true,
  "data": {
    "module": "热门推荐",
    "engine": "js",
    "verdict": "healthy",            // healthy | partial | dead | not_supported
    "okSteps": 4, "totalSteps": 4,
    "steps": [
      { "step": "home",     "label": "首页",   "ok": true, "httpStatus": 200, "costMs": 312, "items": 18, "sample": {...} },
      { "step": "category", "label": "分类",   "ok": true, "costMs": 280, "items": 24 },
      { "step": "detail",   "label": "详情",   "ok": true, "costMs": 350, "items": 1, "playable": true },
      { "step": "search",   "label": "搜索",   "ok": true, "costMs": 420, "items": 12 },
      { "step": "play",     "label": "播放",   "ok": false, "error": "...", "skipped": false }
    ],
    "costMs": 1362
  }
}
```

- `verdict`：`okSteps/totalSteps ≥ 0.75`（4 步里 ≥3）→ `healthy`；≥1 → `partial`；0 → `dead`；dr2 源 → `not_supported`（提示仅支持语法验证）；
- `play` 步骤**不计入基础分**（外站链接有效性不可控），只在 `verifyPlay: true` 时执行并单独展示。

### 3.3 流程步骤（对齐 source-checker 的成熟判定，修正其不足）

每步 = 服务端 `fetch(http://127.0.0.1:PORT/api/{module}?pwd=...&<参数>)` + AbortController 超时 + JSON 解析 + 数据有效性校验：

| 步骤 | 请求参数 | 通过判定 |
|------|----------|----------|
| 1 home 首页 | 无参 | HTTP 200 且 `class` 为非空数组 |
| 2 category 分类 | `ac=list&t=<home 第一个有效 type_id>&pg=1` | `list` 非空且含有效项（过滤 `vod_id==='no_data'`/「无数据,防无限请求」占位——复用检测页 isValidData 判定） |
| 3 detail 详情 | `ac=detail&ids=<分类第一项 vod_id>` | HTTP 200 且返回列表/详情结构；**附加 `playable`**：`vod_play_url` 非空（多数源播放地址在此给出） |
| 4 search 搜索 | `wd=<searchKeyword>` | 同 category 判定 |
| 5 play 播放（可选） | `play=<detail 第一集地址>&flag=<flag>` | 返回结构含可解析的播放信息（jx/url/parse 任一）；默认关闭 |

相对 source-checker 的改进：分类用 home 真实 `type_id`（检测页已有）、detail 用分类真实 `vod_id`（已有）、**新增 playable 判定**（检测页缺失）、新增可选 play 深度验证（检测页缺失）。

### 3.4 播放验证的边界

`play` 深度验证默认关闭：外站播放地址有效性不可控（防盗链/区域限制），误报率高。`verifyPlay: true` 时执行并单独展示，不计入 verdict。

### 3.5 引擎适配范围

| 引擎 | 流程验证 | 说明 |
|------|----------|------|
| js（drpyS） | ✅ 完整流程 | 协议标准（class/list/vod_play_url） |
| py（hipy）/ php / catvod | ✅ 基础流程 | 走 `do=py/php/cat` 参数映射，home/list/search 协议同构 |
| dr2 | ❌ 仅语法验证 | `/api` 路由无 dr2 分支（dr2 走 `enable_dr2` 公开 cat 形态分发），verify-flow 返回 `not_supported` |

`do` 映射复用 `getApiEngine` 的既有约定：py→`do=py`、php→`do=php`、catvod→`do=cat`、js→缺省。

### 3.6 并发与防呆

- 进程内单飞互斥（同 installTask 模式）：同一时间仅允许一个 verify-flow（并发 409）；
- 每步超时独立（默认 10s，上限 30s）；总时长软上限 = 步数 × 单步超时；
- 停用源也可验证（验证是诊断工具，与启用/停用正交）。

## 4. 前端（Sources.vue）

- 行操作区「验证源」按钮拆为两个：
  - **语法检查**（闪电图标，title「语法检查」）：调用现有 `checkSyntax`，结果沿用行内红绿文本；
  - **流程验证**（播放图标，title「接口全流程验证」）：调用 verify-flow，按钮转圈；
- 流程验证结果：行下方展开步骤面板（替代现有单行验证结果文本）——每步一行：状态点（绿/红/灰）+ 步骤名 + 耗时 + items 数；顶部汇总徽标（healthy=绿「可用」/ partial=黄「部分可用」/ dead=红「不可用」/ not_supported=灰）；
- 面板内提供「深度验证播放」勾选（触发 verifyPlay 重跑）；
- 结果缓存于 `validationResults[path]`（现有结构扩展 `{kind: 'syntax'|'flow', ...}`），翻页/搜索不丢；
- 移动端：步骤面板纵向堆叠，触控目标不变。

## 5. 边界与非目标

- 不做**批量**流程验证（全量批量是 source-checker 检测页的职责，本期单源化；二期可把 verify-flow 接入检测页报告）；
- play 深度验证不追最终媒体流（不下载 ts/mp4，只验证源 play 接口出地址）；
- 不改变 `/api/{module}` 对停用源的可调用性（见 source-toggle-design §4）；
- 不引入新依赖（fetch + AbortController 原生能力）。

## 6. 任务拆分

| # | 任务 | 涉及文件 | 规模 |
|---|------|----------|------|
| T1 | verify-flow 控制器：步骤引擎（fetch/超时/isValidData/playable）+ 互斥 + verdict | sourcesController.js（或 utils/sourceVerify.js 收敛纯函数） | M |
| T2 | 路由 + schema + Swagger | admin.js | XS |
| T3 | checkSyntax 保留并在 UI/文档层面与流程验证分离命名 | sourcesController.js、admin.js | XS |
| T4 | Sources.vue：双按钮 + 步骤面板 + 深度播放勾选 + 结果结构扩展 | Sources.vue | M |
| T5 | admin:build + 端到端验收（真实源跑全流程） | — | S |

预估 1 开发日。依赖顺序：T1 → T2 → T4 → T5。

## 7. 测试与验收

**单测**（tests/unit/source-verify.test.js）：isValidData 占位过滤、verdict 评分边界、do 参数映射、互斥 409（mock 步骤函数）。

**端到端**（curl，真实源）：
1. 对健康源（如 央视大全[官]）verify-flow → verdict=healthy、home/category/detail/search 全 ok、detail.playable=true；
2. verifyPlay=true → play 步骤执行且不影响 verdict 基础分；
3. 对坏源（host 失效）→ verdict=dead，错误信息含超时/HTTP 状态；
4. dr2 源 → `not_supported`；
5. 并发第二次调用 → 409；
6. schema 校验：未知路径 400；
7. Swagger /json 收录。

**页面**：语法检查与流程验证按钮独立可用；步骤面板实时展开；停用源同样可验证；暗亮主题、390px 不溢出。
