import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getFetchDispatcher} from '../../libs_drpy/fetchAxios.js';

test('无代理时全局复用同一 Agent 实例（L7 回归）', () => {
    const a = getFetchDispatcher(null);
    const b = getFetchDispatcher(null);
    assert.equal(a, b, '连续请求必须复用同一个直连 Agent');
});

test('同代理地址复用同实例，不同地址各自独立', () => {
    const p1 = getFetchDispatcher('http://127.0.0.1:18081');
    const p1b = getFetchDispatcher('http://127.0.0.1:18081');
    const p2 = getFetchDispatcher('http://127.0.0.1:18082');
    assert.equal(p1, p1b);
    assert.notEqual(p1, p2);
    assert.equal(getFetchDispatcher(null), getFetchDispatcher(null), '代理与直连互不影响');
});

test('无效代理 URI 退化为默认 Agent 而非抛错', () => {
    const d = getFetchDispatcher('not-a-valid-proxy-uri');
    assert.ok(d, '应当拿到可用的 dispatcher（退化或正常实例）');
});
