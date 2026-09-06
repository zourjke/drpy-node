/**
 * 一次性 codemod：把指定目录下 .js 的 console.log/error/warn( 替换为
 * utils/log.js 的 log/logError/logWarn(，并自动补/合并 import。
 * 用法: node scripts/codemod-console.js <dir> [dir2 ...]
 * 例外：utils/log.js 与 controllers/fastlogger.js 自身不处理（日志基建本体）。
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const dirs = process.argv.slice(2);
if (!dirs.length) {
    console.error('usage: node scripts/codemod-console.js <dir> [dir2 ...]');
    process.exit(1);
}
const SKIP_DIRS = new Set([
    'node_modules', '.git', 'drpy-node-admin', 'drpy-node-mcp', 'apps', 'public',
    'jx', 'json', 'spider', 'tests', 'scripts', 'docs', 'config', 'plugins',
]);
const SELF = path.resolve(ROOT, 'utils/log.js');
const FASTLOGGER = path.resolve(ROOT, 'controllers/fastlogger.js');

const relImport = (fromFile, target) => {
    let rel = path.relative(path.dirname(fromFile), target).replace(/\\/g, '/');
    if (!rel.startsWith('.')) rel = './' + rel;
    return rel; // ESM 相对导入必须带 .js 扩展名
};

const walk = (dir, files = []) => {
    const st = fs.statSync(dir);
    if (st.isFile()) {
        return dir.endsWith('.js') ? [...files, dir] : files;
    }
    for (const name of fs.readdirSync(dir)) {
        const p = path.join(dir, name);
        const st2 = fs.statSync(p);
        if (st2.isDirectory()) {
            if (SKIP_DIRS.has(name)) continue;
            walk(p, files);
        } else if (name.endsWith('.js') && !name.endsWith('.min.js')) {
            files.push(p);
        }
    }
    return files;
};

let changed = 0;
for (const dir of dirs) {
    for (const file of walk(path.resolve(ROOT, dir))) {
        if (file === SELF || file === FASTLOGGER) continue;
        const src = fs.readFileSync(file, 'utf8');
        if (!/console\.(log|error|warn)\(/.test(src)) continue;
        const used = new Set();
        const next = src
            .replace(/console\.log\(/g, () => (used.add('log'), 'log('))
            .replace(/console\.error\(/g, () => (used.add('logError'), 'logError('))
            .replace(/console\.warn\(/g, () => (used.add('logWarn'), 'logWarn('));
        const names = [...used].sort().join(', ');
        const spec = relImport(file, SELF);
        const importRe = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*'${spec}'\\s*;?\\n`);
        let out;
        const existing = next.match(importRe);
        if (existing) {
            const merged = [...new Set([...existing[1].split(',').map((s) => s.trim()).filter(Boolean), ...used])].sort().join(', ');
            out = next.replace(importRe, `import {${merged}} from '${spec}';\n`);
        } else {
            // 插到首个 import 行行首；无 import 行则放文件最前。
            // 行尾自适应 CRLF/LF（CRLF 文件用 \n 插入会错位注释块）
            const eol = next.includes('\r\n') ? '\r\n' : '\n';
            const m = next.match(/^import /m);
            const idx = m ? m.index : 0;
            out = next.slice(0, idx) + `import {${names}} from '${spec}';` + eol + next.slice(idx);
        }
        fs.writeFileSync(file, out);
        changed++;
        console.log(`[codemod] ${path.relative(ROOT, file)} (${[...used].join(',')})`);
    }
}
console.log(`[codemod] done, ${changed} files changed`);
