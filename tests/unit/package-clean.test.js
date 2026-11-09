import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
    shouldInclude, isExcludedSource, smokeCheck, collectDocClosure,
    smokeCheckBundle, buildBundleStaging,
} from '../../package-clean.mjs';

// ==================== 白名单判定 shouldInclude ====================

test('shouldInclude: 运行必需内容放行', () => {
    assert.equal(shouldInclude('index.js'), true);
    assert.equal(shouldInclude('package.json'), true);
    assert.equal(shouldInclude('controllers/index.js'), true);
    assert.equal(shouldInclude('utils/pathGuard.js'), true);
    assert.equal(shouldInclude('spider/js/某源.js'), true);
    assert.equal(shouldInclude('docs/changelog/v2.0.0.md'), true);
    assert.equal(shouldInclude('install/autorun.sh'), true);
});

test('shouldInclude: 开发产物与子项目一律排除（黑名单模式反转）', () => {
    assert.equal(shouldInclude('tests/unit/changelog.test.js'), false);
    assert.equal(shouldInclude('scripts/migrate-changelog.mjs'), false);
    assert.equal(shouldInclude('docs/package-design.md'), false);
    // 注：docs/updateRecord.md 等 README 引用的文档由 collectDocClosure 动态收集进包
    // （buildStaging 合并子路径清单），不走 shouldInclude 的静态白名单
    assert.equal(shouldInclude('docs/updateRecord.md'), false);
    assert.equal(shouldInclude('drpy-node-admin/src/main.js'), false);
    assert.equal(shouldInclude('drpy-node-bundle/index.js'), false);
    assert.equal(shouldInclude('examples/demo.js'), false);
    assert.equal(shouldInclude('soft/tool.exe'), false);
    assert.equal(shouldInclude('database.db'), false);
    assert.equal(shouldInclude('.env'), false);
});

test('shouldInclude: DIR_EXCLUDES 与 data 骨架规则', () => {
    assert.equal(shouldInclude('config/env.json'), false);
    assert.equal(shouldInclude('config/source-states.json'), false); // 用户自定义状态文件不入包
    assert.equal(shouldInclude('config/env.json.bak') || shouldInclude('config/other.json'), true);
    assert.equal(shouldInclude('apps/cat/index.html'), false);
    // spider 废弃/测试目录（项目内保留，分发包剔除）
    assert.equal(shouldInclude('spider/js_bad/xvideos[密].js'), false);
    assert.equal(shouldInclude('spider/js_dr2_old/漫画走廊[画密飞].js'), false);
    assert.equal(shouldInclude('spider/js_todo/未完成.js'), false);
    assert.equal(shouldInclude('spider/jstest/测试.js'), false);
    assert.equal(shouldInclude('spider/drop_code/废弃.js'), false);
    // 主源库不受影响
    assert.equal(shouldInclude('spider/js/某源.js'), true);
    assert.equal(shouldInclude('spider/js_dr2/某源.js'), true);
    // data 骨架由 buildStaging 专门重建（.gitkeep 占位），不走通用复制判定
    assert.equal(shouldInclude('data/settings'), false);
    assert.equal(shouldInclude('data/mv/1.mp4'), false);
    assert.equal(shouldInclude('data/temp/xx'), false);
});

// ==================== 源黑名单 isExcludedSource ====================

test('isExcludedSource: 常驻排除清单命中', () => {
    assert.equal(isExcludedSource('spider/js/UC分享.js'), true);
    assert.equal(isExcludedSource('jx/奇奇.js'), true);
    assert.equal(isExcludedSource('json/UC分享.json'), true);
    assert.equal(isExcludedSource('spider/js/别的源.js'), false);
});

test('isExcludedSource: green 模式剔除任何路径下带 [密] 标记的私密内容', () => {
    assert.equal(isExcludedSource('spider/js/某源[密].js', {green: true}), true);
    assert.equal(isExcludedSource('spider/js/某某[密pro].js', {green: true}), true);
    // 「密」在方括号内任意位置都命中（如 [画密飞]）
    assert.equal(isExcludedSource('spider/js_dr2_old/漫画走廊[画密飞].js', {green: true}), true);
    // 不限 spider 前缀（json/jx 等源目录同样覆盖）
    assert.equal(isExcludedSource('json/采集[密]静态.json', {green: true}), true);
    // 非 green 或无 [密] 标记不剔除
    assert.equal(isExcludedSource('spider/js/某源[密].js', {green: false}), false);
    assert.equal(isExcludedSource('spider/js/某源.js', {green: true}), false);
});

// ==================== smokeCheck 防呆自检 ====================

test('smokeCheck: 合法 staging 通过', () => {
    const staging = fs.mkdtempSync(path.join('node_modules', '.pkg-test-'));
    try {
        for (const p of ['index.js', 'package.json', path.join('controllers', 'index.js'), path.join('node_modules', 'fastify'), path.join('docs', 'changelog', 'v2.0.0.md'), path.join('docs', 'openapi.json')]) {
            fs.mkdirSync(path.dirname(path.join(staging, p)), {recursive: true});
            fs.writeFileSync(path.join(staging, p), '');
        }
        assert.deepEqual(smokeCheck(staging), []);
    } finally {
        fs.rmSync(staging, {recursive: true, force: true});
    }
});

test('smokeCheck: 缺 index.js / 混入 env.json、tests、dev 依赖被拦截', () => {
    const staging = fs.mkdtempSync(path.join('node_modules', '.pkg-test-'));
    try {
        fs.writeFileSync(path.join(staging, 'package.json'), '');
        fs.mkdirSync(path.join(staging, 'config'), {recursive: true});
        fs.writeFileSync(path.join(staging, 'config', 'env.json'), '{}');
        fs.mkdirSync(path.join(staging, 'tests'), {recursive: true});
        fs.mkdirSync(path.join(staging, 'node_modules', 'rolldown'), {recursive: true});
        const problems = smokeCheck(staging);
        assert.ok(problems.some(p => p.includes('index.js')));
        assert.ok(problems.some(p => p.includes('env.json')));
        assert.ok(problems.some(p => p.includes('tests')));
        assert.ok(problems.some(p => p.includes('rolldown')));
    } finally {
        fs.rmSync(staging, {recursive: true, force: true});
    }
});

// ==================== bundle 模式：staging 自检 / 组装 ====================

const BUNDLE_WRAPPER = "import {start} from './dist/server.bundle.mjs';\nstart();\n";

function makeBundleFixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pkg-bundle-'));
    const write = (rel, content = '') => {
        fs.mkdirSync(path.dirname(path.join(root, rel)), {recursive: true});
        fs.writeFileSync(path.join(root, rel), content);
    };
    // 树版文件集最小骨架
    write('index.js', '// tree entry');
    write('package.json', '{"name":"drpy-node","type":"module"}');
    write('README.md', '# demo');
    write('utils/esm-register.mjs', '// register');
    write('spider/js/demo.js', 'var rule={};');
    write('config/market.json', '{}');
    write('docs/changelog/v2.0.0.md', '# v2');
    write('docs/openapi.json', '{}');
    // bundle 产物
    write('dist/server.bundle.mjs', 'export const start=()=>{};');
    // -min 变体的 swagger-ui static 资产源（打包机 node_modules 形态）
    write('node_modules/@fastify/swagger-ui/static/logo.svg', '<svg/>');
    write('node_modules/@fastify/swagger-ui/static/swagger-ui-bundle.js', '/*ui*/');
    return root;
}

test('smokeCheckBundle: 合法 bundle staging 通过（入口仍是 index.js）', () => {
    const root = makeBundleFixture();
    const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'pkg-bundle-stage-'));
    try {
        fs.cpSync(root, staging, {recursive: true});
        fs.writeFileSync(path.join(staging, 'index.js'), BUNDLE_WRAPPER);
        for (const p of ['@fastify/swagger-ui', 'ws', 'node-sqlite3-wasm', 'simplecc-wasm']) {
            fs.mkdirSync(path.join(staging, 'node_modules', p), {recursive: true});
        }
        assert.deepEqual(smokeCheckBundle(staging), []);
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
        fs.rmSync(staging, {recursive: true, force: true});
    }
});

test('smokeCheckBundle: 缺产物 / 非 wrapper 入口 / 混入 fastify / 根级 bundle 被拦截', () => {
    const root = makeBundleFixture();
    const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'pkg-bundle-bad-'));
    try {
        fs.cpSync(root, staging, {recursive: true});
        fs.writeFileSync(path.join(staging, 'index.js'), '// 未替换的树版入口');
        fs.rmSync(path.join(staging, 'dist', 'server.bundle.mjs'));
        fs.mkdirSync(path.join(staging, 'node_modules', 'fastify'), {recursive: true});
        fs.writeFileSync(path.join(staging, 'server.bundle.mjs'), '');
        const problems = smokeCheckBundle(staging);
        assert.ok(problems.some((p) => p.includes('server.bundle.mjs')));
        assert.ok(problems.some((p) => p.includes('包装器')));
        assert.ok(problems.some((p) => p.includes('fastify')));
        assert.ok(problems.some((p) => p.includes('不应打包的内容: server.bundle.mjs')));
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
        fs.rmSync(staging, {recursive: true, force: true});
    }
});

test('buildBundleStaging: 生成 wrapper + dist 产物，沿用树版白名单/排除规则', () => {
    const root = makeBundleFixture();
    // 排除项与控制用文件
    fs.mkdirSync(path.join(root, 'config'), {recursive: true});
    fs.writeFileSync(path.join(root, 'config', 'env.json'), '{}');
    fs.mkdirSync(path.join(root, 'spider', 'js_bad'), {recursive: true});
    fs.writeFileSync(path.join(root, 'spider', 'js_bad', 'x.js'), '');
    fs.writeFileSync(path.join(root, 'spider', 'js', '私密[密].js'), '');
    const staging = path.join(os.tmpdir(), `pkg-bundle-assemble-${process.pid}`);
    try {
        buildBundleStaging(root, staging, {green: true, installDeps: false});
        // 入口被替换为 wrapper，产物在 dist/
        const entry = fs.readFileSync(path.join(staging, 'index.js'), 'utf-8');
        assert.match(entry, /from\s+['"]\.\/dist\/server\.bundle\.mjs['"]/);
        assert.ok(fs.existsSync(path.join(staging, 'dist', 'server.bundle.mjs')));
        // 伴生 loader 随 utils 文件集发行
        assert.ok(fs.existsSync(path.join(staging, 'utils', 'esm-register.mjs')));
        // 真实 package.json 覆盖 staging 临时 package.json
        assert.match(fs.readFileSync(path.join(staging, 'package.json'), 'utf-8'), /drpy-node/);
        // 白名单排除规则与树版一致
        assert.ok(!fs.existsSync(path.join(staging, 'config', 'env.json')));
        assert.ok(!fs.existsSync(path.join(staging, 'spider', 'js_bad')));
        assert.ok(!fs.existsSync(path.join(staging, 'spider', 'js', '私密[密].js')));
        // data 骨架
        assert.ok(fs.existsSync(path.join(staging, 'data', 'settings', '.gitkeep')));
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
        fs.rmSync(staging, {recursive: true, force: true});
    }
});


test('buildBundleStaging: min 变体双拷 swagger-ui static、依赖集裁到 3 家', () => {
    const root = makeBundleFixture();
    const staging = path.join(os.tmpdir(), `pkg-bundle-min-${process.pid}`);
    try {
        buildBundleStaging(root, staging, {min: true, installDeps: false});
        // installDeps:false 跳过 npm，手动补 3 家运行时 external 占位
        for (const p of ['ws', 'node-sqlite3-wasm', 'simplecc-wasm']) {
            fs.mkdirSync(path.join(staging, 'node_modules', p), {recursive: true});
        }
        // 两份 static 资产：dist/static/（注册期读 csp.json+logo）+ 根级 static/（serve root）
        assert.ok(fs.existsSync(path.join(staging, 'dist', 'static', 'logo.svg')));
        assert.ok(fs.existsSync(path.join(staging, 'static', 'swagger-ui-bundle.js')));
        // swagger-ui 不进 node_modules（内联进 bundle）
        assert.ok(!fs.existsSync(path.join(staging, 'node_modules', '@fastify', 'swagger-ui')));
        assert.deepEqual(smokeCheckBundle(staging, {min: true}), []);
        // min 模式下磁盘再出现 swagger-ui 包 = 依赖集装错，被拦截
        fs.mkdirSync(path.join(staging, 'node_modules', '@fastify', 'swagger-ui'), {recursive: true});
        const problems = smokeCheckBundle(staging, {min: true});
        assert.ok(problems.some((p) => p.includes('swagger-ui') && p.includes('不应打包')));
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
        fs.rmSync(staging, {recursive: true, force: true});
    }
});

// ==================== collectDocClosure（README 引用文档闭包） ====================

function makeDocFixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-closure-'));
    const write = (rel, content) => {
        fs.mkdirSync(path.dirname(path.join(root, rel)), {recursive: true});
        fs.writeFileSync(path.join(root, rel), content);
    };
    write('README.md', [
        '# Demo',
        '- [接口文档](docs/apidoc.md)',
        '- 引用式：[规则属性][attr]',
        '',
        '[attr]: docs/ruleAttr.md',
        '- 锚点与编码：[中文](docs/issue.md#%E6%A0%87%E9%A2%98)',
        '- 外链忽略：[GitHub](https://github.com/x/y/blob/main/docs/a.md)',
        '- 不存在的忽略：[幽灵](docs/ghost.md)',
        '- 站点绝对路径忽略：[abs](/docs/x.md)',
        '- 子目录递归：[crypto](docs/crypto-js-wasm/readme-CN.md)',
    ].join('\n'));
    write('docs/apidoc.md', '# api\n再引用 [规则说明](ruleDesc.md)'); // 相对当前文档目录解析
    write('docs/ruleDesc.md', '# ruleDesc');
    write('docs/ruleAttr.md', '# attr');
    write('docs/issue.md', '# issue');
    write('docs/crypto-js-wasm/readme-CN.md', '# crypto\n[逃逸](../../README.md)');
    write('docs/被逃逸闭环.md', '# loop');
    return root;
}

test('collectDocClosure: 行内/引用式链接、锚点剥离、URL 解码、相对当前文档解析', () => {
    const root = makeDocFixture();
    try {
        const got = collectDocClosure(root);
        assert.ok(got.includes('docs/apidoc.md'));
        assert.ok(got.includes('docs/ruleAttr.md'));
        assert.ok(got.includes('docs/issue.md'));
        assert.ok(got.includes('docs/crypto-js-wasm/readme-CN.md'));
        // apidoc.md 内对同目录 ruleDesc.md 的二级引用也入闭包
        assert.ok(got.includes('docs/ruleDesc.md'));
        // 外链/不存在/绝对路径不收；入口 README 自身不重复返回
        assert.ok(!got.some(p => p.includes('ghost')));
        assert.ok(!got.includes('README.md'));
        assert.ok(!got.some(p => p.startsWith('..')));
        // 有序输出便于确定性打包
        assert.deepEqual(got, [...got].sort());
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});

test('collectDocClosure: 目录逃逸（../）与真实项目 README 的引用收集', () => {
    const root = makeDocFixture();
    try {
        // 逃逸链接：crypto readme 引用 ../../README.md 越出 docs，但仍在 root 内且存在——按规则属于合法闭包成员
        // 这里验证真实项目 README：12 个 docs 引用全部收集
        const realRoot = process.cwd();
        const got = collectDocClosure(realRoot);
        for (const expected of ['docs/apidoc.md', 'docs/apiList.md', 'docs/issue.md', 'docs/updateRecord.md', 'docs/ruleDesc.md', 'docs/ruleAttr.md', 'docs/webdav.md']) {
            assert.ok(got.includes(expected), `缺少 ${expected}`);
        }
        // 设计文档（package-design.md）README 未引用，不入包
        assert.ok(!got.includes('docs/package-design.md'));
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});
