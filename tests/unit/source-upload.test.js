import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import AdmZip from 'adm-zip';
import {
    SOURCE_ENGINES,
    validateSourceFilename,
    matchSourceEngine
} from '../../controllers/admin/sourcesController.js';
import {buildEntryFromZip} from '../../utils/pluginMarket.js';

// ==================== SOURCE_ENGINES 引擎映射 ====================

test('SOURCE_ENGINES: 五类引擎齐全，目录与扩展名成对', () => {
    assert.deepEqual(Object.keys(SOURCE_ENGINES).sort(), ['catvod', 'dr2', 'js', 'php', 'py']);
    for (const [engine, cfg] of Object.entries(SOURCE_ENGINES)) {
        assert.equal(typeof cfg.dir, 'string', `${engine} 缺 dir`);
        assert.ok(cfg.dir.startsWith('spider/'), `${engine} 目录不在 spider/ 下`);
        assert.ok(cfg.ext.startsWith('.'), `${engine} 扩展名非法`);
    }
    assert.equal(SOURCE_ENGINES.js.dir, 'spider/js');
    assert.equal(SOURCE_ENGINES.dr2.dir, 'spider/js_dr2');
});

// ==================== validateSourceFilename（上传校验） ====================

test('validateSourceFilename: 正常文件名放行并 basename 化', () => {
    assert.deepEqual(validateSourceFilename('js', '新源.js'), {ok: true, name: '新源.js'});
    assert.deepEqual(validateSourceFilename('py', 'a-b_c1.py'), {ok: true, name: 'a-b_c1.py'});
    assert.deepEqual(validateSourceFilename('php', 'x.php'), {ok: true, name: 'x.php'});
});

test('validateSourceFilename: 拒绝路径分隔符与穿越', () => {
    assert.equal(validateSourceFilename('js', '../evil.js').ok, false);
    assert.equal(validateSourceFilename('js', 'sub/dir/x.js').ok, false);
    assert.equal(validateSourceFilename('js', 'sub\\dir\\x.js').ok, false);
    assert.equal(validateSourceFilename('js', '..').ok, false);
});

test('validateSourceFilename: 扩展名/空名/超长/_前缀/未知引擎', () => {
    assert.ok(validateSourceFilename('js', 'evil.sh').error.includes('.js'));
    assert.ok(validateSourceFilename('php', 'x.js').error.includes('.php'));
    assert.equal(validateSourceFilename('js', '').ok, false);
    assert.equal(validateSourceFilename('js', '   ').ok, false);
    assert.equal(validateSourceFilename('js', null).ok, false);
    assert.equal(validateSourceFilename('js', 'a'.repeat(200) + '.js').ok, false);
    assert.ok(validateSourceFilename('js', '_private.js').error.includes('_'));
    assert.ok(validateSourceFilename('unknown', 'x.js').error.includes('unknown'));
});

// ==================== matchSourceEngine（删除路径前缀白名单） ====================

test('matchSourceEngine: 源目录内路径按段前缀匹配', () => {
    assert.deepEqual(matchSourceEngine('spider/js/x.js'), {engine: 'js', name: 'x.js'});
    assert.deepEqual(matchSourceEngine('spider/js_dr2/x.js'), {engine: 'dr2', name: 'x.js'});
    assert.deepEqual(matchSourceEngine('spider/catvod/a/b.js'), {engine: 'catvod', name: 'a/b.js'});
    // Windows 反斜杠风格归一化
    assert.deepEqual(matchSourceEngine('spider\\py\\x.py'), {engine: 'py', name: 'x.py'});
});

test('matchSourceEngine: 相似前缀/非源目录不误匹配', () => {
    // spider/js_bad 不能因字符串前缀命中 spider/js
    assert.equal(matchSourceEngine('spider/js_bad/x.js'), null);
    assert.equal(matchSourceEngine('controllers/index.js'), null);
    assert.equal(matchSourceEngine('spider/jsx'), null);
    assert.equal(matchSourceEngine(''), null);
    assert.equal(matchSourceEngine(null), null);
});

test('matchSourceEngine: 穿越路径归入引擎但保留相对段（由删除方按含子路径拒绝）', () => {
    const m = matchSourceEngine('spider/js/../../.env');
    assert.equal(m.engine, 'js');
    assert.equal(m.name, '../../.env');
    assert.ok(m.name.includes('/')); // 删除控制器据此拒绝
});

// ==================== buildEntryFromZip（上传包元信息预读） ====================

function writeTempZip(entries) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zip-entry-'));
    const zipPath = path.join(dir, 'pkg.zip');
    const zip = new AdmZip();
    for (const [name, content] of Object.entries(entries)) {
        zip.addFile(name, Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf-8'));
    }
    zip.writeZip(zipPath);
    return zipPath;
}

test('buildEntryFromZip: 包内 manifest 为准', () => {
    const p = writeTempZip({
        'plugin.json': JSON.stringify({name: 'demo', version: '1.2.3', runtime: 'node', entry: 'main.js', title: '示例'}),
        'main.js': 'console.log(1)',
    });
    const entry = buildEntryFromZip(p, 'whatever.zip');
    assert.equal(entry.name, 'demo');
    assert.equal(entry.version, '1.2.3');
    assert.equal(entry.runtime, 'node');
    assert.equal(entry.entry, 'main.js');
    fs.rmSync(path.dirname(p), {recursive: true, force: true});
});

test('buildEntryFromZip: 单层目录壳自动剥壳识别', () => {
    const p = writeTempZip({
        'demo/plugin.json': JSON.stringify({name: 'demo', version: '0.1.0'}),
        'demo/index.js': 'x',
    });
    const entry = buildEntryFromZip(p, 'demo.zip');
    assert.equal(entry.name, 'demo');
    assert.equal(entry.version, '0.1.0');
    fs.rmSync(path.dirname(p), {recursive: true, force: true});
});

test('buildEntryFromZip: 无 manifest 时按文件名推断 + 内容推断 runtime', () => {
    // 无 manifest 包需为单目录壳（resolveZipRoot 既有约定：根级散文件无法证明是插件包）
    const nodePkg = writeTempZip({'my-tool/index.js': 'x', 'my-tool/package.json': '{}'});
    let entry = buildEntryFromZip(nodePkg, 'my-tool.zip');
    assert.equal(entry.name, 'my-tool');
    assert.equal(entry.runtime, 'node');
    fs.rmSync(path.dirname(nodePkg), {recursive: true, force: true});

    const binPkg = writeTempZip({'my-tool/my-tool-win.exe': Buffer.from([0x4d, 0x5a])});
    entry = buildEntryFromZip(binPkg, 'my-tool.zip');
    assert.equal(entry.name, 'my-tool');
    assert.equal(entry.runtime, 'binary');
    fs.rmSync(path.dirname(binPkg), {recursive: true, force: true});
});

// ZipSlip 恶意条目（../ 逃逸）由端到端验收用 python zipfile 构造实测：
// adm-zip 的 addFile 会规范化条目名，无法在 JS 侧构造非法条目；
// buildEntryFromZip 的非法条目分支与 safeZipEntryName 一致（已由 plugin-market.test.js 覆盖）。

test('buildEntryFromZip: 空 zip / 多顶层无 manifest / manifest 缺 name 均拒绝', () => {
    const empty = writeTempZip({});
    assert.throws(() => buildEntryFromZip(empty, 'a.zip'));
    fs.rmSync(path.dirname(empty), {recursive: true, force: true});

    const multi = writeTempZip({'a/index.js': 'x', 'b/index.js': 'y'});
    assert.throws(() => buildEntryFromZip(multi, 'a.zip'), /包结构无法识别/);
    fs.rmSync(path.dirname(multi), {recursive: true, force: true});

    const noName = writeTempZip({'plugin.json': JSON.stringify({version: '1.0.0'}), 'index.js': 'x'});
    assert.throws(() => buildEntryFromZip(noName, 'a.zip'), /缺少 name/);
    fs.rmSync(path.dirname(noName), {recursive: true, force: true});
});
