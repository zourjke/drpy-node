/**
 * 源路径工具与启用/停用状态管理（设计见 docs/source-toggle-design.md）
 *
 * 状态存储：config/source-states.json —— {"disabled": ["spider/js/xxx.js", ...]}
 * 以相对路径全称记录停用源；不在列表 = 启用（新源默认启用的天然实现）。
 * 读写失败一律降级为「全启用」并 logWarn：停用是运营功能，不能因配置异常阻断源服务。
 */
import fs from 'fs';
import path from 'path';
import {PROJECT_ROOT} from './pathHelper.js';
import {logWarn} from './log.js';

// 引擎目录映射（从 sourcesController 收敛至此，作为源路径工具的唯一真相源）
export const SOURCE_ENGINES = {
    js: {dir: 'spider/js', ext: '.js'},
    dr2: {dir: 'spider/js_dr2', ext: '.js'},
    catvod: {dir: 'spider/catvod', ext: '.js'},
    php: {dir: 'spider/php', ext: '.php'},
    py: {dir: 'spider/py', ext: '.py'},
};

/**
 * 纯函数：上传文件名与引擎类型校验（basename 化 + 扩展名白名单）
 * @returns {{ok: true, name: string} | {ok: false, error: string}}
 */
export function validateSourceFilename(engine, filename) {
    const cfg = SOURCE_ENGINES[engine];
    if (!cfg) return {ok: false, error: `不支持的源类型: ${engine}`};
    if (typeof filename !== 'string' || filename.trim().length === 0) {
        return {ok: false, error: '文件名不能为空'};
    }
    const name = path.basename(filename);
    if (name !== filename || name.includes('..') || name.includes('/') || name.includes('\\')) {
        return {ok: false, error: '文件名不能包含路径分隔符'};
    }
    if (!name.endsWith(cfg.ext)) return {ok: false, error: `${engine} 类型源仅支持 ${cfg.ext} 文件`};
    if (name.startsWith('_')) return {ok: false, error: '文件名不能以 _ 开头（保留前缀）'};
    if (name.length > 128) return {ok: false, error: '文件名过长（>128 字符）'};
    return {ok: true, name};
}

/**
 * 纯函数：删除路径 → 引擎匹配（按路径段前缀白名单，spider/js_bad 不会误匹配 spider/js）
 * @returns {null | {engine: string, name: string}} name 为目录内相对名（可含子路径，由调用方约束）
 */
export function matchSourceEngine(relPath) {
    if (typeof relPath !== 'string' || relPath.length === 0) return null;
    const norm = relPath.replace(/\\/g, '/');
    for (const [engine, cfg] of Object.entries(SOURCE_ENGINES)) {
        const prefix = cfg.dir + '/';
        if (norm.startsWith(prefix)) {
            return {engine, name: norm.slice(prefix.length)};
        }
    }
    return null;
}

// ==================== 启用/停用状态 ====================

const STATE_FILE = path.join(PROJECT_ROOT, 'config', 'source-states.json');
const EMPTY_SET = new Set();
// mtime 缓存：接口热读不重复解析，外部手改文件也能即时生效
let stateCache = null; // {mtimeMs, disabled: Set<string>}

function normalizeRel(relPath) {
    let rel = String(relPath || '').replace(/\\/g, '/');
    // 客户端可能传 URL 编码形态（%E7%83%AD...），统一解码归一到磁盘真实文件名；
    // 解码引入的非法结构（如 %2F 变子路径）由 isValidManagedPath 校验兜住
    try {
        rel = decodeURIComponent(rel);
    } catch {
        // 非法编码序列保留原值
    }
    return rel;
}

export function isValidManagedPath(relPath) {
    const m = matchSourceEngine(relPath);
    if (!m) return false;
    const cfg = SOURCE_ENGINES[m.engine];
    // 仅允许源目录内的单文件（不含子路径段与目录引用），扩展名匹配引擎
    return !!m.name && !m.name.includes('/') && m.name !== '..' && m.name !== '.'
        && !m.name.startsWith('_') && m.name.endsWith(cfg.ext);
}

/** 读停用集合（mtime 缓存；文件缺失/损坏 → 空集 = 全启用） */
export function getDisabledSet() {
    try {
        const st = fs.statSync(STATE_FILE);
        if (stateCache && stateCache.mtimeMs === st.mtimeMs) return stateCache.disabled;
        const parsed = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
        const list = Array.isArray(parsed.disabled) ? parsed.disabled.filter(isValidManagedPath) : [];
        const disabled = new Set(list.map(normalizeRel));
        stateCache = {mtimeMs: st.mtimeMs, disabled};
        return disabled;
    } catch {
        return EMPTY_SET;
    }
}

function writeDisabledSet(disabled) {
    const list = [...disabled].sort();
    fs.mkdirSync(path.dirname(STATE_FILE), {recursive: true});
    fs.writeFileSync(STATE_FILE, JSON.stringify({disabled: list}, null, 2), 'utf-8');
    stateCache = null; // 失效缓存，下次读重建
    return new Set(disabled);
}

/**
 * 批量设置启用/停用。跳过非法路径，返回实际生效的数量。
 * @param {string[]} paths 相对项目根的源路径
 * @param {boolean} enabled true=启用（从列表移除） false=停用（加入列表）
 * @returns {{updated: number, skipped: string[]}}
 */
export function setSourcesEnabled(paths, enabled) {
    if (!Array.isArray(paths) || paths.length === 0) return {updated: 0, skipped: []};
    const disabled = new Set(getDisabledSet());
    const skipped = [];
    let updated = 0;
    for (const raw of paths) {
        const rel = normalizeRel(raw);
        if (!isValidManagedPath(rel)) {
            skipped.push(rel);
            continue;
        }
        if (enabled) {
            if (disabled.delete(rel)) updated++;
        } else if (!disabled.has(rel)) {
            disabled.add(rel);
            updated++;
        }
    }
    if (updated > 0) writeDisabledSet(disabled);
    return {updated, skipped};
}

/** 删除源时联动清理停用列表残留（文件已不存在，条目留着是脏数据） */
export function removeDisabledPaths(paths) {
    const disabled = new Set(getDisabledSet());
    let removed = 0;
    for (const raw of paths) {
        if (disabled.delete(normalizeRel(raw))) removed++;
    }
    if (removed > 0) writeDisabledSet(disabled);
    return removed;
}

/** 某引擎目录下停用文件名的 Set（供 /config 组装过滤：disabledNames.has(filename)） */
export function getDisabledFilenameSet(dirPrefix) {
    const prefix = dirPrefix.replace(/\\/g, '/') + '/';
    const out = new Set();
    for (const rel of getDisabledSet()) {
        if (rel.startsWith(prefix)) out.add(rel.slice(prefix.length));
    }
    return out;
}

// ==================== 缓存配置重建钩子 ====================
// 停用/启用/删除源后需要重建 index.json/custom.json（/index 直接读缓存文件）。
// 组装逻辑依赖路由 options（各引擎目录），由 config.js 插件初始化时注册实现，
// 这里只暴露异步触发口：解耦 controller 间依赖，失败仅告警（下次 /config 请求自然重建）。
let indexRegenerator = null;

export function setIndexRegenerator(fn) {
    if (typeof fn === 'function') indexRegenerator = fn;
}

export function regenerateIndexAsync() {
    if (typeof indexRegenerator !== 'function') return;
    Promise.resolve()
        .then(() => indexRegenerator())
        .then((ok) => {
            if (ok === false) logWarn('[sourceState] index.json 异步重建未完成（可忽略，下次 /config 请求会重建）');
        })
        .catch((e) => logWarn('[sourceState] index.json 异步重建失败:', e?.message));
}
