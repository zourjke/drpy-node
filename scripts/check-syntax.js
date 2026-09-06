// 对重构涉及的自有框架代码做 Node 语法检查（node --check 等价能力的批量版）。
// 只覆盖 v2 重构范围（见 docs/refactor-plan.md），不检查第三方 vendored 库与 spider 源库。

import {execFileSync} from 'child_process';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const TARGETS = [
    'index.js',
    'package.js',
    'package-bundle.js',
    'controllers',
    'utils',
    'libs',
    'libs_drpy/mod.js',
    'libs_drpy/moduleLoader.js',
    'libs_drpy/dsQueue.js',
    'libs_drpy/drpyBatchFetch.js',
    'libs_drpy/hikerBatchFetch.js',
    'libs_drpy/batchExecute.js',
    'libs_drpy/drpyInject.js',
    'libs_drpy/drpyCustom.js',
    'libs_drpy/req-extend.js',
    'libs_drpy/fetchAxios.js',
    'libs_drpy/es6-extend.js',
    'libs_drpy/similarity.js',
    'libs_drpy/template.js',
    'libs_drpy/htmlParser.js',
    'libs_drpy/jinja.js',
    'libs_drpy/jsonpath-adapter.js',
    'libs_drpy/crypto-util.js',
    'libs_drpy/drpyRsa.js',
    'libs_drpy/hls-parser.js',
];

function walk(dir) {
    const out = [];
    if (!fs.existsSync(dir)) return out;
    for (const name of fs.readdirSync(dir)) {
        const p = path.join(dir, name);
        const st = fs.statSync(p);
        if (st.isDirectory()) {
            // 跳过管理面板前端子项目与依赖目录
            if (/^(node_modules|_dist|dist)$/.test(name)) continue;
            out.push(...walk(p));
        } else if (/\.(js|mjs|cjs)$/.test(name) && !name.endsWith('.min.js')) {
            out.push(p);
        }
    }
    return out;
}

const files = [];
for (const t of TARGETS) {
    const abs = path.join(ROOT, t);
    const st = fs.existsSync(abs) && fs.statSync(abs);
    if (!st) continue;
    if (st.isDirectory()) {
        files.push(...walk(abs).filter((f) => !f.includes('node_modules')));
    } else {
        files.push(abs);
    }
}

let failed = 0;
for (const f of files) {
    try {
        execFileSync(process.execPath, ['--check', f], {stdio: 'pipe'});
    } catch (e) {
        failed++;
        console.error(`[FAIL] ${path.relative(ROOT, f)}\n${e.stderr?.toString() || e.message}`);
    }
}
console.log(`checked ${files.length} files, ${failed} failed`);
process.exit(failed ? 1 : 0);
