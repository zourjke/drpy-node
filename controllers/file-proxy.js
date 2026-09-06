/**import {log, logError} from '../utils/log.js';

 * 远程文件代理控制器模块
 * 提供远程文件的 HTTP 直链代理访问功能
 * @module file-proxy-controller
 */

import {
    createHealthResponse,
    createStatusResponse,
    decodeParam,
    forwardResponseHeaders,
    getDefaultHeaders,
    makeRemoteRequest,
    PROXY_CONSTANTS,
    setCorsHeaders,
    verifyAuth,
    CacheManagerFactory
} from '../utils/proxy-util.js';

/**
 * 远程文件代理控制器插件
 * @param {Object} fastify - Fastify实例
 * @param {Object} options - 插件选项
 * @param {Function} done - 完成回调
 */
export default (fastify, options, done) => {
    // 请求缓存 - 使用智能缓存管理器防止内存泄漏
    const requestCache = CacheManagerFactory.createRequestCache('FileProxy-RequestCache');

    /**
     * 远程文件代理健康检查接口
     * GET /file-proxy/health - 检查远程文件代理服务状态
     */
    fastify.get('/file-proxy/health', async (request, reply) => {
        // log(`[fileProxyController] Health check request`);
        
        setCorsHeaders(reply);
        
        const healthData = createHealthResponse(requestCache);
        
        return reply.send({
            ...healthData,
            service: 'Remote File Proxy',
            features: [
                'Remote file streaming',
                'Range request support',
                'Custom headers forwarding',
                'Smart cache management with auto-cleanup'
            ]
        });
    });

    /**
     * 远程文件代理接口
     * GET/HEAD /file-proxy/proxy - 代理远程文件
     */
    fastify.route({
        method: ['GET', 'HEAD'],
        url: '/file-proxy/proxy',
        handler: async (request, reply) => {
            // 验证身份认证
            if (!verifyAuth(request, reply)) {
                return;
            }

            const { url: urlParam, headers: headersParam } = request.query;

            // log(`[fileProxyController] ${request.method} request for URL: ${urlParam}`);

            // 验证必需参数
            if (!urlParam) {
                return reply.status(400).send({ error: 'Missing required parameter: url' });
            }

            try {
                // 解码 URL 参数
                const targetUrl = decodeParam(urlParam, false);
                
                // 验证 URL 格式
                if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
                    return reply.status(400).send({ error: 'Invalid URL: must start with http:// or https://' });
                }

                // 解码 headers 参数
                const customHeaders = decodeParam(headersParam, true);
                
                // 合并默认请求头和自定义请求头
                const defaultHeaders = getDefaultHeaders(request);
                const requestHeaders = { ...defaultHeaders, ...customHeaders };

                // 处理 Range 请求
                const range = request.headers.range;

                try {
                    // 发起远程请求
                    const remoteResponse = await makeRemoteRequest(
                        targetUrl, 
                        requestHeaders, 
                        request.method, 
                        range
                    );

                    // 检查远程响应状态
                    if (remoteResponse.statusCode >= 400) {
                        return reply.status(remoteResponse.statusCode).send({
                            error: `Remote server error: ${remoteResponse.statusCode}`
                        });
                    }

                    // 设置响应状态码
                    reply.status(remoteResponse.statusCode);

                    // 转发响应头和设置CORS
                    forwardResponseHeaders(reply, remoteResponse.headers);
                    setCorsHeaders(reply);

                    // 对于 HEAD 请求，只返回头部信息
                    if (request.method === 'HEAD') {
                        return reply.send();
                    }

                    // 对于 GET 请求，返回文件流
                    return reply.send(remoteResponse.stream);

                } catch (requestError) {
                    logError('[fileProxyController] Remote request error:', requestError);
                    return reply.status(502).send({ 
                        error: `Failed to fetch remote file: ${requestError.message}` 
                    });
                }

            } catch (error) {
                logError('[fileProxyController] Request processing error:', error);
                return reply.status(500).send({ error: error.message });
            }
        }
    });

    /**
     * 远程文件信息获取接口
     * GET /file-proxy/info - 获取远程文件信息（HEAD 请求）
     */
    fastify.get('/file-proxy/info', async (request, reply) => {
        // 验证身份认证
        if (!verifyAuth(request, reply)) {
            return;
        }

        const { url: urlParam, headers: headersParam } = request.query;

        // log(`[fileProxyController] Info request for URL: ${urlParam}`);

        // 验证必需参数
        if (!urlParam) {
            return reply.status(400).send({ error: 'Missing required parameter: url' });
        }

        try {
            // 解码 URL 参数
            const targetUrl = decodeParam(urlParam, false);
            
            // 验证 URL 格式
            if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
                return reply.status(400).send({ error: 'Invalid URL: must start with http:// or https://' });
            }

            // 解码 headers 参数
            const customHeaders = decodeParam(headersParam, true);
            
            // 合并默认请求头和自定义请求头
            const defaultHeaders = getDefaultHeaders(request);
            const requestHeaders = { ...defaultHeaders, ...customHeaders };

            try {
                // 发起 HEAD 请求获取文件信息
                const remoteResponse = await makeRemoteRequest(targetUrl, requestHeaders, 'HEAD');

                if (remoteResponse.statusCode >= 400) {
                    return reply.status(remoteResponse.statusCode).send({
                        error: `Remote server error: ${remoteResponse.statusCode}`
                    });
                }

                // 提取文件信息
                const fileInfo = {
                    url: targetUrl,
                    statusCode: remoteResponse.statusCode,
                    contentType: remoteResponse.headers['content-type'] || 'application/octet-stream',
                    contentLength: remoteResponse.headers['content-length'] ? parseInt(remoteResponse.headers['content-length']) : null,
                    lastModified: remoteResponse.headers['last-modified'] || null,
                    etag: remoteResponse.headers['etag'] || null,
                    acceptRanges: remoteResponse.headers['accept-ranges'] || null,
                    cacheControl: remoteResponse.headers['cache-control'] || null,
                    expires: remoteResponse.headers['expires'] || null
                };

                return reply.send(fileInfo);

            } catch (requestError) {
                logError('[fileProxyController] Remote info request error:', requestError);
                return reply.status(502).send({ 
                    error: `Failed to get remote file info: ${requestError.message}` 
                });
            }

        } catch (error) {
            logError('[fileProxyController] Info request processing error:', error);
            return reply.status(500).send({ error: error.message });
        }
    });

    /**
     * 清理缓存路由
     */
    fastify.delete('/file-proxy/cache', async (request, reply) => {
        if (!verifyAuth(request, reply)) return;

        setCorsHeaders(reply);

        const beforeSize = requestCache.size;
        requestCache.clear();
        
        reply.send({
            status: 'success',
            message: 'Cache cleared',
            cleared: beforeSize,
            timestamp: new Date().toISOString()
        });
    });

    /**
     * 状态路由
     */
    fastify.get('/file-proxy/status', async (request, reply) => {
        setCorsHeaders(reply);
        
        const statusData = createStatusResponse(
            'Remote File Proxy Controller',
            '1.0.0',
            [
                'Remote file streaming',
                'Range request support',
                'Custom headers forwarding',
                'Authentication protection',
                'Smart cache management with auto-cleanup'
            ],
            [
                'GET /file-proxy/health - Health check (no auth required)',
                'GET /file-proxy/proxy?url=<target_url>&auth=<auth_code>&headers=<custom_headers> - Proxy remote file',
                'HEAD /file-proxy/proxy?url=<target_url>&auth=<auth_code>&headers=<custom_headers> - Get file headers',
                'GET /file-proxy/status - Get service status (no auth required)'
            ],
            requestCache,
            null
        );

        reply.send(statusData);
    });

    done();
};