import {test} from 'node:test';
import assert from 'node:assert/strict';
import {boundedCache} from '../../utils/bounded-cache.js';

test('属性语法读写删除与 in 探测', () => {
    const c = boundedCache({});
    c['k1'] = 'v1';
    assert.equal(c['k1'], 'v1');
    assert.ok('k1' in c);
    delete c['k1'];
    assert.ok(!('k1' in c));
    assert.equal(c['k1'], undefined);
});

test('超过 max 时按 LRU 淘汰最旧条目', () => {
    const c = boundedCache({max: 3});
    c['a'] = 1;
    c['b'] = 2;
    c['c'] = 3;
    void c['a']; // 访问 a，使其变为最近使用
    c['d'] = 4;  // 应淘汰 b
    assert.equal(c['a'], 1);
    assert.equal(c['b'], undefined, 'b 应被淘汰');
    assert.equal(Object.keys(c).length, 3);
});

test('ttl 过期后读取返回 undefined', async () => {
    const c = boundedCache({max: 10, ttl: 10});
    c['x'] = 9;
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(c['x'], undefined);
});

test('Object.keys 与 delete 遍历清理兼容网盘清理逻辑', () => {
    const c = boundedCache({max: 50});
    for (let i = 0; i < 5; i++) c[`f${i}`] = i;
    for (const key of Object.keys(c)) {
        delete c[key];
    }
    assert.equal(Object.keys(c).length, 0);
});

test('新增容量上限防泄漏：写入 2000 条只保留 max 条（L11 回归）', () => {
    const c = boundedCache({max: 100});
    for (let i = 0; i < 2000; i++) {
        c[`file_${i}`] = {data: 'x'.repeat(100)};
    }
    assert.ok(Object.keys(c).length <= 100, `实际 ${Object.keys(c).length}`);
});
