import {test, beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import {
    SOURCE_ENGINES,
    validateSourceFilename,
    matchSourceEngine,
    setSourcesEnabled,
    removeDisabledPaths,
    getDisabledSet,
    getDisabledFilenameSet,
    isValidManagedPath
} from '../../utils/sourceState.js';

// 重定向状态文件到临时目录：sourceState 用 PROJECT_ROOT 拼路径，
// 单测直接操作真实 config/source-states.json 的写入并用完成后清理的方式会污染仓库——
// 改为备份/恢复真实文件的策略（写入接口行为与路径解析强耦合，mock 成本高于收益）
const STATE_FILE = path.join(process.cwd(), 'config', 'source-states.json');
let backup = null;
const PROBE_A = 'spider/js/zz-t-a.js';
const PROBE_B = 'spider/py/zz-t-b.py';
const PROBE_BAD = 'controllers/index.js';

test.before(() => {
    if (fs.existsSync(STATE_FILE)) backup = fs.readFileSync(STATE_FILE, 'utf-8');
    if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);
});

test.after(() => {
    if (backup !== null) fs.writeFileSync(STATE_FILE, backup);
    else if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);
});

test('SOURCE_ENGINES: 从 sourcesController 收敛后五类齐全', () => {
    assert.deepEqual(Object.keys(SOURCE_ENGINES).sort(), ['catvod', 'dr2', 'js', 'php', 'py']);
});

test('validateSourceFilename/matchSourceEngine: 迁入后行为不变（兼容性抽查）', () => {
    assert.deepEqual(validateSourceFilename('js', 'a.js'), {ok: true, name: 'a.js'});
    assert.equal(validateSourceFilename('js', '../a.js').ok, false);
    assert.deepEqual(matchSourceEngine('spider/py/x.py'), {engine: 'py', name: 'x.py'});
    assert.equal(matchSourceEngine('controllers/index.js'), null);
});

test('状态文件缺失时全启用（默认启用的天然实现）', () => {
    assert.equal(getDisabledSet().size, 0);
    assert.equal(getDisabledFilenameSet('spider/js').size, 0);
});

test('setSourcesEnabled: 停用/启用/去重/非法路径跳过', () => {
    let r = setSourcesEnabled([PROBE_A, PROBE_B, PROBE_BAD], false);
    assert.equal(r.updated, 2);
    assert.ok(r.skipped.includes(PROBE_BAD));
    assert.equal(getDisabledSet().has(PROBE_A), true);
    assert.equal(getDisabledSet().has(PROBE_B), true);

    // 重复停用不再计数
    r = setSourcesEnabled([PROBE_A], false);
    assert.equal(r.updated, 0);

    // 启用
    r = setSourcesEnabled([PROBE_A], true);
    assert.equal(r.updated, 1);
    assert.equal(getDisabledSet().has(PROBE_A), false);
    assert.equal(getDisabledSet().has(PROBE_B), true);
});

test('getDisabledFilenameSet: 按引擎目录前缀取文件名', () => {
    assert.equal(getDisabledFilenameSet('spider/py').has('zz-t-b.py'), true);
    assert.equal(getDisabledFilenameSet('spider/js').has('zz-t-b.py'), false);
});

test('removeDisabledPaths: 删除源联动清理残留', () => {
    const removed = removeDisabledPaths([PROBE_B, PROBE_A]);
    assert.equal(removed >= 1, true);
    assert.equal(getDisabledSet().has(PROBE_B), false);
});

test('isValidManagedPath: 白名单/子路径/目录引用全部拒绝', () => {
    assert.equal(isValidManagedPath('spider/js/a.js'), true);
    assert.equal(isValidManagedPath('spider/js_bad/a.js'), false);
    assert.equal(isValidManagedPath('spider/js/sub/a.js'), false);
    assert.equal(isValidManagedPath('spider/js/..'), false);
    assert.equal(isValidManagedPath('spider/js/_x.js'), false);
    assert.equal(isValidManagedPath('spider/js/a.sh'), false);
});
