/**import {log, logError, logWarn} from '../utils/log.js';

 * M3U8 代理控制器模块
 * 提供 M3U8 播放列表的代理访问功能，支持内容处理和链接重写
 * @module m3u8-proxy-controller
 */

import {
    CacheManagerFactory,
    createHealthResponse,
    createStatusResponse,
    decodeParam,
    forwardResponseHeaders,
    getDefaultHeaders,
    getProxyBaseUrl,
    getRemoteContent,
    makeRemoteRequest,
    PROXY_CONSTANTS,
    setCorsHeaders,
    verifyAuth
} from '../utils/proxy-util.js';
import {rewriteM3u8, parseRangeHeader} from '../utils/proxy-common.js';

/**
 * M3U8 代理控制器插件
 * @param {Object} fastify - Fastify实例
 * @param {Object} options - 插件选项
 * @param {Function} done - 完成回调
 */
export default (fastify, options, done) => {
    // 请求缓存 - 使用智能缓存管理器
    const requestCache = CacheManagerFactory.createRequestCache('M3U8Proxy-RequestCache');
    // M3U8 索引缓存 - 使用专门的 M3U8 缓存管理器
    const m3u8Cache = CacheManagerFactory.createM3U8Cache('M3U8Proxy-M3U8Cache');
    // M3U8 缓存超时时间（30秒，因为直播流更新频繁）
    const m3u8CacheTimeout = 30 * 1000;



    /**
     * 解析 M3U8 文件内容，转换相对链接为代理链接
     * @param {string} content - M3U8 文件内容
     * @param {string} baseUrl - 基础 URL
     * @param {string} proxyBaseUrl - 代理基础 URL
     * @param {string} authCode - 身份验证码
     * @returns {string} 处理后的 M3U8 内容
     */
    function processM3u8Content(content, baseUrl, proxyBaseUrl, authCode) {
        // P2：公共实现见 utils/proxy-common.js rewriteM3u8
        return rewriteM3u8(content, {
            baseUrl,
            endpoint: `${proxyBaseUrl}/m3u8-proxy/ts`,
            authCode,
        });
    }



    /**
     * M3U8 代理健康检查接口
     * GET /m3u8-proxy/health - 检查 M3U8 代理服务状态
     */
    fastify.get('/m3u8-proxy/health', async (request, reply) => {
        setCorsHeaders(reply);
        
        const healthData = createHealthResponse(requestCache, m3u8Cache, {
            features: [
                'M3U8 playlist proxying with link rewriting',
                'TS segment proxying with authentication',
                'Smart cache management with auto-cleanup',
                'CORS support for cross-origin requests',
                'Authentication support for protected streams'
            ]
        });
        
        reply.send(healthData);
    });

    /**
     * M3U8 索引文件代理接口
     * GET /m3u8-proxy/playlist - 代理 M3U8 索引文件
     */
    fastify.get('/m3u8-proxy/playlist', async (request, reply) => {
        // 验证身份认证
        if (!verifyAuth(request, reply)) {
            return;
        }

        const { url: urlParam, headers: headersParam } = request.query;

        // log(`[m3u8ProxyController] M3U8 playlist request for URL: ${urlParam}`);

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

            // 检查缓存
            const cacheKey = `m3u8:${targetUrl}`;
            const cached = m3u8Cache.get(cacheKey);
            if (cached && (Date.now() - cached.timestamp) < m3u8CacheTimeout) {
                // log(`[m3u8ProxyController] Serving M3U8 from cache: ${targetUrl}`);
                reply.header('Content-Type', 'application/vnd.apple.mpegurl');
                reply.header('Access-Control-Allow-Origin', '*');
                reply.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
                reply.header('Cache-Control', 'no-cache');
                return reply.send(cached.content);
            }

            // 解码 headers 参数
            const customHeaders = decodeParam(headersParam, true);

            // 合并默认请求头和自定义请求头
            const defaultHeaders = getDefaultHeaders(request);
            const requestHeaders = { ...defaultHeaders, ...customHeaders };

            try {
                // 获取 M3U8 文件内容
                const m3u8Content = await getRemoteContent(targetUrl, requestHeaders);

                // 获取代理基础 URL
                const proxyBaseUrl = getProxyBaseUrl(request);

                // 处理 M3U8 内容，转换链接
                const processedContent = processM3u8Content(
                    m3u8Content,
                    targetUrl,
                    proxyBaseUrl,
                    request.query.auth
                );

                // 缓存处理后的内容
                m3u8Cache.set(cacheKey, {
                    content: processedContent,
                    timestamp: Date.now()
                });

                // 设置响应头
                reply.header('Content-Type', 'application/vnd.apple.mpegurl');
                reply.header('Access-Control-Allow-Origin', '*');
                reply.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
                reply.header('Cache-Control', 'no-cache');

                return reply.send(processedContent);

            } catch (requestError) {
                logError('[m3u8ProxyController] M3U8 request error:', requestError);
                return reply.status(502).send({
                    error: `Failed to fetch M3U8 playlist: ${requestError.message}`
                });
            }

        } catch (error) {
            logError('[m3u8ProxyController] M3U8 request processing error:', error);
            return reply.status(500).send({ error: error.message });
        }
    });

    /**
     * TS 文件代理接口
     * GET /m3u8-proxy/ts - 代理 TS 片段文件
     */
    fastify.route({
        method: ['GET', 'HEAD'],
        url: '/m3u8-proxy/ts',
        handler: async (request, reply) => {
            // 验证身份认证
            if (!verifyAuth(request, reply)) {
                return;
            }

            const { url: urlParam, headers: headersParam } = request.query;

            // log(`[m3u8ProxyController] ${request.method} TS request for URL: ${urlParam}`);

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

                    // 转发响应头和设置CORS头
                    forwardResponseHeaders(reply, remoteResponse.headers);
                    setCorsHeaders(reply);

                    // 对于 HEAD 请求，只返回头部信息
                    if (request.method === 'HEAD') {
                        return reply.send();
                    }

                    // 对于 GET 请求，返回文件流
                    return reply.send(remoteResponse.stream);

                } catch (requestError) {
                    logError('[m3u8ProxyController] TS request error:', requestError);
                    return reply.status(502).send({
                        error: `Failed to fetch TS file: ${requestError.message}`
                    });
                }

            } catch (error) {
                logError('[m3u8ProxyController] TS request processing error:', error);
                return reply.status(500).send({ error: error.message });
            }
        }
    });

    /**
     * 缓存管理接口
     * DELETE /m3u8-proxy/cache - 清理缓存
     */
    fastify.delete('/m3u8-proxy/cache', async (request, reply) => {
        // 验证身份认证
        if (!verifyAuth(request, reply)) {
            return;
        }

        // log(`[m3u8ProxyController] Cache clear request`);

        try {
            setCorsHeaders(reply);

            // 非VERCEL环境可在设置中心控制此功能是否开启
            if (!process.env.VERCEL) {
                if (!Number(process.env.allow_file_cache_clear)) {
                    return reply.status(403).send({ error: 'Cache clear is not allowed by owner' });
                }
            }

            const requestCacheCount = requestCache.size;
            const m3u8CacheCount = m3u8Cache.size;

            // 清理缓存
            requestCache.clear();
            m3u8Cache.clear();

            return reply.send({
                success: true,
                message: 'Cache cleared successfully',
                cleared: {
                    requests: requestCacheCount,
                    m3u8: m3u8CacheCount
                }
            });
        } catch (error) {
            logError('[m3u8ProxyController] Cache clear error:', error);
            return reply.status(500).send({ error: error.message });
        }
    });

    /**
     * M3U8 代理状态接口
     * GET /m3u8-proxy/status - 获取代理服务状态
     */
    fastify.get('/m3u8-proxy/status', async (request, reply) => {
        // log(`[m3u8ProxyController] Status request`);

        try {
            setCorsHeaders(reply);

            const statusData = createStatusResponse(
                'M3U8 Stream Proxy Controller',
                '1.0.0',
                [
                    'M3U8 playlist proxying with link rewriting',
                    'TS segment proxying with authentication',
                    'Smart cache management with auto-cleanup',
                    'CORS support for cross-origin requests',
                    'Authentication support for protected streams'
                ],
                [
                    'GET /m3u8-proxy/health - Health check (no auth required)',
                    'GET /m3u8-proxy/proxy?url=<file_url>&auth=<auth_code>&headers=<custom_headers> - Unified proxy for M3U8 and TS files',
                    'HEAD /m3u8-proxy/proxy?url=<file_url>&auth=<auth_code>&headers=<custom_headers> - Get file headers via unified proxy',
                    'GET /m3u8-proxy/playlist?url=<m3u8_url>&auth=<auth_code>&headers=<custom_headers> - Proxy M3U8 playlist',
                    'GET /m3u8-proxy/ts?url=<ts_url>&auth=<auth_code>&headers=<custom_headers> - Proxy TS segment',
                    'HEAD /m3u8-proxy/ts?url=<ts_url>&auth=<auth_code>&headers=<custom_headers> - Get TS segment headers',
                    'DELETE /m3u8-proxy/cache?auth=<auth_code> - Clear cache',
                    'GET /m3u8-proxy/status - Get service status (no auth required)'
                ],
                requestCache,
                m3u8Cache
            );

            return reply.send(statusData);
        } catch (error) {
            logError('[m3u8ProxyController] Status request error:', error);
            return reply.status(500).send({ error: error.message });
        }
    });

    /**
     * 智能文件类型检测
     * @param {string} url - 文件 URL
     * @param {string} contentType - 响应的 Content-Type
     * @param {string} content - 文件内容（可选）
     * @returns {string} 文件类型：'m3u8' 或 'ts' 或 'unknown'
     */
    function detectFileType(url, contentType = '', content = '') {
        // 1. 基于 URL 扩展名检测
        const urlLower = url.toLowerCase();
        if (urlLower.includes('.m3u8')) {
            return 'm3u8';
        }
        if (urlLower.includes('.ts')) {
            return 'ts';
        }

        // 2. 基于 Content-Type 检测
        const contentTypeLower = contentType.toLowerCase();
        if (contentTypeLower.includes('application/vnd.apple.mpegurl') ||
            contentTypeLower.includes('application/x-mpegurl')) {
            return 'm3u8';
        }
        if (contentTypeLower.includes('video/mp2t') ||
            contentTypeLower.includes('application/octet-stream')) {
            return 'ts';
        }

        // 3. 基于内容特征检测（仅对文本内容）
        if (content && typeof content === 'string') {
            const contentTrimmed = content.trim();
            if (contentTrimmed.startsWith('#EXTM3U') ||
                contentTrimmed.includes('#EXT-X-VERSION') ||
                contentTrimmed.includes('#EXTINF')) {
                return 'm3u8';
            }
        }

        return 'unknown';
    }

    /**
     * 统一代理接口
     * GET/HEAD /m3u8-proxy/proxy - 智能代理 M3U8 和 TS 文件
     *
     * 参数：
     * - url: 目标文件 URL（支持 base64 编码）
     * - auth: 认证码
     * - headers: 自定义请求头（JSON 格式，支持 base64 编码）
     *
     * 功能：
     * 1. 自动检测文件类型（M3U8 或 TS）
     * 2. 对 M3U8 文件进行相对路径转换
     * 3. 对 TS 文件进行直接代理
     * 4. 支持嵌套 M3U8 文件处理
     */
    fastify.route({
        method: ['GET', 'HEAD'],
        url: '/m3u8-proxy/proxy',
        handler: async (request, reply) => {
            // 验证身份认证
            if (!verifyAuth(request, reply)) {
                return;
            }

            const { url: urlParam, headers: headersParam } = request.query;

            // log(`[m3u8ProxyController] ${request.method} unified proxy request for URL: ${urlParam}`);

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

                // 首先进行 HEAD 请求来检测文件类型
                let fileType = 'unknown';
                let remoteResponse;
                let headRequestFailed = false;

                try {
                    // 发起 HEAD 请求获取文件信息
                    const headResponse = await makeRemoteRequest(targetUrl, requestHeaders, 'HEAD');

                    if (headResponse.statusCode >= 400) {
                        logWarn(`[m3u8ProxyController] HEAD request failed with ${headResponse.statusCode}, falling back to GET`);
                        headRequestFailed = true;
                        // HEAD 请求失败，继续使用 GET 请求，不直接返回错误
                    } else {
                        // 检测文件类型
                        const contentType = headResponse.headers['content-type'] || '';
                        fileType = detectFileType(targetUrl, contentType);

                        // log(`[m3u8ProxyController] Detected file type: ${fileType} for URL: ${targetUrl}`);

                        // 如果是 HEAD 请求且检测到是 TS 文件，直接返回头信息
                        if (request.method === 'HEAD' && fileType === 'ts') {
                            // 设置响应头
                            Object.entries(headResponse.headers).forEach(([key, value]) => {
                                if (!['connection', 'transfer-encoding'].includes(key.toLowerCase())) {
                                    reply.header(key, value);
                                }
                            });
                            reply.header('Access-Control-Allow-Origin', '*');
                            reply.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');

                            return reply.status(headResponse.statusCode).send();
                        }
                    }

                } catch (headError) {
                    logWarn(`[m3u8ProxyController] HEAD request failed, falling back to GET: ${headError.message}`);
                    headRequestFailed = true;
                    // HEAD 请求失败，继续使用 GET 请求
                }

                // 如果无法通过 HEAD 确定类型，或者需要获取内容，或者 HEAD 请求失败，发起 GET 请求
                if (fileType === 'unknown' || fileType === 'm3u8' || request.method === 'GET' || headRequestFailed) {
                    const range = request.headers.range;

                    try {
                        // 如果是 HEAD 请求失败的回退，使用 GET 方法
                        const requestMethod = (request.method === 'HEAD' && headRequestFailed) ? 'GET' : request.method;

                        remoteResponse = await makeRemoteRequest(
                            targetUrl,
                            requestHeaders,
                            requestMethod,
                            range
                        );

                        if (remoteResponse.statusCode >= 400) {
                            logError(`[m3u8ProxyController] Remote server error: ${remoteResponse.statusCode} for URL: ${targetUrl}`);
                            logError(`[m3u8ProxyController] Remote response headers:`, remoteResponse.headers);

                            // 尝试读取错误响应内容
                            let errorContent = '';
                            try {
                                const chunks = [];
                                remoteResponse.stream.on('data', chunk => chunks.push(chunk));
                                await new Promise((resolve, reject) => {
                                    remoteResponse.stream.on('end', resolve);
                                    remoteResponse.stream.on('error', reject);
                                });
                                errorContent = Buffer.concat(chunks).toString('utf8').substring(0, 500);
                                logError(`[m3u8ProxyController] Remote error content:`, errorContent);
                            } catch (e) {
                                logError(`[m3u8ProxyController] Failed to read error content:`, e.message);
                            }

                            return reply.status(remoteResponse.statusCode).send({
                                error: `Remote server error: ${remoteResponse.statusCode}`,
                                url: targetUrl,
                                details: errorContent || 'No additional details available'
                            });
                        }

                        // 如果之前未能确定文件类型，现在基于响应头再次检测
                        if (fileType === 'unknown') {
                            const contentType = remoteResponse.headers['content-type'] || '';
                            fileType = detectFileType(targetUrl, contentType);
                        }

                    } catch (requestError) {
                        logError('[m3u8ProxyController] Remote request error:', requestError);
                        return reply.status(502).send({
                            error: `Failed to fetch remote file: ${requestError.message}`
                        });
                    }
                }

                // 根据文件类型进行不同处理
                if (fileType === 'm3u8') {
                    // M3U8 文件处理
                    // log(`[m3u8ProxyController] Processing as M3U8 file: ${targetUrl}`);

                    // 检查 M3U8 缓存
                    const cacheKey = `m3u8:${targetUrl}`;
                    const cached = m3u8Cache.get(cacheKey);
                    if (cached && (Date.now() - cached.timestamp) < m3u8CacheTimeout) {
                        // log(`[m3u8ProxyController] Serving M3U8 from cache: ${targetUrl}`);
                        reply.header('Content-Type', 'application/vnd.apple.mpegurl');
                        reply.header('Access-Control-Allow-Origin', '*');
                        reply.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
                        reply.header('Cache-Control', 'no-cache');

                        // 对于 HEAD 请求，只返回头信息，不返回内容
                        if (request.method === 'HEAD') {
                            return reply.status(200).send();
                        } else {
                            return reply.send(cached.content);
                        }
                    }

                    // 获取 M3U8 文件内容 - 使用 Promise 处理异步流
                    const m3u8Content = await new Promise((resolve, reject) => {
                        const chunks = [];

                        remoteResponse.stream.on('data', (chunk) => {
                            chunks.push(chunk);
                        });

                        remoteResponse.stream.on('end', () => {
                            const content = Buffer.concat(chunks).toString('utf8');
                            resolve(content);
                        });

                        remoteResponse.stream.on('error', (error) => {
                            reject(error);
                        });
                    });

                    // 基于内容再次确认文件类型
                    const confirmedType = detectFileType(targetUrl, remoteResponse.headers['content-type'] || '', m3u8Content);

                    if (confirmedType === 'm3u8') {
                        // 获取代理基础 URL
                        const proxyBaseUrl = getProxyBaseUrl(request);

                        // 处理 M3U8 内容，转换链接为统一代理接口
                        const processedContent = processM3u8ContentUnified(
                            m3u8Content,
                            targetUrl,
                            proxyBaseUrl,
                            request.query.auth,
                            request.query.headers
                        );

                        // 缓存处理后的内容
                        m3u8Cache.set(cacheKey, {
                            content: processedContent,
                            timestamp: Date.now()
                        });

                        // 设置响应头
                        reply.header('Content-Type', 'application/vnd.apple.mpegurl');
                        reply.header('Access-Control-Allow-Origin', '*');
                        reply.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
                        reply.header('Cache-Control', 'no-cache');

                        // 对于 HEAD 请求，只返回头信息，不返回内容
                        if (request.method === 'HEAD') {
                            return reply.status(200).send();
                        } else {
                            return reply.send(processedContent);
                        }
                    } else {
                        // 如果确认不是 M3U8 文件，按二进制文件处理
                        // log(`[m3u8ProxyController] File confirmed as non-M3U8, treating as binary: ${targetUrl}`);

                        // 设置响应头
                        Object.entries(remoteResponse.headers).forEach(([key, value]) => {
                            if (!['connection', 'transfer-encoding'].includes(key.toLowerCase())) {
                                reply.header(key, value);
                            }
                        });
                        reply.header('Access-Control-Allow-Origin', '*');
                        reply.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');

                        // 对于 HEAD 请求，只返回头信息，不返回内容
                        if (request.method === 'HEAD') {
                            return reply.status(remoteResponse.statusCode).send();
                        } else {
                            return reply.status(remoteResponse.statusCode).send(m3u8Content);
                        }
                    }

                } else {
                    // TS 文件或其他二进制文件处理
                    // log(`[m3u8ProxyController] Processing as ${fileType} file: ${targetUrl}`);

                    // 设置响应头
                    Object.entries(remoteResponse.headers).forEach(([key, value]) => {
                        if (!['connection', 'transfer-encoding'].includes(key.toLowerCase())) {
                            reply.header(key, value);
                        }
                    });
                    reply.header('Access-Control-Allow-Origin', '*');
                    reply.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');

                    // 对于 HEAD 请求，只返回头信息，不返回内容
                    if (request.method === 'HEAD') {
                        reply.status(remoteResponse.statusCode);
                        return reply.send();
                    } else {
                        // 直接流式传输
                        reply.status(remoteResponse.statusCode);
                        return reply.send(remoteResponse.stream);
                    }
                }

            } catch (error) {
                logError('[m3u8ProxyController] Unified proxy error:', error);
                return reply.status(500).send({ error: error.message });
            }
        }
    });

    /**
     * 处理 M3U8 内容，转换链接为统一代理接口
     * @param {string} content - M3U8 文件内容
     * @param {string} baseUrl - 基础 URL
     * @param {string} proxyBaseUrl - 代理基础 URL
     * @param {string} authCode - 认证码
     * @param {string} headersParam - 自定义请求头参数
     * @returns {string} 处理后的 M3U8 内容
     */
    function processM3u8ContentUnified(content, baseUrl, proxyBaseUrl, authCode, headersParam = null) {
        // P2：公共实现见 utils/proxy-common.js rewriteM3u8
        return rewriteM3u8(content, {
            baseUrl,
            endpoint: `${proxyBaseUrl}/m3u8-proxy/proxy`,
            authCode,
            headersParam,
        });
    }

    done();
};