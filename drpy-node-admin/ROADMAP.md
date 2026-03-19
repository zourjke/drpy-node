# drpy-node-admin 解耦重构规划文档

## 📋 文档目录

本目录包含 drpy-node-admin 解耦与 SPA 插件化重构的完整规划文档：

1. **SPEC.md** - 总体规划与架构设计
2. **IMPLEMENTATION.md** - 详细实现指南与代码示例
3. **API.md** - REST API 接口完整文档
4. **ROADMAP.md** - 本文件，实施路线图

---

## 🎯 重构目标

### 当前问题

```
┌─────────────────────────────────────────────────────┐
│                     当前架构                         │
├─────────────────────────────────────────────────────┤
│                                                             │
│  drpy-node-admin                                         │
│       │                                                    │
│       ├──→ /admin/mcp (调用 MCP 工具)                    │
│                   │                                     │
│  drpy-node                                             │
│       │                                                    │
│       └──→ import('../drpy-node-mcp/tools/*.js') ❌        │
│                                                             │
│  drpy-node-mcp (独立项目)                                │
│       │                                                    │
│       └──→ 依赖 drpy-node (仅用于开发调试)               │
│                                                             │
└─────────────────────────────────────────────────────┘
```

**核心问题**: drpy-node 作为主服务，不应该依赖 drpy-node-mcp

### 目标架构

```
┌─────────────────────────────────────────────────────┐
│                     目标架构                         │
├─────────────────────────────────────────────────────┤
│                                                             │
│  drpy-node (主服务)                                     │
│       │                                                    │
│       ├──→ /api/admin/* (REST API)                      │
│       │                                                    │
│       ├──→ /admin/* (静态文件)                           │
│       │                                                    │
│       └──→ apps/admin/ (编译后的 SPA) ✓                   │
│                                                             │
│  drpy-node-admin (开发时)                                │
│       │                                                    │
│       └──→ npm run dev (开发服务器)                       │
│                                                             │
│  drpy-node-mcp (独立项目)                                │
│       │                                                    │
│       └──→ 依赖 drpy-node 的 API (可选)                   │
│                                                             │
└─────────────────────────────────────────────────────┘
```

---

## 📊 变更概览

### drpy-node 变更

| 操作 | 文件路径 | 说明 |
|-----|---------|------|
| **重构** | `controllers/admin.js` | 移除 MCP 依赖，实现直接业务逻辑 |
| **新增** | `controllers/admin/*.js` | 6 个子控制器模块 |
| **新增** | `utils/admin/*.js` | 3 个工具模块 |
| **新增** | `apps/admin/` | 编译后的 SPA 静态文件 |

### drpy-node-admin 变更

| 操作 | 文件路径 | 说明 |
|-----|---------|------|
| **重构** | `src/api/*.js` | 所有 API 调用改用 REST API |
| **新增** | `src/api/admin.js` | 统一 API 调用模块 |
| **修改** | `vite.config.js` | 输出目录改为 `../apps/admin` |
| **修改** | `src/stores/*.js` | 适配新的 API 响应格式 |

---

## 🚀 实施路线图

### Phase 1: 后端 API 实现 (2-3 天)

**目标**: 实现所有必需的 REST API 接口

#### 步骤 1.1: 创建子控制器 (1 天)
```
✓ controllers/admin/systemController.js    - 系统管理
✓ controllers/admin/logsController.js      - 日志管理
✓ controllers/admin/sourcesController.js   - 源管理
✓ controllers/admin/filesController.js     - 文件管理
✓ controllers/admin/dbController.js        - 数据库查询
✓ controllers/admin/routesController.js    - 路由信息
```

#### 步骤 1.2: 重构 admin.js (0.5 天)
```
✓ 移除 import('../drpy-node-mcp/...') 代码
✓ 注册子控制器路由
✓ 实现 WebSocket 日志流
✓ 添加静态文件服务
```

#### 步骤 1.3: 创建工具模块 (0.5 天)
```
✓ utils/admin/logReader.js        - 日志读取
✓ utils/admin/configManager.js     - 配置管理
✓ utils/admin/fileValidator.js     - 路径安全验证
```

#### 步骤 1.4: 测试 API (0.5 天)
```
✓ 使用 Postman/Thunder 测试所有 API
✓ 验证响应格式正确性
✓ 测试 WebSocket 连接
```

---

### Phase 2: 前端适配 (1-2 天)

**目标**: 前端改用新的 REST API

#### 步骤 2.1: 创建 admin API 模块 (0.5 天)
```
✓ src/api/admin.js                - 统一 API 调用
```

#### 步骤 2.2: 重构现有 API 模块 (0.5 天)
```
✓ src/api/system.js               - 系统相关
✓ src/api/spider.js               - 源管理
✓ src/api/file.js                 - 文件管理
✓ src/api/db.js                   - 数据库查询 (新增)
```

#### 步骤 2.3: 调整 Vite 配置 (0.5 天)
```
✓ 修改 build.outDir 为 ../apps/admin
✓ 修改 base 为 /admin/
✓ 调整 proxy 配置
```

#### 步骤 2.4: 前端测试 (0.5 天)
```
✓ 开发模式测试所有功能
✓ 验证 API 调用正常
✓ 测试 WebSocket 日志流
```

---

### Phase 3: 构建与集成 (1 天)

**目标**: 完成 SPA 插件构建和集成

#### 步骤 3.1: 配置构建脚本 (0.3 天)
```
✓ 添加 scripts/build-admin.js
✓ 更新 package.json 脚本
```

#### 步骤 3.2: 构建并验证 (0.3 天)
```
✓ npm run admin:build
✓ 验证 apps/admin/ 目录生成
✓ 检查 index.html 和 assets
```

#### 步骤 3.3: 集成测试 (0.4 天)
```
✓ 启动 drpy-node 服务
✓ 访问 http://localhost:5757/admin/
✓ 全面功能测试
✓ 性能测试
```

---

### Phase 4: 清理与优化 (可选，1 天)

**目标**: 移除 MCP 依赖，优化代码

#### 步骤 4.1: 移除 MCP 兼容层
```
✓ 移除 /admin/mcp 端点
✓ 清理相关注释
```

#### 步骤 4.2: 代码优化
```
✓ 提取公共逻辑
✓ 添加错误处理
✓ 完善日志记录
```

#### 步骤 4.3: 文档更新
```
✓ 更新 README.md
✓ 更新 API.md
✓ 添加部署文档
```

---

## 📁 文件清单

### 新增文件 (drpy-node)

```
drpy-node/
├── controllers/admin/
│   ├── systemController.js      ← 新增
│   ├── logsController.js        ← 新增
│   ├── sourcesController.js     ← 新增
│   ├── filesController.js       ← 新增
│   ├── dbController.js          ← 新增
│   └── routesController.js      ← 新增
└── utils/admin/
    ├── logReader.js            ← 新增
    ├── configManager.js        ← 新增
    └── fileValidator.js        ← 新增
```

### 修改文件 (drpy-node)

```
drpy-node/
└── controllers/
    └── admin.js                 ← 重构
```

### 新增文件 (drpy-node-admin)

```
drpy-node-admin/
└── src/api/
    └── admin.js                  ← 新增
```

### 修改文件 (drpy-node-admin)

```
drpy-node-admin/
├── src/api/
│   ├── client.js                ← 修改 baseURL
│   ├── system.js                ← 重构 API 调用
│   ├── spider.js                ← 重构 API 调用
│   └── file.js                  ← 重构 API 调用
└── vite.config.js               ← 修改构建配置
```

---

## 🔄 数据流变化

### 之前（MCP 方式）

```
drpy-node-admin
    │
    │ POST /admin/mcp
    │    { "name": "list_sources", "arguments": {} }
    ↓
drpy-node (admin.js)
    │
    │ import('../drpy-node-mcp/tools/spiderTools.js')
    ↓
drpy-node-mcp
    │
    │ return { content: [{ type: "text", text: JSON.stringify(...) }] }
    ↓
drpy-node-admin
    │
    │ JSON.parse(response.content[0].text)
```

### 之后（REST API 方式）

```
drpy-node-admin
    │
    │ GET /api/admin/sources
    ↓
drpy-node (admin.js)
    │
    │ 直接调用 sourcesController.listSources()
    │
    │ return { js: [...], catvod: [...] }
    ↓
drpy-node-admin
```

---

## 🎨 前端开发体验

### 开发模式

```bash
# 终端 1: 启动 drpy-node
npm run dev

# 终端 2: 启动 drpy-node-admin 开发服务器
cd drpy-node-admin
npm run dev

# 访问: http://localhost:5174/
# API 请求自动代理到 http://localhost:5757
```

### 构建生产版本

```bash
cd drpy-node-admin
npm run build

# 输出到: ../apps/admin/
# 包含: index.html, assets/*.js, assets/*.css
```

### 部署验证

```bash
# 启动 drpy-node
npm run dev

# 访问: http://localhost:5757/admin/
```

---

## 🔍 关键决策点

### 决策 1: WebSocket 实现

**选择**: 使用 @fastify/websocket

**原因**:
- drpy-node 已使用 Fastify
- @fastify/websocket 官方插件
- 与现有架构兼容

**替代方案**:
- Socket.io (需要额外依赖)
- 原生 WebSocket (需要手动处理)

### 决策 2: 文件上传方式

**选择**: 使用 POST JSON body 传输内容

**限制**:
- 适合中小文件
- 不支持大文件上传

**如果需要大文件支持**:
- 可考虑 multipart/form-data
- 或分片上传

### 决策 3: 路径安全

**策略**:
- 白名单方式（只允许特定目录）
- 禁止路径遍历（..）
- 禁止敏感文件

### 决策 4: SQL 安全

**策略**:
- 只允许 SELECT 查询
- 关键词黑名单过滤
- 参数化查询（如需要）

---

## 📈 成功指标

### 功能完整性
- [ ] 所有现有功能可正常使用
- [ ] API 响应时间与之前相当
- [ ] WebSocket 日志流稳定

### 代码质量
- [ ] 无 MCP 依赖
- [ ] 代码结构清晰
- [ ] 有适当的错误处理

### 可维护性
- [ ] API 文档完整
- [ ] 代码注释充分
- [ ] 易于扩展

---

## 🎯 下一步行动

1. **审查文档**
   - 仔细阅读 SPEC.md
   - 理解 IMPLEMENTATION.md 中的代码示例
   - 熟悉 API.md 中的接口规范

2. **确认计划**
   - 评估时间估算是否合理
   - 确认技术方案可行
   - 提出调整建议（如有）

3. **开始实施**
   - 按照 Phase 1 → Phase 2 → Phase 3 顺序执行
   - 每个阶段完成后进行测试
   - 遇到问题及时调整

---

## 📞 联系与反馈

如有疑问或需要调整，请及时沟通。在开始实施前，请确保：

1. ✅ 已完整阅读所有规划文档
2. ✅ 理解技术方案和架构设计
3. ✅ 确认实施计划和时间安排
4. ✅ 了解风险和应对措施

**准备好后，请指示开始实施！**
