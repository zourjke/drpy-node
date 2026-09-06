# drpy-node 框架层测试

v2 分支起引入的框架层测试体系。零测试框架依赖，直接使用 Node 原生 `node:test`（要求 Node >= 18，项目 engines 为 >17 <24，生产机请用 Node 20/22 运行）。

## 运行方式

```bash
npm test          # 等价于 node --test tests/ ，递归执行 tests/ 下全部 *.test.js
npm run check     # 对重构涉及的自有代码做语法检查
```

## 目录规划

```
tests/
├── README.md                # 本文件：范围、运行方式、约定
├── helpers/
│   └── timers.js            # 定时器/活动资源计数辅助，供内存泄露回归断言使用
├── unit/                    # 纯函数与类实例的单元测试
│   ├── path-guard.test.js           # utils/pathGuard.js safePath 路径穿越防护
│   ├── with-timeout.test.js         # utils/with-timeout.js 超时包装（无 pending timer 泄漏）
│   ├── proxy-common.test.js         # utils/proxy-common.js parseRange / rewriteM3u8 / setCORS
│   ├── rule-env.test.js             # utils/rule-env.js buildRuleEnv
│   ├── image-manager.test.js        # utils/imageManager.js 过期清理/惰性触发/统计
│   └── ai-base-chat.test.js         # utils/ai/base-chat.js 会话上限/错误映射
├── concurrency/             # 并发内核行为兼容性
│   └── batch-execute.test.js        # batchExecute 成功收集/successCount 提前停止/listener break
├── memory/                  # 内存泄露回归专项（红→绿驱动 P0 修复）
│   └── leak-regression.test.js      # batchExecute 无残留定时器、Agent 单例等
└── integration/             # 预留：需要真实服务进程的冒烟脚本（手工运行，不进 CI 断言）
    └── smoke.md                     # docs/refactor-plan.md 第六章冒烟清单的操作化版本
```

## 约定

0. **内置模块导入**：业务/框架代码统一使用裸名导入（`from 'fs/promises'`），与仓库既有风格一致；测试代码统一使用 `node:` 前缀（`node:test`、`node:assert/strict`）——其中 `node:test` 必须带前缀，裸名 `'test'` 会与 npm 同名包冲突，这是 Node 官方要求。
1. **不启动完整服务**：单测一律不 import `index.js` / 任何 controller 路由注册链；被测对象为可独立实例化的工具模块。
2. **不访问真实网络**：涉及 HTTP 的地方注入桩函数或使用本地 http server 监听 127.0.0.1 随机端口。
3. **泄露断言方式**：优先比较 `process.getActiveResourcesInfo()` 中定时器类型数量前后差值（`helpers/timers.js`），避免依赖绝对数值导致 flaky。
4. **新增公共模块必须带对应 `.test.js`**，P2 重构批次以"旧实现与新实现在相同输入下输出一致"的对拍思路组织用例。
5. 测试失败即阻塞合入；不写 skip 占位。
