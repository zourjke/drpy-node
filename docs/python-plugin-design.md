# Python 插件规范（v2.0.1 起支持）

> 关联：`docs/plugin-market-design.md`（node/binary 规范）、`utils/pluginManager.js`、`utils/pluginMarket.js`
> 首个案例：`hongguo-bridge`（红果短剧签名/解密播放桥，Flask，默认端口 9877）

## 1. 规范扩展

`plugin.json` 在 node/binary 两种 runtime 之外新增 `python` 型：

```json
{
  "name": "hongguo-bridge",
  "version": "0.1.0",
  "title": "红果短剧播放桥",
  "runtime": "python",
  "entry": "bridge.py",
  "python": { "requirements": "requirements.txt" },
  "platforms": ["all"]
}
```

| 字段 | 说明 |
|------|------|
| `runtime: "python"` | 声明 Python 型插件 |
| `entry` | 入口 `.py` 脚本（缺省 `main.py`） |
| `python.requirements` | 依赖清单文件，相对插件目录（缺省 `requirements.txt`；无依赖可省略整个 `python` 字段） |

其余字段（name/version/title/desc/author/params/env/platforms）与 node/binary 规范一致。

**端口等运行参数的自定义**：插件进程由 pluginManager 注入 `params`（启动参数）与 `env`（环境变量），插件脚本自身按「命令行参数 > 环境变量 > 配置文件 > 内置默认」的优先级解析。以 hongguo-bridge 为例（后台「插件管理」编辑插件）：

- 启动参数方式：`params` 填 `--port 8888`
- 环境变量方式：`env` 加 `{"APP_PORT": "8888"}`
- 两者都不配则读插件目录 `config.json` 的 `port`，再兜底 9979

改端口后记得同步更新源侧 `ext` / `config.json` 的 `public_url` 指向新地址。

## 2. 运行时行为

| 环节 | 行为 |
|------|------|
| 依赖准备 | 在插件目录内创建 **`.venv` 虚拟环境** 并 `pip install -r <requirements>`（幂等：`.venv` 存在即视为就绪，与 node 的 node_modules 同口径）；无 requirements 声明则跳过 |
| 启动 | `venv python -u <entry> [params...]`，无 venv 且无依赖声明时退回系统 python（VIRTUAL_ENV 优先，否则 python/python3） |
| 启动方式 | `spawn` 子进程 + 进程注册表，启停/崩溃重启与 node 型一致；stdout/stderr 进插件日志 |
| 完整性校验 | 入口 `.py` 文件存在 |
| 依赖准备触发点 | 安装任务管线（start=true 时自动）、启动/重启 API（先准备再启动）——均异步不阻塞事件循环 |

**设计取舍**：依赖装进插件内 `.venv` 而非系统 python——插件间互不污染、随插件目录整体卸载；pip 安装耗时（数分钟）因此不放进 `startPlugin` 同步路径（与 node 的 npm 同步安装不同），统一走异步管线。

## 3. 上传安装

`POST /api/admin/plugins/upload` 对含 `plugin.json` 的包按 manifest 安装（name/runtime/entry/python 全部透传）；无 manifest 的包按内容推断：根级有 `requirements.txt` → python 型（entry 兜底 `main.py`，**规范要求 python 型自带 plugin.json 指明 entry**）。

**已上架插件市场**（v0.1.2 起，platforms=["all"]）：后台「插件市场」搜索 hongguo-bridge 安装即可，启动时自动创建 .venv 并安装 requirements；访问 `http://127.0.0.1:9877/health` 应返回 `{"ok":true,...}`。config.json 默认 port/public_url 与 `spider/js/红果短剧[短].js` 源写死端口一致（9877），同机部署零配置。

## 4. 已知约束与坑

- **中文路径 zip 必须用 UTF-8 编码文件名**：Windows 下 7z 命令行打包默认用本地代码页（GBK）写条目名，adm-zip 解压按 UTF-8 解读会产生乱码目录、文件错位。用项目内 adm-zip（node 脚本）打包或 7z 指定 UTF-8 文件名即可。示例包已用 adm-zip 打包。
- **Windows 覆盖安装的目录句柄坑**：运行中插件停止后（以及资源管理器/索引服务停在插件目录上时），目录 rename 会 EPERM/EBUSY——installPlugin 已做两级兜底：rename 自动重试（指数退避），仍失败则「逐项搬空旧目录到 .bak 再解压」，对句柄占用免疫。
- `.venv` 创建依赖本机 python 与 venv 模块（Ubuntu 需 `python3-venv`）。
- 插件自带的二进制依赖（如 ffmpeg）不在 venv 管理范围，需系统安装或随包携带并在插件内定位。

## 5. 未来扩展

- pip 依赖哈希锁定（requirements.txt + pip --require-hashes）
- python 插件的市场分发（平台无关，platforms: ["all"]，天然适合上市场）
