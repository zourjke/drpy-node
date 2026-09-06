import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import {compareVersions} from '../../utils/semver.js';
import {
    parseFrontmatter,
    parseChangelogFile,
    parseArchive,
    sortReleases,
    VERSION_FILE_RE,
    TYPE_PRIORITY,
} from '../../utils/changelogParser.js';

// ==================== compareVersions（utils/semver.js） ====================

test('semver.compareVersions: 数值逐段比较', () => {
    assert.equal(compareVersions('1.0.0', '1.0.10'), -1);
    assert.equal(compareVersions('2.0.0', '1.9.9'), 1);
    assert.equal(compareVersions('1.4.2', '1.4.2'), 0);
});

// ==================== parseFrontmatter ====================

test('parseFrontmatter: 提取键值对并剥离围栏', () => {
    const {meta, body} = parseFrontmatter('---\ndate: 2026-08-29\ntype: major\n---\n\n## 新功能\n');
    assert.deepEqual(meta, {date: '2026-08-29', type: 'major'});
    assert.equal(body, '\n## 新功能\n');
});

test('parseFrontmatter: 无围栏/未闭合时整体作为正文', () => {
    assert.deepEqual(parseFrontmatter('## 新功能\n').meta, {});
    assert.deepEqual(parseFrontmatter('---\ndate: 2026-08-29\n').meta, {});
});

// ==================== parseChangelogFile ====================

test('parseChangelogFile: 完整文件解析（版本提取/小节映射/条目）', () => {
    const content = [
        '---',
        'date: 2026-08-29',
        'type: major',
        'title: Instrument Panel 与插件生态',
        'tags: 管理界面,插件, 文档',
        '---',
        '',
        '## 新功能',
        '',
        '- 管理界面全站重构',
        '- 新增插件市场',
        '',
        '## 修复',
        '',
        '- 修复站源映射误报「未保存」',
    ].join('\n');
    const {ok, release, warnings} = parseChangelogFile('v2.0.0.md', content);
    assert.equal(ok, true);
    assert.deepEqual(warnings, []);
    assert.equal(release.version, '2.0.0');
    assert.equal(release.date, '2026-08-29');
    assert.equal(release.type, 'major');
    assert.equal(release.title, 'Instrument Panel 与插件生态');
    assert.deepEqual(release.tags, ['管理界面', '插件', '文档']);
    assert.equal(release.items[0].type, 'feat');
    assert.equal(release.items[2].type, 'fix');
});

test('parseChangelogFile: 未识别小节归 other 且保留原小节名作 label', () => {
    const {release} = parseChangelogFile('v1.0.0.md', '---\ndate: 2026-01-01\n---\n\n## 界面\n\n- 调整了布局');
    assert.equal(release.items[0].type, 'other');
    assert.equal(release.items[0].label, '界面');
});

test('parseChangelogFile: 小节外的裸列表归 other', () => {
    const {release} = parseChangelogFile('v1.0.0.md', '---\ndate: 2026-01-01\n---\n\n- 直接写的条目');
    assert.equal(release.items[0].type, 'other');
    assert.equal(release.items[0].label, undefined);
});

test('parseChangelogFile: type 缺省 patch、title 缺省回退并给 warning', () => {
    const {release, warnings} = parseChangelogFile('v1.2.3.md', '---\ndate: 2026-01-01\n---\n\n## 修复\n\n- x');
    assert.equal(release.type, 'patch');
    assert.equal(release.title, '版本 v1.2.3');
    assert.ok(warnings.some(w => w.includes('title')));
});

test('parseChangelogFile: 文件名不合规被拒绝', () => {
    const r = parseChangelogFile('readme.md', 'x');
    assert.equal(r.ok, false);
    assert.ok(!VERSION_FILE_RE.test('V1.0.0.MD'));
});

// ==================== parseArchive / sortReleases ====================

test('parseArchive: 提取日期前缀条目，忽略标题', () => {
    const {items} = parseArchive('# 历史归档\n\n### 20240101\n\n- 记录一\n- 记录二\n');
    assert.deepEqual(items, [
        {type: 'other', text: '20240101 记录一'},
        {type: 'other', text: '20240101 记录二'},
    ]);
});

test('sortReleases: 版本严格降序', () => {
    const sorted = sortReleases([
        {version: '1.0.1'}, {version: '2.0.0'}, {version: '1.4.8'},
    ]);
    assert.deepEqual(sorted.map(r => r.version), ['2.0.0', '1.4.8', '1.0.1']);
});

// ==================== 真实数据质量校验（docs/changelog/） ====================

test('changelog 数据质量：文件命名、日期、条目、无重复且降序', () => {
    const dir = path.resolve('docs/changelog');
    assert.ok(fs.existsSync(dir), 'docs/changelog 目录必须存在');
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));

    const releases = [];
    const warnings = [];
    for (const f of files) {
        if (f === 'archive.md') continue;
        const {ok, release, warnings: w} = parseChangelogFile(f, fs.readFileSync(path.join(dir, f), 'utf-8'));
        if (!ok) { warnings.push(...w); continue; }
        releases.push(release);
        warnings.push(...w);
        assert.ok(release.date, `${f} 缺少合法 date`);
        assert.ok(release.items.length > 0, `${f} 至少要有一条变更`);
        assert.ok(release.items.every(i => i.text), `${f} 条目文本不能为空`);
    }
    assert.deepEqual(warnings, [], `解析警告: ${warnings.join('; ')}`);

    const versions = sortReleases(releases).map(r => r.version);
    assert.equal(new Set(versions).size, versions.length, '版本号不得重复');
    for (let i = 1; i < versions.length; i++) {
        assert.equal(compareVersions(versions[i - 1], versions[i]), 1, `版本未降序: ${versions[i - 1]} < ${versions[i]}`);
    }
    assert.ok(versions.includes('2.0.0'), '必须包含当前版本 2.0.0');
    assert.ok(TYPE_PRIORITY.length > 0);
});
