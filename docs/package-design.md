# 干净打包方案设计（package 打包体系重构）

> 状态：设计稿（待评审 → 开发）
> 日期：2026-08-29
> 关联：`package.py`、`package.js`、`package-bundle.js`（现状脚本）、`docs/changelog-design.md`
> 目标：产出「解压即可用任意 Node 解释器运行、无需 npm install」的完整服务压缩包，且**包内零冗余、体积最小**。

---

## 1. 现状分析

### 1.1 现有脚本清单

| 脚本 | 形态 | 机制 |
|------|------|------|
| `package.py` | 7z/zip 全量打包 | **黑名单排除**：`EXCLUDE_DIRS` + `EXCLUDE_FILES` 递归排除后 `7z a` 整目录 |
| `package.js` | 同 package.py 的 Node 版 | 与 package.py 逐字同构（排除清单复制两份，维护易漂移） |
| `package-bundle.js` | rolldown 独立核心 | 只打包源运行最小核心（_lib + 源），**不是完整服务**，与本方案正交，不在本设计范围 |

### 1.2 问题定位

| # | 问题 | 证据 |
|---|------|------|
| Q1 | **node_modules 全量打包（224MB）**：dev 依赖（rolldown、@anthropic-ai/mcpb、@inquirer 等）、子项目历史安装残留（@babel/@esbuild/@alloc/vite 系）全部进包；实际生产依赖仅 **43 个目录约 120MB** | `npm ls --omit=dev --omit=optional --parseable` = 43；`du -sm node_modules` = 224MB |
| Q2 | **黑名单模式的天然缺陷**：只有「记得排除的」才不进包。`tests/`、`scripts/`、`docs/`（含设计文档与 128 段归档）、`database.db`（运行数据！）默认全进包；未来新增的任何垃圾目录也会默认进包 | EXCLUDE_DIRS/EXCLUDE_FILES 清单逐项核对 |
| Q3 | **排除规则误伤与漏排**：`-xr!node-pty` 按名递归排除会误伤任何同名子目录；`database.db`、`logs` 之外的运行数据（`data/cat`、`data/temp`、`data/source-checker` 等）未排除 | package.py 第 7-22 行 |
| Q4 | **排除清单双份维护**：package.py 与 package.js 各持一份字面量，历史上已出现不一致风险 | 两文件对照 |
| Q5 | 单一最大黑洞已由黑名单规避：`data/mv` 运行缓存 **1010MB** 被排除 ✓（黑名单模式仅存的正确设计，需在新方案中保留等价能力） | `du -sm data/*` |

### 1.3 现状体积解剖（MB）

```
node_modules          224   ← 生产集仅 ~120（43 目录），其余为 dev/子项目 CLI 残留
data                  1010  ← 几乎全部是 data/mv 运行缓存（已被排除）
drpy-node-admin       188   ← 子项目，已排除 ✓
drpy-node-mcp          75   ← 已排除 ✓
drpy2-quickjs          30   ← 已排除 ✓
drpy-node-bundle       22   ← 已排除 ✓
logs                   31   ← 已排除 ✓
apps                   22   ← 托管前端产物，应保留
spider                 19   ← 源库，应保留
public                 14   ← 静态资源，应保留
docs/tests/examples/soft/install/local  ~12
```

## 2. 目标与非目标

### 目标

- G1 **免 npm install 可运行**：解压包后 `node index.js` 直接启动（原生/二进制依赖随包携带，与打包机平台匹配）；
- G2 **白名单组装**：包内只出现运行必需内容，新增垃圾默认不进包；
- G3 **生产依赖精确集**：只携带 `dependencies`（含间接依赖），dev/optional/子项目残留一律不进包；
- G4 单一脚本、单一配置源（消灭 package.py/package.js 双份清单）；
- G5 兼容现有产物语义：完整包 / `-green` 密源过滤包 / `-zip` 格式、命名规则不变。

### 非目标

- 不做 bundle 核心（`package-bundle.js` 保持独立演进）；
- 不做依赖 tree-shaking（单文件级裁剪）——包粒度即可满足体积目标；
- 不改变服务任何运行时行为。

## 3. 方案总览

```
package-clean.mjs
  ① staging 组装：白名单复制（源码/内容/前端/配置骨架）
  ② node_modules 生产集复制（npm ls --omit=dev --omit=optional 快照，见 §5）
  ③ 剔除运行数据与敏感文件（database.db/.env/config/env.json/缓存目录）
  ④ 7z a 压缩（沿用现有 7z 依赖与命名规则）
  ⑤ 清理 staging
```

**黑名单 → 白名单的模式反转**是本方案的根：打包内容的默认集合从「整个目录」变为「清单内的东西」，新垃圾天然隔离。

## 4. 白名单清单（staging 组装内容）

| 目标路径 | 来源 | 说明 |
|----------|------|------|
| `index.js`、`package.json` | 根 | package.json 供版本读取（`/api/admin/version`） |
| `controllers/` `libs/` `libs_drpy/` `utils/` | 整目录 | 服务端代码 |
| `spider/` `jx/` `json/` | 整目录 | 源与内容库；`-green` 模式按 `[密]` 过滤（沿用现规则） |
| `config/` | 整目录，**排除 `env.json`** | 运行配置骨架（真实密钥不入包） |
| `public/` `apps/` | 整目录，排除 `apps/cat` | 静态资源与托管前端产物（apps/admin、drplayer 等全部保留） |
| `docs/changelog/` | 仅此子目录 | 更新日志 API 数据源（设计文档等不入包） |
| `data/` | **骨架重建**：仅创建 `data/settings/` `data/temp/` `data/market-tmp/` 空目录 | 运行缓存/用户数据（mv、cat、douyin 等一律不带，运行时自建） |
| `install/` | 整目录 | autorun/uninstall 脚本 |
| `README.md` `LICENSE` `Dockerfile` `docker-compose.yml` | 根文件 | 部署配套 |

显式不打包：`tests/`、`scripts/`、`docs/`（除 changelog）、`examples/`、`soft/`、`local/`、`logs/`、`drpy-node-admin|bundle|mcp/`、`drpy2-quickjs/`、`database.db`、`index.json`、`custom.json`、`.env`、`.plugins.js`、`t4_daemon.pid`、`clipboard.txt`、现有源码中的个别密源黑名单（`-green` 语义保留）。

> 迁移注意：现 EXCLUDE_FILES 里的 `spider/js/UC分享.js`、`jx/奇奇.js` 等**个别源黑名单**属于内容治理，迁移到 `PACKAGE_EXCLUDE_SOURCES` 常量继续生效。

## 5. node_modules 生产依赖集（核心）

生产集 = `npm ls --omit=dev --omit=optional --parseable` 输出的目录集合（当前 43 个、~120MB）。两条实现路线：

### 路线 A：裁剪式（默认，推荐）

从打包机现有 node_modules 复制快照集合：

```js
execSync('npm ls --omit=dev --omit=optional --parseable', {cwd: ROOT})
  → 每行一个包目录 → 复制到 staging/node_modules/<name>
```

- ✅ 快、离线、**保留打包机已安装的原生/wasm 产物**（node-sqlite3-wasm、simplecc-wasm 均为 wasm 无平台问题；pino 等纯 JS）；
- ✅ 天然排除 dev 残留（rolldown/@inquirer/@babel 等不在快照）；
- ⚠️ 隐含要求打包机依赖安装状态健康（`npm ls` 报 extraneous/invalid 时警告并中止提示 `yarn install` 修复）。

### 路线 B：安装式（`--prod-install` 开关）

staging 内执行 `npm install --omit=dev --omit=optional --no-audit --no-fund`（用根 package.json）：

- ✅ 完全可复现，不依赖打包机现状；
- ⚠️ 需网络与构建链；速度慢。作为校验/兜底路线。

### optional 依赖 `node-pty`（64MB 编译产物）

维持现状语义：**不进默认包**（终端模拟功能在无 node-pty 时已有降级提示）。未来如需分发，单独出 `pty-{platform}` 附加包，不混入主包。

### 体积预估

| 项 | 现状包 | 新方案 |
|----|--------|--------|
| node_modules | 224MB | ~120MB（43 目录生产集） |
| tests/docs/scripts/子项目残留 | ~10MB | 0 |
| 运行数据/缓存 | 视 data 状态 | 0（骨架重建） |
| 源码/前端/内容 | ~60MB | ~60MB |
| **staging 合计** | ~300MB+ | **~180MB** |
| **7z 产物（JS 高压缩比 ~40%）** | **~120MB+** | **目标 ≤ 70MB** |

## 6. 脚本设计

新脚本 `package-clean.mjs`（Node 单文件、跨平台，替代 package.py 的日常使用；package.py 保留但标记 deprecated 指向新脚本）：

```
用法：
  node package-clean.mjs              # 完整包（7z）
  node package-clean.mjs -z           # zip 格式
  node package-clean.mjs -g           # 绿色包（spider/js 仅保留带[密]源，沿用现语义）
  node package-clean.mjs --prod-install  # 生产依赖走安装式（路线 B）
产物：<parent>/drpy-node-YYYYMMDD[-green].7z|zip（命名与现规则一致）
```

内部结构（全部纯函数 + 单测可测）：

| 模块 | 职责 |
|------|------|
| `WHITELIST` / `SOURCE_EXCLUDES` | §4 清单的单一配置源 |
| `buildStaging(root, staging, {green})` | 白名单复制（含 env.json/密源剔除、data 骨架重建） |
| `resolveProdDirs(root)` | npm ls 快照 → 生产目录集合（校验 extraneous/invalid 时报错中止） |
| `copyProdModules(dirs, staging)` | 生产集复制（保 symlink 结构：包内 workspace 无，平铺即可） |
| `pack(staging, out, {zip})` | 7z 调用（沿用现有命令行约定，7z 不存在时报错提示） |
| `smokeCheck(staging)` | 组装后自检：index.js/生产依赖存在、env.json 不存在、无 tests 目录（防呆闸） |

package.js（旧脚本）改造：保留但头部加 deprecated 提示指向新脚本，避免双份清单继续漂移。

## 7. 测试与验收标准

**单测**（`tests/unit/package-clean.test.js`，不真打包，纯函数）：

- 白名单/排除判定：`shouldInclude(relPath)` 各典型路径（apps/admin 应打包、apps/cat 排除、tests 排除、docs/changelog 打包、docs 其他排除）；
- 源名黑名单（`-green` 与 SOURCE_EXCLUDES）匹配；
- staging 冒烟自检函数：给定伪造 staging 能发现缺失 index.js / 多余 env.json。

**端到端验收**（人工/脚本）：

1. 打包后在**无 node_modules 的干净目录**解压 → `node index.js` 启动成功；
2. 冒烟：`/health` 200、`/apps/admin/` 200、`/api/admin/changelog` 200（证明 docs/changelog 随包）；
3. 包内不含：tests、scripts、docs 设计文档、database.db、.env、config/env.json、rolldown/@inquirer/@babel；
4. 体积：7z ≤ 70MB（对比现状 ≥120MB）；
5. `-g` 语义沿用旧脚本实际行为：包内 spider/js **不含**带 `[密]` 标记的源（私密源不入分发包），抽样核对。

## 8. 任务拆分

| # | 任务 | 文件 | 规模 |
|---|------|------|------|
| T1 | package-clean.mjs 骨架 + 白名单配置 + staging 组装 | 新脚本 | M |
| T2 | 生产依赖集解析与复制（路线 A）+ `--prod-install` 开关 | 同上 | M |
| T3 | 7z 打包 + 命名 + -g/-z 参数 | 同上 | S |
| T4 | smokeCheck 防呆自检 | 同上 | S |
| T5 | 单测 | `tests/unit/package-clean.test.js` | M |
| T6 | package.js/py 加 deprecated 提示 | 两脚本 | S |
| T7 | 端到端验收（干净目录解压启动 + 体积测量） | — | M |

预估 1 个开发日。

## 9. 未来扩展（记录不做承诺）

- 附加包体系：`pty-{platform}`（终端模拟原生依赖）、`models`（大模型资源）等按需扩展包；
- 打包机 CI 化：GitHub Actions 出三平台包；
- `--analyze` 输出 staging 体积 Top 报表，持续监控包体回胀。
