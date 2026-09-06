import {log, logError, logWarn} from '../utils/log.js';
import http from 'http';
import https from 'https';
import {PassThrough} from 'stream';
import {base64Decode, md5} from '../libs_drpy/crypto-util.js';
import '../utils/random-http-ua.js'
import {keysToLowerCase} from '../utils/utils.js';
import {ENV} from "../utils/env.js";
import chunkStream, {testSupport} from '../utils/chunk.js';
import createAxiosInstance from '../utils/createAxiosAgent.js';

// 全局资源管理器
const globalResourceManager = {
    activeStreams: new Set(),
    activeRequests: new Set(),
    
    addStream: function(stream) {
        this.activeStreams.add(stream);
        stream.on('close', () => this.activeStreams.delete(stream));
        stream.on('end', () => this.activeStreams.delete(stream));
        stream.on('error', () => this.activeStreams.delete(stream));
    },
    
    addRequest: function(requestId) {
        this.activeRequests.add(requestId);
    },
    
    removeRequest: function(requestId) {
        this.activeRequests.delete(requestId);
    },
    
    cleanup: function() {
        // 清理所有活跃的流
        this.activeStreams.forEach(stream => {
            if (stream && !stream.destroyed) {
                stream.destroy();
            }
        });
        this.activeStreams.clear();
        this.activeRequests.clear();
    },
    
    getStats: function() {
        return {
            activeStreams: this.activeStreams.size,
            activeRequests: this.activeRequests.size,
            memoryUsage: process.memoryUsage()
        };
    }
};

// 定期清理和内存监控
setInterval(() => {
    const stats = globalResourceManager.getStats();
    if (stats.activeStreams > 50 || stats.activeRequests > 100) {
        logWarn('[MediaProxy] High resource usage detected:', stats);
    }
    
    // 强制垃圾回收（如果可用）
    if (global.gc && stats.memoryUsage.heapUsed > 500 * 1024 * 1024) { // 500MB
        global.gc();
        log('[MediaProxy] Forced garbage collection due to high memory usage');
    }
}, 30000).unref?.(); // 每30秒检查一次；unref 避免常驻定时器阻塞优雅退出 (L18)

const maxSockets = 32; // 减少最大连接数以防止连接池过大
const _axios = createAxiosInstance({
        maxSockets: maxSockets,
        rejectUnauthorized: true, // 不忽略证书错误
        keepAlive: true,
        keepAliveMsecs: 30000, // 30秒保持连接
        maxFreeSockets: 10, // 最大空闲连接数
        timeout: 30000, // 30秒超时
        freeSocketTimeout: 15000, // 空闲连接超时时间
    },
);

export default (fastify, options, done) => {
    // 用法同 https://github.com/Zhu-zi-a/mediaProxy
    fastify.all('/mediaProxy', {
        schema: {
            tags: ['协议接口'],
            summary: '流媒体代理',
            description: '媒体流代理转发，支持 Range 请求；用法同 https://github.com/Zhu-zi-a/mediaProxy。',
            security: [],
        },
    }, async (request, reply) => {
        const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        globalResourceManager.addRequest(requestId);
        
        // 请求完成时清理
        const cleanup = () => {
            globalResourceManager.removeRequest(requestId);
        };
        
        // 监听请求结束事件
        request.raw.on('close', cleanup);
        request.raw.on('aborted', cleanup);
        reply.raw.on('finish', cleanup);
        reply.raw.on('close', cleanup);

        const {thread = 1, form = 'urlcode', url, header, size = '128K', chunkSize, randUa = 0, stream = 0} = request.query;

        // Check if the URL parameter is missing
        if (!url) {
            cleanup();
            return reply.code(400).send({error: 'Missing required parameter: url'});
        }

        try {
            // Decode URL and headers based on the form type
            const decodedUrl = form === 'base64' ? base64Decode(url) : url;
            let decodedHeader = header
                ? JSON.parse(form === 'base64' ? base64Decode(header) : header)
                : {};

            // stream=1：纯流式 pipe 转发，零中间开销，收到上游数据即吐给客户端
            // 起播最快，适合大文件直接中转（如 123云盘跨地区播放）
            if (parseInt(stream, 10) === 1) {
                return await proxyStreamMedia(decodedUrl, decodedHeader, request, reply, parseInt(randUa, 10));
            }

            // 如果传了 chunkSize 参数，强制走 chunkStream（磁盘加速），支持超线程分块
            // 用于 UC 无限猫等需要 chunkSize=256 多线程分块下载的场景
            if (chunkSize) {
                const cs = parseInt(chunkSize, 10) * 1024;
                const pool = parseInt(thread, 10) || 6;
                // 统一 header 键名为小写，避免大小写冲突导致 OSS 防盗链检查失败
                decodedHeader = keysToLowerCase(decodedHeader);
                // UC OSS 防盗链：Referer 需等于播放 URL 本身，用 __URL__ 占位符表示
                if (decodedHeader['referer'] === '__URL__') {
                    decodedHeader['referer'] = decodedUrl;
                }
                log('[mediaProxy] chunkStream 超线程分块:chunkSize:', cs, 'poolSize:', pool);
                return await chunkStream(request, reply, decodedUrl, md5(decodedUrl), decodedHeader,
                    {chunkSize: cs, poolSize: pool, timeout: 1000 * 10}
                );
            }

            // Call the proxy function, passing the decoded URL and headers
            // return await proxyStreamMediaMulti(decodedUrl, decodedHeader, request, reply, thread, size, randUa);
            // return await chunkStream(request, reply, decodedUrl, ids[1], Object.assign({Cookie: cookie}, baseHeader));
            if (ENV.get('play_proxy_mode', '1') !== '2') { // 2磁盘加速 其他都是内存加速
                log('[mediaProxy] proxyStreamMediaMulti 内存加速:chunkSize:', sizeToBytes(size));
                return await proxyStreamMediaMulti(decodedUrl, decodedHeader, request, reply, thread, size, randUa);
            } else {
                log('[mediaProxy] chunkStream 磁盘加速 chunkSize:', sizeToBytes('256K'));
                return await chunkStream(request, reply, decodedUrl, md5(decodedUrl), decodedHeader,
                    Object.assign({chunkSize: 1024 * 256, poolSize: 5, timeout: 1000 * 10}, {
                        // chunkSize: sizeToBytes(size),
                        poolSize: thread
                    })
                );
            }
        } catch (error) {
            // fastify.log.error(error);
            fastify.log.error(error.message);
            cleanup();
            if (!reply.sent && !reply.raw.destroyed) {
                reply.code(500).send({error: error.message});
            }
        }
    });

    // 红果流式直通代理：零缓存纯流式转发，仅用于内部解密流服务器
    fastify.all('/hgProxy', async (request, reply) => {
        const targetUrl = request.query.url;
        if (!targetUrl) {
            return reply.code(400).send({error: 'Missing url parameter'});
        }

        // hijack 让 Fastify 不再自动管理响应，完全由 reply.raw 控制
        reply.hijack();

        const isHttps = targetUrl.startsWith('https');
        const lib = isHttps ? https : http;
        const reqHeaders = {...request.headers};
        delete reqHeaders['host'];
        delete reqHeaders['connection'];
        delete reqHeaders['content-length'];

        const proxyReq = lib.request(targetUrl, {
            method: request.method,
            headers: reqHeaders,
        }, (proxyRes) => {
            reply.raw.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(reply.raw);
        });

        proxyReq.on('error', (e) => {
            if (!reply.raw.headersSent) {
                reply.raw.writeHead(502, {'Content-Type': 'application/json'});
            }
            if (!reply.raw.writableEnded) {
                reply.raw.end(JSON.stringify({error: e.message}));
            }
        });

        // 客户端断开时销毁上游请求
        reply.raw.on('close', () => {
            if (!proxyReq.destroyed) {
                proxyReq.destroy();
            }
        });

        if (request.method !== 'GET' && request.method !== 'HEAD') {
            request.raw.pipe(proxyReq);
        } else {
            proxyReq.end();
        }
    });

    done();
};

// Helper function for range-based chunk downloading
async function fetchStream(url, userHeaders, start, end, randUa) {
    let stream = null;
    const headers = keysToLowerCase({
        ...userHeaders,
    });
    // UC OSS 防盗链：Referer 需等于播放 URL 本身，用 __URL__ 占位符表示
    if (headers['referer'] === '__URL__') {
        headers['referer'] = url;
    }
    // 添加accept属性防止获取网页源码编码不正确问题
    if (!Object.keys(headers).includes('accept')) {
        headers['accept'] = '*/*';
    }
    try {
        const response = await _axios.get(url, {
            headers: {
                ...headers,
                ...randUa ? {
                    'User-Agent': randomUa.generateUa(1, {
                        // device: ['mobile', 'pc'],
                        device: ['pc'],
                        mobileOs: ['android']
                    })
                } : {},
                Range: `bytes=${start}-${end}`,
            },
            responseType: 'stream',
            timeout: 30000, // 30秒超时
        });

        stream = response.data;
        
        // 添加错误处理监听器
        stream.on('error', (error) => {
            logError(`[fetchStream] Stream error for range ${start}-${end}:`, error.message);
            if (!stream.destroyed) {
                stream.destroy();
            }
        });

        // 添加超时处理
        const timeoutId = setTimeout(() => {
            if (!stream.destroyed) {
                logWarn(`[fetchStream] Stream timeout for range ${start}-${end}`);
                stream.destroy();
            }
        }, 60000); // 60秒超时

        // 清理超时定时器
        stream.on('end', () => clearTimeout(timeoutId));
        stream.on('close', () => clearTimeout(timeoutId));
        stream.on('error', () => clearTimeout(timeoutId));

        return {stream: stream, headers: response.headers};
    } catch (error) {
        logError(`[fetchStream] Error fetching range ${start}-${end}:`, error.message);
        
        // 确保流被正确销毁
        if (stream && !stream.destroyed) {
            stream.destroy();
        }
        
        throw error;
    }
}

// 导出供 /proxy 路由的 toBytes=3 内联流式分支复用（与 /mediaProxy?stream=1 同一实现体）
export async function proxyStreamMedia(mediaUrl, reqHeaders, request, reply, randUa = 0) {
    let responseStream = null;
    const eventListeners = [];
    
    // 添加事件监听器的辅助函数
    const addListener = (target, event, listener) => {
        eventListeners.push({target, event, listener});
        target.on(event, listener);
    };
    
    // 清理所有事件监听器的函数
    const cleanupListeners = () => {
        eventListeners.forEach(({target, event, listener}) => {
            if (target && typeof target.removeListener === 'function') {
                target.removeListener(event, listener);
            }
        });
        eventListeners.length = 0;
    };
    
    try {
        // 随机生成 UA（如果启用 randUa 参数）
        const randHeaders = randUa
            ? Object.assign({}, reqHeaders, {
                'User-Agent': randomUa.generateUa(1, {
                    // device: ['mobile', 'pc'],
                    device: ['pc'],
                    mobileOs: ['android']
                })
            })
            : reqHeaders;

        const headers = keysToLowerCase({
            ...randHeaders,
        });
        // 添加accept属性防止获取网页源码编码不正确问题
        if (!Object.keys(headers).includes('accept')) {
            headers['accept'] = '*/*';
        }
        // 将客户端 Range 头透传给上游，确保上游返回正确的分片数据
        if (request.headers.range) {
            headers['range'] = request.headers.range;
        }

        const response = await _axios.get(mediaUrl, {
            headers: headers,
            responseType: 'stream',
            timeout: 30000, // 30秒超时
        });

        responseStream = response.data;
        
        // 将流添加到全局资源管理器
        globalResourceManager.addStream(responseStream);

        // 设置响应头：直接转发上游响应头（含 Content-Range/Content-Length），
        // Range 已透传给上游，上游返回的 status/headers 即正确结果，无需本地计算
        Object.entries(response.headers).forEach(([key, value]) => {
            if (!['transfer-encoding'].includes(key.toLowerCase())) {
                reply.raw.setHeader(key, value);
            }
        });

        // 直接使用上游返回的 status code（200 或 206）
        reply.raw.writeHead(response.status);

        // 监听客户端断开连接
        const onAbort = () => {
            log('[proxyStreamMedia] Client aborted the connection');
            if (responseStream && !responseStream.destroyed) {
                responseStream.destroy();
            }
            cleanupListeners();
        };

        addListener(request.raw, 'aborted', onAbort);
        addListener(request.raw, 'close', onAbort);
        addListener(reply.raw, 'close', onAbort);

        // 流错误处理
        const onStreamError = (error) => {
            logError('[proxyStreamMedia] Stream error:', error.message);
            cleanupListeners();
            if (!reply.sent && !reply.raw.destroyed) {
                reply.code(500).send({error: error.message});
            }
        };

        addListener(responseStream, 'error', onStreamError);

        // 流结束处理
        const onStreamEnd = () => {
            log('[proxyStreamMedia] Stream ended successfully');
            cleanupListeners();
        };

        addListener(responseStream, 'end', onStreamEnd);
        addListener(responseStream, 'close', onStreamEnd);

        // 检查连接状态
        if (request.raw.aborted || request.raw.destroyed) {
            log('[proxyStreamMedia] Connection already aborted');
            if (responseStream && !responseStream.destroyed) {
                responseStream.destroy();
            }
            return;
        }

        // 流式传输数据：用大缓冲 PassThrough 中转，预读上游数据平滑高码率视频波动
        // 默认 reply.raw 缓冲仅 16KB，4K 高码率下极易因上游瞬时抖动导致卡顿
        const passThrough = new PassThrough({highWaterMark: 8 * 1024 * 1024}); // 8MB 预读缓冲
        // 上游错误透传给客户端
        const onUpstreamError = (err) => {
            logError('[proxyStreamMedia] Upstream pipe error:', err.message);
            passThrough.destroy();
        };
        addListener(responseStream, 'error', onUpstreamError);
        addListener(passThrough, 'error', onUpstreamError);
        responseStream.pipe(passThrough);
        passThrough.pipe(reply.raw);

    } catch (error) {
        logError('[proxyStreamMedia] Error:', error.message);
        
        // 清理资源
        if (responseStream && !responseStream.destroyed) {
            responseStream.destroy();
        }
        cleanupListeners();
        
        if (!reply.sent && !reply.raw.destroyed) {
            reply.code(500).send({error: error.message});
        }
    }
}

async function proxyStreamMediaMulti(mediaUrl, reqHeaders, request, reply, thread, size, randUa = 0) {
    // 资源清理管理器
    const resourceManager = {
        streams: [],
        eventListeners: [],
        cleanup: function() {
            // 清理所有流
            this.streams.forEach(stream => {
                if (stream && !stream.destroyed) {
                    stream.destroy();
                }
            });
            this.streams = [];
            
            // 清理所有事件监听器
            this.eventListeners.forEach(({target, event, listener}) => {
                if (target && typeof target.removeListener === 'function') {
                    target.removeListener(event, listener);
                }
            });
            this.eventListeners = [];
        },
        addStream: function(stream) {
            this.streams.push(stream);
        },
        addEventListener: function(target, event, listener) {
            this.eventListeners.push({target, event, listener});
            target.on(event, listener);
        }
    };

    try {
        let initialHeaders;
        let contentLength;

        // 随机生成 UA（如果启用 randUa 参数）
        const randHeaders = randUa
            ? Object.assign({}, reqHeaders, {
                'User-Agent': randomUa.generateUa(1, {
                    // device: ['mobile', 'pc'],
                    device: ['pc'],
                    mobileOs: ['android']
                })
            })
            : reqHeaders;

        const headers = keysToLowerCase({
            ...randHeaders,
        });
        // UC OSS 防盗链：Referer 需等于播放 URL 本身，用 __URL__ 占位符表示
        if (headers['referer'] === '__URL__') {
            headers['referer'] = mediaUrl;
        }
        // 添加accept属性防止获取网页源码编码不正确问题
        if (!Object.keys(headers).includes('accept')) {
            headers['accept'] = '*/*';
        }
        // 检查请求头中是否包含 Cookie
        const hasCookie = Object.keys(randHeaders).some(key => key.toLowerCase() === 'cookie');
        // log(`[proxyStreamMediaMulti] Checking for Cookie in headers: ${hasCookie}`);

        let testStream = null;
        try {
            if (!hasCookie) {
                // 优先尝试 HEAD 请求
                // log('[proxyStreamMediaMulti] Attempting HEAD request to fetch content-length...');
                const headResponse = await _axios.head(mediaUrl, {headers: headers});
                initialHeaders = headResponse.headers;
                contentLength = parseInt(initialHeaders['content-length'], 10);
                log(`[proxyStreamMediaMulti] HEAD request successful, content-length: ${contentLength}`);
            } else {
                throw new Error('Skipping HEAD request due to Cookie in headers.');
            }
        } catch (headError) {
            logError('[proxyStreamMediaMulti] HEAD request failed or skipped:', headError.message);

            // 使用 HTTP Range 请求获取 content-length
            try {
                // log('[proxyStreamMediaMulti] Attempting Range GET request to fetch content-length...');
                const rangeHeaders = {...headers, Range: 'bytes=0-1'};
                const rangeResponse = await _axios.get(mediaUrl, {
                    headers: rangeHeaders,
                    responseType: 'stream',
                });
                initialHeaders = rangeResponse.headers;
                testStream = rangeResponse.data;

                // 从 Content-Range 提取总大小
                const contentRange = initialHeaders['content-range'];
                if (contentRange) {
                    const match = contentRange.match(/\/(\d+)$/);
                    if (match) {
                        contentLength = parseInt(match[1], 10);
                        log(`[proxyStreamMediaMulti] Range GET request successful, content-length: ${contentLength}`);
                    }
                }

                // 立即销毁流，防止下载文件内容
                if (testStream && !testStream.destroyed) {
                    testStream.destroy();
                }
                testStream = null;
            } catch (rangeError) {
                logError('[proxyStreamMediaMulti] Range GET request failed:', rangeError.message);
                log('[proxyStreamMediaMulti] headers:', headers);
                // 使用 GET 请求获取 content-length
                // log('[proxyStreamMediaMulti] Falling back to full GET request to fetch content-length...');
                const getResponse = await _axios.get(mediaUrl, {
                    headers: headers,
                    responseType: 'stream',
                });
                initialHeaders = getResponse.headers;
                contentLength = parseInt(initialHeaders['content-length'], 10);
                log(`[proxyStreamMediaMulti] Full GET request successful, content-length: ${contentLength}`);
                testStream = getResponse.data;

                // 立即销毁流，防止下载文件内容
                if (testStream && !testStream.destroyed) {
                    testStream.destroy();
                }
                testStream = null;
            }
        }

        // 确保 content-length 有效
        if (!contentLength) {
            throw new Error('Failed to get the total content length.');
        }

        // 设置响应头，排除不必要的头部
        Object.entries(initialHeaders).forEach(([key, value]) => {
            if (!['transfer-encoding', 'content-length'].includes(key.toLowerCase())) {
                reply.raw.setHeader(key, value);
            }
        });

        reply.raw.setHeader('Accept-Ranges', 'bytes');

        // 解析 range 请求头
        const range = request.headers.range || 'bytes=0-';
        const [startStr, endStr] = range.replace(/bytes=/, '').split('-');
        let start = parseInt(startStr, 10);
        let end = endStr ? parseInt(endStr, 10) : contentLength - 1;

        // 校正 range 范围
        if (start < 0) start = 0;
        if (end >= contentLength) end = contentLength - 1;

        if (start >= end) {
            reply.code(416).header('Content-Range', `bytes */${contentLength}`).send();
            log('[proxyStreamMediaMulti] Invalid range, sending 416 response.');
            return;
        }

        // 设置 Content-Range 和 Content-Length 响应头
        reply.raw.setHeader('Content-Range', `bytes ${start}-${end}/${contentLength}`);
        reply.raw.setHeader('Content-Length', end - start + 1);
        reply.raw.writeHead(206); // 206 Partial Content
        // log(`[proxyStreamMediaMulti] Serving range: ${start}-${end}`);

        // 计算每块的大小并划分子范围
        const chunkSize = sizeToBytes(size);
        const totalChunks = Math.ceil((end - start + 1) / chunkSize);
        const threadCount = Math.min(thread, totalChunks);
        const ranges = Array.from({length: threadCount}, (_, i) => {
            const subStart = start + (i * (end - start + 1)) / threadCount;
            const subEnd = Math.min(subStart + (end - start + 1) / threadCount - 1, end);
            return {start: Math.floor(subStart), end: Math.floor(subEnd)};
        });

        // log(`[proxyStreamMediaMulti] Splitting range into ${ranges.length} threads...`);

        // 并发获取数据块
        const fetchChunks = ranges.map(range =>
            fetchStream(mediaUrl, randHeaders, range.start, range.end, randUa)
        );
        
        let streams;
        try {
            streams = await Promise.all(fetchChunks);
        } catch (fetchError) {
            logError('[proxyStreamMediaMulti] Error fetching streams:', fetchError.message);
            throw fetchError;
        }

        // 将所有流添加到资源管理器
        streams.forEach(({stream}) => {
            resourceManager.addStream(stream);
            globalResourceManager.addStream(stream);
        });

        // 设置全局中断处理
        let clientAborted = false;
        const globalAbortHandler = () => {
            if (clientAborted) return;
            clientAborted = true;
            log('[proxyStreamMediaMulti] Client connection aborted, cleaning up resources');
            resourceManager.cleanup();
        };

        // 添加中断监听器到资源管理器（同时监听 request 和 reply，确保断开时能触发）
        resourceManager.addEventListener(request.raw, 'aborted', globalAbortHandler);
        resourceManager.addEventListener(request.raw, 'close', globalAbortHandler);
        resourceManager.addEventListener(reply.raw, 'close', globalAbortHandler);

        // 按顺序发送数据块
        let cnt = 0;
        for (const {stream} of streams) {
            cnt += 1;
            // log(`[proxyStreamMediaMulti] Streaming chunk ${cnt}...`);

            try {
                // 检查连接状态
                if (clientAborted || request.raw.aborted || request.raw.destroyed) {
                    log(`[proxyStreamMediaMulti] Connection aborted before chunk ${cnt}`);
                    break;
                }

                for await (const chunk of stream) {
                    if (clientAborted || request.raw.aborted || request.raw.destroyed) {
                        // log(`[proxyStreamMediaMulti] Chunk ${cnt} aborted.`);
                        break;
                    }

                    // 安全写入数据
                    if (!reply.raw.destroyed && !reply.raw.writableEnded) {
                        reply.raw.write(chunk);
                    } else {
                        log(`[proxyStreamMediaMulti] Response stream closed during chunk ${cnt}`);
                        break;
                    }
                }
            } catch (error) {
                logError(`[proxyStreamMediaMulti] Error during streaming chunk ${cnt}:`, error.message);
                // 不要抛出错误，继续处理下一个chunk
            }

            // 客户端已断开，停止处理后续chunk
            if (clientAborted) break;
        }

        log('[proxyStreamMediaMulti] All chunks streamed successfully.');
        
        // 安全结束响应
        if (!reply.raw.destroyed && !reply.raw.writableEnded) {
            reply.raw.end();
        }

    } catch (error) {
        logError('[proxyStreamMediaMulti] Error:', error.message);
        
        // 确保资源清理
        resourceManager.cleanup();
        
        if (!reply.sent && !reply.raw.destroyed) {
            reply.code(500).send({error: error.message});
        }
    } finally {
        // 最终清理
        resourceManager.cleanup();
    }
}

// Helper function to convert size string (e.g., '128K', '1M') to bytes
function sizeToBytes(size) {
    const sizeMap = {
        K: 1024,
        M: 1024 * 1024,
        G: 1024 * 1024 * 1024
    };
    const unit = size[size.length - 1].toUpperCase();
    const number = parseInt(size, 10);
    return number * (sizeMap[unit] || 1);
}
