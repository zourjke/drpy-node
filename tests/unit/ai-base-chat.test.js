import {test, beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import Kimi from '../../utils/ai/Kimi.js';
import DeepSeek from '../../utils/ai/DeepSeek.js';
import SparkAI from '../../utils/ai/SparkAI.js';

// 本地 OpenAI 兼容桩服务：覆盖 ask() 的成功与错误路径
let stub;
let lastAuth = '';
let stubPayload;

test.before(async () => {
    stub = http.createServer((req, res) => {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
            lastAuth = req.headers.authorization || '';
            try {
                stubPayload = JSON.parse(body);
            } catch {
                stubPayload = {};
            }
            const respond = (code, obj) => {
                res.writeHead(code, {'content-type': 'application/json'});
                res.end(JSON.stringify(obj));
            };
            if (!lastAuth.startsWith('Bearer ')) {
                return respond(401, {error: {message: 'unauthorized'}});
            }
            if ((stubPayload.model || '').startsWith('fail')) {
                return respond(500, {error: {message: 'boom'}});
            }
            if (stubPayload.model === 'empty') {
                // 无 choices 分支
                return respond(200, {});
            }
            respond(200, {
                choices: [{message: {role: 'assistant', content: `echo:${stubPayload.messages.at(-1).content}`}}]
            });
        });
    });
    await new Promise((r) => stub.listen(0, '127.0.0.1', r));
    globalThis.__stubPort = stub.address().port;
});

test.after(() => new Promise((r) => stub.close(r)));

const stubURL = () => `http://127.0.0.1:${globalThis.__stubPort}`;

beforeEach(() => {
    lastAuth = '';
    stubPayload = null;
});

test('三个渠道默认参数正确', () => {
    assert.equal(new Kimi({apiKey: 'k'}).baseURL, 'https://api.moonshot.cn/v1');
    assert.equal(new DeepSeek({apiKey: 'k'}).baseURL, 'https://api.deepseek.com');
    assert.equal(new SparkAI({authKey: 'k'}).baseURL, 'https://spark-api-open.xf-yun.com');

    const spark = new SparkAI({authKey: 'k1'});
    assert.equal(spark.authKey, 'k1'); // 旧属性名兼容
    assert.equal(spark.apiKey, 'k1');
});

test('缺失密钥抛错（三渠道契约一致）', () => {
    for (const Cls of [Kimi, DeepSeek]) {
        assert.throws(() => new Cls({}), /Missing required configuration parameters\./);
    }
    assert.throws(() => new SparkAI({}), /Missing required configuration parameters\./);
});

test('ask 正常往返：Bearer 认证 + 上下文注入 + 回答写入历史', async () => {
    const ai = new Kimi({apiKey: 'key-1', baseURL: stubURL()});
    const answer = await ai.ask('u1', '你好');
    assert.equal(answer, 'echo:你好');
    assert.equal(lastAuth, 'Bearer key-1');
    assert.equal(stubPayload.model, 'moonshot-v1-8k');
    // system + user(已随请求发出但未入库) → assistant 已写入，user 消息在响应后才入库？
    // 原实现行为：请求时 concat user，不入库；响应后仅写 assistant —— 保持一致
    const history = ai.userContexts['u1'];
    assert.equal(history[0].role, 'system');
    assert.equal(history.at(-1).content, 'echo:你好');
});

test('上下文裁剪：超过 20 条保留 system + 最近 19 条', async () => {
    const ai = new DeepSeek({apiKey: 'key-2', baseURL: stubURL()});
    await ai.ask('u2', 'q0');
    for (let i = 1; i <= 30; i++) {
        await ai.ask('u2', `q${i}`);
    }
    const h = ai.userContexts['u2'];
    assert.ok(h.length <= 20, `history length ${h.length}`);
    assert.equal(h[0].role, 'system', 'system 提示词必须始终位于首位');
});

test('HTTP 错误映射为 <name> API Error (<status>) 格式', async () => {
    const ai = new SparkAI({authKey: 'key-3', baseURL: stubURL()});
    await assert.rejects(
        ai.ask('u3', 'x', {model: 'fail-model'}),
        /Spark AI API Error \(500\): boom/
    );
});

test('无 choices 响应抛 Error from <name>', async () => {
    const ai = new DeepSeek({apiKey: 'key-4', baseURL: stubURL()});
    await assert.rejects(
        ai.ask('u4', 'x', {model: 'empty'}),
        /Error from DeepSeek AI/
    );
});
