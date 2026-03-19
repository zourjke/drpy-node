# drpy-node Admin API 文档

## 概述

drpy-node Admin API 是一套 RESTful API，用于后台管理面板与 drpy-node 服务之间的通信。

**Base URL**: `http://localhost:5757/api/admin`

**认证方式**: Basic Auth（与 /apps/ 相同）

---

## API 端点

### 1. 系统管理

#### 1.1 健康检查

获取服务运行状态和系统信息。

```http
GET /api/admin/health
```

**响应**:
```json
{
  "status": "ok",
  "uptime": 123456,
  "memory": {
    "used": 128,
    "total": 512,
    "rss": 256
  },
  "version": "1.3.30",
  "platform": {
    "arch": "x64",
    "platform": "win32",
    "nodeVersion": "v18.17.0"
  },
  "timestamp": 1710907200000
}
```

#### 1.2 重启服务

尝试重启服务（需要 PM2 环境）。

```http
POST /api/admin/restart
```

**响应**:
```json
{
  "success": true,
  "message": "服务已通过 PM2 重启"
}
```

或（非 PM2 环境）:
```json
{
  "success": false,
  "message": "当前未使用 PM2 运行。请在终端中手动重启服务：\n1. 按 Ctrl+C 停止当前服务\n2. 运行 npm run dev 重新启动"
}
```

---

### 2. 日志管理

#### 2.1 读取日志

获取最近的日志内容。

```http
GET /api/admin/logs?lines=50
```

**查询参数**:
- `lines` (可选): 读取的行数，默认 50

**响应**:
```json
{
  "file": "drpy-node-20250318.log.txt",
  "content": "[2025-03-18 10:30:00] Server started on port 5757\n..."
}
```

#### 2.2 实时日志流 (WebSocket)

建立 WebSocket 连接以接收实时日志。

```http
WS /api/admin/logs/stream
```

**客户端发送**:
```json
{
  "action": "subscribe",
  "lines": 50
}
```

**服务端推送**:
```json
{
  "type": "log",
  "timestamp": 1710907200000,
  "content": "[INFO] Server started"
}
```

**消息类型**:
- `connected`: 连接成功
- `log`: 日志内容
- `error`: 错误信息
- `end`: 日志读取完成
- `cleared`: 日志已清空
- `pong`: 心跳响应

---

### 3. 配置管理

#### 3.1 获取配置

获取配置值。

```http
GET /api/admin/config?key=section.key
```

**查询参数**:
- `key` (可选): 配置键路径，使用点分隔

**响应**:
```json
"配置值"
```

#### 3.2 更新配置

更新配置值。

```http
POST /api/admin/config
```

**请求体**:
```json
{
  "key": "section.key",
  "value": "new value"
}
```

**响应**:
```json
{
  "success": true,
  "message": "配置项 section.key 已更新"
}
```

#### 3.3 获取环境变量

获取当前环境变量。

```http
GET /api/admin/env
```

**响应**:
```json
{
  "PORT": "5757",
  "NODE_ENV": "development",
  "MAX_TEXT_SIZE": "102400",
  "QUARK_COOKIE": "..."
}
```

---

### 4. 源管理

#### 4.1 列出所有源

获取所有可用的源文件列表。

```http
GET /api/admin/sources
```

**响应**:
```json
{
  "js": ["_test.js", "_qq.js", "_fq.js", ...],
  "catvod": ["cat.js", ...]
}
```

#### 4.2 验证源

验证源文件的结构和必填字段。

```http
POST /api/admin/sources/validate
```

**请求体**:
```json
{
  "path": "spider/js/_test.js"
}
```

**响应**:
```json
{
  "isValid": true,
  "message": "验证通过"
}
```

或（验证失败）:
```json
{
  "isValid": false,
  "error": "rule 对象缺少必填字段: host"
}
```

#### 4.3 检查语法

检查源文件的 JavaScript 语法。

```http
POST /api/admin/sources/syntax
```

**请求体**:
```json
{
  "path": "spider/js/_test.js"
}
```

**响应**:
```json
{
  "isValid": true,
  "message": "语法检查通过"
}
```

或（语法错误）:
```json
{
  "isValid": false,
  "error": "Syntax Error: Unexpected token"
}
```

#### 4.4 获取源模板

获取空的源文件模板。

```http
GET /api/admin/sources/template
```

**响应**:
```json
{
  "template": "var rule = {\n  类型: '影视',\n  ...\n}"
}
```

#### 4.5 获取 drpy 库信息

获取 drpy 全局对象和规则语法说明。

```http
GET /api/admin/sources/libs
```

**响应**:
```json
{
  "globalObjects": [
    "request(url, options) - HTTP Request",
    "pdfa(html, rule) - Parse List",
    ...
  ],
  "parsingRules": [
    "Format: selector;attr1;attr2...",
    "pdfa (list): Returns array",
    ...
  ]
}
```

---

### 5. 文件管理

#### 5.1 列出目录

获取目录内容列表。

```http
GET /api/admin/files/list?path=spider/js
```

**查询参数**:
- `path`: 目录路径，默认为当前目录 '.'

**响应**:
```json
{
  "files": [
    {
      "name": "_test.js",
      "path": "spider/js/_test.js",
      "isDirectory": false,
      "size": 2048
    },
    {
      "name": "lib",
      "path": "spider/js/lib",
      "isDirectory": true
    }
  ]
}
```

#### 5.2 读取文件

读取文件内容。

```http
GET /api/admin/files/read?path=spider/js/_test.js
```

**查询参数**:
- `path`: 文件路径

**文本文件响应**:
```json
{
  "type": "text",
  "content": "文件内容..."
}
```

**图片文件响应**:
```json
{
  "type": "image",
  "mimeType": "image/png",
  "dataUrl": "data:image/png;base64,iVBORw0KGgo..."
}
```

#### 5.3 写入文件

写入文件内容。

```http
POST /api/admin/files/write
```

**请求体**:
```json
{
  "path": "spider/js/new_source.js",
  "content": "文件内容..."
}
```

**响应**:
```json
{
  "success": true,
  "message": "文件保存成功"
}
```

#### 5.4 删除文件

删除文件。

```http
DELETE /api/admin/files/delete?path=spider/js/old.js
```

**查询参数**:
- `path`: 文件路径

**响应**:
```json
{
  "success": true,
  "message": "文件删除成功"
}
```

---

### 6. 数据库查询

#### 6.1 执行查询

执行只读 SQL 查询。

```http
POST /api/admin/db/query
```

**请求体**:
```json
{
  "sql": "SELECT * FROM sqlite_master WHERE type='table'"
}
```

**响应**:
```json
{
  "success": true,
  "data": [
    { "type": "table", "name": "sources", "tbl_name": "sources", ... }
  ],
  "rows": 10
}
```

#### 6.2 获取所有表

获取数据库中所有表。

```http
GET /api/admin/db/tables
```

**响应**:
```json
{
  "success": true,
  "tables": ["sources", "config", ...]
}
```

#### 6.3 获取表结构

获取表的字段信息。

```http
GET /api/admin/db/tables/{table}/schema
```

**响应**:
```json
{
  "success": true,
  "table": "sources",
  "columns": [
    { "cid": 0, "name": "id", "type": "INTEGER", "notnull": 1, "dflt_value": null },
    ...
  ]
}
```

---

### 7. 路由信息

#### 7.1 获取路由列表

获取已注册的控制器列表。

```http
GET /api/admin/routes
```

**响应**:
```json
{
  "file": "controllers/index.js",
  "registered_controllers": [
    "fastify.register(websocketController, options);",
    "fastify.register(staticController, options);",
    ...
  ]
}
```

---

## 错误响应格式

所有 API 在发生错误时返回统一格式：

```json
{
  "error": "错误描述信息"
}
```

HTTP 状态码:
- `200`: 成功
- `400`: 请求参数错误
- `403`: 访问被拒绝（路径不安全）
- `404`: 资源不存在
- `500`: 服务器内部错误

---

## 安全限制

### 路径访问限制

允许访问的目录:
- `spider/js/`
- `spider/js_dr2/`
- `spider/catvod/`
- `spider/py/`
- `spider/xbpq/`
- `config/`
- `json/`
- `docs/`

禁止访问:
- 包含 `..` 的路径（路径遍历）
- 包含 `~` 的路径
- 绝对路径（以 `/` 开头）
- `node_modules/` 目录
- `database.db` 文件

### SQL 查询限制

- 只允许 `SELECT` 查询
- 禁止 `DROP`、`DELETE`、`INSERT`、`UPDATE`、`ALTER`、`CREATE`、`TRUNCATE`

---

## WebSocket 心跳

为保持连接活跃，客户端应每 30 秒发送一次心跳：

```javascript
// 客户端代码示例
setInterval(() => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'heartbeat' }));
  }
}, 30000);
```

服务端会响应：
```json
{ "type": "pong" }
```

---

## 速率限制

为防止滥用，建议实施以下速率限制：

- 日志读取: 10 次/分钟
- 文件操作: 20 次/分钟
- 配置更新: 5 次/分钟
- 数据库查询: 30 次/分钟

---

## 版本历史

### v1.0.0 (2025-03-18)
- 初始版本
- 实现所有核心 API
- WebSocket 实时日志支持
- 移除 MCP 依赖
