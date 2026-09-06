/**
 * Compatible packaging adapter for drpy-node
 * Wraps package-clean.mjs or creates staging zip/7z archive
 */
import { execSync } from 'child_process';
import { existsSync, readdirSync, statSync, mkdirSync, copyFileSync, rmSync, writeFileSync } from 'fs';
import { join, basename, dirname, resolve, relative } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT_FILES = ['index.js', 'package.json', 'README.md', 'LICENSE', 'Dockerfile', 'docker-compose.yml'];
const ROOT_DIRS = ['controllers', 'libs', 'libs_drpy', 'utils', 'spider', 'jx', 'json', 'config', 'public', 'apps', 'install'];
const SUB_PATHS = ['docs/changelog', 'docs/openapi.json'];
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
const DATA_SKELETON = ['data/settings', 'data/temp', 'data/market-tmp'];
const SOURCE_EXCLUDES = [
    'spider/js/UC分享.js',
    'spider/js/百忙无果[官].js',
    'spider/catvod/mtv60w[差].js',
    'json/UC分享.json',
    'jx/_30wmv.js',
    'jx/奇奇.js',
    'jx/芒果关姐.js',
];
const GREEN_FILE_RE = /\[[^\]]*密[^\]]*\]/;

function isExcludedSource(relPath, { green = false } = {}) {
    const norm = relPath.replace(/\\/g, '/');
    if (SOURCE_EXCLUDES.includes(norm)) return true;
    if (green && GREEN_FILE_RE.test(basename(norm))) return true;
    return false;
}

function copyDir(src, dest, { green = false, root = '' } = {}) {
    mkdirSync(dest, { recursive: true });
    for (const entry of readdirSync(src)) {
        const relPath = root ? `${root}/${entry}` : entry;
        if (DIR_EXCLUDES.includes(relPath)) continue;
        const srcPath = join(src, entry);
        const stat = statSync(srcPath);
        if (stat.isDirectory()) {
            copyDir(srcPath, join(dest, entry), { green, root: relPath });
        } else {
            if (isExcludedSource(relPath, { green })) continue;
            copyFileSync(srcPath, join(dest, entry));
        }
    }
}

function copyNodeModules(root, staging) {
    const srcNm = join(root, 'node_modules');
    const destNm = join(staging, 'node_modules');
    if (!existsSync(srcNm)) return;
    mkdirSync(destNm, { recursive: true });

    const items = readdirSync(srcNm);
    for (const item of items) {
        if (item.startsWith('.')) continue;
        const srcPath = join(srcNm, item);
        const destPath = join(destNm, item);
        const stat = statSync(srcPath);
        if (stat.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            copyFileSync(srcPath, destPath);
        }
    }
}

function buildStaging(root, staging, { green = false } = {}) {
    if (existsSync(staging)) rmSync(staging, { recursive: true, force: true });
    mkdirSync(staging, { recursive: true });

    for (const file of ROOT_FILES) {
        if (existsSync(join(root, file))) copyFileSync(join(root, file), join(staging, file));
    }
    for (const dir of ROOT_DIRS) {
        if (existsSync(join(root, dir))) copyDir(join(root, dir), join(staging, dir), { green, root: dir });
    }
    for (const sub of SUB_PATHS) {
        const src = join(root, sub);
        if (!existsSync(src)) continue;
        if (statSync(src).isFile()) {
            mkdirSync(dirname(join(staging, sub)), { recursive: true });
            copyFileSync(src, join(staging, sub));
        } else {
            copyDir(src, join(staging, sub), { root: sub });
        }
    }
    for (const skeleton of DATA_SKELETON) {
        const dir = join(staging, skeleton);
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, '.gitkeep'), '');
    }

    copyNodeModules(root, staging);
    return staging;
}

function main() {
    const root = __dirname;
    const args = process.argv.slice(2);
    const green = args.includes('-g') || args.includes('--green');
    const useZip = args.includes('-z') || args.includes('--zip');

    const now = new Date();
    const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const baseProj = basename(root);

    const namesToBuild = [
        `drpy-node-${date}${green ? '-green' : ''}${useZip ? '.zip' : '.7z'}`,
    ];
    if (baseProj !== 'drpy-node') {
        namesToBuild.push(`${baseProj}-${date}${green ? '-green' : ''}${useZip ? '.zip' : '.7z'}`);
    }

    const staging = resolve(root, '..', `drpy-node-staging-${date}${green ? '-green' : ''}`);
    console.log(`[package.js] staging: ${staging}`);
    buildStaging(root, staging, { green });

    const type = useZip ? 'zip' : '7z';
    const primaryArchive = resolve(root, '..', namesToBuild[0]);
    console.log(`[package.js] archiving to ${primaryArchive}`);
    execSync(`7z a -t${type} "${primaryArchive}" "${join(staging, '*')}" -xr!.gitkeep`, { stdio: 'inherit' });

    for (let i = 1; i < namesToBuild.length; i++) {
        const target = resolve(root, '..', namesToBuild[i]);
        console.log(`[package.js] duplicating link/copy to ${target}`);
        copyFileSync(primaryArchive, target);
    }

    rmSync(staging, { recursive: true, force: true });
    console.log(`[package.js] finished: ${primaryArchive}`);
}

main();
