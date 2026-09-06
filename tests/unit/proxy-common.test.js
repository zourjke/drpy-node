import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rewriteM3u8, parseRangeHeader} from '../../utils/proxy-common.js';

const M3U8 = [
    '#EXTM3U',
    '#EXT-X-VERSION:3',
    '',
    'seg-001.ts',
    'https://cdn.example.com/abs/seg-002.ts',
    './sub/index.m3u8',
].join('\n');

test('注释与空行原样保留，分片转代理链接', () => {
    const out = rewriteM3u8(M3U8, {
        baseUrl: 'https://live.example.com/path/play.m3u8',
        endpoint: 'http://h/m3u8-proxy/ts',
        authCode: 'AUTH',
    });
    const lines = out.split('\n');
    assert.equal(lines[0], '#EXTM3U');
    assert.equal(lines[1], '#EXT-X-VERSION:3');
    assert.equal(lines[2], '');
    assert.equal(
        lines[3],
        `http://h/m3u8-proxy/ts?url=${encodeURIComponent('https://live.example.com/path/seg-001.ts')}&auth=AUTH`
    );
    assert.equal(
        lines[4],
        `http://h/m3u8-proxy/ts?url=${encodeURIComponent('https://cdn.example.com/abs/seg-002.ts')}&auth=AUTH`
    );
});

test('headersParam 追加编码后的 headers 参数', () => {
    const out = rewriteM3u8(M3U8, {
        baseUrl: 'https://l.com/a.m3u8',
        endpoint: 'http://h/unified-proxy/proxy',
        authCode: 'A',
        headersParam: '{"Referer":"x"}',
    });
    for (const l of out.split('\n').slice(3)) {
        assert.ok(l.endsWith(`&headers=${encodeURIComponent('{"Referer":"x"}')}`));
    }
});

test('非法相对行保留原文不中断处理', () => {
    const bad = 'ht!tp://broken %%%\nhttps://ok.com/s.ts';
    const out = rewriteM3u8(bad, {
        baseUrl: '%invalid%base%', // baseUrl 也非法 → new URL 抛错
        endpoint: 'http://h/ts',
        authCode: 'A',
    });
    const lines = out.split('\n');
    assert.equal(lines[0], 'ht!tp://broken %%%', '解析失败的行保留原文');
    assert.ok(lines[1].startsWith('http://h/ts?'), '后续行继续处理');
});

test('parseRangeHeader：无头返回 null、带 end 与开放 end', () => {
    assert.deepEqual(parseRangeHeader(undefined, 1000), null);
    assert.deepEqual(parseRangeHeader(null, 1000), null);
    assert.deepEqual(parseRangeHeader('bytes=0-99', 1000), {start: 0, end: 99});
    assert.deepEqual(parseRangeHeader('bytes=500-', 1000), {start: 500, end: 999});
});
