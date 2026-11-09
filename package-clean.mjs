/**
 * 干净打包脚本（docs/package-design.md）
 *
 * 白名单 staging 组装 + node_modules 生产依赖精确集 + 7z 压缩，
 * 产出「解压即可用任意 Node 解释器运行、无需 npm install」的完整服务包。
 *
 * 用法：
 *   node package-clean.mjs               # 完整包（7z）
 *   node package-clean.mjs -z            # zip 格式
 *   node package-clean.mjs -g            # 绿色包：spider/js 不带 [密] 私密源
 *   node package-clean.mjs --prod-install  # 生产依赖走安装式（默认裁剪式）
 *   node package-clean.mjs -bundle       # bundle 版：单文件启动图 + 微型 node_modules（7z）
 *   node package-clean.mjs -bundle -min  # bundle 极简目录变体：swagger-ui 内联，node_modules 只剩 3 家
 *   压缩格式全部默认 7z（更小），加 -z 才出 zip——树版与 bundle 版语义一致
 */

import {execSync, execFileSync} from 'child_process';
import {existsSync, readdirSync, statSync, mkdirSync, copyFileSync, rmSync, writeFileSync, readFileSync} from 'fs';
import {join, basename, dirname, resolve, relative} from 'path';
import {pathToFileURL, fileURLToPath} from 'url';

// ==================== 配置（单一配置源） ====================

// 根级单文件白名单
const ROOT_FILES = ['index.js', 'package.json', 'README.md', 'LICENSE', 'Dockerfile', 'docker-compose.yml'];

// 整目录白名单（递归复制）
const ROOT_DIRS = ['controllers', 'libs', 'libs_drpy', 'utils', 'spider', 'jx', 'json', 'config', 'public', 'apps', 'install'];

// 子路径白名单（父目录不整体打包）
const SUB_PATHS = ['docs/changelog', 'docs/openapi.json'];

// 目录复制时剔除的相对路径（白名单内的例外）：密钥配置、非分发前端、spider 废弃/测试目录
const DIR_EXCLUDES = [
    'config/env.json',
    'config/source-states.json',
    'apps/cat',
    'spider/js_bad',
    'spider/js_dr2_old',
    'spider/js_todo',
    'spider/jstest',
    'spider/drop_code',
];

// data 运行数据目录：只重建骨架（.gitkeep 占位防压缩包丢空目录），运行缓存/用户数据一律不带
const DATA_SKELETON = ['data/settings', 'data/temp', 'data/market-tmp'];

// 内容黑名单：分发包中剔除的个别源（内容治理清单，-green 之外的常驻排除）
const SOURCE_EXCLUDES = [
    'spider/js/UC分享.js',
    'spider/js/百忙无果[官].js',
    'spider/catvod/mtv60w[差].js',
    'json/UC分享.json',
    'jx/_30wmv.js',
    'jx/奇奇.js',
    'jx/芒果关姐.js',
];

// -green 语义：任何文件名方括号内含「密」标记的私密内容不入分发包（覆盖 spider/json/jx 全部源目录）
const GREEN_FILE_RE = /\[[^\]]*密[^\]]*\]/;

// ==================== bundle 模式配置（-bundle） ====================

// bundle 版根入口包装器：入口文件名/启动方式与树版完全一致（node index.js），
// DsPlayer/用户侧零改动。产物放 dist/ 是有意的——启动图内所有模块按「源码在
// 项目根下一级」推导 `__dirname/..`，单文件放 dist/ 才能让这些路径落回项目根。
const BUNDLE_ENTRY = `// bundle 版入口：静态启动图在 dist/server.bundle.mjs（minify 单文件）。
// 与树版 index.js 同名同启动方式（node index.js），服务配置/环境变量不变。
import {start} from './dist/server.bundle.mjs';
start();
`;

// bundle 版运行时 external 包（打不进单文件的 .wasm 资产包 + ws 的 CJS 形状 +
// swagger-ui 按自身 __dirname 读 static 资产）。版本锁定为实测组合。
// 坑：--no-save 追装会剪掉前面的包，必须一条 npm i 装齐。
const BUNDLE_RUNTIME_DEPS = [
    '@fastify/swagger-ui@4.2.0',
    'ws@8.19.0',
    'node-sqlite3-wasm@0.8.54',
    'simplecc-wasm@1.1.0',
];

// -min 变体：swagger-ui 内联进 bundle，node_modules 只剩物理上打不进单文件的 3 家
// （ws CJS 形状 + 两个 .wasm 资产包），顶层目录 54→3。
// 代价：swagger-ui 的 static 资产要随包带两份（注册期按假 __dirname 读
// dist/static/，serve root 拼 __dirname/../static 落根级 static/——hack 依赖
// 包内部两种路径拼法，升级 @fastify/swagger-ui 后需复查文档页）。
const BUNDLE_RUNTIME_DEPS_MIN = BUNDLE_RUNTIME_DEPS.filter((p) => !p.startsWith('@fastify/swagger-ui'));
const SWAGGER_STATIC_SRC = ['node_modules', '@fastify', 'swagger-ui', 'static'];

const BUNDLE_ENTRY_REL = 'dist/server.bundle.mjs';

/** bundle 版 staging 自检（防呆）：入口/产物/微型依赖/运行时目录 + 禁止内容 */
export function smokeCheckBundle(staging, {min = false} = {}) {
    const problems = [];
    // min：swagger-ui 内联（node_modules 不应再有），static 资产双份必须在
    const mustExist = [
        'index.js',
        'package.json',
        BUNDLE_ENTRY_REL,
        join('utils', 'esm-register.mjs'),
        join('node_modules', 'ws'),
        join('node_modules', 'node-sqlite3-wasm'),
        join('node_modules', 'simplecc-wasm'),
        join('spider', 'js'),
        join('config', 'market.json'),
        join('docs', 'changelog'),
        join('docs', 'openapi.json'),
        ...(min
            ? [join('dist', 'static', 'logo.svg'), join('static', 'swagger-ui-bundle.js')]
            : [join('node_modules', '@fastify', 'swagger-ui')]),
    ];
    for (const p of mustExist) {
        if (!existsSync(join(staging, p))) problems.push(`缺少必需内容: ${p}`);
    }
    // 入口必须还是 index.js，且指向 bundle 产物
    try {
        const entry = readFileSync(join(staging, 'index.js'), 'utf-8');
        if (!/from\s+['"]\.\/dist\/server\.bundle\.mjs['"]/.test(entry)) {
            problems.push('index.js 不是 bundle 包装器（未指向 ./dist/server.bundle.mjs）');
        }
    } catch {
        // 缺失已在上方记录
    }
    const mustNotExist = [
        join('config', 'env.json'),
        join('config', 'source-states.json'),
        '.env',
        'tests',
        'database.db',
        join('node_modules', 'rolldown'),
        // fastify 已打进 bundle；出现说明 npm 误把主工程全量依赖装进 staging
        join('node_modules', 'fastify'),
        // bundle 必须在 dist/（根级会破坏模块内 ../ 路径语义）
        'server.bundle.mjs',
        // min：swagger-ui 已内联，磁盘再出现说明装错了依赖集
        ...(min ? [join('node_modules', '@fastify', 'swagger-ui')] : []),
    ];
    for (const p of mustNotExist) {
        if (existsSync(join(staging, p))) problems.push(`不应打包的内容: ${p}`);
    }
    return problems;
}

function buildServerBundle(root, {min = false} = {}) {
    execFileSync(process.execPath, [
        join('node_modules', 'rolldown', 'dist', 'cli.mjs'),
        '--config', join('drpy-node-bundle', 'rolldown.server.config.js'),
    ], {
        cwd: root,
        stdio: 'inherit',
        // -min：让 rolldown 配置把 swagger-ui 内联（见该配置 BUNDLE_INLINE_SWAGGER 注释）
        env: min ? {...process.env, BUNDLE_INLINE_SWAGGER: '1'} : process.env,
    });
}

function runSandboxCheck(root, staging) {
    const checkFile = 'sandbox-check.bundle.mjs';
    const dest = join(staging, 'dist', checkFile);
    copyFileSync(join(root, 'dist', checkFile), dest);
    try {
        execFileSync(process.execPath, [join('dist', checkFile)], {cwd: staging, stdio: 'inherit'});
    } finally {
        rmSync(dest, {force: true});
    }
}

/**
 * bundle 版 staging 组装：干净独立目录 + 与树版完全相同的文件集 + 微型 node_modules。
 * 注意必须从仓库外的独立目录组装——仓库根 node_modules 的向上解析会掩盖缺包。
 * min：swagger-ui 内联版——依赖集裁到 3 家，另拷两份 swagger-ui static 资产。
 */
export function buildBundleStaging(root, staging, {green = false, installDeps = true, min = false} = {}) {
    if (existsSync(staging)) rmSync(staging, {recursive: true, force: true});
    mkdirSync(staging, {recursive: true});

    // 1) 微型 node_modules：先放极简 package.json，避免 npm 把主工程全量依赖装进来
    writeFileSync(join(staging, 'package.json'), '{"name":"drpy-node-bundle-stage","private":true,"version":"0.0.0"}\n');
    if (installDeps) {
        // --prefer-offline：打包机重复出包时直接吃缓存，避开 registry 抖动；
        // 缓存没有的包仍会联网（版本已精确锁定）
        const deps = (min ? BUNDLE_RUNTIME_DEPS_MIN : BUNDLE_RUNTIME_DEPS).join(' ');
        execSync(`npm install --omit=dev --no-save --no-audit --no-fund --no-package-lock --prefer-offline ${deps}`, {
            cwd: staging,
            stdio: 'inherit',
        });
    }

    // 2) 与树版完全相同的文件集（白名单 + 排除规则 + green 语义，见 copyReleaseFiles）
    copyReleaseFiles(root, staging, {green});

    // 3) 单文件启动图 + 根入口包装器（覆盖树版 index.js）；伴生 esm-register.mjs
    //    已在 utils/ 文件集中（bundle 内引用 ../utils/esm-register.mjs）
    mkdirSync(join(staging, 'dist'), {recursive: true});
    copyFileSync(join(root, 'dist', 'server.bundle.mjs'), join(staging, 'dist', 'server.bundle.mjs'));
    writeFileSync(join(staging, 'index.js'), BUNDLE_ENTRY);

    // min：swagger-ui 已内联，其 static 资产按包内两种路径拼法各放一份
    //（dist/static/ 供注册期读 csp.json+logo，根级 static/ 供 @fastify/static serve）
    if (min) {
        const staticSrc = join(root, ...SWAGGER_STATIC_SRC);
        if (!existsSync(staticSrc)) {
            throw new Error(`-min 需要 ${SWAGGER_STATIC_SRC.join('/')}（打包机 node_modules 未安装 @fastify/swagger-ui）`);
        }
        copyDir(staticSrc, join(staging, 'dist', 'static'));
        copyDir(staticSrc, join(staging, 'static'));
    }

    // 4) 真实 package.json 覆盖（controllers/web.js 读取 name/version）
    copyFileSync(join(root, 'package.json'), join(staging, 'package.json'));
    return staging;
}

function runBundlePackage(root, {green, date, min = false, useZip = false}) {
    const variant = `${green ? '-green' : ''}-bundle${min ? '-min' : ''}`;
    const staging = resolve(root, '..', `drpy-node-staging-${date}${variant}`);
    const archiveName = `drpy-node-${date}${variant}${useZip ? '.zip' : '.7z'}`;
    const archivePath = resolve(root, '..', archiveName);

    console.log(`[package-clean] bundle${min ? '-min' : ''} 模式：构建 server.bundle.mjs + sandbox-check.bundle.mjs`);
    buildServerBundle(root, {min});

    console.log(`[package-clean] staging: ${staging}`);
    buildBundleStaging(root, staging, {green, min});

    // 出包前硬门：bundle 上下文 + 干净 staging（只有微型 node_modules）跑沙箱全局自检
    console.log('[package-clean] 沙箱全局自检 ...');
    runSandboxCheck(root, staging);

    const problems = smokeCheckBundle(staging, {min});
    if (problems.length > 0) {
        console.error('[package-clean] bundle staging 自检未通过:');
        for (const p of problems) console.error('  - ' + p);
        process.exit(1);
    }

    console.log(`[package-clean] 压缩: ${archivePath}`);
    pack(staging, archivePath, useZip);
    rmSync(staging, {recursive: true, force: true});
    console.log(`[package-clean] 完成: ${archivePath}`);
}

// ==================== 可测纯函数 ====================

/** 相对路径是否应进入 staging（白名单判定） */
export function shouldInclude(relPath) {
    const norm = relPath.replace(/\\/g, '/');
    if (DIR_EXCLUDES.some(s => norm === s || norm.startsWith(s + '/'))) return false;
    if (ROOT_FILES.includes(norm)) return true;
    if (SUB_PATHS.some(s => norm === s || norm.startsWith(s + '/'))) return true;
    if (DATA_SKELETON.includes(norm) || DATA_SKELETON.some(s => norm.startsWith(s + '/'))) return false;
    return ROOT_DIRS.includes(norm.split('/')[0]);
}

/**
 * 从入口 markdown（默认 README.md）递归收集项目内被引用的 .md 文档闭包。
 * 背景：发布包只带 docs 的静态白名单，README.md 里的关联跳转（docs/apidoc.md 等）
 * 会全部落空；此函数保证「README 可点到的文档」随包分发，且 README 演进时无需改清单。
 * 规则：仅收集本地相对路径（忽略 http/锚点/解码失败的链接），目标必须真实存在且位于 root 内；不存在或越界的链接静默忽略。
 * @param {string} root 项目根
 * @param {string[]} [entries] 入口文件（相对 root），默认 README.md
 * @returns {string[]} 相对 root 的文档路径列表（posix 风格，含入口自身引用到的全部层级）
 */
export function collectDocClosure(root, entries = ['README.md']) {
    const LINK_RE = /\[[^\]]*\]\(([^)\s]+)\)|^\s*\[[^\]]*\]:\s*(\S+)/gm;
    const queue = entries.map((e) => e.replace(/\\/g, '/'));
    const seen = new Set();
    const out = new Set();
    while (queue.length > 0) {
        const rel = queue.shift();
        if (seen.has(rel)) continue;
        seen.add(rel);
        const abs = join(root, rel);
        if (!existsSync(abs) || !statSync(abs).isFile()) continue;
        out.add(rel);
        const text = (() => {
            try {
                return readFileSync(abs, 'utf-8');
            } catch {
                return '';
            }
        })();
        let m;
        LINK_RE.lastIndex = 0;
        while ((m = LINK_RE.exec(text)) !== null) {
            let link = (m[1] || m[2] || '').trim();
            if (!link || /^(https?:)?\/\//i.test(link) || link.startsWith('#')) continue;
            link = link.split('#')[0];
            if (!link || !/\.md$/i.test(link)) continue;
            try {
                link = decodeURIComponent(link);
            } catch {
                // 保留原值（非法编码序列）
            }
            if (link.startsWith('/')) continue; // 绝对路径（站点根语义）不适用离线包
            const absTarget = resolve(dirname(abs), link);
            const relTarget = relative(root, absTarget).replace(/\\/g, '/');
            if (!relTarget || relTarget.startsWith('..') || !/\.md$/i.test(relTarget)) continue;
            if (!existsSync(absTarget)) continue;
            if (!seen.has(relTarget)) queue.push(relTarget);
        }
    }
    out.delete(entries[0]); // 入口本身（README.md）已在 ROOT_FILES 白名单
    return [...out].sort();
}

/** 源内容黑名单（常驻排除 + green 私密源）是否命中 */
export function isExcludedSource(relPath, {green = false} = {}) {
    const norm = relPath.replace(/\\/g, '/');
    if (SOURCE_EXCLUDES.includes(norm)) return true;
    if (green && GREEN_FILE_RE.test(basename(norm))) return true;
    return false;
}

/**
 * staging 组装后防呆自检，返回缺失/多余问题列表（空数组 = 通过）
 */
export function smokeCheck(staging) {
    const problems = [];
    const mustExist = ['index.js', 'package.json', join('controllers', 'index.js'), join('node_modules', 'fastify'), join('docs', 'changelog'), join('docs', 'openapi.json')];
    for (const p of mustExist) {
        if (!existsSync(join(staging, p))) problems.push(`缺少必需内容: ${p}`);
    }
    const mustNotExist = [join('config', 'env.json'), join('config', 'source-states.json'), '.env', 'tests', 'database.db', join('node_modules', 'rolldown'), join('node_modules', '@inquirer')];
    for (const p of mustNotExist) {
        if (existsSync(join(staging, p))) problems.push(`不应打包的内容: ${p}`);
    }
    return problems;
}

// ==================== 组装实现 ====================

function copyDir(src, dest, {green = false, root = ''} = {}) {
    mkdirSync(dest, {recursive: true});
    for (const entry of readdirSync(src)) {
        const relPath = root ? `${root}/${entry}` : entry;
        // 目录级排除：命中即整棵跳过（不产生空目录）
        if (DIR_EXCLUDES.includes(relPath)) continue;
        const srcPath = join(src, entry);
        const stat = statSync(srcPath);
        if (stat.isDirectory()) {
            copyDir(srcPath, join(dest, entry), {green, root: relPath});
        } else {
            if (isExcludedSource(relPath, {green})) continue;
            copyFileSync(srcPath, join(dest, entry));
        }
    }
}

/** 生产依赖目录集合：npm ls 快照（--all 必须带上，默认 depth=0 会漏掉全部传递依赖） */
export function resolveProdDirs(root) {
    let out;
    try {
        out = execSync('npm ls --omit=dev --omit=optional --all --parseable', {cwd: root, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe']});
    } catch (e) {
        throw new Error(`依赖树不健康，请先在项目根执行 yarn install 修复再打包: ${e.stderr || e.message}`);
    }
    const dirs = out.split('\n').map((l) => l.trim()).filter(Boolean)
        .filter((p) => resolve(p) !== resolve(root))
        .map((p) => relative(root, p));
    if (dirs.length === 0) throw new Error('生产依赖快照为空，请检查 node_modules 安装状态');
    return dirs;
}

/**
 * 发行文件集复制（树版 / bundle 版共用，单一事实源）：
 * 根级单文件 + 整目录白名单 + README 文档闭包子路径 + data 骨架
 */
function copyReleaseFiles(root, staging, {green = false} = {}) {
    for (const file of ROOT_FILES) {
        if (existsSync(join(root, file))) copyFileSync(join(root, file), join(staging, file));
    }
    for (const dir of ROOT_DIRS) {
        if (existsSync(join(root, dir))) copyDir(join(root, dir), join(staging, dir), {green, root: dir});
    }
    // README 引用的文档闭包（关联跳转随包分发，见 collectDocClosure）+ 静态子路径白名单
    const subPaths = [...SUB_PATHS, ...collectDocClosure(root)];
    for (const sub of subPaths) {
        const src = join(root, sub);
        if (!existsSync(src)) continue;
        if (statSync(src).isFile()) {
            // 文件型子路径（如 docs/openapi.json）
            mkdirSync(dirname(join(staging, sub)), {recursive: true});
            copyFileSync(src, join(staging, sub));
        } else {
            copyDir(src, join(staging, sub), {root: sub});
        }
    }
    // data 骨架：空目录 + .gitkeep 占位（运行缓存/用户数据不带，服务运行时自建）
    for (const skeleton of DATA_SKELETON) {
        const dir = join(staging, skeleton);
        mkdirSync(dir, {recursive: true});
        writeFileSync(join(dir, '.gitkeep'), '');
    }
}

/**
 * staging 组装
 */
export function buildStaging(root, staging, {green = false, prodDirs} = {}) {
    if (existsSync(staging)) rmSync(staging, {recursive: true, force: true});
    mkdirSync(staging, {recursive: true});
    copyReleaseFiles(root, staging, {green});

    // node_modules 生产集
    const nmDirs = prodDirs || resolveProdDirs(root);
    for (const rel of nmDirs) {
        const src = join(root, rel);
        const dest = join(staging, rel);
        mkdirSync(dirname(dest), {recursive: true});
        copyDir(src, dest);
    }
    return staging;
}

// ==================== 压缩与入口 ====================

function pack(staging, archivePath, useZip) {
    const type = useZip ? 'zip' : '7z';
    execSync(`7z a -t${type} "${archivePath}" "${join(staging, '*')}" -xr!.gitkeep`, {stdio: 'inherit'});
}

function main() {
    const root = dirname(fileURLToPath(import.meta.url));
    const args = process.argv.slice(2);
    const green = args.includes('-g') || args.includes('--green');
    const useZip = args.includes('-z') || args.includes('--zip');
    const prodInstall = args.includes('--prod-install');
    const bundle = args.includes('-bundle') || args.includes('--bundle');
    const min = args.includes('-min') || args.includes('--min');

    // 本地日期（toISOString 走 UTC，晚间打包日期会差一天）
    const now = new Date();
    const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;

    // bundle 版：单文件启动图 + 微型 node_modules；压缩格式与树版同语义（默认 7z，-z 出 zip）
    // -min：swagger-ui 内联变体（node_modules 顶层 54→3，代价见 BUNDLE_RUNTIME_DEPS_MIN 注释）
    if (bundle) {
        runBundlePackage(root, {green, date, min, useZip});
        return;
    }

    const staging = resolve(root, '..', `drpy-node-staging-${date}${green ? '-green' : ''}`);
    const archiveName = `drpy-node-${date}${green ? '-green' : ''}${useZip ? '.zip' : '.7z'}`;
    const archivePath = resolve(root, '..', archiveName);

    console.log(`[package-clean] staging: ${staging}`);
    if (prodInstall) {
        // 路线 B（安装式）：staging 携带 package.json 后原地安装生产依赖，完全可复现
        console.log('[package-clean] --prod-install: staging 内安装生产依赖（路线 B）');
        buildStaging(root, staging, {green, prodDirs: []});
        execSync('npm install --omit=dev --omit=optional --no-audit --no-fund', {cwd: staging, stdio: 'inherit'});
    } else {
        // 路线 A（裁剪式，默认）：从打包机 node_modules 复制生产集快照
        buildStaging(root, staging, {green});
    }
    const problems = smokeCheck(staging);
    if (problems.length > 0) {
        console.error('[package-clean] staging 自检未通过:');
        for (const p of problems) console.error('  - ' + p);
        process.exit(1);
    }

    console.log(`[package-clean] 压缩: ${archivePath}`);
    pack(staging, archivePath, useZip);
    rmSync(staging, {recursive: true, force: true});
    console.log(`[package-clean] 完成: ${archivePath}`);
}

// CLI 入口守卫：被 import 时（单测）不执行打包
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main();
}