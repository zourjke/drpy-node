import { PROJECT_ROOT } from '../utils/pathHelper.js';
/**
 * 剪贴板推送控制器
 * 提供剪贴板内容的添加、清空、读取功能
 */

import fs from 'fs/promises';
import path from 'path';
import {validateVercel} from '../utils/api_validate.js';

/**
 * 认证中间件（callback 风格，方便跟 validateVercel 一致）
 * @param {Object} request 请求对象
 * @param {Object} reply 响应对象
 * @param {Function} done 回调函数
 */
function authenticate(request, reply, done) {
    const SECURITY_CODE = process.env.CLIPBOARD_SECURITY_CODE;
    if (!SECURITY_CODE) return done(); // 不启用安全码

    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.code(401).send('Invalid authorization header format');
    }

    const token = authHeader.substring(7);
    if (token !== SECURITY_CODE) {
        return reply.code(401).send('Invalid security code');
    }

    done();
}

/**
 * 剪贴板推送插件
 * @param {Object} fastify Fastify实例
 * @param {Object} options 选项
 */
export default async function (fastify, options) {
    // 配置参数
    const MAX_TEXT_SIZE = parseInt(process.env.CLIPBOARD_MAX_SIZE) || 100 * 1024;
    const SECURITY_CODE = process.env.CLIPBOARD_SECURITY_CODE;
    const ALLOWED_CHARSET = process.env.CLIPBOARD_ALLOWED_CHARSET || 'utf8';
    const MAX_READ_SIZE = parseInt(process.env.CLIPBOARD_MAX_READ_SIZE) || 2 * 1024 * 1024;

    if (!SECURITY_CODE) {
        fastify.log.warn('CLIPBOARD_SECURITY_CODE is not set, API will be unprotected!');
    }

    // ===== 工具函数 =====
    
    /**
     * 检查文本是否包含可执行模式
     * @param {string} text 待检查文本
     * @returns {boolean} 是否包含可执行模式
     */
    function containsExecutablePatterns(text) {
        const executablePatterns = [
            /\x4D\x5A/, // MZ
            /\x7F\x45\x4C\x46/, // ELF
            /\x23\x21/, // Shebang
            /<\?php/,
            /<script\b[^>]*>/,
            /eval\(/,
            /javascript:/i,
            /vbscript:/i,
        ];
        return executablePatterns.some(pattern => pattern.test(text));
    }

    /**
     * 验证字符集是否有效
     * @param {string} text 待验证文本
     * @param {string} allowedCharset 允许的字符集
     * @returns {boolean} 字符集是否有效
     */
    function isValidCharset(text, allowedCharset) {
        try {
            if (allowedCharset === 'utf8') {
                Buffer.from(text, 'utf8').toString('utf8');
            }
            return true;
        } catch {
            return false;
        }
    }

    // ============ 添加文本接口 ============
    fastify.post('/clipboard/add', {
        preHandler: [validateVercel, authenticate],
    }, async (request, reply) => {
        const {text, mode = 'append'} = request.body;

        // 验证输入参数
        if (!text || typeof text !== 'string') {
            return reply.code(400).send('Valid text content is required');
        }
        if (!['append', 'overwrite'].includes(mode)) {
            return reply.code(400).send('Mode must be either "append" or "overwrite"');
        }

        // 检查文本大小
        const textSize = Buffer.byteLength(text, 'utf8');
        if (textSize > MAX_TEXT_SIZE) {
            return reply.code(413).send(`Text exceeds maximum size of ${MAX_TEXT_SIZE} bytes`);
        }
        // 安全检查
        if (containsExecutablePatterns(text)) {
            return reply.code(400).send('Content contains suspicious patterns');
        }
        if (!isValidCharset(text, ALLOWED_CHARSET)) {
            return reply.code(400).send('Text contains invalid characters');
        }

        // 文件路径安全检查
        const filePath = path.resolve(PROJECT_ROOT, 'clipboard.txt');
        if (!filePath.startsWith(PROJECT_ROOT)) {
            return reply.code(500).send('Invalid file path');
        }

        try {
            if (mode === 'append') {
                // 追加模式
                await fs.appendFile(filePath, text + '\n');
            } else {
                // 覆盖模式：先备份
                try {
                    const currentContent = await fs.readFile(filePath, 'utf8');
                    const backupPath = path.resolve(PROJECT_ROOT, 'clipboard.txt.bak');
                    if (backupPath.startsWith(PROJECT_ROOT)) {
                        await fs.writeFile(backupPath, currentContent);
                        fastify.log.info(`Clipboard content backed up to ${backupPath}`);
                    }
                } catch {
                    fastify.log.info('No existing clipboard file to backup');
                }
                await fs.writeFile(filePath, text + '\n');
            }

            return reply.send({
                success: true,
                message: `Text ${mode === 'append' ? 'appended' : 'written'} successfully`,
                size: textSize,
                mode,
            });
        } catch (err) {
            fastify.log.error(err);
            return reply.code(500).send('Failed to process the request');
        }
    });

    // ============ 清空文本接口 ============
    fastify.post('/clipboard/clear', {
        preHandler: [validateVercel, authenticate],
    }, async (request, reply) => {
        const filePath = path.resolve(PROJECT_ROOT, 'clipboard.txt');
        const backupPath = path.resolve(PROJECT_ROOT, 'clipboard.txt.bak');

        // 文件路径安全检查
        if (!filePath.startsWith(PROJECT_ROOT) || !backupPath.startsWith(PROJECT_ROOT)) {
            return reply.code(500).send('Invalid file path');
        }

        // 检查文件是否存在
        try {
            await fs.access(filePath);
        } catch {
            return reply.send({
                success: true,
                message: 'Clipboard already empty, no backup created',
            });
        }

        try {
            // 备份当前内容
            const currentContent = await fs.readFile(filePath, 'utf8');
            await fs.writeFile(backupPath, currentContent);
            fastify.log.info(`Clipboard content backed up to ${backupPath}`);

            // 清空文件
            await fs.writeFile(filePath, '');
            return reply.send({
                success: true,
                message: 'Clipboard cleared successfully, backup created',
                backupSize: Buffer.byteLength(currentContent, 'utf8'),
            });
        } catch (err) {
            fastify.log.error(err);
            return reply.code(500).send('Failed to clear clipboard');
        }
    });

    // ============ 读取文本接口 ============
    fastify.get('/clipboard/read', {
        preHandler: [validateVercel, authenticate],
    }, async (request, reply) => {
        const filePath = path.resolve(PROJECT_ROOT, 'clipboard.txt');
        // 文件路径安全检查
        if (!filePath.startsWith(PROJECT_ROOT)) {
            return reply.code(500).send('Invalid file path');
        }

        try {
            // 检查文件是否存在
            await fs.access(filePath).catch(() => null);

            // 检查文件大小
            const stats = await fs.stat(filePath).catch(() => ({size: 0}));
            if (stats.size === 0) {
                return reply.type('text/plain;charset=utf-8').send('');
            }
            if (stats.size > MAX_READ_SIZE) {
                return reply.code(413).send(`File size exceeds maximum read size of ${MAX_READ_SIZE} bytes`);
            }

            // 读取文件内容
            const content = await fs.readFile(filePath, 'utf8');
            return reply.type('text/plain;charset=utf-8').send(content);
        } catch (err) {
            fastify.log.error(err);
            return reply.code(500).send('Failed to read clipboard content');
        }
    });
}
