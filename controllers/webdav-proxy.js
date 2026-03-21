import { PROJECT_ROOT } from '../utils/pathHelper.js';
/**
 * WebDAV 代理控制器模块
 * 提供 WebDAV 文件的 HTTP 直链访问功能
 * @module webdav-proxy-controller
 */

import {ENV} from '../utils/env.js';
import {WebDAVClient} from '../utils/webdav.js';
import {CacheManagerFactory, createHealthResponse, createStatusResponse} from '../utils/proxy-util.js';
import {readFileSync} from 'fs';
import path from 'path';

/**
 * WebDAV 代理控制器插件
 * @param {Object} fastify - Fastify实例
 * @param {Object} options - 插件选项
 * @param {Function} done - 完成回调
 */
export default (fastify, options, done) => {
    // WebDAV 客户端缓存 - 使用智能缓存管理器
    const webdavClients = CacheManagerFactory.createClientCache('WebDAVProxy-ClientCache');
    // 文件信息缓存 - 使用智能缓存管理器
    const fileCache = CacheManagerFactory.createFileCache('WebDAVProxy-FileCache');
    // 缓存超时时间（5分钟）
    const cacheTimeout = 5 * 60 * 1000;

    /**
     * 获取或创建 WebDAV 客户端
     */
    function getWebDAVClient(config) {
        const key = `${config.baseURL}:${config.username}`;

        if (!webdavClients.has(key)) {
            const client = new WebDAVClient(config);
            webdavClients.set(key, client);
        }

        return webdavClients.get(key);
    }

    /**
     * 加载默认配置
     */
    function loadDefaultConfig() {
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
     * WebDAV 健康检查接口
     * GET /webdav/health - 检查 WebDAV 代理服务状态
     */
    fastify.get('/webdav/health', async (request, reply) => {
        console.log(`[webdavController] Health check request`);

        const healthData = createHealthResponse(webdavClients, fileCache, {
            features: [
                'WebDAV file direct link access',
                'Smart cache management with auto-cleanup',
                'Multiple WebDAV server support',
                'File metadata caching',
                'Range request support for large files'
            ]
        });

        return reply.send(healthData);
    });

    /**
     * WebDAV 文件直链访问接口
     * GET /webdav/file - 获取文件直链
     */
    fastify.get('/webdav/file', async (request, reply) => {
        const {path: filePath, config: configParam} = request.query;

        console.log(`[webdavController] File request: ${filePath}`);

        // 验证必需参数
        if (!filePath) {
            return reply.status(400).send({error: 'Missing required parameter: path'});
        }

        try {
            // 获取 WebDAV 配置
            let config;
            if (configParam) {
                try {
                    config = JSON.parse(decodeURIComponent(configParam));
                } catch (e) {
                    return reply.status(400).send({error: 'Invalid config parameter'});
                }
            } else {
                config = loadDefaultConfig();
            }

            if (!config) {
                return reply.status(400).send({error: 'WebDAV config not provided'});
            }

            const client = getWebDAVClient(config);

            // 检查缓存
            const cacheKey = `${config.baseURL}:${filePath}`;
            const cached = fileCache.get(cacheKey);
            const now = Date.now();

            let fileInfo;
            if (cached && (now - cached.timestamp) < cacheTimeout) {
                fileInfo = cached.info;
            } else {
                // 获取文件信息并缓存
                fileInfo = await client.getInfo(filePath);
                fileCache.set(cacheKey, {
                    info: fileInfo,
                    timestamp: now
                });
            }

            if (!fileInfo || fileInfo.isDirectory) {
                return reply.status(404).send({error: 'File not found or is a directory'});
            }

            // 处理 Range 请求
            const range = request.headers.range;
            let streamOptions = {};

            if (range) {
                const parts = range.replace(/bytes=/, "").split("-");
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : fileInfo.size - 1;

                if (start >= fileInfo.size || end >= fileInfo.size) {
                    reply.status(416);
                    reply.header('Content-Range', `bytes */${fileInfo.size}`);
                    return;
                }

                streamOptions.headers = {
                    'Range': `bytes=${start}-${end}`
                };

                reply.status(206);
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
            reply.header('Access-Control-Allow-Origin', '*');

            // 获取文件流
            const {stream} = await client.getFileStream(filePath, streamOptions);

            // 返回流
            return reply.send(stream);

        } catch (error) {
            console.error('[webdavController] File request error:', error);
            return reply.status(500).send({error: error.message});
        }
    });

    /**
     * WebDAV 文件信息获取接口
     * GET /webdav/info - 获取文件或目录信息
     */
    fastify.get('/webdav/info', async (request, reply) => {
        const {path: filePath, config: configParam} = request.query;

        console.log(`[webdavController] Info request: ${filePath}`);

        // 验证必需参数
        if (!filePath) {
            return reply.status(400).send({error: 'Missing required parameter: path'});
        }

        try {
            let config;
            if (configParam) {
                config = JSON.parse(decodeURIComponent(configParam));
            } else {
                config = loadDefaultConfig();
            }

            if (!config) {
                return reply.status(400).send({error: 'WebDAV config not provided'});
            }

            const client = getWebDAVClient(config);
            const fileInfo = await client.getInfo(filePath);

            return reply.send(fileInfo);
        } catch (error) {
            console.error('[webdavController] Info request error:', error);
            return reply.status(500).send({error: error.message});
        }
    });

    /**
     * WebDAV 目录列表接口
     * GET /webdav/list - 获取目录内容列表
     */
    fastify.get('/webdav/list', async (request, reply) => {
        const {path: dirPath = '/', config: configParam} = request.query;

        console.log(`[webdavController] List request: ${dirPath}`);

        try {
            let config;
            if (configParam) {
                config = JSON.parse(decodeURIComponent(configParam));
            } else {
                config = loadDefaultConfig();
            }

            if (!config) {
                return reply.status(400).send({error: 'WebDAV config not provided'});
            }

            const client = getWebDAVClient(config);
            const items = await client.listDirectory(dirPath);

            return reply.send(items);
        } catch (error) {
            console.error('[webdavController] List request error:', error);
            return reply.status(500).send({error: error.message});
        }
    });

    /**
     * WebDAV 配置测试接口
     * POST /webdav/config - 测试和配置 WebDAV 连接
     */
    fastify.post('/webdav/config', async (request, reply) => {
        console.log(`[webdavController] Config test request`);

        try {
            const config = request.body;

            // 验证配置
            if (!config.baseURL || !config.username || !config.password) {
                return reply.status(400).send({
                    error: 'Missing required config fields: baseURL, username, password'
                });
            }

            // 测试连接
            const client = getWebDAVClient(config);
            await client.testConnection();

            return reply.send({
                success: true,
                message: 'WebDAV connection configured and tested successfully',
                config: {
                    baseURL: config.baseURL,
                    username: config.username,
                    // 不返回密码
                }
            });
        } catch (error) {
            console.error('[webdavController] Config test error:', error);
            return reply.status(500).send({error: error.message});
        }
    });

    /**
     * WebDAV 缓存管理接口
     * DELETE /webdav/cache - 清理缓存
     */
    fastify.delete('/webdav/cache', async (request, reply) => {
        console.log(`[webdavController] Cache clear request`);

        try {
            // 非VERCEL环境可在设置中心控制此功能是否开启
            if (!process.env.VERCEL) {
                if (ENV.get('allow_webdav_cache_clear') !== '1') {
                    return reply.status(403).send({error: 'Cache clear is not allowed by owner'});
                }
            }

            const clientCount = webdavClients.size;
            const fileCount = fileCache.size;

            // 清理缓存
            fileCache.clear();
            webdavClients.clear();

            return reply.send({
                success: true,
                message: 'Cache cleared successfully',
                cleared: {
                    clients: clientCount,
                    files: fileCount
                }
            });
        } catch (error) {
            console.error('[webdavController] Cache clear error:', error);
            return reply.status(500).send({error: error.message});
        }
    });

    /**
     * WebDAV 代理状态接口
     * GET /webdav/status - 获取代理服务状态
     */
    fastify.get('/webdav/status', async (request, reply) => {
        console.log(`[webdavController] Status request`);

        try {
            const config = loadDefaultConfig();

            const statusData = createStatusResponse(
                'WebDAV Proxy Controller',
                '1.0.0',
                [
                    'WebDAV file direct link access',
                    'Smart cache management with auto-cleanup',
                    'Multiple WebDAV server support',
                    'File metadata caching',
                    'Range request support for large files'
                ],
                [
                    'GET /webdav/health - Health check',
                    'GET /webdav/file?path=<file_path> - Get file direct link',
                    'GET /webdav/info?path=<file_path> - Get file information',
                    'GET /webdav/list?path=<dir_path> - List directory contents',
                    'POST /webdav/config - Test WebDAV configuration',
                    'DELETE /webdav/cache - Clear cache',
                    'GET /webdav/status - Get service status'
                ],
                webdavClients,
                fileCache,
                {
                    config: config ? {
                        baseURL: config.baseURL,
                        username: config.username,
                        hasPassword: !!config.password
                    } : null
                }
            );

            return reply.send(statusData);
        } catch (error) {
            console.error('[webdavController] Status request error:', error);
            return reply.status(500).send({error: error.message});
        }
    });

    done();
};