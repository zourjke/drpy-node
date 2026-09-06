import {log, logError} from './log.js';
import fs from 'fs';
import path from 'path';

/**
 * 确保文件具有执行权限 (Linux/macOS)
 * @param {string} filePath 文件绝对路径
 */
export function ensureExecutable(filePath) {
    if (process.platform === "win32") {
        // Windows 不需要 chmod，直接返回
        return;
    }
    try {
        if (!fs.existsSync(filePath)) {
             return;
        }
        const stats = fs.statSync(filePath);
        if (!(stats.mode & 0o111)) {
            fs.chmodSync(filePath, 0o755);
            log(`[binHelper] 已为文件 ${filePath} 添加执行权限`);
        }
    } catch (err) {
        logError(`[binHelper] 无法设置执行权限: ${filePath}`, err.message);
    }
}

/**
 * 检查并准备二进制文件（检查存在性 + 赋予权限）
 * @param {string} binPath 二进制文件路径或命令
 * @returns {string|null} 如果是现有文件路径返回路径，如果是全局命令返回原命令，如果文件不存在返回 null
 */
export function prepareBinary(binPath) {
    if (!binPath) return null;
    
    // 如果不包含路径分隔符，假定是全局命令（如 'php', 'node'），直接返回
    // 注意：这里简单判断，如果用户写 ./php 或 /usr/bin/php 都会进入下面的 exist 检查
    if (!binPath.includes('/') && !binPath.includes('\\')) {
        return binPath;
    }

    // 如果是路径，检查是否存在
    if (fs.existsSync(binPath)) {
        ensureExecutable(binPath);
        return binPath;
    }
    
    // 路径不存在
    return null;
}
