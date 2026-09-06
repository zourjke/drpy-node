import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
    isWritableCreatePath,
    isProtectedPath,
    isEditablePath,
    isDeletablePath,
} from '../../utils/filePolicy.js';

test('isWritableCreatePath: config/json 两类目录（根目录不开放）', () => {
    assert.equal(isWritableCreatePath('config/zz.js'), true);
    assert.equal(isWritableCreatePath('config/sub/zz.json'), true); // config 递归
    assert.equal(isWritableCreatePath('json/zz.json'), true);
    assert.equal(isWritableCreatePath('json/sub/zz.json'), true); // json 递归
    assert.equal(isWritableCreatePath('zz-root.json'), false); // 根目录不开放
});

test('isWritableCreatePath: 托管目录内类型扩展（json|js|txt|m3u|conf）', () => {
    assert.equal(isWritableCreatePath('config/zz.txt'), true);
    assert.equal(isWritableCreatePath('config/zz.conf'), true);
    assert.equal(isWritableCreatePath('json/zz.txt'), true);
});

test('isWritableCreatePath: 白名单外与非法类型拒绝', () => {
    assert.equal(isWritableCreatePath('spider/js/xx.js'), false);
    assert.equal(isWritableCreatePath('controllers/xx.js'), false);
    assert.equal(isWritableCreatePath('json/zz.m3u8'), false);
    assert.equal(isWritableCreatePath('../zz.json'), false);
});

test('isWritableCreatePath/isEditablePath: conf 类型支持', () => {
    assert.equal(isWritableCreatePath('config/zz.conf'), true);
    assert.equal(isWritableCreatePath('json/xx.conf'), true);
    assert.equal(isWritableCreatePath('zz.conf'), false); // 根目录不开放
    // 框架 parses.conf：禁删但可编辑（conf 豁免）
    assert.equal(isDeletablePath('config/parses.conf'), false);
    assert.equal(isEditablePath('config/parses.conf'), true);
});

test('isProtectedPath: 框架自带文件全命中', () => {
    assert.equal(isProtectedPath('package.json'), true);
    assert.equal(isProtectedPath('vercel.json'), true);
    assert.equal(isProtectedPath('config/player.json'), true);
    assert.equal(isProtectedPath('config/env.json'), true);
    assert.equal(isProtectedPath('config/map.txt'), true);
    assert.equal(isProtectedPath('json/alist.json'), true);
    assert.equal(isProtectedPath('json/tv/live_cntv.txt'), true);
    assert.equal(isProtectedPath('json/采集[密]静态.json'), true);
    assert.equal(isProtectedPath('config/zz-test.json'), false);
    assert.equal(isProtectedPath('json/zz-user.json'), false);
});

test('isEditablePath: json/ 框架只读、自建可改；config/根目录保护不禁改', () => {
    // json/ 框架 json 只读
    assert.equal(isEditablePath('json/alist.json'), false);
    assert.equal(isEditablePath('json/采集[密]静态.json'), false);
    // .txt / .m3u 数据文件全局可编辑（含 json/ 框架文件）
    assert.equal(isEditablePath('json/tv/live_cntv.txt'), true);
    assert.equal(isEditablePath('json/mv/电影天堂.txt'), true);
    assert.equal(isEditablePath('json/tv/ipv6.m3u'), true);
    // json/ 自建可改
    assert.equal(isEditablePath('json/zz-user.json'), true);
    // config 框架 json 保护仅禁删，可改
    assert.equal(isEditablePath('config/player.json'), true);
    assert.equal(isEditablePath('config/env.json'), true);
    // 根目录退出托管：package.json 等彻底只读
    assert.equal(isEditablePath('package.json'), false);
    // 白名单外不可编辑
    assert.equal(isEditablePath('spider/js/热门推荐.js'), false);
});

test('isDeletablePath: 用户自建可删、框架/保护文件禁删', () => {
    assert.equal(isDeletablePath('config/zz-test.json'), true);
    assert.equal(isDeletablePath('json/zz-user.json'), true);
    assert.equal(isDeletablePath('index.json'), false); // 根目录退出托管，缓存不可删（/config 每次自动覆盖重建）
    assert.equal(isDeletablePath('package.json'), false);
    assert.equal(isDeletablePath('config/player.json'), false);
    assert.equal(isDeletablePath('json/alist.json'), false);
    assert.equal(isDeletablePath('spider/js/热门推荐.js'), false); // 源删除走专用接口
    assert.equal(isDeletablePath('zz-root.json'), false); // 根目录不开放
});
