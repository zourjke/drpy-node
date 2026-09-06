import {test} from 'node:test';
import assert from 'node:assert/strict';
import {safePath, findBlacklistedItem, DEFAULT_PATH_BLACKLIST} from '../../utils/pathGuard.js';

test('普通相对路径允许', () => {
    assert.equal(safePath('spider/js/test.js'), true);
    assert.equal(safePath('config/env.json'), true);
});

test('空值与非字符串拒绝', () => {
    assert.equal(safePath(''), false);
    assert.equal(safePath(null), false);
    assert.equal(safePath(undefined), false);
    assert.equal(safePath(123), false);
});

test('绝对路径一律拒绝（与原 isSafePath 对拍）', () => {
    assert.equal(safePath('E:/gitwork/drpy-node/.env'), false);
    if (process.platform !== 'win32') {
        assert.equal(safePath('/etc/passwd'), false);
    }
});

test('../ 穿越出项目根被拒绝', () => {
    assert.equal(safePath('../../etc/passwd'), false);
    assert.equal(safePath('spider/../../.env'), false);
});

test('默认黑名单命中拒绝', () => {
    assert.equal(safePath('.env'), false);
    assert.equal(safePath('node_modules/pkg/index.js'), false);
    assert.equal(safePath('database.db'), false);
    assert.equal(safePath('.git/config'), false);
});

test('自定义黑名单可扩展（filesController 场景）', () => {
    const bl = [...DEFAULT_PATH_BLACKLIST, 'package-lock.json', 'yarn.lock'];
    assert.equal(safePath('package-lock.json', {blacklist: bl}), false);
    assert.equal(safePath('src/index.js', {blacklist: bl}), true);
});

test('findBlacklistedItem 返回命中的名单项，供拒绝提示区分原因', () => {
    const bl = [...DEFAULT_PATH_BLACKLIST, 'package-lock.json', 'yarn.lock'];
    assert.equal(findBlacklistedItem('.env', bl), '.env');
    assert.equal(findBlacklistedItem('yarn.lock', bl), 'yarn.lock');
    assert.equal(findBlacklistedItem('config/env.json', bl), null);
    // 路径本身无效（非字符串/绝对路径/穿越）时返回 null，不误报为受保护
    assert.equal(findBlacklistedItem(null, bl), null);
    assert.equal(findBlacklistedItem('E:/x/.env', bl), null);
    assert.equal(findBlacklistedItem('../.env', bl), null);
});
