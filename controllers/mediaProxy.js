import {logError, logWarn} from '../utils/log.js';
import http from 'http';
import https from 'https';
import {pipeline} from 'stream/promises';
import {base64Decode, md5} from '../libs_drpy/crypto-util.js';
import '../utils/random-http-ua.js';
import {keysToLowerCase} from '../utils/utils.js';
import {ENV} from "../utils/env.js";
import chunkStream from '../utils/chunk.js';
import createAxiosInstance from '../utils/createAxiosAgent.js';

// ─── 全局连接池与缓存 ───

const _axios = createAxiosInstance({
    maxSockets: 64,
    rejectUnauthorized: true,
    keepAlive: true,
    keepAliveMsecs: 30000,
    maxFreeSockets: 16,
    timeout: 30000,
    freeSocketTimeout: 15000,
});

// content-length 缓存：播放器对同一 URL 发多次 Range 请求，命中则跳过 HEAD/Range 探测
const contentLengthCache = new Map();
const CL_CACHE_TTL = 300000; // 5 分钟

// 定期清理过期缓存条目，防止 Map 无限增长
setInterval(() => {
    const now = Date.now();
    for (const [k, v] of contentLengthCache) {
        if (now - v.timestamp > CL_CACHE_TTL) contentLengthCache.delete(k);
    }
}, CL_CACHE_TTL).unref?.();

// /hgProxy 专用 keep-alive Agent（复用 TCP 连接）
const hgAgentHttp = new http.Agent({keepAlive: true, keepAliveMsecs: 1000, maxSockets: 16});
const hgAgentHttps = new https.Agent({keepAlive: true, keepAliveMsecs: 1000, maxSockets: 16});

// 活跃流计数（仅用于监控告警）
let activeStreamCount = 0;
setInterval(() => {
    if (activeStreamCount > 100) logWarn(`[MediaProxy] 活跃流数偏高: ${activeStreamCount}`);
    if (global.gc && process.memoryUsage().heapUsed > 500 * 1024 * 1024) global.gc();
}, 30000).unref?.();

// ─── 辅助函数 ───

function sizeToBytes(size) {
    if (!size) return 131072;
    const s = String(size);
    const unit = s[s.length - 1].toUpperCase();
    const num = parseInt(s, 10) || 0;
    return num * (unit === 'K' ? 1024 : unit === 'M' ? 1048576 : unit === 'G' ? 1073741824 : 1);
}

function buildHeaders(reqHeaders, url, randUa) {
    const h = keysToLowerCase({...reqHeaders});
    if (h['referer'] === '__URL__') h['referer'] = url;
    if (!h['accept']) h['accept'] = '*/*';
    if (randUa) h['user-agent'] = randomUa.generateUa(1, {device: ['pc'], mobileOs: ['android']});
    return h;
}

async function getContentLength(url, headers, hasCookie) {
    if (!hasCookie) {
        const cached = contentLengthCache.get(url);
        if (cached && Date.now() - cached.timestamp < CL_CACHE_TTL) {
            return {length: cached.length, headers: cached.headers};
        }
    }

    let initialHeaders, contentLength;

    if (!hasCookie) {
        try {
            const resp = await _axios.head(url, {headers});
            initialHeaders = resp.headers;
            contentLength = parseInt(initialHeaders['content-length'], 10);
        } catch {}
    }

    if (!contentLength) {
        try {
            const resp = await _axios.get(url, {
                headers: {...headers, Range: 'bytes=0-1'},
                responseType: 'stream',
            });
            initialHeaders = resp.headers;
            resp.data.destroy();
            const cr = initialHeaders['content-range'];
            if (cr) {
                const m = cr.match(/\/(\d+)$/);
                if (m) contentLength = parseInt(m[1], 10);
            }
        } catch {}
    }

    if (!contentLength) {
        const resp = await _axios.get(url, {headers, responseType: 'stream'});
        initialHeaders = resp.headers;
        contentLength = parseInt(initialHeaders['content-length'], 10);
        resp.data.destroy();
    }

    if (!contentLength) throw new Error('Failed to get content length');

    if (!hasCookie) {
        // 直播/动态转码类（m3u8/event/DASH）同一 URL 内容随时间变化，缓存总长会切出错误 Range
        const ct = String(initialHeaders['content-type'] || '').toLowerCase();
        const cacheable = !ct.includes('mpegurl') && !ct.includes('event') && !ct.includes('dash') && !ct.includes('mpd');
        if (cacheable) {
            contentLengthCache.set(url, {
                length: contentLength,
                headers: {...initialHeaders},
                timestamp: Date.now(),
            });
        }
    }

    return {length: contentLength, headers: initialHeaders};
}

async function fetchStream(url, headers, start, end) {
    const resp = await _axios.get(url, {
        headers: {...headers, Range: `bytes=${start}-${end}`},
        responseType: 'stream',
        timeout: 30000,
    });
    activeStreamCount++;
    resp.data.on('close', () => activeStreamCount--);
    return resp.data;
}

// ─── 代理函数 ───

export async function proxyStreamMedia(mediaUrl, reqHeaders, request, reply, randUa = 0) {
    const headers = buildHeaders(reqHeaders, mediaUrl, randUa);
    if (request.headers.range) headers['range'] = request.headers.range;

    const resp = await _axios.get(mediaUrl, {headers, responseType: 'stream', timeout: 30000});

    if (reply.raw.destroyed) { resp.data.destroy(); return; }

    // 直写 reply.raw 流式转发必须 hijack：否则 handler 结束后 Fastify 会再走一次
    // reply.send() 收尾，客户端断连时触发 ERR_HTTP_HEADERS_SENT unhandledRejection；
    // hijack 后 reply.sent===true，Fastify 的 thenable 收尾（含 rejection 分支）安全跳过
    reply.hijack();

    for (const [k, v] of Object.entries(resp.headers)) {
        if (k.toLowerCase() !== 'transfer-encoding') reply.raw.setHeader(k, v);
    }
    reply.raw.writeHead(resp.status);

    await pipeline(resp.data, reply.raw).catch(err => {
        if (err?.code !== 'ERR_STREAM_PREMATURE_CLOSE' && err?.code !== 'ERR_ECONNRESET') throw err;
    });
}

async function proxyStreamMediaMulti(mediaUrl, reqHeaders, request, reply, thread, size, randUa = 0) {
    const headers = buildHeaders(reqHeaders, mediaUrl, randUa);
    const hasCookie = Object.keys(reqHeaders).some(k => k.toLowerCase() === 'cookie');
    const threadCount = Math.min(parseInt(thread, 10) || 1, 32);

    const {length: contentLength, headers: initialHeaders} = await getContentLength(mediaUrl, headers, hasCookie);

    // 与 proxyStreamMedia 同理：直写 reply.raw 前必须 hijack，否则 pipeline 中途出错时
    // Fastify 的 thenable 收尾会对已发 206 头的响应再走一次 send，触发 ERR_HTTP_HEADERS_SENT
    reply.hijack();

    for (const [k, v] of Object.entries(initialHeaders)) {
        if (!['transfer-encoding', 'content-length'].includes(k.toLowerCase())) reply.raw.setHeader(k, v);
    }
    reply.raw.setHeader('Accept-Ranges', 'bytes');

    const range = request.headers.range || 'bytes=0-';
    const [startStr, endStr] = range.replace(/bytes=/, '').split('-');
    let start = parseInt(startStr, 10) || 0;
    let end = endStr ? parseInt(endStr, 10) : contentLength - 1;
    if (start < 0) start = 0;
    if (end >= contentLength) end = contentLength - 1;

    if (start >= end) {
        // 已 hijack，不能再用 reply.code().send()，直写 raw
        reply.raw.writeHead(416, {'Content-Range': `bytes */${contentLength}`});
        reply.raw.end();
        return;
    }

    reply.raw.setHeader('Content-Range', `bytes ${start}-${end}/${contentLength}`);
    reply.raw.setHeader('Content-Length', end - start + 1);
    reply.raw.writeHead(206);

    const totalSize = end - start + 1;
    const numThreads = Math.min(threadCount, Math.ceil(totalSize / sizeToBytes(size)));
    const subRanges = [];
    for (let i = 0; i < numThreads; i++) {
        const subStart = start + Math.floor(i * totalSize / numThreads);
        const subEnd = start + Math.floor((i + 1) * totalSize / numThreads) - 1;
        subRanges.push({start: subStart, end: Math.min(subEnd, end)});
    }

    const streams = await Promise.all(
        subRanges.map(r => fetchStream(mediaUrl, headers, r.start, r.end))
    );

    try {
        for (const stream of streams) {
            if (request.raw.aborted || reply.raw.destroyed) break;
            await pipeline(stream, reply.raw, {end: false}).catch(err => {
                if (err?.code !== 'ERR_STREAM_PREMATURE_CLOSE') throw err;
            });
        }
    } finally {
        streams.forEach(s => { if (!s.destroyed) s.destroy(); });
    }

    if (!reply.raw.destroyed && !reply.raw.writableEnded) reply.raw.end();
}

// ─── 路由 ───

export default (fastify, _opts, done) => {
    fastify.all('/mediaProxy', {
        config: { auth: 'public' }, // 媒体流代理门面，免鉴权
        schema: {
            tags: ['协议接口'],
            summary: '流媒体代理',
            description: '媒体流代理转发，支持 Range 请求；用法同 https://github.com/Zhu-zi-a/mediaProxy。',
            security: [],
        },
    }, async (request, reply) => {
        const {thread = 1, form = 'urlcode', url, header, size = '128K', chunkSize, randUa = 0, stream = 0} = request.query;

        if (!url) return reply.code(400).send({error: 'Missing required parameter: url'});

        try {
            const decodedUrl = form === 'base64' ? base64Decode(url) : url;
            let decodedHeader = header
                ? JSON.parse(form === 'base64' ? base64Decode(header) : header)
                : {};

            if (parseInt(stream, 10) === 1) {
                return await proxyStreamMedia(decodedUrl, decodedHeader, request, reply, parseInt(randUa, 10));
            }

            if (chunkSize) {
                const cs = parseInt(chunkSize, 10) * 1024;
                const pool = parseInt(thread, 10) || 6;
                decodedHeader = keysToLowerCase(decodedHeader);
                if (decodedHeader['referer'] === '__URL__') decodedHeader['referer'] = decodedUrl;
                return await chunkStream(request, reply, decodedUrl, md5(decodedUrl), decodedHeader,
                    {chunkSize: cs, poolSize: pool, timeout: 10000});
            }

            if (ENV.get('play_proxy_mode', '1') !== '2') {
                return await proxyStreamMediaMulti(decodedUrl, decodedHeader, request, reply, thread, size, randUa);
            } else {
                return await chunkStream(request, reply, decodedUrl, md5(decodedUrl), decodedHeader,
                    {chunkSize: 262144, poolSize: parseInt(thread, 10) || 5, timeout: 10000});
            }
        } catch (error) {
            fastify.log.error(error.message);
            if (!reply.sent && !reply.raw.destroyed) return reply.code(500).send({error: error.message});
        }
    });

    fastify.all('/hgProxy', {config: {auth: 'public'}}, async (request, reply) => {
        const targetUrl = request.query.url;
        if (!targetUrl) return reply.code(400).send({error: 'Missing url parameter'});

        let target;
        try { target = new URL(targetUrl); } catch { return reply.code(400).send({error: 'Invalid url'}); }

        // URL() 对 IPv6 字面量返回的 hostname 带方括号（'[::1]'），需剥掉再比对白名单
        const targetHost = target.hostname.replace(/^\[|\]$/g, '');
        if (!['http:', 'https:'].includes(target.protocol)
            || !['localhost', '127.0.0.1', '::1'].includes(targetHost)) {
            return reply.code(403).send({error: 'Only loopback http(s) targets are allowed'});
        }

        reply.hijack();

        const reqHeaders = {...request.headers};
        delete reqHeaders['host'];
        delete reqHeaders['connection'];
        delete reqHeaders['content-length'];
        delete reqHeaders['accept-encoding'];

        const proxyReq = (target.protocol === 'https:' ? https : http).request(targetUrl, {
            method: request.method,
            headers: reqHeaders,
            agent: target.protocol === 'https:' ? hgAgentHttps : hgAgentHttp,
        }, (proxyRes) => {
            const ct = String(proxyRes.headers['content-type'] || '').toLowerCase();

            if (ct.includes('dash') || ct.includes('mpd')) {
                const chunks = [];
                proxyRes.on('data', c => chunks.push(c));
                proxyRes.on('end', () => {
                    let body = Buffer.concat(chunks).toString('utf-8');
                    const proto = request.headers['x-forwarded-proto'] || 'http';
                    const host = request.headers.host || '127.0.0.1:5757';
                    const proxyBase = `${proto}://${host}/hgProxy`;
                    body = body.replace(/<BaseURL>\s*([^<]+?)\s*<\/BaseURL>/g, (m, u) => {
                        if (u.startsWith('http://127.0.0.1') || u.startsWith('http://localhost')) {
                            return `<BaseURL>${proxyBase}?url=${encodeURIComponent(u)}</BaseURL>`;
                        }
                        return m;
                    });
                    const out = {...proxyRes.headers, 'content-type': 'application/dash+xml',
                        'content-length': Buffer.byteLength(body)};
                    delete out['transfer-encoding'];
                    reply.raw.writeHead(proxyRes.statusCode, out);
                    reply.raw.end(body);
                });
                proxyRes.on('error', () => {
                    if (!reply.raw.headersSent) reply.raw.writeHead(502);
                    if (!reply.raw.writableEnded) reply.raw.end();
                });
                return;
            }

            const out = {...proxyRes.headers};
            delete out['connection'];
            delete out['keep-alive'];
            delete out['transfer-encoding'];
            reply.raw.writeHead(proxyRes.statusCode, out);
            proxyRes.on('error', () => { if (!reply.raw.writableEnded) reply.raw.end(); });
            proxyRes.pipe(reply.raw);
        });

        proxyReq.on('error', (e) => {
            if (!reply.raw.headersSent) reply.raw.writeHead(502, {'Content-Type': 'application/json'});
            if (!reply.raw.writableEnded) reply.raw.end(JSON.stringify({error: e.message}));
        });

        reply.raw.on('close', () => { if (!proxyReq.destroyed) proxyReq.destroy(); });

        if (request.method !== 'GET' && request.method !== 'HEAD') request.raw.pipe(proxyReq);
        else proxyReq.end();
    });

    done();
};
