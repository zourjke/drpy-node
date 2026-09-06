import {test} from 'node:test';
import assert from 'node:assert/strict';
import AdmZip from 'adm-zip';
import {
    compareVersions,
    safeZipEntryName,
    resolveZipRoot,
    mergePluginEntry,
    removePluginEntry,
    buildDownloadUrls
} from '../../utils/pluginMarket.js';

// ==================== compareVersions ====================

test('compareVersions: 数值逐段比较，非逐字符比较', () => {
    assert.equal(compareVersions('1.0.0', '1.0.10'), -1);
    assert.equal(compareVersions('1.0.10', '1.0.2'), 1);
    assert.equal(compareVersions('2.0.0', '2.0.0'), 0);
    assert.equal(compareVersions('1.10', '1.9'), 1);
    assert.equal(compareVersions('1', '1.0.0'), 0);
    assert.equal(compareVersions('', '0.0.1'), -1);
});

// ==================== safeZipEntryName (Zip Slip) ====================

test('safeZipEntryName: 拒绝相对路径逃逸、绝对路径、盘符、NUL', () => {
    assert.equal(safeZipEntryName('../evil.js'), false);
    assert.equal(safeZipEntryName('a/../../evil.js'), false);
    assert.equal(safeZipEntryName('dir/..\\evil.js'), false);
    assert.equal(safeZipEntryName('/abs/path.js'), false);
    assert.equal(safeZipEntryName('C:\\win\\evil.js'), false);
    assert.equal(safeZipEntryName('C:/win/evil.js'), false);
    assert.equal(safeZipEntryName('good\0bad.js'), false);
    assert.equal(safeZipEntryName(''), false);
    assert.equal(safeZipEntryName(null), false);
});

test('safeZipEntryName: 正常相对路径放行', () => {
    assert.equal(safeZipEntryName('index.js'), true);
    assert.equal(safeZipEntryName('server/src/index.js'), true);
    assert.equal(safeZipEntryName('dir.name/file.txt'), true);
    assert.equal(safeZipEntryName('lx-music-sync-server/node_modules/pkg/a.js'), true);
});

// ==================== resolveZipRoot (剥壳判定) ====================

test('resolveZipRoot: 根级含 plugin.json → 无壳', () => {
    const root = resolveZipRoot(['plugin.json', 'index.js', 'lib/a.js']);
    assert.deepEqual(root, {prefix: ''});
});

test('resolveZipRoot: 单顶层目录壳 → 剥壳（lxserver 形态 B）', () => {
    const root = resolveZipRoot([
        'lx-music-sync-server/',
        'lx-music-sync-server/package.json',
        'lx-music-sync-server/index.js',
        'lx-music-sync-server/public/app.js'
    ]);
    assert.deepEqual(root, {prefix: 'lx-music-sync-server/'});
});

test('resolveZipRoot: 多顶层目录且无根级 manifest → 报错', () => {
    assert.throws(() => resolveZipRoot(['a/index.js', 'b/index.js']), /包结构无法识别/);
});

test('resolveZipRoot: 空包 → 报错', () => {
    assert.throws(() => resolveZipRoot(['empty-dir/']), /压缩包为空/);
});

// ==================== 真实 zip 端到端剥壳（AdmZip 集成） ====================

test('resolveZipRoot + AdmZip: 构造带目录壳的 zip 并剥离解压', () => {
    const zip = new AdmZip();
    zip.addFile('lx-music-sync-server/index.js', Buffer.from('console.log(1)'));
    zip.addFile('lx-music-sync-server/package.json', Buffer.from('{"name":"x"}'));
    const names = zip.getEntries().map(e => e.entryName);
    const {prefix} = resolveZipRoot(names);
    assert.equal(prefix, 'lx-music-sync-server/');

    const stripped = names
        .filter(n => !n.endsWith('/'))
        .map(n => n.slice(prefix.length));
    assert.ok(stripped.includes('index.js'));
    assert.ok(stripped.includes('package.json'));
});

// ==================== mergePluginEntry (.plugins.js 合并规则) ====================

test('mergePluginEntry: 新插件 → 追加条目，path 按约定生成', () => {
    const next = mergePluginEntry([], {name: 'lxserver', runtime: 'node', entry: 'index.js', env: {PORT: '9527'}}, true);
    assert.equal(next.length, 1);
    assert.deepEqual(next[0], {
        name: 'lxserver',
        path: 'plugins/lxserver',
        runtime: 'node',
        entry: 'index.js',
        params: '',
        env: {PORT: '9527'},
        desc: '',
        active: true
    });
});

test('mergePluginEntry: 同名条目存在 → 保留用户已改的 params/env/active，仅补缺失字段', () => {
    const existing = [{
        name: 'lxserver',
        path: 'plugins/lxserver',
        runtime: 'node',
        params: '-custom 1234',   // 用户已改
        env: {PORT: '9999'},      // 用户已改
        desc: '我的描述',
        active: false             // 用户已关
    }];
    const next = mergePluginEntry(existing, {
        name: 'lxserver', runtime: 'node', entry: 'index.js',
        params: '', env: {PORT: '9527'}, desc: '市场描述'
    }, true);
    assert.equal(next.length, 1);
    assert.equal(next[0].params, '-custom 1234');
    assert.deepEqual(next[0].env, {PORT: '9999'});
    assert.equal(next[0].desc, '我的描述');
    assert.equal(next[0].active, false); // active 不被覆盖
});

test('mergePluginEntry: 同名条目缺 entry 字段 → 补齐', () => {
    const existing = [{name: 'lxserver', path: 'plugins/lxserver', active: true}];
    const next = mergePluginEntry(existing, {name: 'lxserver', runtime: 'node', entry: 'index.js'}, false);
    assert.equal(next[0].entry, 'index.js');
    assert.equal(next[0].runtime, 'node');
    assert.equal(next[0].active, true); // 原值保留
});

test('mergePluginEntry: 不修改入参数组', () => {
    const existing = [{name: 'a', active: true}];
    mergePluginEntry(existing, {name: 'a', entry: 'i.js'}, false);
    assert.deepEqual(existing, [{name: 'a', active: true}]);
});

// ==================== removePluginEntry ====================

test('removePluginEntry: 按 name 移除', () => {
    const plugins = [{name: 'a'}, {name: 'b'}];
    assert.deepEqual(removePluginEntry(plugins, 'a'), [{name: 'b'}]);
    assert.deepEqual(removePluginEntry(plugins, 'not-exist'), plugins);
});

// ==================== buildDownloadUrls (ghProxy 兜底) ====================

test('buildDownloadUrls: GitHub 系域名（含 raw.githubusercontent.com）追加代理候选', () => {
    const proxy = 'https://github.catvod.com/';
    // releases 下载（github.com）
    assert.deepEqual(
        buildDownloadUrls('https://github.com/a/b/releases/download/v1/x.zip', proxy),
        ['https://github.com/a/b/releases/download/v1/x.zip',
         'https://github.catvod.com/https://github.com/a/b/releases/download/v1/x.zip']
    );
    // raw 资源（raw.githubusercontent.com）也走兜底
    assert.deepEqual(
        buildDownloadUrls('https://raw.githubusercontent.com/a/b/main/market.json', proxy),
        ['https://raw.githubusercontent.com/a/b/main/market.json',
         'https://github.catvod.com/https://raw.githubusercontent.com/a/b/main/market.json']
    );
});

test('buildDownloadUrls: 非 GitHub 域名/无代理/非法 URL', () => {
    const proxy = 'https://github.catvod.com/';
    // 非 GitHub 域名只直连
    assert.deepEqual(buildDownloadUrls('https://example.com/x.zip', proxy), ['https://example.com/x.zip']);
    // 无代理只直连
    assert.deepEqual(
        buildDownloadUrls('https://github.com/a/b/x.zip', ''),
        ['https://github.com/a/b/x.zip']
    );
    // 非法 URL
    assert.deepEqual(buildDownloadUrls('not-a-url', proxy), []);
});
