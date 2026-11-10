/**
 * 出站 UTF-16 良构化测试（lone surrogate 闪退根治）
 *
 * 夹具形态对应真实事故通道：
 *   - 孤立高代理 \uD83C / 孤立低代理 \uDFF4（上游数据拼接产物）
 *   - 代理对被 substring 切开（截断逻辑产物）
 *   - JSON 文本坏转义透传（"\ud83c" 单独出现——纯 ASCII，Buffer 编码救不了）
 *   - 嵌套对象/数组深处病态串（preSerialization 深洗路径）
 *   - 合法 emoji 必须原样保留（不误伤）
 *   - Buffer 不被改动（scrubDeep）
 *   - fastify 端到端：attachSanitizeHooks 后对象/字符串两种 payload 出站全阴
 */

import {test} from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {LONE, scrubString, scrubJsonText, scrubDeep, attachSanitizeHooks} from '../../utils/sanitize-utf16.js';

// ==================== scrubString：裸 lone surrogate ====================

test('scrubString: 孤立高代理/孤立低代理被替换为 U+FFFD', () => {
    for (const sick of ['\uD83C', '前缀\uD83C后缀', '\uDFF4', '\uDC00\uD800'.slice(0, 1)]) {
        const clean = scrubString(sick);
        assert.equal(LONE.test(clean), false, `洗后仍有孤代理: ${JSON.stringify(clean)}`);
        assert.ok(clean.includes('\uFFFD'));
    }
});

test('scrubString: 合法 emoji / 全中文 / ASCII 原样保留（零替换直通）', () => {
    const ok = ['\uD83C\uDF89 合法 emoji', '普通中文标题', 'plain ascii', 'a\uDC00\uD800'.slice(0, 0) + '\uD83D\uDE00'];
    for (const s of ok) {
        assert.equal(LONE.test(s), false);
        assert.equal(scrubString(s), s);
    }
});

test('scrubString: 代理对被 substring 切开的产物洗净', () => {
    const title = '电影\uD83C\uDFAC名';
    const cut = title.substring(0, 3); // 切在高代理后 → "\u5F71\u89C6\uD83C" 含孤立高代理
    assert.equal(LONE.test(cut), true, '夹具自检：切开后应含孤代理');
    assert.equal(LONE.test(scrubString(cut)), false);
    // 未切开的完整串不受影响
    assert.equal(scrubString(title), title);
});

// ==================== scrubJsonText：转义形态坏序列（上游透传通道） ====================

test('scrubJsonText: 孤立 \\udXXX 转义改写为 \\ufffd，客户端解码后必为良构', () => {
    const raw = '{"name":"坏\\ud83c名","ok":"\uD83C\uDF89"}';
    const out = scrubJsonText(raw);
    // 转义形态孤代理清零
    assert.equal(/\\u[dD][89abABc-fC-F][0-9a-fA-F]{2}(?!\\u[dD][c-fC-F][0-9a-fA-F]{2})|(?<!\\u[dD][89abAB][0-9a-fA-F]{2})\\u[dD][c-fC-F][0-9a-fA-F]{2}/.test(out), false);
    // 合法转义对保留、JSON 仍可解析且解析后良构
    const parsed = JSON.parse(out);
    assert.equal(LONE.test(parsed.name), false);
    assert.equal(parsed.ok, '\uD83C\uDF89');
});

test('scrubJsonText: 大小写十六进制（\\uD83C / \\ud83c）与配对完整性', () => {
    for (const sick of ['{"a":"\\uD83C"}', '{"a":"\\ud83c"}', '{"a":"\\uDFF4"}', '{"a":"\\udc00单独"}']) {
        const parsed = JSON.parse(scrubJsonText(sick));
        assert.equal(LONE.test(parsed.a), false, sick);
    }
    // 完整转义对（含大小写混合写法）不误伤
    const paired = JSON.parse(scrubJsonText('{"a":"\\uD83C\\udf89"}'));
    assert.equal(paired.a, '\uD83C\uDF89');
});

test('scrubJsonText: 文本内裸孤代理与转义形态并存时双洗', () => {
    const raw = 'x\uD83Cy\ud83cz'; // 裸孤代理 + 转义孤代理混在一段文本
    const out = scrubJsonText(raw);
    assert.equal(LONE.test(out), false);
    assert.equal(/\\u[dD][89abAB][0-9a-fA-F]{2}(?![0-9a-fA-F])/.test(out.replace('\\ufffd', '')), false);
});

// ==================== scrubDeep：嵌套结构 ====================

test('scrubDeep: 嵌套对象/数组深处的病态串逐值洗净，合法内容与数值不动', () => {
    const emoji = '\uD83C\uDF89';
    const obj = {
        list: [
            {title: '坏\uD83C题', pic: 'url'},
            ['\uDFF4低代理', 42, null],
        ],
        meta: {deep: {deeper: {name: '再\uD83C深'}}},
        ok: emoji,
        n: 123,
    };
    scrubDeep(obj);
    assert.equal(LONE.test(obj.list[0].title), false);
    assert.equal(LONE.test(obj.list[1][0]), false);
    assert.equal(LONE.test(obj.meta.deep.deeper.name), false);
    assert.equal(obj.ok, emoji); // 合法 emoji 原样
    assert.equal(obj.n, 123);
    assert.equal(obj.list[1][1], 42);
});

test('scrubDeep: Buffer 原样不动（字节语义）', () => {
    const buf = Buffer.from('{"a":"\uD83C"}'); // Buffer.from 已把孤代理变 FFFD 字节
    const before = Buffer.from(buf);
    scrubDeep({data: buf, arr: [buf]});
    assert.ok(buf.equals(before));
});

test('scrubDeep: 深层嵌套不爆栈（迭代实现）', () => {
    let obj = {v: '坏\uD83C'};
    for (let i = 0; i < 5000; i++) obj = {child: obj};
    scrubDeep(obj);
    let cur = obj;
    for (let i = 0; i < 5000; i++) cur = cur.child;
    assert.equal(LONE.test(cur.v), false);
});

// ==================== fastify 端到端：attachSanitizeHooks ====================

async function buildApp() {
    const app = Fastify({logger: false});
    attachSanitizeHooks(app);
    app.get('/obj', async () => ({sites: [{name: '坏\uD83C名'}], ok: '\uD83C\uDF89'}));
    app.get('/raw', async (req, reply) => {
        reply.type('application/json');
        return reply.send('{"name":"坏\\ud83c名","ok":"\uD83C\uDF89"}');
    });
    await app.ready();
    return app;
}

test('attachSanitizeHooks: 对象 payload 出站后 JSON 良构且合法 emoji 保留', async () => {
    const app = await buildApp();
    const res = await app.inject('/obj');
    const body = res.body;
    assert.equal(LONE.test(body), false, '序列化文本不应含裸孤代理');
    const parsed = JSON.parse(body);
    assert.equal(LONE.test(parsed.sites[0].name), false);
    assert.equal(parsed.ok, '\uD83C\uDF89');
    await app.close();
});

test('attachSanitizeHooks: 字符串 payload（上游透传）坏转义被改写', async () => {
    const app = await buildApp();
    const res = await app.inject('/raw');
    const parsed = JSON.parse(res.body);
    assert.equal(LONE.test(parsed.name), false);
    assert.equal(parsed.ok, '\uD83C\uDF89');
    await app.close();
});

// ==================== 性能基准（交付口径：200KB 级真实形态响应） ====================

test('性能基准: 200KB 响应预检+清洗开销 < 1ms 量级', () => {
    // 构造 ~200KB 的 vod 列表形态 payload（干净为主 + 少量病态）
    const sites = [];
    for (let i = 0; i < 2200; i++) {
        sites.push({vod_name: `节目${i}\uD83C\uDF89标题`, vod_remarks: '第' + i + '集', vod_pic: `https://pic/img${i}.jpg`});
    }
    const dirty = JSON.parse(JSON.stringify(sites));
    dirty[3].vod_name = '坏\uD83C名';
    dirty[888].vod_name = '低\uDFF4代理';

    const t0 = process.hrtime.bigint();
    for (let i = 0; i < 50; i++) scrubDeep(sites);           // 干净路径（预检直通）
    const t1 = process.hrtime.bigint();
    for (let i = 0; i < 50; i++) scrubDeep(dirty);            // 含病态路径
    const t2 = process.hrtime.bigint();

    const cleanMs = Number(t1 - t0) / 1e6 / 50;
    const dirtyMs = Number(t2 - t1) / 1e6 / 50;
    const sizeKb = Buffer.byteLength(JSON.stringify(sites)) / 1024;
    console.log(`  [bench] ${sizeKb.toFixed(0)}KB 对象：干净 ${cleanMs.toFixed(3)}ms / 含病态 ${dirtyMs.toFixed(3)}ms 每次清洗`);
    assert.ok(cleanMs < 1, `干净响应清洗耗时 ${cleanMs}ms 应 <1ms`);
    assert.ok(dirtyMs < 1, `含病态响应清洗耗时 ${dirtyMs}ms 应 <1ms`);

    // 字符串路径（上游透传 200KB 文本）
    const text = JSON.stringify(sites).slice(0, 200 * 1024);
    const t3 = process.hrtime.bigint();
    for (let i = 0; i < 50; i++) scrubJsonText(text);
    const t4 = process.hrtime.bigint();
    const textMs = Number(t4 - t3) / 1e6 / 50;
    console.log(`  [bench] ${(Buffer.byteLength(text) / 1024).toFixed(0)}KB 文本：scrubJsonText ${textMs.toFixed(3)}ms/次`);
    assert.ok(textMs < 1, `文本清洗耗时 ${textMs}ms 应 <1ms`);
});
