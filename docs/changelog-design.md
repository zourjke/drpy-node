# 更新日志管理机制与后台「更新日志」页面设计

> 状态：已实施（2026-08-29）
> 日期：2026-08-29
> 修订：v2 采纳「目录 + 每版本一个 Markdown」方案，替换 v1 的单文件 JSON（编辑 JSON 反人类，写作体验优先）
> 实施备注：T8（bundle 打包清单）经调研裁剪——bundle 形态为纯源运行核心，不含管理界面与 docs，无需随包；T9（changelog-sync）为 P2 可选，暂缓。
> 关联：`docs/updateRecord.md`（现状）、`drpy-node-admin/`（管理面板）、`docs/admin-ui-redesign.md`（设计语言基线）

---

## 1. 背景与痛点

| # | 痛点 | 现状证据 |
|---|------|----------|
| P1 | **自由 Markdown 无结构**：`docs/updateRecord.md` 以 `### 日期` + 自由文本记录，累计 **128 个日期段**，程序无法可靠解析出版本号、变更类型、条目 | 1.4.2 条目是 11 条连续自然段 |
| P2 | **三处手工同步**：同一份内容要在 `updateRecord.md`、`README.md`、`public/index.html` 各写一遍，已出现格式漂移 | 20260829 发布时三处手工复制 |
| P3 | **后台无入口**：想知道「当前版本、更新了什么」只能翻仓库 Markdown | 后台无版本信息入口 |
| P4 | **无检索能力**：想找「哪次更新修了某问题」只能肉眼翻找 | — |

## 2. 目标与非目标

### 目标

- G1 数据源是**人类友好的 Markdown 文件**：每个版本一个文件、任意编辑器可写、git diff 清晰；
- G2 写作格式有**轻量约定**（frontmatter + 小节名），可被程序解析为结构化数据；
- G3 后台新增「更新日志」菜单页：版本时间轴 + 全文搜索 + 类型过滤；
- G4 消除三处手工同步（README / 首页可从 Markdown 源生成）；
- G5 历史数据一次性迁移，旧文件归档退役。

### 非目标（本期不做，见 §13）

- 后台在线编辑/发布（本期只读）；
- 公开（免鉴权）changelog API 或 RSS；
- 自动从 git log 生成条目。

## 3. 总体方案与数据流

```
docs/changelog/
  ├── v2.0.0.md          ← 每版本一个文件（人维护，git 友好）
  ├── v1.4.8.md
  ├── …
  └── archive.md         ← 早期无版本号历史的归档
          │
          ▼
GET /api/admin/changelog ──── changelogController：目录扫描 + md 解析 + mtime 缓存
          │                       （输出结构化 JSON，前端不做 md 解析）
          ▼
后台「更新日志」页（版本时间轴 + 搜索/过滤）     仪表盘可复用「当前版本」StatCard
          │
scripts/changelog-sync.mjs（可选 P2）──► 生成 README / public/index.html 的更新记录段
```

核心原则：**人写 Markdown（一份），程序解析后供多处消费**。结构化发生在读取时，不要求人写结构化格式。

## 4. 数据规范：`docs/changelog/` 目录

### 4.1 选型决策

| 候选 | 结论 |
|------|------|
| 单文件 `changelog.json` | ❌ **已否决**（v1 评审）：手工编辑 JSON 反人类，注释/换行/逗号都是负担 |
| 继续单文件自由 Markdown | ❌ 程序不可解析（现状即痛点 P1） |
| **目录 `docs/changelog/` + 每版本一个 `.md`** | ✅ 写作体验最好、git diff 按版本清晰、删除/回看某版本=操作一个文件 |

### 4.2 文件组织

```
docs/changelog/
  ├── v2.0.0.md     ← 文件名即版本号：v{semver}.md（版本号唯一来源，文件内不重复声明）
  ├── v1.4.8.md
  ├── v1.4.7.md
  ├── …
  └── archive.md    ← 固定名归档文件：承载 updateRecord.md 时代无版本号的历史段落
```

约束：

- 文件名必须匹配 `^v\d+\.\d+\.\d+\.md$`，不合规文件被解析器忽略并在接口返回 `warnings`；
- 不允许同名重复（文件系统天然保证）；
- `archive.md` 是保留名，不参与版本排序，前端单独作为「历史归档」区块展示。

### 4.3 单文件格式约定

```markdown
---
date: 2026-08-29
type: major
title: Instrument Panel 与插件生态
tags: 管理界面,插件,文档
---

## 新功能

- 管理界面「Instrument Panel」全站重构：暗色/亮色双主题、全新 UI 组件库与移动端适配
- 接口文档集成 Swagger UI，文档由路由 schema 自动生成
- 新增插件市场：从远程源一键安装/更新/卸载插件
- 新增验证码识别代理：源直接请求主服务相同端口即可调用 captcha-bypass（ddddocr）插件

## 修复

- 修复 lx 音乐代理带参数请求被误杀中断
- 修复站源映射页面误报「未保存」，并新增撤销修改按钮

## 优化

- 修复十余处内存与资源泄漏（定时器堆积、连接池失效等），长时间运行更稳定
```

规则：

1. **frontmatter**（`---` 围栏，逐行 `key: value`，自写 ~15 行解析器，零依赖）：
   - `date`：必填，`YYYY-MM-DD`；
   - `title`：必填，一句话主题（缺失时回退为 `版本 vX.Y.Z` 并记 warning）；
   - `type`：选填，`major | minor | patch`，缺省 `patch`；
   - `tags`：选填，逗号分隔字符串，解析为数组；
2. **正文按 `## 小节名` 分组**，小节名映射条目类型（映射表见 4.4）；小节下的每个 `- ` 列表项为一条变更（**单行一条**，不支持多行续写，保持解析简单）；
3. 小节之外的裸列表项归入 `other`；
4. 小节名未命中映射表时整节归 `other`，但保留原小节名用于展示徽章文案；
5. 普通段落文本（非小节非列表）忽略。

### 4.4 小节名 → 条目类型映射

| 约定小节名（别名） | type | 色板（style.css 语义 token） | 徽章 tone |
|--------------------|------|------------------------------|-----------|
| 新增 / 新功能 / 特性 | `feat` | `text-accent` | `accent` |
| 修复 | `fix` | `text-warn` | `warn` |
| 优化 / 性能 | `perf` | `text-info` | `info` |
| 重构 | `refactor` | `text-mid` | `neutral` |
| 安全 | `security` | `text-danger` | `danger` |
| 文档 | `docs` | `text-low` | `neutral` |
| 其他（含未识别小节/裸列表） | `other` | `text-low` | `neutral`（徽章显示原小节名） |

映射表以常量形式放在解析器中，单测覆盖。

### 4.5 版本排序

文件名提取 semver，按数值逐段降序（复用 `utils/pluginMarket.js` 已有的 `compareVersions`——为避免 admin 控制器反向依赖 pluginMarket，将 `compareVersions` 抽取到 `utils/semver.js`，pluginMarket 改为 re-export 保持现有 import 与测试兼容）。

## 5. 后端 API

### 5.1 端点

```
GET /api/admin/changelog
```

- 鉴权：沿用 `/api/admin` 全局 Basic Auth；公开只读端点见 §13；
- 实现：新增 `controllers/admin/changelogController.js`，注册进 `controllers/admin.js`；
- 路由 schema 按新规范编写（tags: ['更新日志']），Swagger 自动收录。

### 5.2 解析与缓存

- 目录扫描 `docs/changelog/*.md` → 合并所有文件的 mtime（取 max）作为缓存键，目录无变化直接返回缓存；
- 每个文件解析产物：

```jsonc
{
  "version": "2.0.0",
  "date": "2026-08-29",
  "type": "major",
  "title": "Instrument Panel 与插件生态",
  "tags": ["管理界面", "插件", "文档"],
  "items": [ { "type": "feat", "text": "管理界面「Instrument Panel」全站重构…" } ]
}
```

- 全列表按 `compareVersions` 降序；`archive.md` 解析为 `archive: { items: [...] }` 挂在响应根部，不入版本序列；
- 解析警告（frontmatter 缺 title、文件名不合规等）不阻塞，收集进响应 `warnings` 供开发期排查。

### 5.3 响应

```jsonc
{
  "success": true,
  "data": {
    "latest": "2.0.0",
    "count": 21,
    "releases": [ /* 降序，见 5.2 */ ],
    "archive": { "items": [ { "type": "other", "text": "…" } ] },
    "warnings": []
  }
}
```

错误：目录缺失 → `500 {"error": "changelog 目录缺失"}`（属部署异常，正常不触发）。

### 5.4 搜索/过滤留在前端

全量数据小（预计 <200KB）、条目数百级，一次返回 + 前端 computed 过滤体验最好；后端保持薄层。

## 6. 前端页面设计

### 6.1 菜单与路由

- 路由：`/changelog`，name `changelog`，`meta.title: '更新日志'`；
- 菜单：`navigation.js`「// 系统」组末尾（终端模拟之后）：

```js
{ path: '/changelog', label: '更新日志', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' } // 时钟
```

- 不进移动端底部 Tab（低频入口，经「更多」抽屉可达）。

### 6.2 信息架构（PC 线框）

```
┌────────────────────────────────────────────────────────────────────────┐
│ // CHANGELOG                                        [搜索框  w-56]      │
│ 更新日志                                             ⌕ 搜索版本/内容…   │
├────────────────────────────────────────────────────────────────────────┤
│ ┌─ StatCard ─────┐ ┌─ StatCard ─────┐ ┌─ StatCard ──────────────────┐ │
│ │ 当前版本        │ │ 版本总数        │ │ 最近发布                     │ │
│ │ v2.0.0   ● 运行 │ │ 21             │ │ 2026-08-29                  │ │
│ └────────────────┘ └────────────────┘ └─────────────────────────────┘ │
├────────────────────────────────────────────────────────────────────────┤
│ 过滤: (全部)(新功能)(修复)(优化)(重构)(安全)   标签: [管理界面][插件]…    │
├────────────────────────────────────────────────────────────────────────┤
│   ●─┤ v2.0.0 ──── 2026-08-29 ──[MAJOR]─────────────── [类型色条]        │
│   │  Instrument Panel 与插件生态                                        │
│   │  ┃ 新功能 │ 管理界面「Instrument Panel」全站重构：双主题…            │
│   │  ┃ 修复   │ 修复站源映射页面误报「未保存」                          │
│   │                                                                    │
│   ○─┤ v1.4.8 ──── 2026-08-25 ───────────────────────────                │
│   │  合并近 2 个月提交……                                                │
│   │                                                                    │
│   ○─┤ [展开更早版本（18）]                                               │
│   ╶─┤ [历史归档（128 条早期记录）]   ← archive.md，默认折叠              │
└────────────────────────────────────────────────────────────────────────┘
```

### 6.3 视觉方向：「Release Rail」版本轨道

设计基调与 Instrument Panel 一致（hairline 分层、mono 眉题、语义色），记忆点集中在**左侧版本轨道**：

- **轨道轴**：内容区左侧一条 1px `border-line` 竖线，每个版本一个节点；
- **节点样式**（按 frontmatter `type`）：
  - `major`：12px `bg-accent` 实心圆 + 外圈 `ring-4 ring-accent/15`，右侧追加 mono `MAJOR` 徽章（`UBadge tone="accent"`）；
  - `minor`：10px 空心圆 `border-2 border-accent`；
  - `patch`：8px 实心 `bg-mid/40`；
  - 最新版本节点用 `animate-dot-breath` 呼吸灯（复用 StatusDot 动效）；
- **版本号**：`font-mono text-lg text-hi tracking-tight`（`v2.0.0`），日期 `text-2xs text-low font-mono`；
- **版本卡片**：`panel` 容器，左缘 3px 色条取该版本「最高优先级条目类型」的颜色（security > feat > fix > perf > refactor > docs > other）；`title` 一行 `text-sm font-medium text-hi`；
- **条目行**：`[类型徽章] + 文本（text-[13px] text-mid）`，`divide-y divide-line/50`；
- **头部 StatCard**（复用组件）：`当前版本 v2.0.0`（dot=running）、`版本总数`、`最近发布`；
- **入场**：沿用 `enter-stagger` 交错进场；动效只保留呼吸灯与卡片 `hover:border-accent/30` 两处——发布记录的气质是精密、克制。

> 字体说明：不自造字体。项目已锁定 JetBrains Mono + 系统中文栈，「版本号的仪表感」由 mono + tracking-tight + 尺寸对比达成，一致性优先于标新立异。

### 6.4 交互细节

| 交互 | 行为 |
|------|------|
| 搜索 | 顶部搜索框，250ms 防抖；匹配字段见 §7；命中词高亮 |
| 类型过滤 chips | 单选含「全部」；无命中的版本卡片折叠为一行摘要并置灰（时间轴节点保留） |
| 标签过滤 | 点击版本卡上的 tag 追加/取消（多选，与类型过滤 AND 组合） |
| 折叠早期版本 | 默认渲染最近 8 个版本，`[展开更早版本（N）]` 一次展开 |
| 历史归档 | `archive.md` 内容独立区块展示，默认折叠 |
| 空状态 | 搜索无命中：`UEmpty`（放大镜 icon）+「没有匹配的更新记录」 |
| 加载 | `USkeleton` × 4；接口失败 toast.error + UEmpty 重试按钮 |
| 键盘 | `/` 聚焦搜索框，Esc 清空并失焦 |

### 6.5 响应式

- `≥lg`：StatCard 三列；内容区 `max-w-4xl`；
- `<lg`：StatCard 堆叠/横滚；轨道收窄 16px；过滤 chips 横滚（`hide-scrollbar`）；触控目标 ≥40px。

### 6.6 主题

暗色默认、亮色完整，全部走 `style.css` CSS 变量与语义类，禁止硬编码色值。

## 7. 搜索设计

- **匹配字段**：`version`（不带 v 前缀与部分匹配均可，如 `2.0`、`1.4`）、`title`、`tags[]`、`items[].text`；命中任一即保留该版本；
- **实现**：前端 `computed` + 小写 `includes`（中文无需分词）；
- **排序**：保持版本降序，不做相关度排序；
- **高亮**：命中片段用分段渲染拼 `<mark>`（`bg-accent-dim text-accent rounded-[2px]`），**不使用 v-html**（搜索词来自用户输入，规避注入）。

## 8. 历史数据迁移

一次性脚本 `scripts/migrate-changelog.mjs`（执行后归档）：

1. 解析 `docs/updateRecord.md`：`### (\d{8})` 切段 → 段内 `更新至V(\d+\.\d+\.\d+)` 提取版本；
2. **有版本号的段落** → 生成 `docs/changelog/v{version}.md`：`date` 取标题日期，`type` 缺省 `patch`（人工抽查修订 major/minor），正文条目整体放入 `## 其他` 小节（保留原文）；
3. **无版本号的早期段落**（格式化之前的历史）→ 合并写入 `docs/changelog/archive.md`，每段一个 `### YYYYMMDD` + 原文；
4. 输出迁移报告（成功/归档/失败段落数），人工核对后入库；
5. `updateRecord.md` 顶部加归档说明（指向 changelog 目录与后台页面），此后不再更新。

## 9. 配套改造：消除三处手工同步（P2 可选）

`scripts/changelog-sync.mjs`：从 changelog 目录生成

1. README「更新记录」段（最近 3 个版本简版 + 链接）；
2. `public/index.html` 更新记录 `<h2>` 段落。

本期发版手工跑一次即可，未来挂 pre-release 自动执行。

## 10. 测试与验收

**单测**（`tests/unit/changelog.test.js`，零依赖 node:test）：

- 解析器纯函数：frontmatter 完整/缺失 title、小节映射（含未知小节）、裸列表归 other、单行条目提取；
- 文件名版本提取与 `compareVersions` 降序排序；
- `archive.md` 不参与版本序列。

**API**（curl）：

- 带 Basic Auth → 200 结构完整；无凭证 → 401；
- Swagger `/json` 含 `/api/admin/changelog` 条目（tag 更新日志）。

**页面**（浏览器实测）：

- 菜单出现且高亮正确；`/changelog` 深链刷新正常；
- 搜索 `ddocr` / `2.0` 命中并高亮，清空恢复；
- 类型 chips + tag 组合过滤正确；无命中显示 UEmpty；
- 默认折叠 8 版、展开更早版本、历史归档区块正常；
- 暗色/亮色切换、390px 移动端布局正常；
- `npm test` 全绿、`npm run check` 通过、`yarn admin:build` 产物入库。

## 11. 开发任务拆分

| # | 任务 | 涉及文件 | 规模 |
|---|------|----------|------|
| T1 | 迁移脚本 + 生成 `docs/changelog/*.md` | `scripts/migrate-changelog.mjs` | M |
| T2 | `compareVersions` 抽取到 `utils/semver.js`（pluginMarket re-export） | 两个 utils | S |
| T3 | md 解析器（frontmatter + 小节映射）+ 单测 | `utils/changelogParser.js`、`tests/unit/changelog.test.js` | M |
| T4 | changelogController（扫描 + mtime 缓存 + 路由 schema）+ 注册 | `controllers/admin/changelogController.js`、`controllers/admin.js` | S |
| T5 | 前端 Changelog.vue（时间轴/搜索/过滤/折叠/归档区块） | `drpy-node-admin/src/views/Changelog.vue` | L |
| T6 | 路由 + 菜单 | `router/index.js`、`navigation.js` | S |
| T7 | `api/admin.js` 增加 `getChangelog()` | `src/api/admin.js` | S |
| T8 | bundle 打包清单补 `docs/changelog/` | `package-bundle.js` | S |
| T9 | （可选 P2）changelog-sync 生成脚本 | `scripts/changelog-sync.mjs` | M |
| T10 | admin:build + 全量验收 | — | S |

依赖顺序：T1 → T2/T3 → T4 → T5-T8 → T10。整体预估 1~1.5 个开发日。

## 13. 未来扩展（记录不做承诺）

- 公开只读端点 `GET /changelog`（免鉴权，供壳子/文档站）；
- 后台在线新建版本（表单生成 md 文件写入 changelog 目录）；
- 发版自动化：release 脚本草拟 md + changelog-sync 生成 README，一键发版；
- RSS/Atom 输出。
