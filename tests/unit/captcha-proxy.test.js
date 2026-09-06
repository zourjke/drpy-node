import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveCaptchaTarget } from '../../controllers/captcha-proxy.js';

const pluginsWith = (env) => [{ name: 'captcha-bypass', env, runtime: 'binary' }];
const running = { 'captcha-bypass': { running: true, pid: 1 } };
const stopped = {};

test('插件未安装 → 503，提示到插件市场安装', () => {
    const t = resolveCaptchaTarget([], {});
    assert.equal(t.ok, false);
    assert.equal(t.code, 503);
    assert.equal(t.installed, false);
    assert.match(t.message, /插件市场/);
});

test('已安装未运行 → 503，提示到插件管理启动', () => {
    const t = resolveCaptchaTarget(pluginsWith({ PORT: '7788' }), stopped);
    assert.equal(t.ok, false);
    assert.equal(t.code, 503);
    assert.equal(t.installed, true);
    assert.equal(t.running, false);
    assert.match(t.message, /未运行/);
});

test('运行中：端口取自插件 env.PORT', () => {
    const t = resolveCaptchaTarget(pluginsWith({ PORT: '7901' }), running);
    assert.deepEqual({ ok: t.ok, port: t.port, installed: t.installed, running: t.running }, {
        ok: true, port: 7901, installed: true, running: true,
    });
});

test('运行中：无 env.PORT 时回落默认 7788；非法值同样回落', () => {
    assert.equal(resolveCaptchaTarget(pluginsWith({}), running).port, 7788);
    assert.equal(resolveCaptchaTarget(pluginsWith({ PORT: 'abc' }), running).port, 7788);
});
