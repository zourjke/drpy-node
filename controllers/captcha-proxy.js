/**
 * captcha-bypass 插件透明代理
 *
 * 让 drpys 的源无需感知插件端口，直接请求 drpys 主服务同端口完成验证码识别：
 * - POST /captcha/ocr|detect|rotate|slide → 透传插件同名接口
 * - GET  /captcha/health                 → 透传插件健康检查
 * - GET  /captcha/status                 → 本地探测：插件是否安装/运行及转发端口
 *
 * 可用性按插件名判定（不探测端口）：
 * - 未安装 / 未运行 → 503 明确提示；转发目标端口从插件 env.PORT 动态发现（缺省 7788）
 */

import {logError} from '../utils/log.js';
import http from 'http';
import { getPluginsConfig } from '../utils/pluginManager.js';
import { getRuntimeStatus } from '../utils/pluginRegistry.js';

const PLUGIN_NAME = 'captcha-bypass';
const DEFAULT_PORT = 7788;
const UPSTREAM_TIMEOUT = 60000; // OCR 推理可能到秒级，比 lx-proxy 的 30s 放宽

/**
 * 解析转发目标（纯函数，便于单测）
 * @returns {{ok:true, port:number, installed:boolean, running:boolean}
 *   | {ok:false, code:number, installed:boolean, running:boolean, message:string}}
 */
export function resolveCaptchaTarget(plugins, runtime) {
    const plugin = (plugins ?? getPluginsConfig()).find(p => p.name === PLUGIN_NAME);
    if (!plugin) {
        return {
            ok: false, code: 503, installed: false, running: false,
            message: `插件 ${PLUGIN_NAME} 未安装，请到后台管理-插件市场安装`,
        };
    }
    const running = !!(runtime ?? getRuntimeStatus())[PLUGIN_NAME]?.running;
    if (!running) {
        return {
            ok: false, code: 503, installed: true, running: false,
            message: `插件 ${PLUGIN_NAME} 未运行，请到后台管理-插件管理启动`,
        };
    }
    const port = parseInt(plugin.env?.PORT, 10);
    return {
        ok: true, installed: true, running: true,
        port: Number.isFinite(port) && port > 0 ? port : DEFAULT_PORT,
    };
}

/**
 * 透传请求到插件（hijack + pipe，JSON 与原始 body 均支持）
 */
function proxyCaptcha(req, reply, target, subPath) {
    const path = subPath.startsWith('/') ? subPath : '/' + subPath;

    const headers = { ...req.headers };
    delete headers.host;
    delete headers['content-length'];
    delete headers.authorization; // drpys 凭证对插件无意义

    // fastify 已解析 body，按原始 content-type 重组转发体
    let bodyBuf = null;
    if (req.body !== undefined && req.body !== null) {
        const contentType = (headers['content-type'] || '').toLowerCase();
        if (Buffer.isBuffer(req.body)) {
            if (req.body.length > 0) bodyBuf = req.body;
        } else if (typeof req.body === 'string') {
            bodyBuf = Buffer.from(req.body);
        } else {
            // JSON 或表单对象：统一回退 JSON 序列化（captcha-bypass 仅接受 JSON/form-data，
            // form-data 场景 contentTypeParser 已按 buffer 透传，不会走到这里）
            bodyBuf = Buffer.from(JSON.stringify(req.body));
        }
        if (bodyBuf) headers['content-length'] = bodyBuf.length;
    }

    reply.hijack();

    const proxyReq = http.request(
        { host: '127.0.0.1', port: target.port, path, method: req.method, headers, timeout: UPSTREAM_TIMEOUT },
        (proxyRes) => {
            const respHeaders = { ...proxyRes.headers };
            const onClientClose = () => proxyRes.destroy();
            reply.raw.on('close', onClientClose);
            reply.raw.writeHead(proxyRes.statusCode || 200, respHeaders);
            proxyRes.pipe(reply.raw);
            const cleanup = () => reply.raw.removeListener('close', onClientClose);
            proxyRes.on('end', cleanup);
            proxyRes.on('error', () => {
                cleanup();
                if (!reply.raw.headersSent) {
                    reply.raw.writeHead(502, { 'content-type': 'application/json; charset=utf-8' });
                    reply.raw.end(JSON.stringify({ code: -1, msg: 'captcha-bypass 上游响应错误' }));
                }
            });
        }
    );

    proxyReq.on('timeout', () => {
        proxyReq.destroy();
        if (!reply.raw.headersSent) {
            reply.raw.writeHead(504, { 'content-type': 'application/json; charset=utf-8' });
            reply.raw.end(JSON.stringify({ code: -1, msg: `captcha-bypass 上游响应超时 (${UPSTREAM_TIMEOUT / 1000}s)` }));
        }
    });

    proxyReq.on('error', (err) => {
        logError(`[captcha-proxy] 转发失败 (127.0.0.1:${target.port}${path}):`, err.message);
        if (!reply.raw.headersSent) {
            reply.raw.writeHead(502, {
                'content-type': 'application/json; charset=utf-8',
            });
            reply.raw.end(JSON.stringify({
                code: -1,
                msg: `插件 ${PLUGIN_NAME} 进程不可达（可能已僵死，请到插件管理重启）: ${err.message}`,
            }));
        }
    });

    // 监听连接级 close（POST body 被 fastify 消费后 IncomingMessage 'close' 即触发，
    // 会误杀转发中的上游请求，故不能用 req.raw.on('close')）
    const onReqAbort = () => proxyReq.destroy();
    req.raw.socket.on('close', onReqAbort);
    proxyReq.on('close', () => req.raw.socket.removeListener('close', onReqAbort));

    if (bodyBuf) proxyReq.end(bodyBuf);
    else proxyReq.end();
}

export default (fastify, options, done) => {
    // 未声明的 Content-Type（如 multipart）按 buffer 透传，仅作用于本控制器封装的路由
    try {
        fastify.addContentTypeParser('*', { parseAs: 'buffer' }, (req, body, cb) => cb(null, body));
    } catch (_) {}

    // 本地状态探测：源可据此判断是否走本代
    fastify.get('/captcha/status', {
        schema: {
            tags: ['验证码代理'],
            summary: 'drpys 本地探测代理可用性',
            description: '按插件名判定（不探测端口）：返回 {ok, installed, running, port}，不可用时附 message。',
            security: [],
        },
    }, async () => {
        const t = resolveCaptchaTarget();
        return t.ok
            ? { ok: true, installed: true, running: true, port: t.port }
            : { ok: false, installed: t.installed, running: t.running, message: t.message };
    });

    // 通配透传 /captcha/*（ocr / detect / rotate / slide / health 等），路径原样保留：
    // 源只需把 host:port 换成 drpys 主服务，路径与直连插件完全一致
    fastify.all('/captcha/*', {
        schema: {
            tags: ['验证码代理'],
            summary: '验证码识别透传（ocr/detect/rotate/slide/health）',
            description: '路径原样透传给 captcha-bypass 插件；插件未安装或未运行时返回 503。各子接口的请求体见 /captcha/ocr 等文档条目。',
            security: [],
            params: {type: 'object', properties: {'*': {type: 'string', description: '插件子路径，如 ocr、detect、rotate、slide、health'}}, required: ['*']},
        },
    }, async (req, reply) => {
        const target = resolveCaptchaTarget();
        if (!target.ok) {
            return reply.code(target.code).send({ code: -1, msg: target.message });
        }
        proxyCaptcha(req, reply, target, req.raw.url || '/');
    });

    done();
};
