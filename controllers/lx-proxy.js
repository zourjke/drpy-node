/**
 * LX Music 透明反向代理
 * lxserver 新版路径：后台管理 /admin，Web 播放器挂载到根路径 /
 * - /admin/*  → 后台管理控制台（转发到 lxserver /admin，重写 HTML 绝对路径）
 * - /lx/*     → Web 播放器（转发到 lxserver 根路径 /，保留前缀，仅重写 /api/ 等关键路径）
 * - /music*   → 旧入口兼容重定向到 /lx
 * - WebSocket 升级代理支持同步功能（/admin/* → /admin，其余 → 根路径）
 * - /lx/status 供探测后端在线状态
 */

import {log, logError, logWarn} from '../utils/log.js';
import http from 'http';

const LX_HOST = '127.0.0.1';
const LX_PORT = parseInt(process.env.LX_PORT || '9527', 10);
const LX_PREFIX = '/lx';
const ADMIN_PREFIX = '/admin';

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
 * 后台管理目标路径
 * - 普通资源：加 /admin 前缀转发到 lxserver /admin
 * - /api、/js/config.js、/about.md 这些由 lxserver 根路径直接提供（配置注入 / API / 关于页），
 *   必须转发到根路径，否则 /js/config.js 拿不到运行时注入的 window.CONFIG
 */
function adminTarget(rest) {
    const qi = rest.indexOf('?');
    const pathOnly = qi >= 0 ? rest.slice(0, qi) : rest;
    const query = qi >= 0 ? rest.slice(qi) : '';
    if (pathOnly === '' || pathOnly === '/') return '/admin/' + query;
    if (pathOnly.startsWith('/api') ||
        pathOnly === '/js/config.js' ||
        pathOnly.startsWith('/about.md')) {
        return rest; // 转发到 lxserver 根路径
    }
    return '/admin' + pathOnly + query;
}

/** Web 播放器目标路径：lxserver 已将播放器挂载到根路径 / */
function playerTarget(rest) {
    const pathOnly = rest.split('?')[0];
    if (pathOnly === '' || pathOnly === '/') return '/';
    return rest;
}

/**
 * 把 player.path 的根路径值改写为反代挂载点 /lx
 * 兼容单/双引号与 ''、'/' 两种「根路径」形态（lxserver 用 JSON.stringify 生成，双引号）；
 * 非根路径值（如 /music）不触碰。
 */
function rewritePlayerPath(body) {
    return body.replace(/((['"])player\.path\2\s*:\s*)(['"])(?:\/)?\3/g, '$1$3/lx$3');
}

/**
 * 核心代理函数
 * @param {object} req  fastify 请求对象
 * @param {object} reply fastify 响应对象
 * @param {string} targetPath 转发到 lxserver 的路径（含查询）
 * @param {'admin'|'player'} mode 重写模式：admin 重写所有绝对路径，player 仅重写 /api/ 等特定路径
 */
function proxyToLx(req, reply, targetPath, mode, mountPrefix) {
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
            const isJson = contentType.includes('application/json');
            const shouldRewrite = isHtml || isJs || isJson;
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
                const prefix = mountPrefix || LX_PREFIX;
                if (isHtml) {
                    if (mode === 'admin') {
                        // 管理控制台：所有绝对路径加 mountPrefix 前缀
                        // （/admin 入口；/js/config.js、/api/ 等会被转发到 lxserver 根路径）
                        body = body.replace(
                            /((?:href|src|action|poster)\s*=\s*")\/(?!\/)/g,
                            '$1' + prefix + '/'
                        );
                        // 内联脚本中的 '/api/' 也加前缀（如 filemanager.html 的 elFinder
                        // connector 地址），否则会落到主服务自身路由上 404
                        body = body.replace(
                            /(['"`])\/api\//g,
                            '$1' + prefix + '/api/'
                        );
                    } else if (mode === 'player') {
                        // 播放器：lxserver 已将播放器挂载到根路径 /，代理前缀为 prefix（/lx）
                        // 重写 /api/ → prefix/api/，/js/*.js → prefix/js/*.js，遗留 /music/ → prefix/music/
                        body = body.replace(
                            /((?:href|src|action|poster)\s*=\s*")\/api\//g,
                            '$1' + prefix + '/api/'
                        );
                        body = body.replace(
                            /((?:src)\s*=\s*")\/(js\/[^"']+\.js)/g,
                            '$1' + prefix + '/$2'
                        );
                        body = body.replace(
                            /((?:href|src|action|poster)\s*=\s*")\/music\//g,
                            '$1' + prefix + '/music/'
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
                        // 内联脚本中的 /api/ 与 /music/ 也替换
                        body = body.replace(
                            /(['"`])\/api\//g,
                            '$1' + prefix + '/api/'
                        );
                        body = body.replace(
                            /(['"`])\/music\//g,
                            '$1' + prefix + '/music/'
                        );
                    }
                }
                if (isJs) {
                    const apiPrefix = prefix + '/api';
                    body = body.replace(
                        /(['"`])\/api\//g,
                        '$1' + apiPrefix + '/'
                    );
                    const aboutPrefix = prefix;
                    body = body.replace(
                        /(['"`])\/about\.md/g,
                        '$1' + aboutPrefix + '/about.md'
                    );
                    body = body.replace(
                        /(['"`])\/music\//g,
                        '$1' + prefix + '/music/'
                    );
                    // 让后台「去播放器」按钮正确跳到 /lx：lxserver 注入的 player.path 为 /
                    // （播放器实际挂在反代 /lx）；仅对配置注入接口生效，避免误伤其它 JS
                    if (targetPath.startsWith('/js/config.js')) {
                        body = rewritePlayerPath(body);
                    }
                }
                // /api/config JSON 响应：设置页会用它覆盖侧边栏播放器链接，同样改写 player.path
                if (isJson && targetPath.startsWith('/api/config')) {
                    body = rewritePlayerPath(body);
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

    // Web 播放器根路径重定向（lxserver 已将播放器挂载到 /）
    fastify.get(LX_PREFIX, async (req, reply) => {
        reply.redirect(LX_PREFIX + '/', 302);
    });

    // 后台管理根路径重定向（lxserver 后台在 /admin）
    // 以下 /admin*、/lx/status、/lx/*、/music/* 均声明 public 对齐旧版匿名语义：
    // 壳子/播放器直连不带 Basic，鉴权由 lxserver 自身 token 负责；仅 /lx、/music 精确入口保留全局 Basic
    fastify.get(ADMIN_PREFIX, {config: {auth: 'public'}}, async (req, reply) => {
        reply.redirect(ADMIN_PREFIX + '/', 302);
    });

    // 在线状态探测
    fastify.get(LX_PREFIX + '/status', {config: {auth: 'public'}}, async (req, reply) => {
        const online = await isLxOnline();
        return reply.send({ online, host: LX_HOST, port: LX_PORT });
    });

    // /admin/* 后台管理控制台（转发到 lxserver /admin）
    fastify.all(ADMIN_PREFIX + '/*', {config: {auth: 'public'}}, async (req, reply) => {
        const rawUrl = req.raw.url || '';
        const rest = rawUrl.startsWith(ADMIN_PREFIX) ? rawUrl.slice(ADMIN_PREFIX.length) : rawUrl;
        proxyToLx(req, reply, adminTarget(rest), 'admin', ADMIN_PREFIX);
    });

    // /lx/* Web 播放器（转发到 lxserver 根路径 /）
    fastify.all(LX_PREFIX + '/*', {config: {auth: 'public'}}, async (req, reply) => {
        const rawUrl = req.raw.url || '';
        const rest = rawUrl.startsWith(LX_PREFIX) ? rawUrl.slice(LX_PREFIX.length) : rawUrl;
        proxyToLx(req, reply, playerTarget(rest), 'player', LX_PREFIX);
    });

    // 旧 /music 入口兼容重定向到 /lx（Web 播放器已迁移到根路径）
    fastify.get('/music', async (req, reply) => {
        reply.redirect(LX_PREFIX + '/', 302);
    });
    fastify.all('/music/*', {config: {auth: 'public'}}, async (req, reply) => {
        const rawUrl = req.raw.url || '';
        const rest = rawUrl.startsWith('/music') ? rawUrl.slice('/music'.length) : rawUrl;
        reply.redirect(LX_PREFIX + (rest || '/'), 302);
    });

    // WebSocket 升级代理（用于同步功能）
    function wsUpgradeHandler(req, socket, head) {
        const url = req.url || '';
        if (!url.startsWith(LX_PREFIX + '/') && url !== LX_PREFIX &&
            !url.startsWith(ADMIN_PREFIX + '/') && url !== ADMIN_PREFIX) return;

        let target;
        if (url.startsWith(ADMIN_PREFIX + '/') || url === ADMIN_PREFIX) {
            const rest = url.startsWith(ADMIN_PREFIX) ? url.slice(ADMIN_PREFIX.length) : '';
            target = adminTarget(rest);
        } else {
            const rest = url.startsWith(LX_PREFIX) ? url.slice(LX_PREFIX.length) : '';
            target = playerTarget(rest);
        }
        const path = target.startsWith('/') ? target : '/' + target;

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
