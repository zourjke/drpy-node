import {test, beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {imageManager} from '../../utils/imageManager.js';

const PNG = (n = 8) => `data:image/png;base64,${'A'.repeat(n)}`;

beforeEach(() => {
    imageManager.images.clear();
    imageManager._lastCleanAt = 0;
});

test('存储后可按 id 读取，返回地址与元信息', () => {
    const ret = imageManager.storeImage('a1', PNG());
    assert.equal(ret.imageId, 'a1');
    assert.equal(ret.imageUrl, '/image/a1');
    assert.equal(ret.mimeType, 'png');
    const got = imageManager.getImage('a1');
    assert.ok(got && got.data.startsWith('data:image/png'));
});

test('非法 base64 / 空参数被拒绝', () => {
    assert.throws(() => imageManager.storeImage('', PNG()));
    assert.throws(() => imageManager.storeImage('x', ''));
    assert.throws(() => imageManager.storeImage('x', 'not-base64'));
});

test('cleanExpiredImages 按 maxAge 清理过期项', () => {
    imageManager.storeImage('b1', PNG());
    imageManager.storeImage('b2', PNG());
    // 同毫秒写入时 now-ts==0，把两张图的时间戳拨回两小时前模拟过期
    for (const info of imageManager.images.values()) {
        info.timestamp = Date.now() - 2 * 60 * 60 * 1000;
    }
    const n = imageManager.cleanExpiredImages(60 * 60 * 1000);
    assert.equal(n, 2);
    assert.equal(imageManager.getImage('b1'), null);
});

test('storeImage 惰性触发过期清理：预置旧图会在下一次上传时被清走', () => {
    // 预置一张"24h 前"的过期图
    imageManager.images.set('old', {data: PNG(), timestamp: Date.now() - 25 * 60 * 60 * 1000, size: 10, mimeType: 'png'});
    imageManager._lastCleanAt = 0; // 允许触发惰性清理
    imageManager.storeImage('new', PNG());
    assert.equal(imageManager.getImage('old'), null, '过期图应被惰性清理');
    assert.ok(imageManager.getImage('new'), '新图不受影响');
});

test('惰性清理有节流间隔：连续上传不会每次都全表扫描', () => {
    imageManager._lastCleanAt = Date.now(); // 刚清理过
    imageManager.images.set('stale', {data: PNG(), timestamp: Date.now() - 48 * 60 * 60 * 1000, size: 10, mimeType: 'png'});
    imageManager.storeImage('fresh', PNG());
    assert.ok(imageManager.getImage('stale'), '节流窗口内不应触发扫描');
});

test('getMemoryUsage 统计正确', () => {
    imageManager.storeImage('m1', PNG(100));
    const usage = imageManager.getMemoryUsage();
    assert.equal(usage.imageCount, 1);
    assert.ok(usage.totalSize >= 100);
});
