import {logError} from './log.js';
import { PROJECT_ROOT } from './pathHelper.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import axios from 'axios';
import AdmZip from 'adm-zip';
import iconv from 'iconv-lite';
import { ensureExecutable } from './binHelper.js';
import { loadPluginsConfig, savePluginsConfig } from './pluginsConfigFile.js';

/**
 * 插件市场核心模块：市场源聚合、插件包下载/解压/落位、安装状态推导、.plugins.js 登记
 *
 * 状态模型"磁盘即真相"：安装状态与版本实时从 plugins/<name>/plugin.json 推导，
 * 不引入第二个状态文件。形态 B（上游原始包无 manifest）安装时由安装器用市场清单
 * 条目生成 plugin.json 落盘，保证该模型成立。详见 docs/plugin-market-design.md。
 */

const MARKET_CONFIG_PATH = path.join(PROJECT_ROOT, 'config', 'market.json');
const TMP_DIR = path.join(PROJECT_ROOT, 'data', 'market-tmp');
const PLUGINS_DIR = path.join(PROJECT_ROOT, 'plugins');

const MAX_DOWNLOAD_BYTES = 500 * 1024 * 1024; // 500MB
// 单个安装包大小上限（市场下载与后台上传共用同一约束）
export const MAX_UPLOAD_BYTES = MAX_DOWNLOAD_BYTES;
const DOWNLOAD_TIMEOUT = 600000; // 10min
const MARKET_CACHE_TTL = 60 * 1000;

// ==================== 版本比较 ====================

// 数值段比较已收敛至 utils/semver.js，此处 re-export 保持既有 import 兼容
export { compareVersions } from './semver.js';

// ==================== 压缩包安全与结构 ====================

/**
 * Zip Slip 防护：校验压缩包条目名，拒绝相对路径逃逸/绝对路径/盘符/NUL
 * @returns {boolean} true 表示条目名安全
 */

// zip 中文文件名解码：adm-zip 默认 UTF-8，Windows 创建的 zip 常用 GBK 编码中文文件名
function decodeZipEntryName(entry) {
    const raw = entry.rawEntryName;
    if (!raw) return entry.entryName;
    const utf8 = raw.toString('utf8');
    // UTF-8 解码无替换字符说明是合法 UTF-8，直接用
    if (!utf8.includes('\uFFFD')) return utf8;
    // 否则用 GBK 解码
    try { return iconv.decode(raw, 'gbk'); } catch { return utf8; }
}

export function safeZipEntryName(entryName) {
    if (typeof entryName !== 'string' || entryName.length === 0) return false;
    if (entryName.includes('\0')) return false;
    const normalized = entryName.replace(/\\/g, '/');
    if (path.isAbsolute(normalized) || /^[a-zA-Z]:/.test(normalized)) return false;
    if (normalized.split('/').includes('..')) return false;
    return true;
}

/**
 * 剥壳判定（在条目名列表上做，不落盘）：
 * - 根级含 plugin.json → 无壳，返回 { prefix: '' }
 * - 根级仅一个目录壳且所有文件在其下 → 返回 { prefix: 'topdir/' }
 * - 其余 → 抛「包结构无法识别」
 * @param {string[]} entryNames 压缩包条目名（posix 风格）
 */
export function resolveZipRoot(entryNames) {
    const files = entryNames.filter(n => typeof n === 'string' && n.length > 0 && !n.endsWith('/'));
    if (files.length === 0) throw new Error('压缩包为空');
    if (files.some(n => n === 'plugin.json')) return {prefix: ''};

    const tops = new Set(files.map(n => n.split('/')[0]));
    if (tops.size === 1) {
        const top = [...tops][0];
        if (files.some(n => n.startsWith(top + '/'))) return {prefix: top + '/'};
    }
    throw new Error('包结构无法识别：根级无 plugin.json 且顶层目录不唯一');
}

// ==================== 市场源 ====================

let marketCache = {at: 0, data: null};

const DEFAULT_MARKET_CONFIG = {
    sources: ['config/market-plugins.json'],
    ghProxy: 'https://github.catvod.com/'
};

export function loadMarketConfig() {
    try {
        const cfg = JSON.parse(fs.readFileSync(MARKET_CONFIG_PATH, 'utf-8'));
        return {
            sources: Array.isArray(cfg.sources) ? cfg.sources.filter(s => typeof s === 'string' && s) : [],
            ghProxy: typeof cfg.ghProxy === 'string' ? cfg.ghProxy : ''
        };
    } catch {
        return {...DEFAULT_MARKET_CONFIG};
    }
}

export function saveMarketConfig(cfg) {
    if (!Array.isArray(cfg.sources)) throw new TypeError('sources must be an array');
    const normalized = {
        sources: cfg.sources.filter(s => typeof s === 'string' && s),
        ghProxy: typeof cfg.ghProxy === 'string' ? cfg.ghProxy : ''
    };
    fs.mkdirSync(path.dirname(MARKET_CONFIG_PATH), {recursive: true});
    fs.writeFileSync(MARKET_CONFIG_PATH, JSON.stringify(normalized, null, 2), 'utf-8');
    marketCache.at = 0; // 失效缓存
}

const GITHUB_HOST_RE = /(^|\.)(github\.com|githubusercontent\.com|githubassets\.com)$/;
const isGithubUrl = (u) => {
    try { return GITHUB_HOST_RE.test(new URL(u).hostname); } catch { return false; }
};

async function fetchMarketSource(src, ghProxy) {
    if (/^https?:\/\//i.test(src)) {
        // cache-buster：规避 CDN/代理对同一 URL 的内容滞留，保证发版后市场尽快可见
        const bust = (u) => {
            const parsed = new URL(u);
            parsed.searchParams.set('_', String(Date.now()));
            return parsed.toString();
        };
        try {
            const resp = await axios.get(bust(src), {timeout: 15000, headers: {'User-Agent': 'drpy-node-market'}});
            return resp.data;
        } catch (err) {
            // GitHub 域名（含 raw.githubusercontent.com）直连失败时用 ghProxy 兜底重试
            if (ghProxy && isGithubUrl(src)) {
                const proxied = ghProxy.replace(/\/+$/, '') + '/' + bust(src);
                const resp = await axios.get(proxied, {timeout: 15000, headers: {'User-Agent': 'drpy-node-market'}});
                return resp.data;
            }
            throw err;
        }
    }
    // 本地文件源（相对 PROJECT_ROOT，防逃逸）
    const p = path.resolve(PROJECT_ROOT, src);
    if (!p.startsWith(PROJECT_ROOT + path.sep) && p !== PROJECT_ROOT) throw new Error('非法源路径');
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

/**
 * 聚合所有市场源：按 name 去重（先注册的源优先），单源失败不阻塞聚合
 * @returns {Promise<{plugins: Array, errors: Array<{source, error}>, sources: string[]}>}
 */
export async function getMarketIndex({refresh = false} = {}) {
    if (!refresh && marketCache.data && Date.now() - marketCache.at < MARKET_CACHE_TTL) {
        return marketCache.data;
    }
    const cfg = loadMarketConfig();
    const plugins = [];
    const errors = [];
    for (const src of cfg.sources) {
        try {
            const idx = await fetchMarketSource(src, cfg.ghProxy);
            for (const p of (idx && Array.isArray(idx.plugins) ? idx.plugins : [])) {
                if (p && p.name && !plugins.some(x => x.name === p.name)) plugins.push(p);
            }
        } catch (e) {
            errors.push({source: src, error: e.message});
        }
    }
    const data = {plugins, errors, sources: cfg.sources};
    marketCache = {at: Date.now(), data};
    return data;
}

// ==================== 本地安装状态 ====================

function isValidPluginName(name) {
    return typeof name === 'string' && /^[A-Za-z0-9._-]+$/.test(name) && !name.includes('..');
}

export function getPluginDir(name) {
    if (!isValidPluginName(name)) throw new Error(`非法插件名: ${name}`);
    return path.join(PLUGINS_DIR, name);
}

/**
 * 读取已安装插件的 manifest（plugins/<name>/plugin.json），无 manifest 或解析失败返回 null
 */
export function getInstalledManifest(name) {
    try {
        const p = path.join(getPluginDir(name), 'plugin.json');
        if (!fs.existsSync(p)) return null;
        return JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch {
        return null;
    }
}

/**
 * 扫描 plugins/ 下已安装的插件目录
 * @returns {Array<{name: string, manifest: Object|null}>}
 */
export function listInstalledPlugins() {
    if (!fs.existsSync(PLUGINS_DIR)) return [];
    return fs.readdirSync(PLUGINS_DIR, {withFileTypes: true})
        .filter(d => d.isDirectory() && !d.name.startsWith('.') && isValidPluginName(d.name))
        .map(d => ({name: d.name, manifest: getInstalledManifest(d.name)}));
}

// ==================== 下载与安装 ====================

async function downloadOnce(url, destPath, onProgress) {
    const resp = await axios.get(url, {
        responseType: 'stream',
        timeout: DOWNLOAD_TIMEOUT,
        maxRedirects: 10,
        headers: {'User-Agent': 'drpy-node-market'}
    });
    const contentLength = parseInt(resp.headers['content-length'] || '0', 10);
    if (contentLength > MAX_DOWNLOAD_BYTES) {
        resp.data.destroy();
        throw new Error(`文件大小 ${contentLength} 超过上限 ${MAX_DOWNLOAD_BYTES}`);
    }
    await fs.promises.mkdir(path.dirname(destPath), {recursive: true});
    const out = fs.createWriteStream(destPath);
    let received = 0;
    await new Promise((resolve, reject) => {
        resp.data.on('data', (chunk) => {
            received += chunk.length;
            if (received > MAX_DOWNLOAD_BYTES) {
                resp.data.destroy();
                out.destroy();
                reject(new Error(`下载内容超过大小上限 ${MAX_DOWNLOAD_BYTES}`));
                return;
            }
            // onProgress(receivedBytes, totalBytes)；total 可能为 0（无 content-length，进度未知）
            try { onProgress?.(received, contentLength); } catch {}
        });
        resp.data.pipe(out);
        out.on('finish', resolve);
        out.on('error', reject);
        resp.data.on('error', reject);
    });
}

/**
 * 纯函数：构建下载候选 URL 列表——直连优先，GitHub 系链接（github.com / raw.githubusercontent.com 等）
 * 失败时用 ghProxy 前缀兜底重试。非法 URL 返回空数组。
 */
export function buildDownloadUrls(url, ghProxy) {
    try { new URL(url); } catch { return []; }
    const urls = [url];
    if (ghProxy && isGithubUrl(url)) urls.push(ghProxy.replace(/\/+$/, '') + '/' + url);
    return urls;
}

/**
 * 下载文件：直连优先，GitHub 系链接（github.com / raw.githubusercontent.com 等）失败时用 ghProxy 前缀兜底重试
 * @param {Function} [onProgress] (receivedBytes, totalBytes) => void
 * @returns {Promise<{ok: boolean, url?: string, error?: string}>}
 */
export async function downloadFile(url, destPath, ghProxy, onProgress) {
    const urls = buildDownloadUrls(url, ghProxy);
    if (urls.length === 0) return {ok: false, error: '非法下载地址'};
    let lastErr = null;
    for (const u of urls) {
        try {
            await downloadOnce(u, destPath, onProgress);
            return {ok: true, url: u};
        } catch (e) {
            lastErr = e;
            logError(`[pluginMarket] 下载失败 (${u}): ${e.message}`);
        }
    }
    return {ok: false, error: lastErr?.message || '下载失败'};
}

function buildManifestFromEntry(entry) {
    return {
        name: entry.name,
        version: entry.version || '0.0.0',
        title: entry.title || entry.name,
        desc: entry.desc || '',
        author: entry.author || '',
        runtime: entry.runtime || 'binary',
        entry: entry.entry || 'index.js',
        params: entry.params || '',
        env: entry.env || {},
        binaries: entry.binaries,
        python: entry.python,
        platforms: entry.platforms,
        homepage: entry.homepage,
        _source: entry._source || 'market'
    };
}

/**
 * 纯读取：从上传的安装包预读元信息，生成 installPlugin 所需的 entry
 * （上传安装没有市场清单条目，name/version/runtime 等只能从包内推导）
 * - 包内有 plugin.json：以 manifest 为准（name 必填，其余字段透传）
 * - 无 manifest：从 zip 文件名推断 name；包内有 index.js/package.json → node 型，否则 binary 型
 * 非法条目（ZipSlip）在预读阶段即拒绝，上传接口可直接返回 400 而不产生后台任务
 * @param {string} zipPath 安装包路径
 * @param {string} uploadName 上传时的文件名（无 manifest 包用于推断插件名）
 * @returns {Object} entry（不含 sha256，由调用方按需附加）
 * @throws 包为空 / 结构无法识别 / 含非法路径条目 / manifest 解析失败或缺 name
 */
export function buildEntryFromZip(zipPath, uploadName) {
    const zip = new AdmZip(zipPath);
    const names = zip.getEntries().map(e => decodeZipEntryName(e));
    for (const n of names) {
        if (!safeZipEntryName(n)) throw new Error(`压缩包含非法路径条目: ${n}`);
    }
    const root = resolveZipRoot(names);
    const mfName = names.find(n => n === root.prefix + 'plugin.json');
    if (mfName) {
        let mf;
        try {
            mf = JSON.parse(zip.readAsText(mfName));
        } catch {
            throw new Error('包内 plugin.json 解析失败');
        }
        if (!mf || !mf.name) throw new Error('包内 plugin.json 缺少 name 字段');
        return {
            name: mf.name, version: mf.version, title: mf.title, desc: mf.desc,
            author: mf.author, runtime: mf.runtime, entry: mf.entry,
            params: mf.params, env: mf.env, binaries: mf.binaries,
            python: mf.python, platforms: mf.platforms
        };
    }
    const base = path.basename(String(uploadName || ''), '.zip')
        .replace(/[^\w.-]+/g, '-').replace(/^[-.]+|[-.]+$/g, '') || 'uploaded-plugin';
    // 无 manifest 包的 runtime 推断顺序：node（index.js/package.json）→ python（requirements.txt，
    // 入口默认 main.py，规范要求 python 型自带 plugin.json 指明 entry，此为兜底）→ binary
    const pyEntry = names.find(n => n === root.prefix + 'requirements.txt');
    if (pyEntry) return {name: base, title: base, runtime: 'python', entry: 'main.py'};
    const nodeEntry = names.some(n => n === root.prefix + 'index.js' || n === root.prefix + 'package.json');
    return {name: base, title: base, runtime: nodeEntry ? 'node' : 'binary', entry: 'index.js'};
}

/**
 * 装后完整性校验：node/python 型断言入口文件存在；binary 型按 binaries 映射或命名约定找任一平台二进制
 */
function checkIntegrity(pluginDir, manifest) {
    if (manifest.runtime === 'node' || manifest.runtime === 'python') {
        const entryFile = path.join(pluginDir, manifest.entry || (manifest.runtime === 'python' ? 'main.py' : 'index.js'));
        if (!fs.existsSync(entryFile)) {
            return {ok: false, error: `入口文件缺失: ${manifest.entry || (manifest.runtime === 'python' ? 'main.py' : 'index.js')}`};
        }
        return {ok: true};
    }
    const candidates = new Set();
    if (manifest.binaries) Object.values(manifest.binaries).forEach(f => f && candidates.add(f));
    candidates.add(`${manifest.name}-win.exe`);
    candidates.add(`${manifest.name}-linux`);
    candidates.add(`${manifest.name}-darwin`);
    candidates.add(`${manifest.name}-android`);
    for (const c of candidates) {
        if (fs.existsSync(path.join(pluginDir, c))) return {ok: true};
    }
    return {ok: false, error: '未在包内找到任何平台二进制文件'};
}

function ensureExecutableAll(pluginDir, manifest) {
    const targets = new Set();
    if (manifest.binaries) Object.values(manifest.binaries).forEach(f => f && targets.add(f));
    if (manifest.runtime === 'python') targets.add(manifest.entry || 'main.py');
    if (manifest.binaries) Object.values(manifest.binaries).forEach(f => f && targets.add(f));
    targets.add(`${manifest.name}-win.exe`);
    targets.add(`${manifest.name}-linux`);
    targets.add(`${manifest.name}-darwin`);
    targets.add(`${manifest.name}-android`);
    if (manifest.runtime === 'node') targets.add(manifest.entry || 'index.js');
    for (const f of targets) {
        const p = path.join(pluginDir, f);
        if (fs.existsSync(p)) ensureExecutable(p);
    }
}

/**
 * 纯函数：市场清单条目合并进 .plugins.js 配置数组（可单测的合并规则）
 * - 同名条目存在：仅补缺失/空字段（保留用户已改的 params/env/active），active 仅在原值为 undefined 时设置
 * - 不存在：追加 { ...manifest 映射, path: 'plugins/<name>', active }
 * @returns {Array} 新数组（不修改入参）
 */
export function mergePluginEntry(plugins, manifest, active = false) {
    const defaults = {
        name: manifest.name,
        path: `plugins/${manifest.name}`,
        runtime: manifest.runtime || 'binary',
        entry: manifest.entry || 'index.js',
        params: manifest.params || '',
        env: manifest.env || {},
        desc: manifest.desc || manifest.title || ''
    };
    const next = plugins.map(p => ({...p}));
    const idx = next.findIndex(p => p.name === manifest.name);
    if (idx >= 0) {
        const cur = next[idx];
        for (const [k, v] of Object.entries(defaults)) {
            if (cur[k] === undefined || cur[k] === null || cur[k] === '') cur[k] = v;
        }
        if (cur.active === undefined && (active === true || active === false)) cur.active = active;
        return next;
    }
    next.push({...defaults, active: active === true});
    return next;
}

/**
 * 纯函数：从 .plugins.js 配置数组移除指定插件（可单测）
 */
export function removePluginEntry(plugins, name) {
    return plugins.filter(p => p.name !== name);
}

/**
 * 安装插件包：下载/本地包 → 校验 → 剥壳解压 → manifest 落盘 → 完整性校验 → 登记 .plugins.js
 * @param {Object} opts
 * @param {Object} opts.entry 市场清单条目（含 name/version/runtime 等）
 * @param {string} [opts.zipPath] 本地安装包路径（上传安装入口）：提供时跳过下载直接以该文件安装，
 *   与 entry.download 二选一；处理完成后该文件会被清理（与下载的临时 zip 同生命周期）
 * @param {string} [opts.ghProxy] GitHub 下载加速前缀
 * @param {boolean|null} [opts.active] 新装时的启用状态；null 表示登记时不动 active
 * @param {Function} [opts.onProgress] (stage, percent, message) => void
 *   stage: download(0-70, 含字节消息) | verify(~72) | extract(~78-84) | register(~88)
 *   percent 缺省表示该阶段进度未知（前端按不定进度渲染）
 * @returns {Promise<{name: string, version: string, dir: string}>}
 */
export async function installPlugin({entry, zipPath: localZip, ghProxy, active = false, onProgress}) {
    if (!entry || !entry.name) throw new Error('市场清单条目缺少 name 字段');
    if (!localZip && !entry.download) throw new Error('安装包缺失：需提供 entry.download 或 zipPath');
    const name = entry.name;
    const pluginDir = getPluginDir(name); // 校验 name 合法性

    await fs.promises.mkdir(TMP_DIR, {recursive: true});
    const tmpZipPath = localZip || path.join(TMP_DIR, `${name}-${Date.now()}.zip`);

    if (localZip) {
        onProgress?.('download', 70, '读取上传的安装包...');
    } else {
        onProgress?.('download', 1, '开始下载安装包...');
        const dl = await downloadFile(entry.download, tmpZipPath, ghProxy, (received, total) => {
            if (total > 0) {
                onProgress?.('download', Math.max(1, Math.min(70, 1 + (received / total) * 69)),
                    `下载中 ${fmtBytes(received)} / ${fmtBytes(total)}`);
            } else {
                onProgress?.('download', undefined, `下载中 ${fmtBytes(received)}`);
            }
        });
        if (!dl.ok) throw new Error(`下载失败: ${dl.error}`);
    }

    try {
        onProgress?.('verify', 72, '校验安装包完整性...');
        if (entry.sha256) {
            const hash = crypto.createHash('sha256').update(await fs.promises.readFile(tmpZipPath)).digest('hex');
            if (hash !== String(entry.sha256).toLowerCase()) throw new Error('sha256 校验失败，安装包可能被篡改或下载不完整');
        }

        onProgress?.('extract', 76, '解析安装包...');
        const zip = new AdmZip(tmpZipPath);
        const entries = zip.getEntries();
        const names = entries.map(e => decodeZipEntryName(e));
        for (const n of names) {
            if (!safeZipEntryName(n)) throw new Error(`压缩包含非法路径条目: ${n}`);
        }
        const root = resolveZipRoot(names);

        // 旧目录先换名保留（覆盖安装/更新场景，失败可回滚）
        const bakPath = pluginDir + '.bak-' + Date.now();
        const hadOld = fs.existsSync(pluginDir);
        if (hadOld) {
            onProgress?.('extract', 78, '旧目录释放中，准备替换...');
            await movePluginDirAside(pluginDir, bakPath);
        }

        // 剥壳解压到 plugins/<name>/
        onProgress?.('extract', 80, `解压 ${entries.length} 个文件...`);
        try {
            await fs.promises.mkdir(pluginDir, {recursive: true});
            for (const e of entries) {
                if (e.isDirectory) continue;
                const entryName = decodeZipEntryName(e);
                const rel = entryName.startsWith(root.prefix) ? entryName.slice(root.prefix.length) : null;
                if (!rel) continue;
                const target = path.join(pluginDir, ...rel.split('/'));
                await fs.promises.mkdir(path.dirname(target), {recursive: true});
                fs.writeFileSync(target, e.getData());
            }
        } catch (err) {
            if (hadOld) {
                await restorePluginDir(bakPath, pluginDir);
            } else {
                await fs.promises.rm(pluginDir, {recursive: true, force: true}).catch(() => {});
            }
            throw new Error(`解压失败: ${err.message}`);
        }

        // manifest 落定：包内优先，缺失时用市场清单条目生成并落盘（磁盘即真相）
        onProgress?.('register', 86, '写入插件清单...');
        let manifest;
        const manifestPath = path.join(pluginDir, 'plugin.json');
        if (fs.existsSync(manifestPath)) {
            try {
                manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
            } catch {
                await rollback(pluginDir, bakPath, hadOld);
                throw new Error('包内 plugin.json 解析失败');
            }
            if (manifest.name !== name) {
                await rollback(pluginDir, bakPath, hadOld);
                throw new Error(`包内 manifest name (${manifest.name}) 与清单条目 (${name}) 不一致`);
            }
        } else {
            manifest = buildManifestFromEntry(entry);
            fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
        }
        if (!manifest.version) manifest.version = entry.version || '0.0.0';

        // 完整性校验，失败回滚
        const integrity = checkIntegrity(pluginDir, manifest);
        if (!integrity.ok) {
            await rollback(pluginDir, bakPath, hadOld);
            throw new Error(integrity.error);
        }

        // 落位成功，清理 .bak
        if (hadOld) await fs.promises.rm(bakPath, {recursive: true, force: true}).catch(() => {});

        ensureExecutableAll(pluginDir, manifest);

        onProgress?.('register', 89, '登记插件配置...');
        const {plugins} = await loadPluginsConfig();
        savePluginsConfig(mergePluginEntry(plugins, manifest, active));

        onProgress?.('register', 90, '安装完成');
        return {name, version: manifest.version, dir: `plugins/${name}`};
    } finally {
        await fs.promises.rm(tmpZipPath, {force: true}).catch(() => {});
    }
}

/**
 * Windows 下目录 rename 常因句柄延迟释放或杀软实时扫描临时锁定而 EPERM/EBUSY，
 * 异步重试若干次（退避 250ms 起步）——进程停止/解压后短暂等待即可成功
 * @throws 重试耗尽后抛出最后一次错误
 */
async function renameWithRetry(src, dest, {retries = 5} = {}) {
    let lastErr;
    for (let i = 0; i <= retries; i++) {
        try {
            fs.renameSync(src, dest);
            return;
        } catch (e) {
            lastErr = e;
            if (!/EPERM|EBUSY|ENOTEMPTY|EACCES/i.test(e.code || '')) throw e;
            await new Promise((r) => setTimeout(r, 250 * Math.pow(2, i)));
        }
    }
    throw lastErr;
}

/**
 * 把插件目录整体移到 bakPath（覆盖安装第一步）。
 * Windows 下若目录句柄被占用（资源管理器/索引服务停在目录上），父目录自身不可 rename
 * 但子项可以——此时退化为「逐项搬空 + 删空壳」，绕开父目录句柄。
 */
async function movePluginDirAside(pluginDir, bakPath) {
    try {
        await renameWithRetry(pluginDir, bakPath);
        return;
    } catch (e) {
        if (!/EPERM|EBUSY|EACCES/i.test(e.code || '')) throw e;
    }
    fs.mkdirSync(bakPath, {recursive: true});
    for (const entry of fs.readdirSync(pluginDir)) {
        await renameWithRetry(path.join(pluginDir, entry), path.join(bakPath, entry));
    }
    try { fs.rmdirSync(pluginDir); } catch {}
}

/** 回滚：把 bak 内容搬回 pluginDir（逐项搬运对句柄占用免疫，见 movePluginDirAside） */
async function restorePluginDir(bakPath, pluginDir) {
    try { fs.mkdirSync(pluginDir, {recursive: true}); } catch {}
    for (const entry of fs.readdirSync(bakPath)) {
        await renameWithRetry(path.join(bakPath, entry), path.join(pluginDir, entry));
    }
    try { fs.rmdirSync(bakPath); } catch {}
}

async function rollback(pluginDir, bakPath, hadOld) {
    await fs.promises.rm(pluginDir, {recursive: true, force: true}).catch(() => {});
    if (hadOld) await restorePluginDir(bakPath, pluginDir);
}

function fmtBytes(n) {
    if (!n) return '0 B';
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * 卸载插件：删除 plugins/<name>/ 目录并从 .plugins.js 移除配置（停止进程由调用方负责）
 */
export async function uninstallPluginFiles(name) {
    const pluginDir = getPluginDir(name);
    const existed = fs.existsSync(pluginDir);
    if (existed) await fs.promises.rm(pluginDir, {recursive: true, force: true});
    const {plugins} = await loadPluginsConfig();
    const next = removePluginEntry(plugins, name);
    if (next.length !== plugins.length) savePluginsConfig(next);
    return {removed: existed};
}
