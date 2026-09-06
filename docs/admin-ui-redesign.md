# drpy-node-admin 后台管理界面重构设计

> 目标：在不改变任何已有功能的前提下，将后台管理界面的专业性与美观度提升一个台阶；**全面消灭原生 alert/confirm 弹窗**；PC 与移动端均为一等公民。本文档为开发蓝本，按分期推进。

---

## 一、现状盘点（为什么重构）

### 1.1 规模与形态

- 17 个视图（约 6,600 行）+ Sidebar/Header 两个组件，Vue3 + Vite + Tailwind 3 + Pinia。
- 路由：`/` `/config` `/sources` `/map-manager` `/parses` `/logs` `/api-docs` `/files` `/subscription` `/plugins` `/plugins/market` `/database` `/crypto` `/zy-crypto` `/backup` `/terminal`（条件显示）+ SourceEditor（Monaco 编辑器）。
- 布局：fixed Header（h-16）+ PC 固定侧栏（14rem）+ 移动抽屉遮罩；KeepAlive max 10。

### 1.2 问题清单

| # | 问题 | 证据 |
|---|---|---|
| 1 | **65 处原生弹窗**（52 alert + 13 confirm），阻塞线程、无法样式化、移动端体验差 | PluginMarket 16 处、Plugins 14 处、Subscription 8 处、MapManager 6 处…共 12 个文件 |
| 2 | **设计系统空缺**：style.css 仅 82 行（btn/card/input/badge 四件套），无字体体系、无动效、无状态语言、无品牌识别 | tailwind.config 仅扩展了 sky 色与两个动画 |
| 3 | **移动端是缩放而非适配**：断点类使用极不均匀（Config 30 处 vs 多数视图 <10 处）；表格靠 overflow-x 兜底；无底部导航、无触控目标规范、无 safe-area 处理 | grep 统计 |
| 4 | 组件抽象为零：全部是 utilities 直接堆在模板里，17 个视图各自造轮子（弹窗、加载、空态、错误态各写各的） | components/ 仅 Sidebar+Header |
| 5 | 交互反馈粗糙：alert 阻断、无骨架屏、无空态设计、错误提示一串英文 stack | 各视图 |

### 1.3 兼容红线（重构不可破坏）

1. **API 层零改动**：所有 `src/api/*` 调用与后端契约保持原样；
2. **路由与功能零删减**：17 个页面的全部功能点保留（每页功能清单见 §八，作为验收 checklist）；
3. **Basic Auth 与自动跳转逻辑不动**；
4. **Monaco/xterm 等重依赖的集成方式不动**（只调整其容器布局）；
5. 渐进迁移：新旧样式共存，`style.css` 旧类（.btn/.card/.input）保留为兼容层，全部视图迁移完成后才允许删除。

---

## 二、设计语言：「Instrument Panel」精密仪表台

drpyS 是跑在盒子/NAS 上的自托管媒体服务端，管理员是极客用户。设计定位：**精密仪表台**——暗色优先、数据密度可控、信号色克制、等宽字体的仪器感。拒绝通用 AI 风（无紫渐变白底、无 Inter/Roboto、无圆角大阴影卡片海）。

### 2.1 色彩 Token（CSS 变量 + Tailwind 扩展）

```
基底（暗）            亮色对应
--bg-app      #0b0f14（深空石墨，非纯黑）   #f4f6f8
--bg-panel    #11161d（面板）              #ffffff
--bg-sunken   #0d1117（代码/终端凹面）      #eef1f4
--line        rgba(148,163,184,.14)（hairline）  rgba(15,23,42,.08)
--text-hi     #e6edf3                      #0f172a
--text-mid    #8b98a9                      #475569
--text-low    #5b6676                      #94a3b8

信号色
--accent      #2dd4bf（电光青：可交互/主操作/聚焦）    ← 从 sky 迁移
--accent-dim  rgba(45,212,191,.12)（accent 的 12% 底）
--ok          #4ade80   --warn  #fbbf24   --danger #f87171   --info #60a5fa
```

原则：**80% 无彩 + 15% 中性 + 5% 信号**。信号色只给可交互元素、状态语义和数据高亮，大面积一律无彩。暗色为默认主题，亮色完整支持（沿用 theme store 的 class 切换）。

### 2.2 字体

- **拉丁/数字/代码：JetBrains Mono**（自托管，`@fontsource/jetbrains-mono` npm 包，构建进产物——drpys 常跑内网，禁止运行时 Google Fonts 依赖）。用于：所有数字、端口、版本号、路径、日志、代码、页面眉题。
- **中文 UI：系统栈** `"PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif`（中文 webfont 体积不可接受，靠字重与间距做层次）。
- 层次规范：页面主标题 15-16px/600 + 字距 0.02em；面板眉题 10px mono 大写 + 字距 0.15em（如 `// PLUGINS`）；正文 13px；辅助 11-12px。

### 2.3 形状与质感

- 圆角收紧：控件 6px、面板 8px（替代现在的大圆角）。
- **hairline 边框 + 底色微差分层**，替代阴影；弹窗/抽屉允许一层 `shadow-2xl` 定悬浮。
- 内容区背景铺极淡的 24px 网格点阵（2% 透明度），面板浮于其上——仪表台的"图纸"质感。
- 状态语言：**StatusDot 呼吸灯**（running=青色脉冲 / stopped=灰 / error=红闪）贯穿全部列表。

### 2.4 动效（克制、一次性编排）

- 页面进入：面板级 staggered fade-up（首屏一次性，80ms 间隔），不搞滚动触发；
- 交互反馈：按钮 hover 亮度位移 1px、focus 可见环（accent）、弹窗 scale 0.96→1 + fade 150ms、toast 滑入 200ms；
- 数字变化（统计卡）不做花哨计数动画，保持仪器感。

---

## 三、布局与导航（双端 Shell）

### 3.1 PC（≥1024px）

```
┌─────────┬──────────────────────────────┐
│ Sidebar │  Topbar：眉题路径 / 搜索(预留) / 主题 / 状态灯 │
│ 224px   ├──────────────────────────────┤
│ 分组导航 │  content-area（网格点阵背景）               │
│ ·系统   │  ┌─ Panel ─┐ ┌─ Panel ─┐                 │
│ ·源     │  └─────────┘ └─────────┘                 │
│ ·插件   │                                          │
│ ·工具   │                                          │
└─────────┴──────────────────────────────┘
```

- Sidebar 重构：品牌区（drpyS mono 标识 + 版本号）→ **分组导航**（系统：仪表盘/配置/备份/终端；内容：源/映射/解析/订阅；插件：插件管理/插件市场；工具：文件/数据库/日志/API 文档/加解密×2）→ 底部固定主题切换与 GitHub 链接（从 Topbar 移入）；当前项 accent 左缘条 + 微亮底。
- Topbar 减负：面包屑路径（mono 眉题）+ 全局服务状态灯（复用 health 接口）+ 移动菜单钮。

### 3.2 移动端（<1024px）

- **底部 Tab 栏**（safe-area 适配）：5 个高频入口 仪表盘 / 源 / 插件 / 文件 / 更多；「更多」唤起**全量导航抽屉**（复用 Sidebar 内容，左侧滑入）。
- Topbar 移动态：菜单钮 + 页面标题 + 主题切换，高度 52px。
- 通用规则：触控目标 ≥40px；主操作固定为**底部动作栏**（表单页"保存"、编辑器页"保存/语法检查"）；模态在移动端转为**底部抽屉**（bottom sheet）形态；横向滚动区显示渐隐遮罩提示可滑。

---

## 四、组件体系（`src/components/ui/`）

新建 `ui/` 目录，PascalCase。所有组件双主题、键盘可达、触控友好。

| 组件 | 职责 | 关键 API |
|---|---|---|
| `AppToast` + `useToast()` | 非阻塞通知，替代 alert | `toast.success/error/warning/info(msg)`；右上堆叠（PC）/顶部滑入（移动）；4s 自动消失；全局单例挂载于 App.vue |
| `AppDialog` + `useDialog()` | Promise 化确认/输入弹窗，替代 confirm | `await dialog.confirm({title, message, danger?, confirmText?}) → boolean`；`dialog.form({title, fields}) → 值|null`；danger 态红色确认键；Esc/遮罩关闭 |
| `AppDrawer` | 侧滑面板（移动导航、详情面板） | `v-model:open`、`side: left|right|bottom` |
| `UButton` | 统一按钮 | `variant: primary/ghost/danger/soft`、`size: sm/md/lg`、`loading`、`icon` |
| `UInput / USelect / USwitch` | 表单控件 | v-model、error 态行内提示（替代 alert 校验） |
| `UBadge / StatusDot` | 徽标 / 呼吸灯状态 | `tone: ok/warn/danger/info/neutral` |
| `UTabs` | 页内 tab | v-model、路由同步模式 |
| `USkeleton / UEmpty` | 骨架屏 / 空态 | `UEmpty: icon+文案+动作槽` |
| `PageHeader` | 页头：眉题+标题+说明+动作区 | 插槽式，统一全部页面头部结构 |
| `StatCard` | 仪表盘统计卡 | mono 大数字 + 趋势说明 |
| `DataList` | **自适应数据列表**：≥md 渲染表格 / <md 渲染卡片堆叠 | `columns` 定义 + `卡片槽`，是表格移动化的统一解法 |

兼容层：`style.css` 的旧类 `.btn/.card/.input/.badge` 保留并改为引用新 token（视觉渐进趋同），视图迁移期不删除。

---

## 五、原生弹窗迁移映射（65 处清零）

按语义归类映射，逐文件清点：

| 文件（处数） | 场景 → 迁移目标 |
|---|---|
| PluginMarket（16） | 「获取失败/保存失败/安装失败…」→ `toast.error`；「市场源已保存/卸载成功」→ `toast.success`；「该源已存在」→ 表单行内 error；安装/更新/卸载 confirm → `dialog.confirm`（卸载为 danger 态） |
| Plugins（14） | 各类失败 → `toast.error`；「保存成功/已恢复默认」→ `toast.success`；「恢复默认配置」confirm → `dialog.confirm` danger；「名称和路径不能为空/名称已存在」→ 弹窗表单行内校验；删除插件 confirm → `dialog.confirm` |
| Subscription（8） | 加载/保存失败 → `toast.error`；保存成功 → `toast.success`；「未保存切换文件」→ `dialog.confirm` warning |
| MapManager（6） | 加载/保存失败 → toast；「保存成功」→ toast.success；「站名不能为空」→ 行内校验；删除记录/保存写入 confirm → `dialog.confirm` |
| SourceEditor（5） | 加载/保存/模板失败 → toast；「语法检查通过」→ toast.success |
| Files（4） | 「不安全的路径」→ toast.warning；加载/读取失败 → toast.error |
| Dashboard（3） | 重启服务 confirm（危险）→ `dialog.confirm` danger；成功/失败 → toast |
| Backup（3） | 备份/重置 confirm → `dialog.confirm`；**恢复备份（覆盖系统文件）→ danger 态 + 强制输入确认词 `RESTORE` 的高危模式** |
| Crypto / ZyCrypto（4） | 复制成功/失败 → toast |
| Config（1） | 保存失败 → toast.error |
| Sidebar（1） | 「返回主页」confirm → `dialog.confirm` |

验收口径：`grep -rn "alert(\|confirm(\|prompt(" src/` 结果为 **0**（monaco/xterm 内部弹窗除外，其属第三方库）。

---

## 六、移动端适配策略（分场景）

| 场景 | 方案 |
|---|---|
| 全局导航 | 底部 Tab（5 高频）+「更多」抽屉（§3.2） |
| 数据表格（Config/Database/Sources/MapManager） | `DataList` 组件：<md 自动切卡片堆叠（键值对纵向排布），≥md 表格 |
| 文件浏览器（Files） | 列表项全宽触控 + 面包屑可点 + 底部动作栏（新建/上传）；预览抽屉化 |
| 代码编辑（SourceEditor/Monaco、Subscription） | 编辑器高度 60vh；工具按钮收进底部动作栏；移动端提示横屏更佳 |
| 终端（Terminal/xterm） | 保持横滚；工具栏折叠；字号随屏宽自适应 |
| 插件卡片（Plugins/PluginMarket） | 已是卡片流，1 列 <sm、2 列 sm-md、3-4 列 ≥lg；操作按钮 ≥40px |
| 表单弹窗 | 移动端全部转 bottom sheet；键盘弹起时 `visualViewport` 适配 |
| 系统栏 | `viewport-fit=cover` + `env(safe-area-inset-*)` |

---

## 七、分视图重构要点（功能保留清单即验收标准）

每页格式：**保留功能（验收 checklist）→ 重构要点**。

1. **Dashboard**：服务重启、健康状态、统计展示、快捷入口 → StatCard 仪表化；重启走 danger confirm + toast；状态灯体系首次落地。
2. **Config**：分组配置浏览/编辑/保存、敏感值掩码、搜索 → 分组侧锚点（PC）/ 横滑 chips（移动，已有雏形升级）；键值行内编辑。
3. **Sources**：源列表/启用开关/校验/语法检查/新建（跳编辑器）→ StatusDot 语言、行内菜单重构、`DataList`。
4. **SourceEditor**：Monaco 编辑/保存/语法检查/模板加载 → 三栏（列表/编辑/检查结果）响应式折叠为抽屉；底部动作栏。
5. **MapManager**：映射 CRUD/保存写入 map.txt/搜索 → 表格卡片化；保存 confirm + toast。
6. **Parses**：解析配置编辑保存 → 表单化 + toast。
7. **Logs**：实时日志/行数/清理 → 终端风凹面面板（bg-sunken + mono）、暂停/滚动到底控制。
8. **ApiDocs**：接口文档浏览 → 左目录右内容双栏（移动抽屉目录）、mono 路径样式。
9. **Files**：目录浏览/读取/写入/删除/新建 → 抽屉预览、面包屑、底部动作栏。
10. **Subscription**：订阅文件多文件切换/编辑/保存 → 未保存切换走 dialog；编辑器同 SourceEditor 移动策略。
11. **Plugins**：列表/编辑（含 env 键值对）/启停/删除/保存/恢复默认/市场 tab → 编辑弹窗表单化校验；启停 StatusDot；删除 dialog。
12. **PluginMarket**：市场列表/源管理/安装/更新/卸载/任务进度弹窗 → 安装任务进度弹窗升级为管线可视化（保留现有六阶段数据结构）；源管理抽屉化。
13. **Database**：SQL 执行/表结构浏览 → 结果表格卡片化；SQL mono 编辑区。
14. **Crypto / ZyCrypto**：加解密工具/复制 → 复制 toast；表单布局双列→单列。
15. **Backup**：备份路径配置/创建/恢复/重置 → 恢复走高危输入确认模式；操作日志区保留。
16. **Terminal**：xterm 终端 → 凹面全屏风；移动端工具栏折叠。
17. **SourceEditor 路由返回/未保存守卫** → dialog。

---

## 八、分期实施计划

### P0 地基（先行，全局立住）
1. 设计 token 落地：tailwind.config 扩展（色彩/字体/间距/动效 keyframes）+ style.css 重写（token、兼容层、点阵背景、滚动条）+ `@fontsource/jetbrains-mono` 引入；
2. `ui/` 组件库第一批：UButton/UInput/UBadge/StatusDot/USkeleton/UEmpty/PageHeader/USwitch/UTabs；
3. 反馈体系：AppToast+useToast、AppDialog+useDialog、AppDrawer，挂载于 App.vue；
4. Shell 重构：Sidebar 分组化 + Topbar 减负 + 移动底部 Tab/抽屉 + safe-area；
   **验收**：所有页面在新 Shell 下功能正常（旧样式共存），grep 原生弹窗仍存在但全局观感已统一。

### P1 弹窗清零 + 活跃页重构
1. 12 个文件 65 处弹窗全部替换（§五映射表），`grep` 清零验收；
2. Plugins / PluginMarket 完整重构（当前活跃开发页）；
   **验收**：两页功能 checklist 全过 + 移动端 375px 宽度走查。

### P2 高频页重构 + 表格卡片化
Dashboard / Config / Sources / Files / Logs / Subscription / SourceEditor；DataList 落地。
   **验收**：各页 checklist + 移动端无横向溢出（除 Terminal/Monaco 特批）。

### P3 收尾打磨
其余视图（MapManager/Parses/Database/Crypto/ZyCrypto/Backup/Terminal/ApiDocs）+ 空态/骨架屏全覆盖 + 页面入场动效 + 可选命令面板（Ctrl+K 全局跳转）。
   **验收**：全站 375/768/1280 三档走查 + 亮暗双主题走查 + 功能 checklist 全过。

### 回归保障
- 每页重构 PR 必须附功能 checklist 逐项勾选（§七清单）；
- `yarn admin:build`（build:apps 模式）产物走查 `http://127.0.0.1:5757/apps/admin/` 深层路由；
- 后端/接口 diff 必须为零。

---

## 九、风险与对策

| 风险 | 对策 |
|---|---|
| 一次性大改引入回归 | 分期推进，P0 不动任何视图逻辑；兼容层保证旧类名渐进迁移 |
| KeepAlive 与新组件状态冲突 | ui 组件无副作用设计；弹窗/toast 挂载在 App 层不受 KeepAlive 影响 |
| 移动端触屏误触 | 触控目标 ≥40px；危险操作一律 dialog 二次确认（不可绕过） |
| 字体自托管体积 | JetBrains Mono 仅 latin 子集 woff2（约 100KB×2 权重），中文走系统栈 |
| Terminal/Monaco 移动端性能 | 不强改内部实现，仅容器布局适配；提供"建议桌面使用"轻提示 |
