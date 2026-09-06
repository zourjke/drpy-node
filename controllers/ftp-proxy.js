/**import {log, logError, logWarn} from '../utils/log.js';

 * FTP 代理控制器模块
 * 提供 FTP 文件的 HTTP 直链访问功能
 * @module ftp-proxy-controller
 */

import {ENV} from '../utils/env.js';
import {FTPClient} from '../utils/ftp.js';
import {CacheManagerFactory, createHealthResponse, createStatusResponse} from '../utils/proxy-util.js';
import {readFileSync} from 'fs';
import path from 'path';
import { PROJECT_ROOT } from '../utils/pathHelper.js';

/**
 * FTP 代理控制器插件
 * @param {Object} fastify - Fastify实例
 * @param {Object} options - 插件选项
 * @param {Function} done - 完成回调
 */
export default (fastify, options, done) => {
    // FTP 客户端缓存 - 使用智能缓存管理器
    const ftpClients = CacheManagerFactory.createClientCache('FTPProxy-ClientCache');
    // 文件信息缓存 - 使用智能缓存管理器
    const fileCache = CacheManagerFactory.createFileCache('FTPProxy-FileCache');
    // 缓存超时时间（5分钟）
    const cacheTimeout = 5 * 60 * 1000;

    /**
     * 创建新的 FTP 客户端（每个请求独立连接）
     */
    function getFTPClient(config) {
        // 为每个请求创建新的客户端实例，避免并发冲突
        return new FTPClient(config);
    }

    /**
     * 客户端一次性释放器 (L8)：无论 finish/close/error 哪条路径先发生，
     * 都保证每个请求对应的 FTP 连接被显式关闭，不再依赖服务端踢出或 GC。
     */
    function createClientReleaser(clientPromise) {
        let released = false;
        return async () => {
            if (released) return;
            released = true;
            try {
                const client = await clientPromise;
                await client.disconnect();
            } catch {
                // 连接已经异常/客户端不支持时忽略
            }
        };
    }

    /**
     * 加载默认配置
     */
    function loadDefaultConfig() {
        try {
            const configPath = path.join(PROJECT_ROOT, 'json', 'ftp.json');
            const configData = readFileSync(configPath, 'utf8');
            const parsed = JSON.parse(configData);

            // 如果是数组，取第一个配置
            if (Array.isArray(parsed)) {
                return parsed.length > 0 ? parsed[0] : null;
            }

            return parsed;
        } catch (error) {
            logWarn('Could not load default FTP config:', error.message);
            return null;
        }
    }

    /**
     * 处理匿名 FTP 配置
     */
    function processConfig(config) {
        if (!config) return null;

        const processedConfig = { ...config };

        // 处理匿名 FTP 访问
        if (!processedConfig.username || processedConfig.username === 'your-username') {
            processedConfig.username = 'anonymous';
        }
        if (!processedConfig.password || processedConfig.password === 'your-password') {
            processedConfig.password = 'anonymous@example.com';
        }

        return processedConfig;
    }

    /**
     * FTP 健康检查接口
     * GET /ftp/health - 检查 FTP 代理服务状态
     */
    fastify.get('/ftp/health', async (request, reply) => {
        log(`[ftpController] Health check request`);

        const healthData = createHealthResponse(ftpClients, fileCache, {
            features: [
                'FTP file direct link access',
                'Smart cache management with auto-cleanup',
                'Multiple FTP server support',
                'File metadata caching',
                'Range request support for large files'
            ]
        });

        return reply.send(healthData);
    });

    /**
     * FTP 文件直链访问接口/**
     * GET/HEAD /ftp/file - 获取文件直链
     */
    fastify.route({
        method: ['GET', 'HEAD'],
        url: '/ftp/file',
        handler: async (request, reply) => {
        const {path: filePath, config: configParam} = request.query;

        log(`[ftpController] File request: ${filePath}`);

        // 验证必需参数
        if (!filePath) {
            return reply.status(400).send({error: 'Missing required parameter: path'});
        }

        try {
            // 获取 FTP 配置
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

            config = processConfig(config);
            if (!config) {
                return reply.status(400).send({error: 'FTP config not provided'});
            }

            const clientPromise = Promise.resolve().then(() => getFTPClient(config));
            const releaseClient = createClientReleaser(clientPromise);
            const client = await clientPromise;

            // 处理 Range 请求
            const range = request.headers.range;
            let streamOptions = {};

            if (range) {
                streamOptions.headers = {
                    'Range': range
                };
            }

            try {
                // 获取文件流和信息
                const streamResult = await client.getFileStream(filePath, streamOptions);
                const {stream, headers, isRangeRequest, fileInfo} = streamResult;

                if (!fileInfo || fileInfo.isDirectory) {
                    await releaseClient();
                    return reply.status(404).send({error: 'File not found or is a directory'});
                }

                // 对于 HEAD 请求，只返回头部信息，不返回文件内容
                if (request.method === 'HEAD') {
                    // 设置基本响应头
                    reply.header('Content-Type', fileInfo.contentType || 'application/octet-stream');
                    reply.header('Accept-Ranges', 'bytes');
                    reply.header('Cache-Control', 'public, max-age=3600');
                    reply.header('Access-Control-Allow-Origin', '*');

                    if (fileInfo.lastModified) {
                        reply.header('Last-Modified', new Date(fileInfo.lastModified).toUTCString());
                    }

                    if (range) {
                        // P2：Range 拆解收敛至 utils/proxy-common.js parseRangeHeader
                        const {start, end} = parseRangeHeader(range, fileInfo.size);

                        if (start >= fileInfo.size || end >= fileInfo.size) {
                            reply.status(416);
                            reply.header('Content-Range', `bytes */${fileInfo.size}`);
                            return;
                        }

                        reply.status(206);
                        reply.header('Content-Range', `bytes ${start}-${end}/${fileInfo.size}`);
                        reply.header('Content-Length', end - start + 1);
                    } else {
                        reply.header('Content-Length', fileInfo.size);
                    }

                    await releaseClient();
                    return reply.send();
                }

                // 设置状态码
                if (isRangeRequest) {
                    reply.status(206);
                }

                // 设置响应头
                Object.keys(headers).forEach(key => {
                    reply.header(key, headers[key]);
                });
                reply.header('Access-Control-Allow-Origin', '*');

                // 流式转发期间挂接连接释放钩子：正常结束(finish)/客户端中断(close)
                // 任一路径都关闭 FTP 连接，原先成功路径从不 disconnect 导致连接堆积 (L8)
                reply.raw.on('finish', releaseClient);
                reply.raw.on('close', releaseClient);

                // 返回流
                return reply.send(stream);
            } catch (streamError) {
                await releaseClient();
                throw streamError;
            }

        } catch (error) {
            logError('[ftpController] File request error:', error);
            return reply.status(500).send({error: error.message});
        }
    }});

    /**
     * FTP 文件信息获取接口
     * GET /ftp/info - 获取文件或目录信息
     */
    fastify.get('/ftp/info', async (request, reply) => {
        const {path: filePath, config: configParam} = request.query;

        log(`[ftpController] Info request: ${filePath}`);

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

            config = processConfig(config);
            if (!config) {
                return reply.status(400).send({error: 'FTP config not provided'});
            }

            const client = getFTPClient(config);
            const releaseClient = createClientReleaser(Promise.resolve(client));
            try {
                const fileInfo = await client.getInfo(filePath);

                return reply.send(fileInfo);
            } finally {
                await releaseClient();
            }
        } catch (error) {
            logError('[ftpController] Info request error:', error);
            return reply.status(500).send({error: error.message});
        }
    });

    /**
     * FTP 目录列表接口
     * GET /ftp/list - 获取目录内容列表
     */
    fastify.get('/ftp/list', async (request, reply) => {
        const {path: dirPath = '/', config: configParam} = request.query;

        log(`[ftpController] List request: ${dirPath}`);

        try {
            let config;
            if (configParam) {
                config = JSON.parse(decodeURIComponent(configParam));
            } else {
                config = loadDefaultConfig();
            }

            config = processConfig(config);
            if (!config) {
                return reply.status(400).send({error: 'FTP config not provided'});
            }

            const client = getFTPClient(config);
            const releaseClient = createClientReleaser(Promise.resolve(client));
            try {
                const items = await client.listDirectory(dirPath);

                return reply.send(items);
            } finally {
                await releaseClient();
            }
        } catch (error) {
            logError('[ftpController] List request error:', error);
            return reply.status(500).send({error: error.message});
        }
    });

    /**
     * FTP 配置测试接口
     * POST /ftp/config - 测试和配置 FTP 连接
     */
    fastify.post('/ftp/config', async (request, reply) => {
        log(`[ftpController] Config test request`);

        try {
            let config = request.body;

            // 验证配置
            if (!config.host) {
                return reply.status(400).send({
                    error: 'Missing required config field: host'
                });
            }

            config = processConfig(config);

            // 测试连接（测完立即释放连接，原先测完从不断开）
            const client = getFTPClient(config);
            const releaseClient = createClientReleaser(Promise.resolve(client));
            try {
                await client.testConnection();
            } finally {
                await releaseClient();
            }

            return reply.send({
                success: true,
                message: 'FTP connection configured and tested successfully',
                config: {
                    host: config.host,
                    port: config.port || 21,
                    username: config.username,
                    secure: config.secure || false,
                    // 不返回密码
                }
            });
        } catch (error) {
            logError('[ftpController] Config test error:', error);
            return reply.status(500).send({error: error.message});
        }
    });

    /**
     * FTP 缓存管理接口
     * DELETE /ftp/cache - 清理缓存
     */
    fastify.delete('/ftp/cache', async (request, reply) => {
        log(`[ftpController] Cache clear request`);

        try {
            // 非VERCEL环境可在设置中心控制此功能是否开启
            if (!process.env.VERCEL) {
                if (ENV.get('allow_ftp_cache_clear') !== '1') {
                    return reply.status(403).send({error: 'Cache clear is not allowed by owner'});
                }
            }

            const clientCount = ftpClients.size;
            const fileCount = fileCache.size;

            // 断开所有 FTP 连接
            for (const client of ftpClients.values()) {
                try {
                    await client.disconnect();
                } catch (e) {
                    // 忽略断开连接时的错误
                }
            }

            // 清理缓存
            fileCache.clear();
            ftpClients.clear();

            return reply.send({
                success: true,
                message: 'Cache cleared successfully',
                cleared: {
                    clients: clientCount,
                    files: fileCount
                }
            });
        } catch (error) {
            logError('[ftpController] Cache clear error:', error);
            return reply.status(500).send({error: error.message});
        }
    });

    /**
     * FTP 代理状态接口
     * GET /ftp/status - 获取代理服务状态
     */
    fastify.get('/ftp/status', async (request, reply) => {
        log(`[ftpController] Status request`);

        try {
            const config = loadDefaultConfig();
            const processedConfig = processConfig(config);

            const statusData = createStatusResponse(
                'FTP Proxy Controller',
                '1.0.0',
                [
                    'FTP file direct link access',
                    'Smart cache management with auto-cleanup',
                    'Multiple FTP server support',
                    'File metadata caching',
                    'Range request support for large files'
                ],
                [
                    'GET /ftp/health - Health check',
                    'GET /ftp/file?path=<file_path> - Get file direct link',
                    'GET /ftp/info?path=<file_path> - Get file information',
                    'GET /ftp/list?path=<dir_path> - List directory contents',
                    'POST /ftp/config - Test FTP configuration',
                    'DELETE /ftp/cache - Clear cache',
                    'GET /ftp/status - Get service status'
                ],
                ftpClients,
                fileCache,
                {
                    config: processedConfig ? {
                        host: processedConfig.host,
                        port: processedConfig.port || 21,
                        username: processedConfig.username,
                        hasPassword: !!processedConfig.password,
                        secure: processedConfig.secure || false
                    } : null
                }
            );

            return reply.send(statusData);
        } catch (error) {
            logError('[ftpController] Status request error:', error);
            return reply.status(500).send({error: error.message});
        }
    });

    done();
};