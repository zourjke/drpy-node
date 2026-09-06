/**
 * LX Music 透明反向代理
 * - /lx/*     → 管理控制台（去掉 /lx 前缀，重写 HTML 绝对路径）
 * - /music/*  → Web 播放器（保留前缀，仅重写 /api/ 等关键路径）
 * - WebSocket 升级代理支持同步功能
 * - /lx/status 供探测后端在线状态
 */

import {log, logError, logWarn} from '../utils/log.js';
import http from 'http';

const LX_HOST = '127.0.0.1';
const LX_PORT = parseInt(process.env.LX_PORT || '9527', 10);
const LX_PREFIX = '/lx';

/** 生成服务离线提示页 */
function offlinePage(reason) {
    return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LX Music - 服务未启动</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#0f172a;color:#e2e8f0;height:100vh;display:flex;align-items:center;justify-content:center}
.box{text-align:center;max-width:480px;padding:32px;background:#1e293b;border-radius:12px;border:1px solid #334155}
.icon{font-size:56px;margin-bottom:12px}
h1{font-size:20px;margin-bottom:16px;color:#fca5a5}
.msg{color:#94a3b8;line-height:1.7;font-size:14px;margin-bottom:20px}
.code{background:#0f172a;padding:8px 12px;border-radius:6px;color:#60a5fa;font-family:monospace;font-size:12px;display:inline-block;margin:4px 0}
a.btn{display:inline-block;margin-top:16px;padding:8px 20px;background:#3b82f6;color:#fff;border-radius:6px;text-decoration:none;font-size:14px}
</style></head><body><div class="box"><div class="icon">🔇</div><h1>LX Music 服务未启动</h1>
<div class="msg">lxserver（端口 ${LX_PORT}）暂不可达，可能原因：<br>1. lxserver 插件未启用或正在启动<br>2. 首次启动正在自动安装依赖（需几分钟）<br>3. lxserver 进程异常退出<br><br>错误详情：<span class="code">${reason}</span></div>
<a class="btn" href="/lx/">刷新重试</a></div></body></html>`;
}

/** 探测 lxserver 是否在线 */
function isLxOnline() {
    return new Promise((resolve) => {
        const req = http.request(
            { host: LX_HOST, port: LX_PORT, path: '/', method: 'GET', timeout: 2000 },
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

/**
 * 核心代理函数
 * @param {object} req  fastify 请求对象
 * @param {object} reply fastify 响应对象
 * @param {string} targetPath 转发到 lxserver 的路径（含查询）
 * @param {'lx'|'music'} mode 重写模式：lx 重写所有绝对路径，music 仅重写 /api/ 等特定路径
 */
function proxyToLx(req, reply, targetPath, mode) {
    const path = targetPath.startsWith('/') ? targetPath : '/' + targetPath;

    // 构造转发请求头
    const headers = { ...req.headers };
    delete headers.host;
    delete headers['content-length'];
    delete headers.authorization; // drpy 自身凭证会导致 lxserver 401

    reply.hijack();

    // 处理请求体（fastify 已解析，需重新序列化）
    let bodyBuf = null;
    if (req.body !== undefined && req.body !== null) {
        const contentType = (headers['content-type'] || '').toLowerCase();
        if (typeof req.body === 'string') {
            bodyBuf = Buffer.from(req.body);
        } else if (Buffer.isBuffer(req.body)) {
            if (req.body.length > 0) bodyBuf = req.body;
        } else if (contentType.includes('application/x-www-form-urlencoded')) {
            const params = new URLSearchParams();
            for (const [k, v] of Object.entries(req.body)) {
                params.append(k, typeof v === 'string' ? v : JSON.stringify(v));
            }
            bodyBuf = Buffer.from(params.toString());
        } else {
            bodyBuf = Buffer.from(JSON.stringify(req.body));
        }
        if (bodyBuf) headers['content-length'] = bodyBuf.length;
    }
    if (!bodyBuf && (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH')) {
        headers['content-length'] = 0;
    }

    const proxyReq = http.request(
        {
            host: LX_HOST,
            port: LX_PORT,
            path,
            method: req.method,
            headers,
            timeout: 30000,
        },
        (proxyRes) => {
            const contentType = proxyRes.headers['content-type'] || '';
            const isHtml = contentType.includes('text/html');
            const isJs = contentType.includes('javascript') || contentType.includes('ecmascript');
            const shouldRewrite = isHtml || isJs;
            const respHeaders = { ...proxyRes.headers };
            delete respHeaders['content-length'];
            delete respHeaders['transfer-encoding'];

            const onClientClose = () => proxyRes.destroy();
            reply.raw.on('close', onClientClose);

            if (!shouldRewrite) {
                reply.raw.writeHead(proxyRes.statusCode || 200, respHeaders);
                proxyRes.pipe(reply.raw);
                proxyRes.on('end', () => reply.raw.removeListener('close', onClientClose));
                proxyRes.on('error', () => reply.raw.removeListener('close', onClientClose));
                return;
            }

            // 缓冲并重写 HTML/JS
            const chunks = [];
            proxyRes.on('data', (c) => chunks.push(c));
            proxyRes.on('end', () => {
                reply.raw.removeListener('close', onClientClose);
                let body = Buffer.concat(chunks).toString('utf8');
                if (isHtml) {
                    if (mode === 'lx') {
                        // 管理控制台：所有绝对路径加 /lx 前缀
                        body = body.replace(
                            /((?:href|src|action|poster)\s*=\s*")\/(?!\/)/g,
                            '$1' + LX_PREFIX + '/'
                        );
                        // 内联脚本中的 '/api/' 也加前缀（如 filemanager.html 的 elFinder
                        // connector 地址），否则会落到主服务自身路由上 404
                        body = body.replace(
                            /(['"`])\/api\//g,
                            '$1' + LX_PREFIX + '/api/'
                        );
                    } else if (mode === 'music') {
                        // 播放器：重写 /api/ → /music/api/，并将 /js/*.js 映射到 /music/js/*
                        body = body.replace(
                            /((?:href|src|action|poster)\s*=\s*")\/api\//g,
                            '$1/music/api/'
                        );
                        body = body.replace(
                            /((?:src)\s*=\s*")\/(js\/[^"']+\.js)/g,
                            '$1/music/$2'
                        );
                        // 为静态资源添加版本参数强制刷新
                        body = body.replace(
                            /((?:href|src)\s*=\s*")([^"']*\.(?:js|css))(?:\?[^"']*)?"/g,
                            (m, p1, p2) => (/^(?:https?:)?\/\//.test(p2) ? m : p1 + p2 + '?_=lxv2"')
                        );
                        // 注入补丁脚本：拦截 fetch POST /api/user/list，失败时显示提示
                        const patchScript = `<script>(function(){if(window.__lxFetchPatched)return;window.__lxFetchPatched=true;var o=window.fetch;window.fetch=function(i,n){return o.apply(this,arguments).then(function(r){try{var u=typeof i==='string'?i:(i&&i.url)||'';var m=(n&&n.method)||(i&&i.method)||'GET';if(m.toUpperCase()==='POST'&&u.indexOf('/api/user/list')>=0){if(!r.ok){r.clone().text().then(function(t){var msg='保存失败('+r.status+')';try{var j=JSON.parse(t);if(j.message)msg=j.message;else if(j.error)msg=j.error}catch(_){}msg+='，请刷新页面查看最新数据';console.error('[lx-patch]保存歌单失败:',r.status,t);if(typeof window.showToast==='function')window.showToast('error',msg);else alert(msg)}).catch(function(){});throw new Error('[lx-patch]保存歌单失败:'+r.status)}else{console.log('[lx-patch]保存歌单成功')}}}catch(e){if(e&&e.message&&e.message.indexOf('[lx-patch]')>=0)throw e}return r})};console.log('[lx-patch]fetch拦截器已安装')})()</script>`;
                        if (body.includes('</body>')) {
                            body = body.replace('</body>', patchScript + '</body>');
                        } else {
                            body += patchScript;
                        }
                        // 内联脚本中的 '/api/' 也替换
                        body = body.replace(
                            /(['"`])\/api\//g,
                            '$1/music/api/'
                        );
                    }
                }
                if (isJs) {
                    const apiPrefix = mode === 'music' ? '/music/api' : LX_PREFIX + '/api';
                    body = body.replace(
                        /(['"`])\/api\//g,
                        '$1' + apiPrefix + '/'
                    );
                    const aboutPrefix = mode === 'music' ? '/music' : LX_PREFIX;
                    body = body.replace(
                        /(['"`])\/about\.md/g,
                        '$1' + aboutPrefix + '/about.md'
                    );
                    // 补丁：为 admin/verify 的 fetch 添加空 body 防止 Cloudflare 400
                    if (mode === 'music') {
                        body = body.replace(
                            "headers: { 'x-frontend-auth': pass }",
                            "headers: { 'x-frontend-auth': pass }, body: '{}'"
                        );
                    }
                }
                reply.raw.writeHead(proxyRes.statusCode || 200, respHeaders);
                reply.raw.end(body);
            });
            proxyRes.on('error', () => {
                reply.raw.removeListener('close', onClientClose);
                if (!reply.raw.headersSent) {
                    reply.raw.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
                    reply.raw.end('lxserver upstream error');
                }
            });
        }
    );

    proxyReq.on('timeout', () => {
        proxyReq.destroy();
        if (!reply.raw.headersSent) {
            reply.raw.writeHead(504, { 'content-type': 'text/html; charset=utf-8' });
            reply.raw.end(offlinePage('上游响应超时 (30s)'));
        }
    });

    proxyReq.on('error', (err) => {
        logError('[lx-proxy] 反代请求失败:', err.message);
        if (!reply.raw.headersSent) {
            reply.raw.writeHead(502, { 'content-type': 'text/html; charset=utf-8' });
            reply.raw.end(offlinePage(err.message));
        }
    });

    // Node 16+ 中 IncomingMessage 的 'close' 语义是「消息完成」而非「连接关闭」：
    // 带 body 的 POST 在 fastify 消费完 body 后即触发 close，会在转发中途误杀上游请求
    // （表现为 502 socket hang up），故改监听底层 socket 的连接级 close。
    const onReqAbort = () => proxyReq.destroy();
    req.raw.socket.on('close', onReqAbort);
    // 上游请求关闭（正常完成/出错/被销毁）时才解除，覆盖整个转发生命周期。
    proxyReq.on('close', () => req.raw.socket.removeListener('close', onReqAbort));

    if (bodyBuf) {
        proxyReq.end(bodyBuf);
    } else {
        proxyReq.end();
    }
}

export default (fastify, options, done) => {
    // 注册通配解析器，防止 Fastify 对未知 Content-Type 返回 415
    try {
        fastify.addContentTypeParser('*', { parseAs: 'buffer' }, (req, body, done) => done(null, body));
    } catch (_) {}

    // 根路径重定向
    fastify.get(LX_PREFIX, async (req, reply) => {
        reply.redirect(LX_PREFIX + '/', 302);
    });

    // 在线状态探测
    fastify.get(LX_PREFIX + '/status', async (req, reply) => {
        const online = await isLxOnline();
        reply.send({ online, host: LX_HOST, port: LX_PORT });
    });

    // /lx/* 管理控制台代理
    fastify.all(LX_PREFIX + '/*', async (req, reply) => {
        const rawUrl = req.raw.url || '';
        const targetPath = rawUrl.startsWith(LX_PREFIX)
            ? rawUrl.slice(LX_PREFIX.length)
            : rawUrl;
        proxyToLx(req, reply, targetPath, 'lx');
    });

    // /music 播放器根重定向
    fastify.get('/music', async (req, reply) => {
        reply.redirect('/music/', 302);
    });

    // /music/* 播放器代理（自包含在 /music 路由下）
    const MUSIC_ROOT_JS = [
        '/music/js/config.js',
        '/music/js/notification-engine.js',
        '/music/js/ui-utils.js',
    ];
    fastify.all('/music/*', async (req, reply) => {
        const rawUrl = req.raw.url || '';
        const pathOnly = rawUrl.split('?')[0];
        let targetPath = rawUrl;
        // 对 API、about.md 和根路径 JS 去掉 /music 前缀
        if (rawUrl.startsWith('/music/api/') ||
            pathOnly === '/music/about.md' ||
            MUSIC_ROOT_JS.includes(pathOnly)) {
            targetPath = rawUrl.slice('/music'.length);
        }
        proxyToLx(req, reply, targetPath, 'music');
    });

    // WebSocket 升级代理（用于同步功能）
    function wsUpgradeHandler(req, socket, head) {
        const url = req.url || '';
        if (!url.startsWith(LX_PREFIX + '/') && url !== LX_PREFIX) return;

        const targetPath = url.startsWith(LX_PREFIX)
            ? url.slice(LX_PREFIX.length)
            : '/';
        const path = targetPath.startsWith('/') ? targetPath : '/' + targetPath;

        const proxyReq = http.request({
            host: LX_HOST,
            port: LX_PORT,
            path,
            method: 'GET',
            headers: {
                ...req.headers,
                host: `${LX_HOST}:${LX_PORT}`,
                connection: 'upgrade',
                upgrade: 'websocket',
            },
            timeout: 5000,
        });

        proxyReq.on('timeout', () => {
            proxyReq.destroy();
            socket.destroy();
        });

        proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
            socket.write(
                'HTTP/1.1 101 Switching Protocols\r\n' +
                Object.entries(proxyRes.headers)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join('\r\n') +
                '\r\n\r\n'
            );
            if (proxyHead && proxyHead.length) socket.write(proxyHead);
            proxySocket.pipe(socket);
            socket.pipe(proxySocket);
            const cleanup = () => {
                proxySocket.destroy();
                socket.destroy();
            };
            proxySocket.on('error', cleanup);
            socket.on('error', cleanup);
            proxySocket.on('close', cleanup);
            socket.on('close', cleanup);
        });

        proxyReq.on('error', (err) => {
            logError('[lx-proxy] WS 升级代理失败:', err.message);
            socket.destroy();
        });

        if (head && head.length) proxyReq.write(head);
        proxyReq.end();
    }

    fastify.addHook('onReady', () => {
        const server = fastify.server;
        if (!server) {
            logWarn('[lx-proxy] 未拿到 fastify.server，跳过 WS 升级代理');
            return;
        }
        server.on('upgrade', wsUpgradeHandler);
        log('[lx-proxy] WebSocket 升级代理已挂载');
    });

    fastify.addHook('onClose', () => {
        const server = fastify.server;
        if (server) server.removeListener('upgrade', wsUpgradeHandler);
    });

    done();
};
