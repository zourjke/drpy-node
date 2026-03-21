# drpy-node 后台管理 API 文档

**基础路径:** `/api/admin`  
**认证方式:** HTTP Basic Auth（需要在请求头中提供与全局 `/apps/` 路由相同的 Basic Auth 凭证）

---

## 1. 系统管理 API

### 1.1 获取系统健康状态
- **路径:** `/health`
- **方法:** `GET`
- **描述:** 获取系统运行时间、内存使用情况、版本及运行环境等健康信息。
- **参数:** 无
- **返回值示例:**
  ```json
  {
      "status": "ok",
      "uptime": 12345, // 运行时间（秒）
      "memory": {
          "used": 120, // 堆内存已用 (MB)
          "total": 200, // 堆内存总量 (MB)
          "rss": 150 // 常驻集大小 (MB)
      },
      "version": "1.0.0",
      "platform": {
          "arch": "x64",
          "platform": "win32",
          "nodeVersion": "v18.0.0"
      },
      "env": {
          "php": "8.1.0", // PHP 版本或 true/false
          "python": true // true/false
      },
      "timestamp": 1690000000000
  }
  ```

### 1.2 重启服务
- **路径:** `/restart`
- **方法:** `POST`
- **描述:** 尝试通过 PM2 重启当前服务。如果未在 PM2 环境下运行或处于只读模式，则返回错误提示。
- **参数:** 无
- **返回值示例:**
  ```json
  {
      "success": true,
      "message": "服务已通过 PM2 重启"
  }
  ```

### 1.3 终端状态
- **路径:** `/terminal/status`
- **方法:** `GET`
- **描述:** 检查终端模拟器功能是否开启且可用。
- **返回值示例:**
  ```json
  {
      "available": true
  }
  ```

### 1.4 终端 WebSocket
- **路径:** `/terminal/ws`
- **方法:** `GET` (WebSocket 升级)
- **描述:** 提供与服务端真实系统终端进行交互的 WebSocket 长连接通道。

### 1.5 获取路由信息
- **路径:** `/routes`
- **方法:** `GET`
- **描述:** 获取项目中 `controllers/index.js` 注册的所有路由控制器信息。
- **返回值示例:**
  ```json
  {
      "file": "controllers/index.js",
      "registered_controllers": ["fastify.register(...)"]
  }
  ```

### 1.6 API 文档列表
- **路径:** `/docs`
- **方法:** `GET`
- **描述:** 获取后端自带的部分 API 文档列表信息。

---

## 2. 日志 API

### 2.1 获取日志
- **路径:** `/logs`
- **方法:** `GET`
- **描述:** 读取最新的系统日志文本。
- **参数 (Query):**
  - `lines` (可选, 整数): 要读取日志的最新行数，默认 `50`。
- **返回值示例:**
  ```json
  {
      "file": "drpy-2023-10-10.log.txt",
      "content": "[INFO] Server started...\n..."
  }
  ```

---

## 3. 配置管理 API

### 3.1 获取配置
- **路径:** `/config`
- **方法:** `GET`
- **描述:** 获取全局配置文件 (`config/env.json`) 中的信息。
- **参数 (Query):**
  - `key` (可选, 字符串): 指定获取某一项特定配置（支持点语法如 `a.b.c`）。如果不传，则返回全部配置项。
- **返回值示例:** 配置对象 JSON，或特定 Key 的对应值。

### 3.2 更新配置
- **路径:** `/config`
- **方法:** `POST`
- **描述:** 更新指定的配置项并保存至磁盘。
- **参数 (Body):**
  - `key` (必填, 字符串): 要更新的配置键名（支持点语法，例如 `sparkBotObject.id`）。
  - `value` (必填, 任意类型): 要更新的具体值。
- **返回值示例:**
  ```json
  {
      "success": true,
      "message": "配置项 xx 已更新"
  }
  ```

### 3.3 获取关键环境变量
- **路径:** `/env`
- **方法:** `GET`
- **描述:** 获取系统级的重要环境变量（如 `PORT`, `NODE_ENV`, `QUARK_COOKIE` 等）。
- **返回值示例:**
  ```json
  {
      "PORT": "5757",
      "NODE_ENV": "production"
  }
  ```

### 3.4 获取版本信息
- **路径:** `/version`
- **方法:** `GET`
- **描述:** 快速获取当前系统的 package.json 版本号。
- **返回值示例:**
  ```json
  {
      "version": "1.0.0"
  }
  ```

---

## 4. 源管理 API

### 4.1 获取源列表
- **路径:** `/sources`
- **方法:** `GET`
- **描述:** 获取不同语言/引擎 (`js`, `catvod`, `php`, `py`) 目录下的爬虫源文件列表。
- **返回值示例:**
  ```json
  {
      "js": ["siteA.js"],
      "catvod": ["siteB.js"],
      "php": ["siteC.php"],
      "py": ["siteD.py"]
  }
  ```

### 4.2 验证源文件
- **路径:** `/sources/validate`
- **方法:** `POST`
- **描述:** 验证爬虫源文件的有效性（例如执行沙箱并检查是否包含必备的 `rule` 对象及必填字段）。
- **参数 (Body):**
  - `path` (必填, 字符串): 源文件的相对路径。
- **返回值示例:**
  ```json
  {
      "isValid": true,
      "message": "验证通过"
  }
  ```

### 4.3 语法检查
- **路径:** `/sources/syntax`
- **方法:** `POST`
- **描述:** 仅检查源文件的代码语法是否有误，不校验具体结构。
- **参数 (Body):**
  - `path` (必填, 字符串): 源文件的相对路径。
- **返回值示例:**
  ```json
  {
      "isValid": true,
      "message": "语法检查通过"
  }
  ```

### 4.4 获取源模板
- **路径:** `/sources/template`
- **方法:** `GET`
- **描述:** 获取开发新 JS 源的标准默认模板内容。
- **返回值示例:**
  ```json
  {
      "template": "/* template content ... */"
  }
  ```

### 4.5 获取内置库信息
- **路径:** `/sources/libs`
- **方法:** `GET`
- **描述:** 获取系统内置爬虫全局方法和解析规则的说明信息（用于开发帮助）。
- **返回值示例:** 包含 `globalObjects` 和 `parsingRules` 字符串数组的 JSON。

---

## 5. 文件管理 API

### 5.1 获取目录列表
- **路径:** `/files/list`
- **方法:** `GET`
- **描述:** 获取指定目录下的文件和文件夹列表。支持安全路径拦截，无法越权访问项目根目录外的文件。
- **参数 (Query):**
  - `path` (可选, 字符串): 相对路径，默认为项目根目录 `.`。
- **返回值示例:**
  ```json
  {
      "files": [
          {
              "name": "src",
              "path": "./src",
              "isDirectory": true,
              "size": 0
          }
      ]
  }
  ```

### 5.2 读取文件内容
- **路径:** `/files/read`
- **方法:** `GET`
- **描述:** 读取指定文本文件或图片文件内容。如果是图片则转为 Base64 格式返回。
- **参数 (Query):**
  - `path` (必填, 字符串): 文件相对路径。
- **返回值示例:**
  ```json
  {
      "type": "text", // 如果是图片则是 "image"
      "content": "..." // 如果是图片则返回 dataUrl (带 mimetype)
  }
  ```

### 5.3 写入文件
- **路径:** `/files/write`
- **方法:** `POST`
- **描述:** 将内容写入到指定文件。
- **参数 (Body):**
  - `path` (必填, 字符串): 文件相对路径。
  - `content` (必填, 字符串): 要写入的文件内容。
- **返回值示例:**
  ```json
  {
      "success": true,
      "message": "文件保存成功"
  }
  ```

### 5.4 删除文件
- **路径:** `/files/delete`
- **方法:** `DELETE`
- **描述:** 删除指定文件或目录。
- **参数 (Query 或 Body):**
  - `path` (必填, 字符串): 文件相对路径。
- **返回值示例:**
  ```json
  {
      "success": true,
      "message": "文件删除成功"
  }
  ```

---

## 6. 数据库 API

### 6.1 执行 SQL 查询
- **路径:** `/db/query`
- **方法:** `POST`
- **描述:** 在本地 SQLite 数据库上执行只读 (`SELECT` / `PRAGMA`) SQL 查询。禁止执行任何写入操作。
- **参数 (Body):**
  - `sql` (必填, 字符串): SQL 查询语句。
  - `params` (可选, 数组或对象): SQL 绑定参数。
- **返回值示例:**
  ```json
  {
      "success": true,
      "data": [...], // 查询结果集
      "rows": 10 // 行数
  }
  ```

### 6.2 获取表列表
- **路径:** `/db/tables`
- **方法:** `GET`
- **描述:** 获取数据库中的所有表名。
- **返回值示例:**
  ```json
  {
      "success": true,
      "tables": ["table1", "table2"]
  }
  ```

### 6.3 获取表结构
- **路径:** `/db/tables/:table/schema`
- **方法:** `GET`
- **描述:** 获取指定数据表的列结构定义信息。
- **参数 (Path):**
  - `table` (必填, 字符串): 数据库表名。
- **返回值示例:**
  ```json
  {
      "success": true,
      "table": "table_name",
      "columns": [{ "cid": 0, "name": "id", "type": "INTEGER", ... }]
  }
  ```

---

## 7. 订阅文件管理 (Sub) API

### 7.1 获取订阅文件列表
- **路径:** `/sub/files`
- **方法:** `GET`
- **描述:** 获取 `public/sub` 目录下的订阅文件列表信息。
- **返回值示例:**
  ```json
  {
      "success": true,
      "data": [
          {
              "name": "example.txt",
              "size": 1024,
              "mtime": "2023-10-10T10:00:00.000Z"
          }
      ]
  }
  ```

### 7.2 读取订阅文件内容
- **路径:** `/sub/file`
- **方法:** `GET`
- **描述:** 读取指定订阅文件 (`public/sub/*`) 的内容。
- **参数 (Query):**
  - `name` (必填, 字符串): 订阅文件名。
- **返回值示例:**
  ```json
  {
      "success": true,
      "data": "文件内容..."
  }
  ```

### 7.3 保存订阅文件内容
- **路径:** `/sub/file`
- **方法:** `POST`
- **描述:** 保存修改后的订阅文件内容。
- **参数 (Body):**
  - `name` (必填, 字符串): 订阅文件名。
  - `content` (必填, 字符串): 文件内容。
- **返回值示例:**
  ```json
  {
      "success": true,
      "message": "File saved successfully"
  }
  ```

---

## 8. 备份与恢复 API

### 8.1 获取备份配置
- **路径:** `/backup/config`
- **方法:** `GET`
- **描述:** 获取系统当前需要备份的文件/目录路径配置，以及上一次备份/恢复的时间。
- **返回值示例:**
  ```json
  {
      "success": true,
      "paths": [".env", "config/env.json"],
      "lastBackupAt": "2023-10-10T...",
      "lastRestoreAt": null
  }
  ```

### 8.2 更新备份配置
- **路径:** `/backup/config`
- **方法:** `POST`
- **描述:** 更新需要备份的文件相对路径列表配置。
- **参数 (Body):**
  - `paths` (必填, 数组): 文件相对路径数组。
- **返回值示例:**
  ```json
  {
      "success": true,
      "message": "Backup configuration updated successfully",
      "paths": [...]
  }
  ```

### 8.3 重置备份配置
- **路径:** `/backup/config/reset`
- **方法:** `POST`
- **描述:** 将备份配置的路径列表重置为系统默认值。
- **返回值示例:**
  ```json
  {
      "success": true,
      "message": "Backup configuration reset to defaults",
      "paths": [...]
  }
  ```

### 8.4 创建备份
- **路径:** `/backup/create`
- **方法:** `POST`
- **描述:** 执行备份操作，将配置中的文件复制到外部的同级备份目录中。
- **返回值示例:**
  ```json
  {
      "success": true,
      "message": "Backup completed successfully",
      "backupDir": "/path/to/backup",
      "details": ["Backed up: .env"]
  }
  ```

### 8.5 恢复备份
- **路径:** `/backup/restore`
- **方法:** `POST`
- **描述:** 从同级的备份目录中恢复覆盖当前项目的文件。
- **返回值示例:**
  ```json
  {
      "success": true,
      "message": "Restore completed successfully",
      "backupDir": "/path/to/backup",
      "details": ["Restored: .env"]
  }
  ```

---

## 9. 插件管理 API

### 9.1 获取插件列表
- **路径:** `/plugins`
- **方法:** `GET`
- **描述:** 获取系统已安装的插件配置文件 (`.plugins.js`)。如果不存在则加载示例配置 (`.plugins.example.js`)。
- **返回值示例:**
  ```json
  {
      "success": true,
      "data": [...],
      "isDefault": false
  }
  ```

### 9.2 保存插件配置
- **路径:** `/plugins`
- **方法:** `POST`
- **描述:** 保存修改后的插件配置信息至 `.plugins.js`。
- **参数 (Body):**
  - `plugins` (必填, 数组): 插件配置数组。
- **返回值示例:**
  ```json
  {
      "success": true,
      "message": "插件配置已保存"
  }
  ```

### 9.3 恢复默认插件配置
- **路径:** `/plugins/restore`
- **方法:** `POST`
- **描述:** 将当前插件配置恢复为示例配置。
- **返回值示例:**
  ```json
  {
      "success": true,
      "message": "已恢复默认插件配置"
  }
  ```

---

## 10. 加解密 API

### 10.1 数据解密
- **路径:** `/crypto/decode`
- **方法:** `POST`
- **描述:** 对给定的密文进行解密，支持多种加密算法（`base64`, `gzip`, `aes`, `rsa`）。
- **参数 (Body):**
  - `type` (必填, 字符串): 解密类型。
  - `code` (必填, 字符串): 密文内容。
- **返回值示例:**
  ```json
  {
      "success": true,
      "result": "解密后的明文"
  }
  ```
