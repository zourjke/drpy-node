# drpy-node-admin 解耦实现细节

## 1. 控制器实现示例

### 1.1 systemController.js

```javascript
/**
 * 系统管理控制器
 * 提供健康检查、服务重启等系统级功能
 */

import os from 'os';
import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs-extra';

const execPromise = util.promisify(exec);

// 健康检查
export async function getHealth(req, reply) {
    try {
        const uptime = process.uptime();
        const memory = process.memoryUsage();
        const packageJson = await fs.readJson(path.join(process.cwd(), 'package.json'));

        return reply.send({
            status: 'ok',
            uptime: Math.floor(uptime),
            memory: {
                used: Math.round(memory.heapUsed / 1024 / 1024),
                total: Math.round(memory.heapTotal / 1024 / 1024),
                rss: Math.round(memory.rss / 1024 / 1024)
            },
            version: packageJson.version,
            platform: {
                arch: os.arch(),
                platform: os.platform(),
                nodeVersion: process.version
            },
            timestamp: Date.now()
        });
    } catch (e) {
        reply.code(500).send({
            status: 'error',
            error: e.message
        });
    }
}

// 服务重启
export async function restartService(req, reply) {
    try {
        // 检查是否在 PM2 环境运行
        try {
            await execPromise('pm2 restart drpys');
            return reply.send({
                success: true,
                message: '服务已通过 PM2 重启'
            });
        } catch (pm2Error) {
            return reply.send({
                success: false,
                message: '当前未使用 PM2 运行。请在终端中手动重启服务：\\n1. 按 Ctrl+C 停止当前服务\\n2. 运行 npm run dev 重新启动'
            });
        }
    } catch (e) {
        reply.code(500).send({
            success: false,
            error: e.message
        });
    }
}
```

### 1.2 logsController.js

```javascript
/**
 * 日志管理控制器
 * 提供日志读取和 WebSocket 实时流式传输
 */

import fs from 'fs-extra';
import path from 'path';
import { WebSocket } from '@fastify/websocket';
import { EventEmitter } from 'events';

const logEmitter = new EventEmitter();
const activeLogConnections = new Set();

// 读取日志
export async function getLogs(req, reply) {
    try {
        const lines = parseInt(req.query.lines) || 50;
        const logDir = path.join(process.cwd(), 'logs');

        if (!await fs.pathExists(logDir)) {
            return reply.send({
                file: null,
                content: '日志目录不存在'
            });
        }

        const files = await fs.readdir(logDir);
        const logFiles = files
            .filter(f => f.endsWith('.log.txt'))
            .sort()
            .reverse();

        if (logFiles.length === 0) {
            return reply.send({
                file: null,
                content: '没有日志文件'
            });
        }

        const latestLog = path.join(logDir, logFiles[0]);
        const content = await fs.readFile(latestLog, 'utf-8');
        const allLines = content.trim().split('\\n');
        const lastLines = allLines.slice(-lines);

        return reply.send({
            file: logFiles[0],
            content: lastLines.join('\\n')
        });
    } catch (e) {
        reply.code(500).send({
            error: e.message
        });
    }
}

// WebSocket 日志流处理
export async function handleLogStream(connection, req) {
    const socket = connection.socket;
    activeLogConnections.add(socket);

    // 发送欢迎消息
    socket.send(JSON.stringify({
        type: 'connected',
        message: '已连接到日志流'
    }));

    // 心跳处理
    const heartbeatInterval = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'pong' }));
        } else {
            clearInterval(heartbeatInterval);
        }
    }, 30000);

    socket.on('message', async (message) => {
        try {
            const data = JSON.parse(message);

            if (data.action === 'subscribe') {
                await streamLogs(socket, data.lines || 50);
            } else if (data.action === 'clear') {
                // 清空日志
                socket.send(JSON.stringify({ type: 'cleared' }));
            }
        } catch (e) {
            socket.send(JSON.stringify({
                type: 'error',
                message: e.message
            }));
        }
    });

    socket.on('close', () => {
        clearInterval(heartbeatInterval);
        activeLogConnections.delete(socket);
    });
}

async function streamLogs(socket, lines) {
    try {
        const logDir = path.join(process.cwd(), 'logs');
        const files = await fs.readdir(logDir);
        const logFiles = files
            .filter(f => f.endsWith('.log.txt'))
            .sort()
            .reverse();

        if (logFiles.length === 0) {
            socket.send(JSON.stringify({
                type: 'error',
                message: '没有日志文件'
            }));
            return;
        }

        const latestLog = path.join(logDir, logFiles[0]);
        const content = await fs.readFile(latestLog, 'utf-8');
        const allLines = content.trim().split('\\n');
        const lastLines = allLines.slice(-lines);

        // 发送现有日志
        for (const line of lastLines) {
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({
                    type: 'log',
                    timestamp: Date.now(),
                    content: line
                }));
            }
        }

        socket.send(JSON.stringify({
            type: 'end',
            message: `已读取 ${lastLines.length} 行日志`
        }));
    } catch (e) {
        socket.send(JSON.stringify({
            type: 'error',
            message: e.message
        }));
    }
}
```

### 1.3 sourcesController.js

```javascript
/**
 * 源管理控制器
 * 提供源列表、验证、语法检查、模板获取等功能
 */

import fs from 'fs-extra';
import path from 'path';
import vm from 'vm';
import { resolvePath } from '../../utils/pathHelper.js';

// 导入 drpy 工具
let jsoup, req;
try {
    const htmlParser = await import('../../libs_drpy/htmlParser.js');
    jsoup = htmlParser.jsoup;
    const reqModule = await import('../../utils/req.js');
    req = reqModule.default;
} catch (e) {
    console.warn('Failed to import project utils:', e.message);
}

// 列出所有源
export async function listSources(req, reply) {
    try {
        const jsPath = path.join(process.cwd(), 'spider/js');
        const catvodPath = path.join(process.cwd(), 'spider/catvod');

        let jsSources = [];
        let catvodSources = [];

        if (await fs.pathExists(jsPath)) {
            jsSources = (await fs.readdir(jsPath))
                .filter(f => f.endsWith('.js'))
                .sort();
        }

        if (await fs.pathExists(catvodPath)) {
            catvodSources = (await fs.readdir(catvodPath))
                .filter(f => f.endsWith('.js'))
                .sort();
        }

        return reply.send({
            js: jsSources,
            catvod: catvodSources
        });
    } catch (e) {
        reply.code(500).send({
            error: e.message
        });
    }
}

// 验证源文件
export async function validateSpider(req, reply) {
    try {
        const { path: filePath } = req.body;

        if (!filePath || !isSafePath(filePath)) {
            return reply.code(400).send({
                isValid: false,
                error: '无效的文件路径'
            });
        }

        const fullPath = path.join(process.cwd(), filePath);
        if (!await fs.pathExists(fullPath)) {
            return reply.code(404).send({
                isValid: false,
                error: '文件不存在'
            });
        }

        let code = await fs.readFile(fullPath, 'utf-8');

        // 如果是 JS 文件，尝试解码
        if (filePath.endsWith('.js')) {
            try {
                const { decodeDsSource } = await import('../../utils/dsHelper.js');
                code = await decodeDsSource(code);
            } catch (e) {
                // 解码失败，使用原始代码
            }
        }

        // 创建沙箱执行
        const sandbox = {
            console: { log: () => {} },
            require: () => {},
            rule: null
        };

        try {
            vm.createContext(sandbox);
            new vm.Script(code).runInContext(sandbox);

            if (!sandbox.rule) {
                return reply.send({
                    isValid: false,
                    error: '源文件中缺少 rule 对象'
                });
            }

            // 基本验证
            const required = ['title', 'host', 'url'];
            const missing = required.filter(k => !sandbox.rule[k]);

            if (missing.length > 0) {
                return reply.send({
                    isValid: false,
                    error: `rule 对象缺少必填字段: ${missing.join(', ')}`
                });
            }

            return reply.send({
                isValid: true,
                message: '验证通过'
            });
        } catch (e) {
            return reply.send({
                isValid: false,
                error: `执行错误: ${e.message}`
            });
        }
    } catch (e) {
        reply.code(500).send({
            error: e.message
        });
    }
}

// 检查语法
export async function checkSyntax(req, reply) {
    try {
        const { path: filePath } = req.body;

        if (!filePath || !isSafePath(filePath)) {
            return reply.code(400).send({
                isValid: false,
                error: '无效的文件路径'
            });
        }

        const fullPath = path.join(process.cwd(), filePath);
        let code = await fs.readFile(fullPath, 'utf-8');

        // 如果是 JS 文件，尝试解码
        if (filePath.endsWith('.js')) {
            try {
                const { decodeDsSource } = await import('../../utils/dsHelper.js');
                code = await decodeDsSource(code);
            } catch (e) {
                // 解码失败，使用原始代码
            }
        }

        try {
            new vm.Script(code);
            return reply.send({
                isValid: true,
                message: '语法检查通过'
            });
        } catch (e) {
            return reply.code(400).send({
                isValid: false,
                error: `语法错误: ${e.message}`
            });
        }
    } catch (e) {
        reply.code(500).send({
            error: e.message
        });
    }
}

// 获取模板
export async function getTemplate(req, reply) {
    const template = `/*
* @File     : drpy-node spider template
* @Author   : user
* @Date     : ${new Date().toISOString().split('T')[0]}
* @Comments :
*/

var rule = {
    // 影视|漫画|小说
    类型: '影视',
    // 源标题
    title: 'Site Name',
    // 源主域名
    host: 'https://example.com',
    // 源主页链接
    homeUrl: '/latest/',
    // 源一级列表链接
    url: '/category/fyclass/page/fypage',
    // 源搜索链接
    searchUrl: '/search?wd=**&pg=fypage',
    // 允许搜索、允许快搜、允许筛选
    searchable: 2,
    quickSearch: 0,
    filterable: 1,
    // 请求头
    headers: {
        'User-Agent': 'MOBILE_UA',
    },
    // 超时时间
    timeout: 5000,
    // 静态分类
    class_name: '电影&电视剧&综艺&动漫',
    class_url: '1&2&3&4',

    // 是否需要调用免嗅
    play_parse: true,
    // 免嗅lazy执行函数
    lazy: '',
    // 首页推荐数量
    limit: 6,
    // 是否双层列表
    double: true,

    // 推荐列表
    推荐: '.recommend .item;a&&title;img&&src;.remarks&&Text;a&&href',
    // 一级列表
    一级: '.list .item;a&&title;img&&src;.remarks&&Text;a&&href',
    // 二级详情
    二级: {
        "title": "h1&&Text",
        "img": ".poster img&&src",
        "desc": ".desc&&Text",
        "content": ".content&&Text",
        "tabs": ".tabs span",
        "lists": ".playlists ul"
    },
    // 搜索
    搜索: '.search-result .item;a&&title;img&&src;.remarks&&Text;a&&href',
}`;

    return reply.send({ template });
}

function isSafePath(filePath) {
    return !filePath.includes('..') &&
           !filePath.includes('~') &&
           !filePath.startsWith('/') &&
           !filePath.includes('node_modules');
}
```

### 1.4 filesController.js

```javascript
/**
 * 文件管理控制器
 * 提供文件列表、读取、写入、删除功能
 */

import fs from 'fs-extra';
import path from 'path';
import mime from 'mime-types';

// 列出目录
export async function listDirectory(req, reply) {
    try {
        const dirPath = req.query.path || '.';

        if (!isSafePath(dirPath)) {
            return reply.code(403).send({
                error: '访问被拒绝'
            });
        }

        const fullPath = path.join(process.cwd(), dirPath);
        const files = await fs.readdir(fullPath, { withFileTypes: true });

        const result = files.map(f => ({
            name: f.name,
            path: dirPath === '.' ? f.name : `${dirPath}/${f.name}`,
            isDirectory: f.isDirectory(),
            size: f.isDirectory() ? undefined : (await fs.stat(path.join(fullPath, f.name))).size
        }));

        return reply.send({ files: result });
    } catch (e) {
        reply.code(500).send({
            error: e.message
        });
    }
}

// 读取文件
export async function readFile(req, reply) {
    try {
        const { path: filePath } = req.query;

        if (!filePath || !isSafePath(filePath)) {
            return reply.code(403).send({
                error: '无效的文件路径'
            });
        }

        const fullPath = path.join(process.cwd(), filePath);

        if (!await fs.pathExists(fullPath)) {
            return reply.code(404).send({
                error: '文件不存在'
            });
        }

        const ext = path.extname(filePath).toLowerCase();
        const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.bmp'];

        if (imageExts.includes(ext)) {
            // 图片文件 - 返回 base64
            const buffer = await fs.readFile(fullPath);
            const base64 = buffer.toString('base64');
            const mimeType = mime.lookup(fullPath) || 'image/png';

            return reply.send({
                type: 'image',
                mimeType,
                dataUrl: `data:${mimeType};base64,${base64}`
            });
        }

        // 文本文件
        let content = await fs.readFile(fullPath, 'utf-8');

        // 如果是 JS 文件，尝试解码
        if (ext === '.js') {
            try {
                const { decodeDsSource } = await import('../../utils/dsHelper.js');
                content = await decodeDsSource(content);
            } catch (e) {
                // 保持原样
            }
        }

        return reply.send({
            type: 'text',
            content
        });
    } catch (e) {
        reply.code(500).send({
            error: e.message
        });
    }
}

// 写入文件
export async function writeFile(req, reply) {
    try {
        const { path: filePath, content } = req.body;

        if (!filePath || !isSafePath(filePath)) {
            return reply.code(403).send({
                error: '无效的文件路径'
            });
        }

        const fullPath = path.join(process.cwd(), filePath);

        // 确保目录存在
        await fs.ensureDir(path.dirname(fullPath));

        // 写入文件
        await fs.writeFile(fullPath, content, 'utf-8');

        return reply.send({
            success: true,
            message: '文件保存成功'
        });
    } catch (e) {
        reply.code(500).send({
            error: e.message
        });
    }
}

// 删除文件
export async function deleteFile(req, reply) {
    try {
        const { path: filePath } = req.body;

        if (!filePath || !isSafePath(filePath)) {
            return reply.code(403).send({
                error: '无效的文件路径'
            });
        }

        const fullPath = path.join(process.cwd(), filePath);

        if (!await fs.pathExists(fullPath)) {
            return reply.code(404).send({
                error: '文件不存在'
            });
        }

        await fs.remove(fullPath);

        return reply.send({
            success: true,
            message: '文件删除成功'
        });
    } catch (e) {
        reply.code(500).send({
            error: e.message
        });
    }
}

function isSafePath(filePath) {
    return !filePath.includes('..') &&
           !filePath.includes('~') &&
           !filePath.startsWith('/') &&
           !filePath.includes('node_modules') &&
           !filePath.includes('database.db');
}
```

### 1.5 dbController.js

```javascript
/**
 * 数据库查询控制器
 * 提供安全的只读 SQL 查询功能
 */

import sqlite3pkg from 'node-sqlite3-wasm';
const { Database } = sqlite3pkg;
import path from 'path';

// 执行查询
export async function executeQuery(req, reply) {
    try {
        const { sql, params } = req.body;

        if (!sql || !sql.trim()) {
            return reply.code(400).send({
                error: 'SQL 查询不能为空'
            });
        }

        // 只允许 SELECT 查询
        const trimmedSql = sql.trim().toLowerCase();
        if (!trimmedSql.startsWith('select')) {
            return reply.code(403).send({
                error: '只允许 SELECT 查询'
            });
        }

        // 额外安全检查
        const dangerousKeywords = ['drop', 'delete', 'insert', 'update', 'alter', 'create', 'truncate'];
        for (const keyword of dangerousKeywords) {
            if (trimmedSql.includes(keyword)) {
                return reply.code(403).send({
                    error: `不允许使用 ${keyword.toUpperCase()} 语句`
                });
            }
        }

        const dbPath = path.join(process.cwd(), 'database.db');
        const db = new Database(dbPath);

        try {
            const rows = db.all(sql, params || []);
            return reply.send({
                success: true,
                data: rows,
                rows: rows.length
            });
        } finally {
            db.close();
        }
    } catch (e) {
        reply.code(500).send({
            error: `SQL 错误: ${e.message}`
        });
    }
}

// 获取表结构
export async function getTables(req, reply) {
    try {
        const dbPath = path.join(process.cwd(), 'database.db');
        const db = new Database(dbPath);

        try {
            const tables = db.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
            return reply.send({
                success: true,
                tables: tables.map(t => t.name)
            });
        } finally {
            db.close();
        }
    } catch (e) {
        reply.code(500).send({
            error: e.message
        });
    }
}

// 获取表结构
export async function getTableSchema(req, reply) {
    try {
        const { table } = req.params;

        if (!table) {
            return reply.code(400).send({
                error: '表名不能为空'
            });
        }

        const dbPath = path.join(process.cwd(), 'database.db');
        const db = new Database(dbPath);

        try {
            const schema = db.all(`PRAGMA table_info(${table})`);
            return reply.send({
                success: true,
                table,
                columns: schema
            });
        } finally {
            db.close();
        }
    } catch (e) {
        reply.code(500).send({
            error: e.message
        });
    }
}
```

## 2. admin.js 重构

```javascript
/**
 * Admin Controller - 后台管理主控制器
 * 重构版：移除 MCP 依赖，直接实现业务逻辑
 */

import path from 'path';
import fs from 'fs-extra';
import fastifyStatic from '@fastify/static';
import { websocketServerConnector } from '@fastify/websocket';

// 导入子控制器
import * as systemController from './admin/systemController.js';
import * as logsController from './admin/logsController.js';
import * as sourcesController from './admin/sourcesController.js';
import * as filesController from './admin/filesController.js';
import * as dbController from './admin/dbController.js';

// 配置常量
const CONFIG_PATH = path.join(process.cwd(), 'config/env.json');

// 导出路由配置
export default async function adminController(fastify, options, done) {
    // 注册 WebSocket 插件
    await fastify.register(websocketServerConnector);

    // ==================== 静态文件服务 ====================
    const adminDistPath = path.join(process.cwd(), 'apps/admin');

    // 如果编译后的 admin 存在，提供静态文件服务
    if (await fs.pathExists(adminDistPath)) {
        fastify.log.info('Serving admin panel from ' + adminDistPath);

        fastify.register(fastifyStatic, {
            root: adminDistPath,
            prefix: '/admin/',
            decorateReply: false,
            index: ['index.html'],
            cacheControl: 3600, // 1 小时缓存
            etag: true
        });
    }

    // ==================== 系统管理 API ====================
    fastify.get('/api/admin/health', systemController.getHealth);
    fastify.post('/api/admin/restart', systemController.restartService);

    // ==================== 日志 API ====================
    fastify.get('/api/admin/logs', logsController.getLogs);
    fastify.register(async function (fastify) {
        fastify.get('/api/admin/logs/stream', { websocket: true }, logsController.handleLogStream);
    });

    // ==================== 配置管理 API ====================
    fastify.get('/api/admin/config', getConfig);
    fastify.post('/api/admin/config', updateConfig);
    fastify.get('/api/admin/env', getEnv);

    // ==================== 源管理 API ====================
    fastify.get('/api/admin/sources', sourcesController.listSources);
    fastify.post('/api/admin/sources/validate', sourcesController.validateSpider);
    fastify.post('/api/admin/sources/syntax', sourcesController.checkSyntax);
    fastify.get('/api/admin/sources/template', sourcesController.getTemplate);
    fastify.get('/api/admin/sources/libs', sourcesController.getLibsInfo);

    // ==================== 文件管理 API ====================
    fastify.get('/api/admin/files/list', filesController.listDirectory);
    fastify.get('/api/admin/files/read', filesController.readFile);
    fastify.post('/api/admin/files/write', filesController.writeFile);
    fastify.delete('/api/admin/files/delete', filesController.deleteFile);

    // ==================== 数据库 API ====================
    fastify.post('/api/admin/db/query', dbController.executeQuery);
    fastify.get('/api/admin/db/tables', dbController.getTables);
    fastify.get('/api/admin/db/tables/:table/schema', dbController.getTableSchema);

    // ==================== 路由信息 API ====================
    fastify.get('/api/admin/routes', getRoutesInfo);

    done();
}

// ==================== 辅助函数 ====================

async function getConfig(req, reply) {
    try {
        const { key } = req.query;

        if (!await fs.pathExists(CONFIG_PATH)) {
            return reply.send({});
        }

        const configContent = await fs.readFile(CONFIG_PATH, 'utf-8');
        const config = JSON.parse(configContent);

        if (key) {
            const keys = key.split('.');
            let value = config;
            for (const k of keys) {
                value = value?.[k];
            }
            return reply.send(value !== undefined ? value : null);
        }

        return reply.send(config);
    } catch (e) {
        reply.code(500).send({ error: e.message });
    }
}

async function updateConfig(req, reply) {
    try {
        const { key, value } = req.body;

        if (!key) {
            return reply.code(400).send({ error: 'Key is required' });
        }

        if (!await fs.pathExists(CONFIG_PATH)) {
            return reply.code(404).send({ error: 'Config file not found' });
        }

        const configContent = await fs.readFile(CONFIG_PATH, 'utf-8');
        let config = JSON.parse(configContent);

        // 设置嵌套值
        const keys = key.split('.');
        let target = config;
        for (let i = 0; i < keys.length - 1; i++) {
            if (!target[keys[i]]) {
                target[keys[i]] = {};
            }
            target = target[keys[i]];
        }

        // 尝试解析为 JSON
        let parsedValue = value;
        try {
            parsedValue = JSON.parse(value);
        } catch {
            // 保持字符串
        }

        target[keys[keys.length - 1]] = parsedValue;

        // 写回文件
        await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));

        return reply.send({
            success: true,
            message: `配置项 ${key} 已更新`
        });
    } catch (e) {
        reply.code(500).send({ error: e.message });
    }
}

async function getEnv(req, reply) {
    try {
        const envData = {};

        // 从 process.env 读取关键配置
        const keys = [
            'PORT', 'NODE_ENV', 'MAX_TEXT_SIZE', 'MAX_IMAGE_SIZE',
            'QUARK_COOKIE', 'ALI_TOKEN', 'bili_cookie'
        ];

        for (const key of keys) {
            if (process.env[key]) {
                envData[key] = process.env[key];
            }
        }

        return reply.send(envData);
    } catch (e) {
        reply.code(500).send({ error: e.message });
    }
}

async function getRoutesInfo(req, reply) {
    try {
        const indexControllerPath = path.join(process.cwd(), 'controllers/index.js');

        if (!await fs.pathExists(indexControllerPath)) {
            return reply.send({
                file: 'controllers/index.js',
                registered_controllers: []
            });
        }

        const content = await fs.readFile(indexControllerPath, 'utf-8');
        const lines = content.split('\n');
        const registered = lines
            .filter(l => l.trim().startsWith('fastify.register('))
            .map(l => l.trim());

        return reply.send({
            file: 'controllers/index.js',
            registered_controllers: registered
        });
    } catch (e) {
        reply.code(500).send({ error: e.message });
    }
}
```

## 3. 前端 API 客户端

### 3.1 src/api/admin.js

```javascript
/**
 * Admin API 统一调用接口
 * 所有后台管理 API 都通过这个模块调用
 */

import client from './client';

export const adminApi = {
    // ==================== 系统 ====================
    async getHealth() {
        return client.get('/api/admin/health');
    },

    async restartService() {
        return client.post('/api/admin/restart');
    },

    // ==================== 日志 ====================
    async getLogs(lines = 50) {
        return client.get('/api/admin/logs', { params: { lines } });
    },

    // WebSocket 连接在组件中直接使用

    // ==================== 配置 ====================
    async getConfig(key) {
        return client.get('/api/admin/config', { params: { key } });
    },

    async updateConfig(key, value) {
        return client.post('/api/admin/config', { key, value });
    },

    async getEnv() {
        return client.get('/api/admin/env');
    },

    // ==================== 源管理 ====================
    async listSources() {
        return client.get('/api/admin/sources');
    },

    async validateSource(path) {
        return client.post('/api/admin/sources/validate', { path });
    },

    async checkSyntax(path) {
        return client.post('/api/admin/sources/syntax', { path });
    },

    async getTemplate() {
        return client.get('/api/admin/sources/template');
    },

    async getLibsInfo() {
        return client.get('/api/admin/sources/libs');
    },

    // ==================== 文件管理 ====================
    async listDirectory(path) {
        return client.get('/api/admin/files/list', { params: { path } });
    },

    async readFile(path) {
        return client.get('/api/admin/files/read', { params: { path } });
    },

    async writeFile(path, content) {
        return client.post('/api/admin/files/write', { path, content });
    },

    async deleteFile(path) {
        return client.delete('/api/admin/files/delete', { params: { path } });
    },

    // ==================== 数据库 ====================
    async executeQuery(sql) {
        return client.post('/api/admin/db/query', { sql });
    },

    async getTables() {
        return client.get('/api/admin/db/tables');
    },

    async getTableSchema(table) {
        return client.get(`/api/admin/db/tables/${table}/schema`);
    },

    // ==================== 路由信息 ====================
    async getRoutes() {
        return client.get('/api/admin/routes');
    }
};
```

### 3.2 其他 API 文件重构

```javascript
// src/api/system.js - 重构
import { adminApi } from './admin';

export const systemApi = {
    async checkHealth() {
        const result = await adminApi.getHealth();
        return result;
    },

    async restartService() {
        const result = await adminApi.restartService();
        return result;
    },

    async fetchRoutes() {
        const result = await adminApi.getRoutes();
        return result;
    },

    async fetchSources() {
        const result = await adminApi.listSources();
        // 保持与原有格式兼容
        return result;
    }
};

// src/api/spider.js - 重构
import { adminApi } from './admin';

export const spiderApi = {
    async listSources() {
        const result = await adminApi.listSources();
        // 保持与原有格式兼容
        return {
            js: result.js || [],
            catvod: result.catvod || []
        };
    },

    async validateSpider(path) {
        const result = await adminApi.validateSource(path);
        // 保持与原有格式兼容
        if (result.isValid) {
            return { isError: false, content: [{ text: result.message || '验证通过' }] };
        } else {
            return { isError: true, content: [{ text: result.error }] };
        }
    },

    async checkSyntax(path) {
        const result = await adminApi.checkSyntax(path);
        // 保持与原有格式兼容
        if (result.isValid) {
            return { isError: false, content: [{ text: result.message || '语法正确' }] };
        } else {
            return { isError: true, content: [{ text: result.error }] };
        }
    },

    async getTemplate() {
        const result = await adminApi.getTemplate();
        return result.template;
    },

    async debugRule(params) {
        // 如果需要调试功能，需要额外实现
        // 暂时返回不支持的提示
        return {
            isError: true,
            content: [{ text: '调试功能暂未实现' }]
        };
    }
};

// src/api/file.js - 重构
import { adminApi } from './admin';

export const fileApi = {
    async listDirectory(path = '.') {
        const result = await adminApi.listDirectory(path);
        // 保持与原有格式兼容
        return result;
    },

    async readFile(path) {
        const result = await adminApi.readFile(path);
        return result;
    },

    async writeFile(path, content) {
        const result = await adminApi.writeFile(path, content);
        return result;
    },

    async deleteFile(path) {
        const result = await adminApi.deleteFile(path);
        return result;
    }
};

// src/api/db.js - 新增
import { adminApi } from './admin';

export const dbApi = {
    async query(sql) {
        const result = await adminApi.executeQuery(sql);
        return result.data;
    },

    async getTables() {
        const result = await adminApi.getTables();
        return result.tables;
    },

    async getTableSchema(table) {
        const result = await adminApi.getTableSchema(table);
        return result.columns;
    }
};
```

## 4. Vite 配置调整

### 4.1 vite.config.js

```javascript
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [vue()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },

  // 构建配置
  build: {
    outDir: path.resolve(__dirname, '../apps/admin'),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['vue', 'vue-router', 'pinia'],
          'ui': ['axios']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  },

  // 开发服务器配置
  server: {
    port: 5174,
    proxy: {
      // 所有 API 请求代理到 drpy-node
      '/api': {
        target: 'http://localhost:5757',
        changeOrigin: true
      },
      // WebSocket 代理
      '/api/admin/logs/stream': {
        target: 'ws://localhost:5757',
        ws: true
      }
    }
  },

  // 基础路径
  base: '/admin/'
});
```

## 5. 测试计划

### 5.1 API 测试用例

```javascript
// tests/api/admin.test.js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { build } from 'vite';
import { fileURLToPath } from 'url';
import { $fetch } from 'island-fetch';

describe('Admin API', () => {
  let baseUrl;

  beforeAll(async () => {
    // 启动测试服务器
    baseUrl = 'http://localhost:5757/api/admin';
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await $fetch(`${baseUrl}/health`);
      const data = await response.json();

      expect(data.status).toBe('ok');
      expect(data.version).toBeDefined();
    });
  });

  describe('GET /sources', () => {
    it('should return list of sources', async () => {
      const response = await $fetch(`${baseUrl}/sources`);
      const data = await response.json();

      expect(data.js).toBeInstanceOf(Array);
      expect(data.catvod).toBeInstanceOf(Array);
    });
  });

  describe('POST /sources/syntax', () => {
    it('should check syntax of spider file', async () => {
      const response = await $fetch(`${baseUrl}/sources/syntax`, {
        method: 'POST',
        body: JSON.stringify({
          path: 'spider/js/_test.js'
        })
      });
      const data = await response.json();

      expect(data.isValid).toBeDefined();
    });
  });

  // 更多测试用例...
});
```

## 6. 部署脚本

### 6.1 构建脚本

```javascript
// scripts/build-admin.js
import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';

console.log('🔨 开始构建 drpy-node-admin...');

// 1. 进入 admin 目录
process.chdir(path.join(process.cwd(), 'drpy-node-admin'));

// 2. 安装依赖（如果需要）
if (!fs.existsSync('node_modules')) {
    console.log('📦 安装依赖...');
    execSync('npm install', { stdio: 'inherit' });
}

// 3. 构建
console.log('🏗️  构建生产版本...');
execSync('npm run build', { stdio: 'inherit' });

// 4. 验证构建结果
const adminDistPath = path.join(process.cwd(), '../apps/admin');
if (!fs.existsSync(adminDistPath)) {
    console.error('❌ 构建失败：未找到输出目录');
    process.exit(1);
}

const indexHtml = path.join(adminDistPath, 'index.html');
if (!fs.existsSync(indexHtml)) {
    console.error('❌ 构建失败：未找到 index.html');
    process.exit(1);
}

console.log('✅ 构建成功！');
console.log(`📂 输出目录: ${adminDistPath}`);
console.log('');
console.log('现在可以通过以下地址访问管理面板:');
console.log('  http://localhost:5757/admin/');
```

## 7. 兼容性过渡方案

### 7.1 MCP 兼容层（可选）

```javascript
// 在 admin.js 中添加兼容层（可配置开关）
const ENABLE_MCP_COMPAT = process.env.ENABLE_MCP_COMPAT === 'true';

// 兼容 MCP 格式的接口
if (ENABLE_MCP_COMPAT) {
    fastify.post('/admin/mcp', async (req, reply) => {
        const { name, arguments: args } = req.body;

        // 映射到新 API
        const apiMapping = {
            'read_logs': () => logsController.getLogs(req, reply),
            'restart_service': () => systemController.restartService(req, reply),
            'list_sources': () => sourcesController.listSources(req, reply),
            // ... 其他映射
        };

        const handler = apiMapping[name];
        if (handler) {
            return handler();
        }

        return reply.code(404).send({ error: 'Tool not found' });
    });
}
```
