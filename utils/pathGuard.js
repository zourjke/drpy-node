import path from 'path';
import {PROJECT_ROOT} from './pathHelper.js';

/**
 * 用户输入路径安全校验 (P2 公共层抽取)
 *
 * 收敛 controllers/admin/filesController.js 与 sourcesController.js
 * 两处近乎逐字重复的 isSafePath 实现；校验语义与原实现完全一致：
 * 1. 非空字符串且不允许绝对路径
 * 2. resolve 后必须位于 PROJECT_ROOT 内
 * 3. 相对路径任意片段命中黑名单则拒绝
 */

export const DEFAULT_PATH_BLACKLIST = ['node_modules', 'database.db', '.git', '.env'];

/** 解析出相对 PROJECT_ROOT 的路径；结构无效（空/非字符串/绝对路径/越界）返回 null */
function resolveRelative(filePath) {
    if (!filePath || typeof filePath !== 'string') return null;

    // 用户输入直接给绝对路径一律拒绝
    if (path.isAbsolute(filePath)) return null;

    const fullPath = path.resolve(PROJECT_ROOT, filePath);
    const cwd = PROJECT_ROOT;

    if (!fullPath.startsWith(cwd)) return null;

    return path.relative(cwd, fullPath);
}

/**
 * @param {string} filePath - 用户提供的相对路径
 * @param {Object} [options]
 * @param {string[]} [options.blacklist] - 自定义黑名单（默认 {@link DEFAULT_PATH_BLACKLIST}）
 * @returns {boolean}
 */
export function safePath(filePath, {blacklist = DEFAULT_PATH_BLACKLIST} = {}) {
    const relativePath = resolveRelative(filePath);
    if (relativePath === null) return false;

    if (blacklist.some((item) => relativePath.includes(item))) return false;

    return true;
}

/**
 * 返回路径中第一个命中的黑名单项；未命中或路径本身无效返回 null。
 * 供调用方区分「路径无效」与「命中保护名单」两种拒绝原因，给出准确提示。
 */
export function findBlacklistedItem(filePath, blacklist = DEFAULT_PATH_BLACKLIST) {
    const relativePath = resolveRelative(filePath);
    if (relativePath === null) return null;

    return blacklist.find((item) => relativePath.includes(item)) ?? null;
}

export default safePath;
