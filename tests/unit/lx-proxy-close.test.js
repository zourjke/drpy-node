import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import fastify from 'fastify';

// 回归背景：Node 16+ 中 IncomingMessage 的 'close' 语义改为「消息完成」而非「连接关闭」。
// lx-proxy 曾监听 req.raw 'close' 来探测客户端断开，导致带 body 的 POST 在 fastify
// 消费完 body 后立即触发 close，转发中途误杀上游请求（502 socket hang up）。
// 修复后改监听 req.raw.socket（连接级 close）。
// 注意：必须走真实 TCP（listen + http.request）才能复现该时序，app.inject() 不经过
// 底层 socket，无法触发 req.raw 的 close 生命周期。

process.env.LX_PORT = '19527'; // 必须在动态 import 前设置，模块加载时固化
const {default: lxProxy} = await import('../../controllers/lx-proxy.js');

async function startStack(t, upstreamHandler) {
    http.globalAgent.destroy(); // 清掉上个用例遗留的 keep-alive socket，避免 ECONNRESET
    const upstream = http.createServer(upstreamHandler);
    await new Promise((r) => upstream.listen(19527, r));
    const app = fastify();
    app.register(lxProxy);
    await app.listen({port: 0, host: '127.0.0.1'});
    t.after(() => Promise.allSettled([app.close(), upstream.close()]));
    const port = app.server.address().port;
    // 发真实 TCP 请求到代理，返回上游响应
    return ({path, method, body}) =>
        new Promise((resolve, reject) => {
            const headers = body
                ? {'content-type': 'application/json', 'content-length': Buffer.byteLength(body)}
                : {};
            const r = http.request({host: '127.0.0.1', port, path, method, headers}, resolve);
            r.on('error', reject);
            r.end(body);
        });
}

async function readBody(res) {
    let body = '';
    for await (const c of res) body += c;
    return body;
}

test('lx-proxy：带 body 的 POST 转发不被 req close 误杀', async (t) => {
    const seen = [];
    const send = await startStack(t, (rq, rs) => {
        let body = '';
        rq.on('data', (c) => (body += c));
        rq.on('end', () => {
            seen.push({method: rq.method, url: rq.url, body});
            rs.writeHead(200, {'content-type': 'application/json'});
            rs.end(JSON.stringify({success: true}));
        });
    });

    const res = await send({path: '/lx/api/login', method: 'POST', body: '{"password":"123456"}'});
    const body = await readBody(res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(body), {success: true});
    assert.deepEqual(seen, [{method: 'POST', url: '/api/login', body: '{"password":"123456"}'}]);
});

test('lx-proxy：无 body 的 GET 转发正常', async (t) => {
    const seen = [];
    const send = await startStack(t, (rq, rs) => {
        seen.push({method: rq.method, url: rq.url});
        rs.writeHead(200, {'content-type': 'text/plain'});
        rs.end('ok');
    });

    const res = await send({path: '/lx/index.html', method: 'GET'});
    await readBody(res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(seen, [{method: 'GET', url: '/index.html'}]);
});

// 回归背景：filemanager.html 的内联脚本里 elFinder connector 写的是根绝对路径
// '/api/elfinder/connector'，lx 模式此前只重写 HTML 属性与外部 JS，内联脚本漏网，
// 导致经代理访问时请求落到主服务自身路由上 404。
test('lx-proxy：lx 模式 HTML 内联脚本中的 /api/ 加代理前缀', async (t) => {
    const send = await startStack(t, (rq, rs) => {
        rs.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
        rs.end(`<html><body><script>
            var cfg = { url: '/api/elfinder/connector?auth=x' };
            document.write('<a href="/api/other">l</a>');
        </script></body></html>`);
    });

    const res = await send({path: '/lx/filemanager.html', method: 'GET'});
    const body = await readBody(res);

    assert.equal(res.statusCode, 200);
    assert.match(body, /['"`]\/lx\/api\/elfinder\/connector/);
    // HTML 属性重写仍生效，二者互不影响
    assert.match(body, /href="\/lx\/api\/other"/);
});
