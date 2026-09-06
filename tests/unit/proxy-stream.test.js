import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {execFile} from 'node:child_process';
import Fastify from 'fastify';
import {proxyStreamMedia} from '../../controllers/mediaProxy.js';
import {assertNoTimerLeak} from '../helpers/timers.js';

// toBytes=3 内联流式分支（api.js /proxy 路由复用 proxyStreamMedia）的行为回归：
// Range/206、全量 200、客户端断连向上游传播、无 timer 泄露。
// 内存 O(1) 属集成观测项（1GB 实流），单元层以功能正确性为准。

const SIZE = 5 * 1024 * 1024; // 5MB 顺序字节流
const bigBuf = Buffer.alloc(SIZE);
for (let i = 0; i < SIZE; i++) bigBuf[i] = i % 251;

let stub;
let stubActive = 0;

test.before(async () => {
    // 上游桩：支持 Range 的字节流服务
    stub = http.createServer((req, res) => {
        stubActive++;
        res.on('close', () => {
            stubActive--;
        });
        const range = req.headers.range;
        if (range) {
            const m = range.match(/bytes=(\d+)-(\d*)/);
            const start = parseInt(m[1], 10);
            const end = m[2] ? Math.min(parseInt(m[2], 10), SIZE - 1) : SIZE - 1;
            res.writeHead(206, {
                'content-type': 'video/mp4',
                'content-range': `bytes ${start}-${end}/${SIZE}`,
                'content-length': end - start + 1,
                'accept-ranges': 'bytes',
            });
            res.end(bigBuf.subarray(start, end + 1));
            return;
        }
        res.writeHead(200, {'content-type': 'video/mp4', 'content-length': SIZE});
        // 分片写入，验证真正的流式转发
        let off = 0;
        const timer = setInterval(() => {
            if (off >= SIZE || res.destroyed) {
                clearInterval(timer);
                res.end();
                return;
            }
            const chunk = bigBuf.subarray(off, Math.min(off + 256 * 1024, SIZE));
            off += chunk.length;
            res.write(chunk);
        }, 5);
    });
    await new Promise((r) => stub.listen(0, '127.0.0.1', r));

    // 被测端点：真实 fastify 实例（proxyStreamMedia 直接操作 reply.raw，需真实 socket）
    const app = Fastify({logger: false});
    app.get('/proxy-inline', (request, reply) =>
        proxyStreamMedia(`http://127.0.0.1:${stub.address().port}/file`, {}, request, reply, 0)
    );
    await new Promise((r) => app.listen({port: 0, host: '127.0.0.1'}, r));
    globalThis.__psApp = app;
    globalThis.__psPort = app.server.address().port;
});

test.after(async () => {
    await globalThis.__psApp?.close();
    await new Promise((r) => stub.close(r));
});

const inlineURL = (suffix = '') => `http://127.0.0.1:${globalThis.__psPort}/proxy-inline${suffix}`;

test('全量请求：200 且字节一致', async () => {
    const res = await fetch(inlineURL());
    assert.equal(res.status, 200);
    const body = Buffer.from(await res.arrayBuffer());
    assert.equal(body.length, SIZE);
    assert.ok(body.equals(bigBuf));
});

test('Range 请求：透传上游 206 与 Content-Range，字节区间正确', async () => {
    const res = await fetch(inlineURL(), {headers: {range: 'bytes=1000-1999'}});
    assert.equal(res.status, 206);
    assert.equal(res.headers.get('content-range'), `bytes 1000-1999/${SIZE}`);
    const body = Buffer.from(await res.arrayBuffer());
    assert.equal(body.length, 1000);
    assert.ok(body.equals(bigBuf.subarray(1000, 2000)));
});

test('客户端中途断连：上游流被销毁，桩连接归零', async () => {
    const ac = new AbortController();
    const res = await fetch(inlineURL(), {signal: ac.signal});
    assert.equal(res.status, 200);
    const reader = res.body.getReader();
    await reader.read(); // 消费首块后断开
    ac.abort();
    await new Promise((r) => setTimeout(r, 300));
    assert.ok(stubActive <= 0, `上游桩应无残留连接，实际 ${stubActive}`);
});

test('流式转发不遗留 pending timer', async () => {
    await assertNoTimerLeak(async () => {
        const res = await fetch(inlineURL(), {headers: {range: 'bytes=0-1023'}});
        await res.arrayBuffer();
    }, 'proxyStreamMedia Range');
});
