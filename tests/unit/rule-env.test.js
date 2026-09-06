import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRuleEnvContext} from '../../utils/rule-env.js';

function fakeRequest({proto, host = '192.168.1.5:5757'} = {}) {
    return {
        headers: proto ? {'x-forwarded-proto': proto} : {},
        socket: {encrypted: false},
        hostname: host,
        url: '/parse/测试解析?do=ds',
    };
}

const fakeOptions = {PORT: 5757, WsPORT: 57575, wsApp: {server: {marker: 'ws-server'}}};

test('默认拼接 /proxy/<module> 模板并带 ext 编码', () => {
    const ctx = createRuleEnvContext(fakeRequest(), fakeOptions, {}, 'a=b&c');
    const env = ctx.getEnv('某源');
    assert.equal(env.proxyUrl, `http://192.168.1.5:5757/proxy/某源/?do=ds&extend=${encodeURIComponent('a=b&c')}`);
    assert.equal(env.getProxyUrl(), env.proxyUrl);
    assert.equal(env.ext, 'a=b&c');
});

test('query.do 优先于默认 ds', () => {
    const ctx = createRuleEnvContext(fakeRequest(), fakeOptions, {do: 'cat'}, '');
    assert.ok(ctx.getEnv('m').proxyUrl.includes('?do=cat'));
});

test('x-forwarded-proto 与 wsName/wsScheme/fServer 字段', () => {
    const ctx = createRuleEnvContext(fakeRequest({proto: 'https', host: 'demo.com'}), fakeOptions, {}, '');
    const env = ctx.getEnv('m');
    assert.ok(env.requestHost.startsWith('https://'));
    // 弹幕 WS 合并到主服务：wsName 即请求 hostname（不再替换为 WsPORT）
    assert.equal(env.wsName, 'demo.com');
    // https 请求 → 弹幕走 wss
    assert.equal(env.wsScheme, 'wss');
    // fServer 兜底链：options.fastify 缺失时回落 wsApp.server
    assert.deepEqual(env.fServer, {marker: 'ws-server'});
    assert.equal(env.hostUrl, 'demo.com');
});

test('EXTERNAL_PROTOCOL 环境变量优先于转发头', () => {
    process.env.EXTERNAL_PROTOCOL = 'https';
    try {
        const ctx = createRuleEnvContext(fakeRequest(), fakeOptions, {}, '');
        assert.ok(ctx.getEnv('m').requestHost.startsWith('https://'));
    } finally {
        delete process.env.EXTERNAL_PROTOCOL;
    }
});

test('proxyUrl 覆写与 extra 注入（/parse 路由场景）', () => {
    const ctx = createRuleEnvContext(fakeRequest(), fakeOptions, {do: 'ds'}, '');
    const custom = 'http://h/proxy/jx0/?do=ds&extend=';
    const env = ctx.getEnv('', {
        proxyUrl: custom,
        extra: {proxyPath: 'sub/path'},
    });
    assert.equal(env.proxyUrl, custom);
    assert.equal(env.proxyPath, 'sub/path');
});
