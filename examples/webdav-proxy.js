/**
 * WebDAV 文件代理服务器
 * 提供 WebDAV 文件的 HTTP 直链访问功能
 * 
 * 使用方法：
 * 1. 启动服务器：node webdav-proxy.js
 * 2. 访问文件：http://localhost:3000/file?path=/path/to/file
 * 3. 支持 Range 请求，适合视频流媒体播放
 */

import Fastify from 'fastify';
import { WebDAVClient } from '../utils/webdav.js';
import { readFileSync } from 'fs';
import path from 'path';
import { PROJECT_ROOT } from '../utils/pathHelper.js';

class WebDAVProxy {
    constructor(options = {}) {
        this.port = options.port || 3000;
        this.host = options.host || 'localhost';
        this.webdavClients = new Map(); // 缓存 WebDAV 客户端
        this.fileCache = new Map(); // 文件信息缓存
        this.cacheTimeout = options.cacheTimeout || 5 * 60 * 1000; // 5分钟缓存
        
        this.app = Fastify({
            logger: false // 使用自定义日志
        });
        
        this.init();
    }

    async init() {
        await this.setupMiddleware();
        this.setupRoutes();
    }

    async setupMiddleware() {
        // 手动添加 CORS 头
        this.app.addHook('onRequest', async (request, reply) => {
            reply.header('Access-Control-Allow-Origin', '*');
            reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Range');
            
            // 添加请求日志
            console.log(`${new Date().toISOString()} - ${request.method} ${request.url}`);
        });
        
        // 处理 OPTIONS 预检请求
        this.app.options('*', async (request, reply) => {
            reply.code(200).send();
        });
    }

    setupRoutes() {
        // 健康检查
        this.app.get('/health', async (request, reply) => {
            return { status: 'ok', timestamp: new Date().toISOString() };
        });

        // 文件直链访问
        this.app.get('/file', this.handleFileRequest.bind(this));
        
        // 文件信息获取
        this.app.get('/info', this.handleInfoRequest.bind(this));
        
        // 目录列表
        this.app.get('/list', this.handleListRequest.bind(this));

        // 配置 WebDAV 连接
        this.app.post('/config', this.handleConfigRequest.bind(this));

        // 错误处理
        this.app.setErrorHandler(this.errorHandler.bind(this));
    }

    /**
     * 获取或创建 WebDAV 客户端
     */
    getWebDAVClient(config) {
        const key = `${config.baseURL}:${config.username}`;
        
        if (!this.webdavClients.has(key)) {
            const client = new WebDAVClient(config);
            this.webdavClients.set(key, client);
        }
        
        return this.webdavClients.get(key);
    }

    /**
     * 处理文件请求
     */
    async handleFileRequest(request, reply) {
        try {
            const { path: filePath, config: configParam } = request.query;
            
            if (!filePath) {
                reply.code(400);
                return { error: 'Missing path parameter' };
            }

            // 获取 WebDAV 配置
            let config;
            if (configParam) {
                try {
                    config = JSON.parse(decodeURIComponent(configParam));
                } catch (e) {
                    reply.code(400);
                    return { error: 'Invalid config parameter' };
                }
            } else {
                // 尝试从默认配置文件读取
                config = this.loadDefaultConfig();
            }

            if (!config) {
                reply.code(400);
                return { error: 'WebDAV config not provided' };
            }

            const client = this.getWebDAVClient(config);
            
            // 检查缓存
            const cacheKey = `${config.baseURL}:${filePath}`;
            const cached = this.fileCache.get(cacheKey);
            const now = Date.now();
            
            let fileInfo;
            if (cached && (now - cached.timestamp) < this.cacheTimeout) {
                fileInfo = cached.info;
            } else {
                // 获取文件信息并缓存
                fileInfo = await client.getInfo(filePath);
                this.fileCache.set(cacheKey, {
                    info: fileInfo,
                    timestamp: now
                });
            }

            if (!fileInfo || fileInfo.isDirectory) {
                reply.code(404);
                return { error: 'File not found or is a directory' };
            }

            // 处理 Range 请求
            const range = request.headers.range;
            let streamOptions = {};
            
            if (range) {
                const parts = range.replace(/bytes=/, "").split("-");
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : fileInfo.size - 1;
                
                if (start >= fileInfo.size || end >= fileInfo.size) {
                    reply.code(416);
                    reply.header('Content-Range', `bytes */${fileInfo.size}`);
                    return;
                }

                streamOptions.headers = {
                    'Range': `bytes=${start}-${end}`
                };

                reply.code(206);
                reply.header('Content-Range', `bytes ${start}-${end}/${fileInfo.size}`);
                reply.header('Accept-Ranges', 'bytes');
                reply.header('Content-Length', end - start + 1);
            } else {
                reply.header('Content-Length', fileInfo.size);
                reply.header('Accept-Ranges', 'bytes');
            }

            // 设置响应头
            reply.header('Content-Type', fileInfo.contentType || 'application/octet-stream');
            if (fileInfo.lastModified) {
                reply.header('Last-Modified', new Date(fileInfo.lastModified).toUTCString());
            }
            if (fileInfo.etag) {
                reply.header('ETag', fileInfo.etag);
            }
            reply.header('Cache-Control', 'public, max-age=3600');

            // 获取文件流
            const { stream } = await client.getFileStream(filePath, streamOptions);
            
            // 返回流
            return reply.send(stream);

        } catch (error) {
            console.error('File request error:', error);
            reply.code(500);
            return { error: error.message };
        }
    }

    /**
     * 处理文件信息请求
     */
    async handleInfoRequest(request, reply) {
        try {
            const { path: filePath, config: configParam } = request.query;
            
            if (!filePath) {
                reply.code(400);
                return { error: 'Missing path parameter' };
            }

            let config;
            if (configParam) {
                config = JSON.parse(decodeURIComponent(configParam));
            } else {
                config = this.loadDefaultConfig();
            }

            if (!config) {
                reply.code(400);
                return { error: 'WebDAV config not provided' };
            }

            const client = this.getWebDAVClient(config);
            const fileInfo = await client.getInfo(filePath);
            
            return fileInfo;
        } catch (error) {
            console.error('Info request error:', error);
            reply.code(500);
            return { error: error.message };
        }
    }

    /**
     * 处理目录列表请求
     */
    async handleListRequest(request, reply) {
        try {
            const { path: dirPath = '/', config: configParam } = request.query;

            let config;
            if (configParam) {
                config = JSON.parse(decodeURIComponent(configParam));
            } else {
                config = this.loadDefaultConfig();
            }

            if (!config) {
                reply.code(400);
                return { error: 'WebDAV config not provided' };
            }

            const client = this.getWebDAVClient(config);
            const items = await client.listDirectory(dirPath);
            
            return items;
        } catch (error) {
            console.error('List request error:', error);
            reply.code(500);
            return { error: error.message };
        }
    }

    /**
     * 处理配置请求
     */
    async handleConfigRequest(request, reply) {
        try {
            const config = request.body;
            
            // 验证配置
            if (!config.baseURL || !config.username || !config.password) {
                reply.code(400);
                return { error: 'Missing required config fields' };
            }

            // 测试连接
            const client = this.getWebDAVClient(config);
            await client.testConnection();
            
            return { success: true, message: 'WebDAV connection configured successfully' };
        } catch (error) {
            console.error('Config request error:', error);
            reply.code(500);
            return { error: error.message };
        }
    }

    /**
     * 加载默认配置
     */
    loadDefaultConfig() {
        try {
            const configPath = path.join(PROJECT_ROOT, 'json', 'webdav.json');
            const configData = readFileSync(configPath, 'utf8');
            const parsed = JSON.parse(configData);
            
            // 如果是数组，取第一个配置
            if (Array.isArray(parsed)) {
                return parsed.length > 0 ? parsed[0] : null;
            }
            
            return parsed;
        } catch (error) {
            console.warn('Could not load default WebDAV config:', error.message);
            return null;
        }
    }

    /**
     * 错误处理中间件
     */
    async errorHandler(error, request, reply) {
        console.error('Unhandled error:', error);
        reply.code(500);
        return { error: 'Internal server error' };
    }

    /**
     * 启动服务器
     */
    async start() {
        try {
            await this.app.listen({ port: this.port, host: this.host });
            console.log(`WebDAV Proxy Server started on http://${this.host}:${this.port}`);
            console.log('Available endpoints:');
            console.log(`  GET  /file?path=<file_path>     - Get file direct link`);
            console.log(`  GET  /info?path=<file_path>     - Get file information`);
            console.log(`  GET  /list?path=<dir_path>      - List directory contents`);
            console.log(`  POST /config                    - Configure WebDAV connection`);
            console.log(`  GET  /health                    - Health check`);
        } catch (error) {
            console.error('Failed to start server:', error);
            throw error;
        }
    }

    /**
     * 停止服务器
     */
    async stop() {
        try {
            await this.app.close();
            console.log('WebDAV Proxy Server stopped');
        } catch (error) {
            console.error('Error stopping server:', error);
        }
    }

    /**
     * 清理缓存
     */
    clearCache() {
        this.fileCache.clear();
        this.webdavClients.clear();
        console.log('Cache cleared');
    }
}

// 如果直接运行此文件，启动服务器
if (import.meta.url === `file://${process.argv[1]}`) {
    const proxy = new WebDAVProxy({
        port: process.env.WEBDAV_PROXY_PORT || 3000,
        host: process.env.WEBDAV_PROXY_HOST || 'localhost'
    });

    proxy.start().catch(console.error);

    // 优雅关闭
    process.on('SIGINT', async () => {
        console.log('\nShutting down gracefully...');
        await proxy.stop();
        process.exit(0);
    });
}

export default WebDAVProxy;
export { WebDAVProxy };