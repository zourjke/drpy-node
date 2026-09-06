# 文件管理扩展设计：创建/编辑/删除 与 框架文件保护

> 状态：已实施（单测 + 端到端验收全 PASS，含 READ_ONLY 全链路实测）
> 日期：2026-08-31
> 关联：`controllers/admin/filesController.js`、`drpy-node-admin/src/views/Files.vue`、`drpy-node-admin/src/api/file.js`、`utils/pathGuard.js`
> 需求：config 目录 js/json 允许创建和修改；config/json 目录框架自带文件受保护不可删，用户自建文件可删。修订（2026-08-31）：托管目录禁用根目录，仅 config 与 json

---

## 1. 现状调研

### 1.1 后端（filesController.js，206 行）

| 接口 | 现状 | 与需求的差距 |
|------|------|--------------|
| `files/list` | 目录列表（name/path/isDirectory/size） | 无保护/可写标记，前端无法感知策略 |
| `files/read` | 文本/图片读取 | 无差距 |
| `files/write` | **已存在**：READ_ONLY_MODE 检查 + safePath 黑名单（额外挡 package-lock.json/yarn.lock）→ 全黑名单外路径**都可写** | 范围过宽（spider 源也能被写）；但**不能收紧**——源管理编辑器保存源走此接口（spider/js/xxx.js）。需区分「新建 vs 修改」分别校验 |
| `files/delete` | **已存在**：safePath 黑名单外**全可删**——spider 源、controllers 代码都删得掉 | 范围过宽且无保护清单（框架文件会被误删）；需收紧 + 保护清单 |

### 1.2 前端（Files.vue，273 行）

纯浏览：目录面包屑 + 文件列表 + 预览（FilePreview，PC 右栏/移动抽屉）。**无新建/编辑/删除任何 UI**——「只能读」是前端缺失；后端 write/delete 能力已存在一半。

`fileApi.writeFile/deleteFile` 封装已存在（调 adminApi），前端接入成本低。

### 1.3 框架自带文件清单（git 跟踪 = 框架自带，发布包以此固化）

- **根目录 json**：`package.json`、`vercel.json`；运行时生成：`index.json`、`custom.json`（/config 缓存）。根目录**不开放**新建/编辑/删除（缓存文件每次 `/config` 请求自动覆盖重建，无需手动删除）；黑名单已挡：`package-lock.json`
- **config/**（git 跟踪 6 个）：`filter_keywords.json`、`map.txt`、`market-plugins.json`、`market.json`、`parses.conf`、`player.json`；运行时生成：`env.json`（用户全局配置）、`source-states.json`（源停用状态）；现状无 js 文件（用户可自建）
- **json/**（git 跟踪 33 个）：数据源配置 json（alist/webdav/哔哩大全/采集静态[zy]/[密] 等）+ tv/、mv/ 子目录数据文件（txt/m3u/jpg）

### 1.4 关键联动约束（不可破坏的既有依赖）

- **源管理编辑器保存**走 `files/write`（`spider/js/xxx.js`）——write 的「修改已存在文件」路径不能收紧；
- **源上传/删除**走 `/sources/upload|delete` 专用接口（含开关联动），文件管理不插手 spider 目录；
- `READ_ONLY_MODE=1` 时写/删全禁（保留）。

## 2. 策略层设计：`utils/filePolicy.js`（新增）

集中收敛三类判定，前后端共用（后端校验 + listDirectory 返回标记 → 前端零硬编码）：

### 2.1 可创建/可修改白名单（新文件创建校验用）

```
根目录：*.json、*.js、*.txt、*.m3u、*.conf
config/：*.js、*.json、*.txt、*.m3u、*.conf（递归）
json/：*.json、*.js、*.txt、*.m3u、*.conf（递归，框架自带 33 个文件保持只读/禁删不变）
```

### 2.2 保护清单 PROTECTED_FILES（删除拦截用）

```
根目录：package.json、vercel.json
config/：env.json、source-states.json、filter_keywords.json、market.json、market-plugins.json、player.json、map.txt、parses.conf
json/：git 跟踪的 33 个框架文件（含 tv/、mv/ 子目录内文件，开发时以 git ls-files json/ 清单固化）
```

说明：
- env.json / source-states.json 虽为运行时生成，但承载用户配置与状态，**不可删**（可改）；
- map.txt / parses.conf 非 js/json 不在可写白名单（保持只读），但属框架文件同样禁删；
- index.json / custom.json 为生成缓存：非保护，且在根目录 `*.json` 范围内 → 可删，下次 `/config` 请求自动重建，无害；
- json/ 下**框架自带文件保持只读**（不开放修改），仅用户自建的 json 可编辑/删除——编辑与删除判定均以 PROTECTED_FILES 排除框架文件。

### 2.3 三个判定函数

```text
isWritableCreatePath(rel)   新建文件白名单：根目录 *.json / config 递归 *.js|*.json / json 递归 *.json
isEditablePath(rel)         修改：已存在文件——根目录 json ∪ config js-json 全部可改（保护不禁修改）；
                            json/ 下仅非保护（用户自建）的 .json 可改，框架 33 个保持只读
isDeletablePath(rel)        删除：位于（根目录 *.json ∪ config/**.{js,json} ∪ json/**.json）且 ∉ PROTECTED_FILES
```

## 3. 后端改动（filesController.js）

| 接口 | 改动 |
|------|------|
| `files/list` | 每项追加 `protected`（∈保护清单）、`deletable`（isDeletablePath）、`editable`（isEditablePath）标记 |
| `files/write` | 区分新建/修改：目标**不存在**（新建）→ 校验 `isWritableCreatePath`（config / json 两处托管目录，根目录不开放），白名单外 403（托管目录内类型不符提示「仅支持创建 .json/.js/.txt/.m3u/.conf」，其余提示走源管理上传入口）；目标已存在（修改）→ json/ 下框架文件（PROTECTED）拒绝修改，其余维持现状校验不收紧；READ_ONLY_MODE 与 safePath 黑名单保留 |
| `files/delete` | 收紧：仅 `isDeletablePath` 通过才执行；保护文件 403 并明确提示「框架文件受保护，不可删除」；范围外（如 spider/**）403 提示「源文件请走源管理的删除入口」 |

`/sources/delete`、`/sources/upload` 专用接口不受影响。

## 4. 前端改动（Files.vue）

| 能力 | 设计 |
|------|------|
| 新建文件 | 工具行「新建文件」按钮：仅当前目录为 `.`（根目录，默认后缀 .json）、`config`（.js/.json）或 `json`（.json）及其递归子目录时可用，其余目录点击提示不允许；对话框输入文件名 + 初始内容模板（json 默认 `{}`，js 默认空注释头）→ `fileApi.writeFile` → 刷新列表并打开 |
| 编辑 | 预览右栏（与移动抽屉）加「编辑」按钮：仅 `editable` 文件显示；进入编辑模式（textarea，等宽字体），保存调 `fileApi.writeFile`，成功 toast + 重载内容；取消还原 |
| 删除 | 列表行 hover 删除按钮：仅 `deletable` 文件显示（保护文件不显示按钮，改显 🔒 图标 + title「框架文件受保护」）；`dialog.confirm(danger)` 后调 `fileApi.deleteFile`，成功刷新目录；若删除的是当前预览文件则关闭预览 |
| 列表标记 | 框架保护文件显示「保护」徽标（tone=neutral）；可编辑文件显示「可编辑」弱标记（可选） |
| 移动端 | 新建/编辑/删除均复用现有 AppDrawer 模式；触控目标 ≥40px |

## 5. READ_ONLY_MODE 全链路覆盖（2026-08-31 实测补充）

### 5.1 现状实测结论（READ_ONLY_MODE=1 启动实测）

| 路径 | 现状 | 结论 |
|------|------|------|
| `files/write`（新建/修改） | 403 ✓ | 真实生效 |
| `files/delete` | 403 ✓ | 真实生效 |
| 终端功能 | 禁用 ✓ | 真实生效 |
| `/sources/upload` | **200 放行** | ❌ 缺口：只读模式下源文件仍可上传（已实测复现） |
| `/sources/delete` | **200 放行** | ❌ 缺口：只读模式下源文件仍可删除（已实测**真实删除过一个源文件**，靠 git 恢复） |
| `/sources/enabled` | **200 放行** | ❌ 缺口：停用状态文件（source-states.json）仍可写 |

### 5.2 本期任务：源专用接口接入 READ_ONLY 检查

`/sources/upload`、`/sources/delete`、`/sources/enabled` 三个入口在 handler 开头统一增加：

```js
if (process.env.READ_ONLY_MODE === '1') {
    return reply.code(403).send({success: false, error: '系统当前处于只读模式，禁止修改源'});
}
```

放置位置：upload/delete 在参数校验**之前**（先拦语义再验参）；enabled 同理。验证是只读的（verify-flow 只读不写），不受限。

### 5.3 验收（并入 §7）

- READ_ONLY_MODE=1 时：`/sources/upload`、`/sources/delete`、`/sources/enabled`、`files/write`、`files/delete` 全部 403；verify-flow 正常可用；
- 恢复默认后上述写接口恢复正常。

## 6. 边界与非目标

- `spider/**`、`jx/**`、`apps/**` 等目录：文件管理界面维持只读浏览；源文件的新建/删除走源管理专用接口（含启停联动），编辑走源编辑器；
- json/ 目录：开放新建（.json）与用户自建文件的编辑/删除，**框架自带 33 个文件保持只读且禁删**（PROTECTED_FILES 排除）；
- 不做重命名/移动/回收站；
- READ_ONLY_MODE=1 全局只读行为保留；
- 二进制文件不支持在线编辑（write 为 utf-8 文本语义，现状如此）。

## 7. 任务拆分

| # | 任务 | 涉及文件 | 规模 |
|---|------|----------|------|
| T1 | utils/filePolicy.js（保护清单/三类判定）+ 单测 | 新增 utils/filePolicy.js、tests/unit/file-policy.test.js | S |
| T2 | filesController：list 标记增强、write 新建校验、delete 收紧+保护拦截（403 消息区分） | filesController.js | M |
| T3 | Files.vue：新建文件、编辑模式、删除按钮、保护/可编辑标记 | Files.vue（+file.js api 补充） | M |
| T4 | admin:build + 端到端验收 | — | S |

预估 1 开发日。依赖顺序：T1 → T2 → T3 → T4。

## 8. 测试与验收

**单测**（tests/unit/file-policy.test.js）：白名单判定（根目录 json/config js-json/其他目录拒绝）、保护清单命中（config 框架文件/json 框架文件/根目录 package.json）、isDeletablePath 组合（用户自建可删/框架文件不可删/生成缓存可删）。

**端到端**（curl，Basic Auth）：
1. 新建 `config/zz-test.json` → 200；新建 `spider/js/xx.js` → 403 白名单提示；新建 `json/zz-user.json` → 200；新建根目录 `zz-root.json` → 403（根目录不开放）；
2. 修改 `config/zz-test.json` → 200；修改 `spider/js/热门推荐.js`（已存在，模拟源编辑器路径）→ 200 不受影响；修改 `json/alist.json`（框架文件）→ 403 只读保护；修改 `json/zz-user.json`（自建）→ 200；
3. 删除 `config/zz-test.json`（自建）→ 200；删除 `config/player.json`（框架）→ 403「框架文件受保护」；删除 `json/alist.json`（框架）→ 403；删除 `json/zz-user.json`（自建）→ 200；删除根目录 `index.json`（生成缓存）→ 200；
4. `files/list` 于 config 目录：player.json `protected=true,deletable=false`，自建文件 `deletable=true`；
5. READ_ONLY_MODE=1 → 写/删均 403；
6. Swagger 收录（现有接口 schema 更新）。

**页面**：新建对话框（根目录/config 可用性切换）、编辑保存回读一致、删除保护文件按钮禁用态、暗亮主题、390px 不溢出。

## 9. 未来扩展（不做承诺）

- 在线内容编辑器升级为 monaco（FilePreview 已具备接入基础）；
- 文件重命名/移动；回收站（软删除）；
- json/ 目录的创建/修改开放（若需求后续扩展）。
