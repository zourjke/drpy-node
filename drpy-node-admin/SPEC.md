# drpy-node-admin 解耦与 SPA 插件化重构 SPEC

## 1. 项目概述

### 1.1 当前状态
- **drpy-node-admin**: 独立的 Vue 3 后台管理项目
- **数据依赖**: 通过 MCP (Model Context Protocol) 工具调用 drpy-node 功能
- **耦合问题**: admin.js 中动态导入 `drpy-node-mcp` 模块，违反依赖方向

### 1.2 目标架构
```
┌─────────────────────────────────────────────────────────────┐
│                        drpy-node                            │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────┐     │
│  │  Core APIs   │  │   Controllers  │  │   Static     │     │
│  │              │  │               │  │   Files      │     │
│  │ - /api/*     │◄─┤ - admin.js    │◄─┤ /apps/admin  │     │
│  │ - /admin/*   │  │ - api.js       │  │              │     │
│  │              │  │ - config.js    │  │ - index.html │     │
│  │              │  │ - ...          │  │ - assets/*   │     │
│  └──────────────┘  └───────────────┘  └──────────────┘     │
│         ▲                                    ▲               │
│         │                                    │               │
│         └──────────────┬─────────────────────┘               │
│                        │                                     │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              drpy-node-admin (SPA Plugin)              ││
│  │  ┌─────────┐  ┌──────────┐  ┌────────────┐           ││
│  │  │  Views  │  │ Stores   │  │Components   │           ││
│  │  └────┬────┘  └────┬─────┘  └──────┬─────┘           ││
│  │       │            │               │                    ││
│  │       └──────┬─────┴───────────────┴────┐              ││
│  │              │  API Client (axios)    │              ││
│  │              └───────────┬─────────────┘              ││
│  │                          │                             ││
│  │              ┌───────────┴─────────────┐              ││
│  │              │  REST API Interface     │              ││
│  │              │  /api/admin/*           │              ││
│  │              └──────────────────────────┘              ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘

                        ▲
                        │
        ┌───────────────┴───────────────┐
        │   drpy-node-mcp (Independent)  │
        │   ┌────────────────────────┐  │
        │   │  MCP Tools              │  │
        │   │  - systemTools.js       │  │
        │   │  - spiderTools.js       │  │
        │   │  - fsTools.js           │  │
        │   │  - dbTools.js           │  │
        │   │  - apiTools.js          │  │
        │   └────────────────────────┘  │
        │            ▲                   │
        │            │ (depends on)      │
        │            └───────────────────┘
        └──────────────────────────────────┘
```

## 2. 需要实现的 REST API

### 2.1 系统管理 API

#### 2.1.1 健康检查
```
GET /api/admin/health
Response: {
  status: "ok" | "error",
  uptime: number,
  memory: { used: number, total: number },
  version: string
}
```

#### 2.1.2 服务重启
```
POST /api/admin/restart
Response: {
  success: boolean,
  message: string
}
```

### 2.2 日志 API

#### 2.2.1 读取日志
```
GET /api/admin/logs?lines=50
Response: {
  file: string,
  content: string
}
```

#### 2.2.2 WebSocket 实时日志
```
WS /api/admin/logs/stream
Message: {
  type: "log" | "error" | "end",
  content: string,
  timestamp: number
}
```

### 2.3 配置管理 API

#### 2.3.1 获取配置
```
GET /api/admin/config?key=section.key
Response: any (配置值)
```

#### 2.3.2 更新配置
```
POST /api/admin/config
Body: {
  key: string,
  value: any
}
Response: {
  success: boolean,
  message: string
}
```

### 2.4 源管理 API

#### 2.4.1 列出所有源
```
GET /api/admin/sources
Response: {
  js: string[],
  catvod: string[]
}
```

#### 2.4.2 验证源
```
POST /api/admin/sources/validate
Body: {
  path: string
}
Response: {
  isValid: boolean,
  message: string
}
```

#### 2.4.3 检查语法
```
POST /api/admin/sources/syntax
Body: {
  path: string
}
Response: {
  isValid: boolean,
  error?: string
}
```

#### 2.4.4 获取模板
```
GET /api/admin/sources/template
Response: {
  template: string
}
```

### 2.5 文件系统 API

#### 2.5.1 列出目录
```
GET /api/admin/files/list?path=spider/js
Response: [{
  name: string,
  path: string,
  isDirectory: boolean,
  size?: number
}]
```

#### 2.5.2 读取文件
```
GET /api/admin/files/read?path=spider/js/test.js
Response: {
  type: "text" | "image",
  content?: string,
  mimeType?: string,
  dataUrl?: string
}
```

#### 2.5.3 写入文件
```
POST /api/admin/files/write
Body: {
  path: string,
  content: string
}
Response: {
  success: boolean,
  message: string
}
```

#### 2.5.4 删除文件
```
DELETE /api/admin/files/delete?path=spider/js/test.js
Response: {
  success: boolean,
  message: string
}
```

### 2.6 数据库 API

#### 2.6.1 执行查询
```
POST /api/admin/db/query
Body: {
  sql: string
}
Response: [{
  // 查询结果行
}]
```

### 2.7 路由信息 API

#### 2.7.1 获取路由列表
```
GET /api/admin/routes
Response: {
  registered_controllers: string[]
}
```

## 3. 文件结构规划

### 3.1 drpy-node 新增文件
```
drpy-node/
├── controllers/
│   ├── admin.js                    # 重构，移除 MCP 依赖
│   └── admin/
│       ├── systemController.js     # 系统管理
│       ├── logsController.js       # 日志管理
│       ├── sourcesController.js    # 源管理
│       ├── filesController.js      # 文件管理
│       ├── dbController.js         # 数据库查询
│       └── routesController.js    # 路由信息
├── utils/
│   └── admin/
│       ├── logReader.js            # 日志读取工具
│       ├── configManager.js        # 配置管理工具
│       └── fileValidator.js        # 文件安全验证
└── apps/
    └── admin/                      # 新增：编译后的 admin SPA
        ├── index.html
        └── assets/
            ├── index-*.js
            └── index-*.css
```

### 3.2 drpy-node-admin 文件调整
```
drpy-node-admin/
├── src/
│   ├── api/
│   │   ├── client.js               # 保持，调整 baseURL
│   │   ├── admin.js                # 新增：统一的 admin API 调用
│   │   ├── system.js               # 重构：使用 /api/admin/system
│   │   ├── sources.js              # 重构：使用 /api/admin/sources
│   │   ├── files.js                # 重构：使用 /api/admin/files
│   │   └── db.js                   # 重构：使用 /api/admin/db
│   ├── views/
│   │   └── ... (保持不变)
│   ├── stores/
│   │   └── ... (保持不变)
│   └── components/
│       └── ... (保持不变)
├── vite.config.js                   # 调整：output 指向 apps/admin
├── package.json
└── tailwind.config.js
```

## 4. 实施步骤

### Phase 1: API 层实现 (drpy-node)

#### 步骤 1.1: 创建 admin 子控制器
1. 创建 `controllers/admin/` 目录
2. 实现 6 个子控制器模块
3. 每个控制器实现对应的 API 接口

#### 步骤 1.2: 重构 admin.js
1. 移除 `import('../drpy-node-mcp/...')` 动态导入
2. 实现独立的业务逻辑
3. 注册子控制器路由
4. 添加静态文件服务指向 `apps/admin/`

#### 步骤 1.3: 实现工具函数
1. `utils/admin/logReader.js` - 日志文件读取
2. `utils/admin/configManager.js` - 配置文件管理
3. `utils/admin/fileValidator.js` - 路径安全验证

### Phase 2: 前端适配 (drpy-node-admin)

#### 步骤 2.1: API 客户端重构
1. 调整 `baseURL` 为 `/api/admin`
2. 移除 MCP 响应解析逻辑
3. 实现标准的 REST API 调用

#### 步骤 2.2: Vite 配置调整
1. 修改 `build.outDir` 为 `../apps/admin`
2. 修改 `base` 为 `/admin/`
3. 添加构建优化配置

#### 步骤 2.3: 路由模式调整
1. 使用 history 模式或 hash 模式
2. 添加路由回退处理

### Phase 3: 构建与集成

#### 步骤 3.1: 本地测试
1. 运行 `npm run admin:build` 构建
2. 验证生成的文件在 `apps/admin/` 目录
3. 测试所有功能正常工作

#### 步骤 3.2: 最终验证
1. 清理 MCP 依赖
2. 确认 drpy-node 可以独立运行
3. 性能测试

## 5. API 详细规范

### 5.1 通用响应格式
```typescript
// 成功响应
{
  success: true,
  data?: any,
  message?: string
}

// 错误响应
{
  success: false,
  error: string,
  code?: string
}
```

### 5.2 错误码定义
```javascript
const ErrorCodes = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  INVALID_PATH: 'INVALID_PATH',
  SYNTAX_ERROR: 'SYNTAX_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
}
```

### 5.3 认证与授权
```javascript
// 使用与 /apps/ 相同的认证机制
// 所有 /api/admin/* 接口需要 basic auth
```

## 6. WebSocket 实时日志规范

### 6.1 连接
```
WS /api/admin/logs/stream
```

### 6.2 消息格式
```javascript
// 客户端 → 服务端
{
  action: "subscribe" | "unsubscribe" | "clear",
  lines?: number
}

// 服务端 → 客户端
{
  type: "log" | "error" | "end",
  timestamp: number,
  content: string
}
```

### 6.3 心跳机制
```javascript
// 每 30 秒发送一次心跳
// 客户端
setInterval(() => {
  ws.send(JSON.stringify({ type: 'heartbeat' }))
}, 30000)

// 服务端响应
{ type: 'pong' }
```

## 7. 安全考虑

### 7.1 路径验证
```javascript
// 只允许访问特定目录
const ALLOWED_PATHS = [
  'spider/js',
  'spider/js_dr2',
  'spider/catvod',
  'spider/py',
  'spider/xbpq',
  'config',
  'json',
  'docs'
];

// 禁止路径遍历
function validatePath(path) {
  return !path.includes('..') &&
         !path.includes('~') &&
         !path.startsWith('/');

}
```

### 7.2 SQL 注入防护
```javascript
// 只允许 SELECT 查询
if (!query.trim().toLowerCase().startsWith('select')) {
  throw new Error('Only SELECT queries allowed');
}
```

### 7.3 文件操作限制
```javascript
// 禁止写入关键文件
const PROTECTED_FILES = [
  'package.json',
  'index.js',
  'database.db'
];
```

## 8. 性能优化

### 8.1 日志流式传输
```javascript
// 使用流式传输大日志文件
const stream = fs.createReadStream(logPath);
stream.on('data', (chunk) => {
  ws.send({ type: 'log', content: chunk.toString() });
});
```

### 8.2 静态资源缓存
```javascript
// admin 静态资源缓存策略
fastify.register(fastifyStatic, {
  root: adminDistPath,
  prefix: '/admin/',
  cacheControl: 3600, // 1 小时
  etag: true
});
```

### 8.3 API 响应压缩
```javascript
// 启用 gzip 压缩
import fastifyCompress from '@fastify/compress';
fastify.register(fastifyCompress);
```

## 9. 兼容性说明

### 9.1 向后兼容
- 保留 `/admin/mcp` 接口作为临时兼容层（可配置开关）
- 给予过渡期，逐步迁移到新 API

### 9.2 版本控制
```javascript
// API 版本号
const API_VERSION = 'v1';
// 所有响应头包含版本
reply.header('X-API-Version', API_VERSION);
```

## 10. 测试计划

### 10.1 单元测试
- 每个控制器函数的单元测试
- 工具函数的单元测试
- API 响应格式验证

### 10.2 集成测试
- API 端到端测试
- WebSocket 连接测试
- 文件上传下载测试

### 10.3 性能测试
- 日志流式传输性能
- 大文件读取性能
- 并发请求处理

## 11. 交付物清单

### 11.1 drpy-node 修改
- [ ] `controllers/admin.js` - 重构完成
- [ ] `controllers/admin/systemController.js` - 新增
- [ ] `controllers/admin/logsController.js` - 新增
- [ ] `controllers/admin/sourcesController.js` - 新增
- [ ] `controllers/admin/filesController.js` - 新增
- [ ] `controllers/admin/dbController.js` - 新增
- [ ] `controllers/admin/routesController.js` - 新增
- [ ] `utils/admin/logReader.js` - 新增
- [ ] `utils/admin/configManager.js` - 新增
- [ ] `utils/admin/fileValidator.js` - 新增

### 11.2 drpy-node-admin 修改
- [ ] `src/api/client.js` - baseURL 调整
- [ ] `src/api/admin.js` - 统一 API 调用
- [ ] `src/api/system.js` - API 重构
- [ ] `src/api/spider.js` - API 重构
- [ ] `src/api/file.js` - API 重构
- [ ] `src/api/db.js` - API 重构
- [ ] `vite.config.js` - 构建配置调整
- [ ] `package.json` - 脚本更新

### 11.3 文档
- [ ] API 接口文档
- [ ] 部署指南
- [ ] 开发指南更新
- [ ] 变更日志

## 12. 时间估算

| 阶段 | 任务 | 预计时间 |
|-----|------|---------|
| Phase 1 | API 层实现 | 2-3 天 |
| Phase 2 | 前端适配 | 1-2 天 |
| Phase 3 | 构建与集成 | 1 天 |
| 测试与修复 | 全面测试 | 1-2 天 |
| **总计** | | **5-8 天** |

## 13. 风险与应对

### 13.1 技术风险
**风险**: 解耦后功能缺失
**应对**: 详细的功能对比测试清单

### 13.2 兼容性风险
**风险**: 现有部署环境适配问题
**应对**: 保持 MCP 临时兼容层

### 13.3 性能风险
**风险**: 新架构性能下降
**应对**: 性能基准测试和优化

## 14. 后续优化方向

### 14.1 功能增强
- 添加源市场功能
- 添加源订阅功能
- 添加统计分析功能

### 14.2 用户体验优化
- 实现主题自定义
- 添加快捷键支持
- 优化移动端体验

### 14.3 运维功能
- 添加系统监控图表
- 实现日志分析功能
- 添加性能指标展示
