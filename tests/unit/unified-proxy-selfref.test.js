import {test} from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import {isSelfReference} from '../../controllers/unified-proxy.js';

test('isSelfReference: 回环地址 + 自身端口 → 放行（源 m3u8 指向本服务 /proxy 的合法回环链）', () => {
    assert.equal(isSelfReference('127.0.0.1', 5757, 5757), true);
    assert.equal(isSelfReference('localhost', 5757, 5757), true);
    assert.equal(isSelfReference('LOCALHOST', 5757, 5757), true); // 大小写归一
    assert.equal(isSelfReference('[::1]', 5757, 5757), true);
});

test('isSelfReference: 本机网卡地址 + 自身端口 → 放行（源用局域网 IP 生成链接的场景）', () => {
    const addrs = [];
    for (const list of Object.values(os.networkInterfaces())) {
        for (const it of (list || [])) if (it && it.address) addrs.push(it.address);
    }
    const lanAddr = addrs.find(a => /^192\.168\.|^10\.|^172\.(1[6-9]|2\d|3[01])\./.test(a));
    if (lanAddr) {
        assert.equal(isSelfReference(lanAddr, 5757, 5757), true);
    }
});

test('isSelfReference: 本机地址但端口不同 → 拦截（不打开本机其他服务/端口的探测面）', () => {
    assert.equal(isSelfReference('127.0.0.1', 6379, 5757), false);
    assert.equal(isSelfReference('localhost', 80, 5757), false);
    assert.equal(isSelfReference('127.0.0.1', 443, 5757), false);
});

test('isSelfReference: 非本机地址 → 拦截（内网其他设备/公网不受放行影响）', () => {
    assert.equal(isSelfReference('192.168.31.1', 80, 5757), false);
    assert.equal(isSelfReference('10.0.0.2', 5757, 5757), false);
    assert.equal(isSelfReference('example.com', 5757, 5757), false);
    assert.equal(isSelfReference('', 5757, 5757), false);
});
