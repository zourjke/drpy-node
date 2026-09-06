/**
 * clash(mihomo) 透明反向代理控制器
 * 把 /clash/* 透明反代到 http://127.0.0.1:9090/*
 * - /clash       → 重定向到 /clash/ui/metacubexd/
 * - /clash/*     → 代理到 9090/*（RESTful API + UI 静态资源）
 * - WebSocket 升级代理（metacubexd connections/traffic/logs 实时页需要）
 * - /clash/status 后端探测在线状态
 * @module clash-proxy-controller
 */

import http from 'http';
import path from 'path';
import fs from 'fs';
import { PROJECT_ROOT } from '../utils/pathHelper.js';
import { getPluginsConfig } from '../utils/pluginManager.js';

const CLASH_HOST = '127.0.0.1';
const CLASH_PORT = parseInt(process.env.CLASH_PORT || '9090', 10);
const CLASH_PREFIX = '/clash';

// 检查 clash 插件是否启用
function isClashPluginActive() {
    try {
        const plugins = getPluginsConfig();
        const clash = plugins.find(p => p.name === 'clash');
        return clash ? !!clash.active : false;
    } catch {
        return false;
    }
}

// HTML 转义，防止 XSS
function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// 离线提示页
function offlinePage(reason) {
    const safeReason = escapeHtml(reason);
    return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Clash - 服务未启动</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#0f172a;color:#e2e8f0;height:100vh;display:flex;align-items:center;justify-content:center}
.box{text-align:center;max-width:480px;padding:32px;background:#1e293b;border-radius:12px;border:1px solid #334155}
.icon{font-size:56px;margin-bottom:12px}
h1{font-size:20px;margin-bottom:16px;color:#fca5a5}
.msg{color:#94a3b8;line-height:1.7;font-size:14px;margin-bottom:20px}
.code{background:#0f172a;padding:8px 12px;border-radius:6px;color:#60a5fa;font-family:monospace;font-size:12px;display:inline-block;margin:4px 0}
a.btn{display:inline-block;margin-top:16px;padding:8px 20px;background:#3b82f6;color:#fff;border-radius:6px;text-decoration:none;font-size:14px}
</style></head><body><div class="box"><div class="icon">🛡️</div><h1>Clash 服务未启动</h1>
<div class="msg">mihomo（端口 ${CLASH_PORT}）暂不可达，可能原因：<br>1. clash 插件未启用或正在启动<br>2. mihomo 进程异常退出（检查 config.yaml 语法/端口占用）<br>3. 首次启动正在加载 GeoSite.dat<br><br>错误详情：<span class="code">${safeReason}</span></div>
<a class="btn" href="/clash/ui/">刷新重试</a></div></body></html>`;
}

// 后端探测 clash 是否在线
function isClashOnline() {
    return new Promise((resolve) => {
        const req = http.request(
            { host: CLASH_HOST, port: CLASH_PORT, path: '/version', method: 'GET', timeout: 2000 },
            (res) => {
                res.resume();
                resolve(res.statusCode !== undefined && res.statusCode < 500);
            }
        );
        req.on('error', () => resolve(false));
        req.on('timeout', () => { req.destroy(); resolve(false); });
        req.end();
    });
}

// 错误日志标志：clash 插件已启用但未启动时只打印一次，clash 恢复在线时重置
let httpErrorLogged = false;
let wsErrorLogged = false;

// ============ 订阅管理（远程订阅 URL / 本地节点 YAML 编辑） ============

// 定位 clash 插件目录（plugins/<path>）
function getClashPluginDir() {
    try {
        const clash = getPluginsConfig().find(p => p.name === 'clash');
        if (clash && clash.path) return path.join(PROJECT_ROOT, clash.path);
    } catch (_) {}
    return null;
}

// 读取 config.yaml 全文
function readConfigText() {
    const dir = getClashPluginDir();
    if (!dir) throw new Error('未找到 clash 插件目录');
    return { dir, text: fs.readFileSync(path.join(dir, 'config.yaml'), 'utf-8') };
}

// 读 config.yaml 中的 api secret（有则带上鉴权）
function readSecret(text) {
    const m = String(text).match(/^secret:\s*(.*)$/m);
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
}

// 行级定位 config.yaml 中指定 provider 块内的 url: 行（读值 + 写值共用）
function locateProviderUrlLine(lines, providerName) {
    const providerRe = new RegExp('^(\\s*)' + providerName + ':\\s*$');
    for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(providerRe);
        if (!m) continue;
        const indent = m[1].length;
        for (let j = i + 1; j < lines.length; j++) {
            const line = lines[j];
            if (!line.trim()) continue;
            const curIndent = line.match(/^\s*/)[0].length;
            if (curIndent <= indent) break; // 离开该 provider 块
            const cm = line.match(/^(\s+)url:(.*)$/);
            if (cm) return { index: j, indent: cm[1], value: cm[2].trim() };
        }
        break;
    }
    return null;
}

function readRemoteSub() {
    const { text } = readConfigText();
    const loc = locateProviderUrlLine(text.split('\n'), 'proxies-remote');
    return loc ? loc.value.replace(/^["']|["']$/g, '') : '';
}

// 调 mihomo 9090 API（自动带 secret）
function mihomoApi(pathName, method, bodyObj) {
    return new Promise((resolve) => {
        let secret = '';
        try { secret = readSecret(readConfigText().text); } catch (_) {}
        const headers = { 'Content-Type': 'application/json' };
        if (secret) headers.Authorization = 'Bearer ' + secret;
        const req = http.request(
            { host: CLASH_HOST, port: CLASH_PORT, path: pathName, method, headers, timeout: 20000 },
            (res) => {
                let data = '';
                res.on('data', c => data += c);
                res.on('end', () => resolve({ status: res.statusCode || 0, body: data }));
            }
        );
        req.on('error', (e) => resolve({ status: 0, body: e.message }));
        req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: '请求超时' }); });
        if (bodyObj !== undefined) req.write(JSON.stringify(bodyObj));
        req.end();
    });
}

const MIHOMO_OK = (r) => r.status === 204 || r.status === 200;

// 保存远程订阅 URL：写 config.yaml → 整配置热重载（provider 拉新订阅）
async function saveRemoteSub(url) {
    const { dir, text } = readConfigText();
    const lines = text.split('\n');
    const loc = locateProviderUrlLine(lines, 'proxies-remote');
    if (!loc) return { ok: false, msg: 'config.yaml 中未找到 proxies-remote.url 字段' };
    const newLines = lines.slice();
    newLines[loc.index] = loc.indent + 'url: "' + url + '"';
    fs.writeFileSync(path.join(dir, 'config.yaml.bak'), text);
    fs.writeFileSync(path.join(dir, 'config.yaml'), newLines.join('\n'));
    const r = await mihomoApi('/configs?force=true', 'PUT', { path: '', payload: '' });
    if (MIHOMO_OK(r)) return { ok: true, msg: '已保存并重载 mihomo' };
    return { ok: false, msg: '已写入 config.yaml，但重载失败（' + (r.status || '无响应') + '）：' + String(r.body).slice(0, 160) + '；可重启 clash 插件生效' };
}

// 保存本地节点 YAML：写 proxies-local.yaml → provider 级热重载，失败回退整配置重载
async function saveLocalSub(content) {
    const dir = getClashPluginDir();
    if (!dir) return { ok: false, msg: '未找到 clash 插件目录' };
    const file = path.join(dir, 'proxies-local.yaml');
    fs.writeFileSync(file + '.bak', fs.readFileSync(file, 'utf-8'));
    fs.writeFileSync(file, content);
    let r = await mihomoApi('/providers/proxies/proxies-local', 'PUT');
    if (MIHOMO_OK(r)) return { ok: true, msg: '已保存并重载' };
    r = await mihomoApi('/configs?force=true', 'PUT', { path: '', payload: '' });
    if (MIHOMO_OK(r)) return { ok: true, msg: '已保存并重载（整配置）' };
    return { ok: false, msg: '已写入文件（原文件备份 .bak），但重载失败：' + String(r.body).slice(0, 160) };
}

// mihomo 在线状态 + 订阅详情（版本 / 远程 / 本地节点数与更新时间）
async function getSubStatus() {
    const online = await isClashOnline();
    const result = { ok: true, online, version: null, remoteNodes: null, remoteUpdateAt: null, localNodes: null, localUpdateAt: null };
    if (!online) return result;
    const vr = await mihomoApi('/version', 'GET');
    if (vr.status === 200) { try { result.version = JSON.parse(vr.body).version; } catch (_) {} }
    const lr = await mihomoApi('/providers/proxies/proxies-local', 'GET');
    if (lr.status === 200) {
        try { const d = JSON.parse(lr.body); result.localNodes = (d.proxies || []).length; result.localUpdateAt = d.updatedAt || null; } catch (_) {}
    }
    const rr = await mihomoApi('/providers/proxies/proxies-remote', 'GET');
    if (rr.status === 200) {
        try { const d = JSON.parse(rr.body); result.remoteNodes = (d.proxies || []).length; result.remoteUpdateAt = d.updatedAt || null; } catch (_) {}
    }
    return result;
}

// 触发远程订阅刷新（PUT /providers/proxies/proxies-remote）
async function refreshRemoteSub() {
    const r = await mihomoApi('/providers/proxies/proxies-remote', 'PUT');
    if (MIHOMO_OK(r)) return { ok: true, msg: '已刷新远程订阅' };
    return { ok: false, msg: '刷新失败（' + (r.status || '无响应') + '）' };
}

// POST body 统一解析（fastify 默认 json parser 或通配 buffer parser 两种情况）
function parseJsonBody(body) {
    if (body === undefined || body === null) return {};
    if (Buffer.isBuffer(body)) { try { return JSON.parse(body.toString('utf-8') || '{}'); } catch (_) { return {}; } }
    if (typeof body === 'string') { try { return JSON.parse(body || '{}'); } catch (_) { return {}; } }
    return body;
}

/**
 * 核心反代函数：把请求透明转发到 clash 9090 的 targetPath
 */
function proxyToClash(req, reply, targetPath) {
    const path = targetPath.startsWith('/') ? targetPath : '/' + targetPath;

    const headers = { ...req.headers };
    delete headers.host;
    delete headers['content-length'];

    reply.hijack();

    // 请求体转发：fastify 默认解析 json/formbody，需基于 req.body 重新序列化
    let bodyBuf = null;
    if (req.body !== undefined && req.body !== null) {
        const contentType = (headers['content-type'] || '').toLowerCase();
        if (typeof req.body === 'string') {
            bodyBuf = Buffer.from(req.body);
        } else if (Buffer.isBuffer(req.body)) {
            if (req.body.length > 0) {
                bodyBuf = req.body;
            }
        } else if (contentType.includes('application/x-www-form-urlencoded')) {
            const params = new URLSearchParams();
            for (const [k, v] of Object.entries(req.body)) {
                params.append(k, typeof v === 'string' ? v : JSON.stringify(v));
            }
            bodyBuf = Buffer.from(params.toString());
        } else {
            bodyBuf = Buffer.from(JSON.stringify(req.body));
        }
        if (bodyBuf) {
            headers['content-length'] = bodyBuf.length;
        }
    }
    if (!bodyBuf && (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE')) {
        headers['content-length'] = 0;
    }

    // 统一清理：销毁代理请求/响应，移除客户端 close 监听器
    let proxyReq = null;
    let proxyRes = null;
    let cleaned = false;

    const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        if (proxyReq) proxyReq.destroy();
        if (proxyRes) proxyRes.destroy();
    };

    // 客户端断开时清理代理请求，避免浪费上游连接
    req.raw.on('close', cleanup);

    proxyReq = http.request(
        {
            host: CLASH_HOST,
            port: CLASH_PORT,
            path,
            method: req.method,
            headers,
            timeout: 30000,
        },
        (res) => {
            proxyRes = res;
            // clash 已响应，重置错误标志（下次离线时可再次提示）
            httpErrorLogged = false;

            const respHeaders = { ...proxyRes.headers };
            delete respHeaders['content-length'];
            delete respHeaders['transfer-encoding'];

            if (!reply.raw.headersSent) {
                reply.raw.writeHead(proxyRes.statusCode || 200, respHeaders);
            }
            proxyRes.pipe(reply.raw);

            // 响应结束/出错/关闭时清理
            proxyRes.on('end', cleanup);
            proxyRes.on('error', cleanup);
            proxyRes.on('close', cleanup);
        }
    );

    proxyReq.on('timeout', () => {
        if (!reply.raw.headersSent) {
            reply.raw.writeHead(504, { 'content-type': 'text/html; charset=utf-8' });
            reply.raw.end(offlinePage('上游响应超时 (30s)'));
        }
        cleanup();
    });

    proxyReq.on('error', (err) => {
        if (isClashPluginActive() && !httpErrorLogged) {
            httpErrorLogged = true;
            console.error('[clash-proxy] 反代请求失败:', err.message, '（clash 插件已启用但未启动？此提示仅显示一次）');
        }
        if (!reply.raw.headersSent) {
            reply.raw.writeHead(502, { 'content-type': 'text/html; charset=utf-8' });
            reply.raw.end(offlinePage(err.message));
        }
        cleanup();
    });

    if (bodyBuf) {
        proxyReq.end(bodyBuf);
    } else {
        proxyReq.end();
    }
}

export default (fastify, options, done) => {
    // 注册通配 content-type parser：clash API 可能收到非标准 content-type，避免 415
    try {
        fastify.addContentTypeParser('*', { parseAs: 'buffer' }, (req, body, done) => done(null, body));
    } catch (_) {}

    // /clash → 重定向到 /clash/ui/metacubexd/
    fastify.get(CLASH_PREFIX, async (req, reply) => {
        reply.redirect(CLASH_PREFIX + '/ui/metacubexd/', 302);
    });

    // /clash/status → 后端探测在线状态
    fastify.get(CLASH_PREFIX + '/status', async (req, reply) => {
        const online = await isClashOnline();
        reply.send({ online, host: CLASH_HOST, port: CLASH_PORT });
    });

    // ===== 订阅管理（远程订阅 URL / 本地节点 YAML，响应式页面兼容手机+PC） =====

    // /clash/config → 重定向到 ui 入口页（订阅管理已合并进 ui/index.html 的导航页）
    fastify.get(CLASH_PREFIX + '/config', async (req, reply) => {
        reply.redirect(CLASH_PREFIX + '/ui/', 302);
    });

    // 状态：mihomo 在线 + 本地节点数
    fastify.get(CLASH_PREFIX + '/config/api/status', async (req, reply) => reply.send(await getSubStatus()));

    // 远程订阅 URL：读取 / 保存
    fastify.get(CLASH_PREFIX + '/config/api/remote', async (req, reply) => {
        try { reply.send({ ok: true, url: readRemoteSub() }); }
        catch (e) { reply.send({ ok: false, msg: e.message }); }
    });
    fastify.post(CLASH_PREFIX + '/config/api/remote', async (req, reply) => {
        const url = String(parseJsonBody(req.body).url || '').trim();
        if (!/^https?:\/\//i.test(url)) return reply.send({ ok: false, msg: '订阅 URL 需以 http(s):// 开头' });
        reply.send(await saveRemoteSub(url));
    });

    // 本地节点 YAML：读取 / 保存
    fastify.get(CLASH_PREFIX + '/config/api/local', async (req, reply) => {
        try {
            const dir = getClashPluginDir();
            reply.send({ ok: true, content: fs.readFileSync(path.join(dir, 'proxies-local.yaml'), 'utf-8') });
        } catch (e) { reply.send({ ok: false, msg: e.message }); }
    });
    fastify.post(CLASH_PREFIX + '/config/api/local', async (req, reply) => {
        const content = parseJsonBody(req.body).content;
        if (typeof content !== 'string' || !content.trim()) return reply.send({ ok: false, msg: '内容为空' });
        reply.send(await saveLocalSub(content));
    });

    // 触发远程订阅刷新
    fastify.post(CLASH_PREFIX + '/config/api/refresh', async (req, reply) => reply.send(await refreshRemoteSub()));

    // /clash/* → 透明反代到 clash 9090
    fastify.all(CLASH_PREFIX + '/*', async (req, reply) => {
        const rawUrl = req.raw.url || '';
        const targetPath = rawUrl.startsWith(CLASH_PREFIX)
            ? rawUrl.slice(CLASH_PREFIX.length)
            : rawUrl;
        proxyToClash(req, reply, targetPath);
    });

    // WebSocket 升级代理：metacubexd 的 connections/traffic/logs 实时页依赖 WS
    function wsUpgradeHandler(req, socket, head) {
        const url = req.url || '';
        if (!url.startsWith(CLASH_PREFIX + '/') && url !== CLASH_PREFIX) return;

        const targetPath = url.startsWith(CLASH_PREFIX)
            ? url.slice(CLASH_PREFIX.length)
            : '/';
        const path = targetPath.startsWith('/') ? targetPath : '/' + targetPath;

        let proxyReq = null;
        let proxySocket = null;
        let cleaned = false;

        // 统一清理：销毁所有连接和 pipe
        const cleanup = () => {
            if (cleaned) return;
            cleaned = true;
            if (proxyReq) proxyReq.destroy();
            if (proxySocket) {
                proxySocket.unpipe(socket);
                socket.unpipe(proxySocket);
                proxySocket.destroy();
            }
            socket.destroy();
        };

        // 客户端断开或出错时清理
        socket.on('close', cleanup);
        socket.on('error', cleanup);

        proxyReq = http.request({
            host: CLASH_HOST,
            port: CLASH_PORT,
            path,
            method: 'GET',
            headers: {
                ...req.headers,
                host: `${CLASH_HOST}:${CLASH_PORT}`,
                connection: 'upgrade',
                upgrade: 'websocket',
            },
            timeout: 5000,
        });

        proxyReq.on('timeout', cleanup);

        // clash 返回非 101 响应（如 401 Unauthorized）：转发状态码后清理
        proxyReq.on('response', (proxyRes) => {
            if (socket.writable && !cleaned) {
                socket.write(
                    `HTTP/1.1 ${proxyRes.statusCode} ${proxyRes.statusMessage}\r\n` +
                    Object.entries(proxyRes.headers)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join('\r\n') +
                    '\r\n\r\n'
                );
                proxyRes.pipe(socket);
                proxyRes.on('end', cleanup);
                proxyRes.on('error', cleanup);
            } else {
                cleanup();
            }
        });

        proxyReq.on('upgrade', (proxyRes, proxySocket_, proxyHead) => {
            proxySocket = proxySocket_;
            // clash WS 已连接，重置错误标志
            wsErrorLogged = false;

            // 检查 socket 是否仍可写
            if (!socket.writable || cleaned) {
                cleanup();
                return;
            }

            // 写入 101 响应头
            socket.write(
                'HTTP/1.1 101 Switching Protocols\r\n' +
                Object.entries(proxyRes.headers)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join('\r\n') +
                '\r\n\r\n'
            );
            if (proxyHead && proxyHead.length) socket.write(proxyHead);

            // 双向 pipe
            proxySocket.pipe(socket);
            socket.pipe(proxySocket);

            // proxySocket 出错/关闭时清理
            proxySocket.on('error', cleanup);
            proxySocket.on('close', cleanup);
        });

        proxyReq.on('error', (err) => {
            if (isClashPluginActive() && !wsErrorLogged) {
                wsErrorLogged = true;
                console.error('[clash-proxy] WS 升级代理失败:', err.message, '（clash 插件已启用但未启动？此提示仅显示一次）');
            }
            cleanup();
        });

        if (head && head.length) proxyReq.write(head);
        proxyReq.end();
    }

    fastify.addHook('onReady', () => {
        const server = fastify.server;
        if (!server) {
            console.warn('[clash-proxy] 未拿到 fastify.server，跳过 WS 升级代理');
            return;
        }
        server.on('upgrade', wsUpgradeHandler);
        console.log('[clash-proxy] WebSocket 升级代理已挂载');
    });

    fastify.addHook('onClose', () => {
        const server = fastify.server;
        if (server) server.removeListener('upgrade', wsUpgradeHandler);
    });

    done();
};
