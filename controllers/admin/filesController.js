/**
 * 文件管理控制器
 * 提供文件列表、读取、写入、删除功能
 */

import fs from '../../utils/fsWrapper.js';
import path from 'path';
import mime from 'mime-types';

// 列出目录
export async function listDirectory(req, reply) {
    try {
        const dirPath = req.query.path || '.';

        if (!isSafePath(dirPath)) {
            return reply.code(403).send({
                error: '访问被拒绝'
            });
        }

        const fullPath = path.join(process.cwd(), dirPath);
        const files = await fs.readdir(fullPath, { withFileTypes: true });

        const result = files.map(f => {
            const isDir = f.isDirectory();
            return {
                name: f.name,
                path: dirPath === '.' ? f.name : `${dirPath}/${f.name}`,
                isDirectory: isDir,
                size: isDir ? undefined : 0 // fs.stat is expensive to do for all files, so omit size here unless needed
            };
        });

        // 异步获取文件大小
        for (let i = 0; i < result.length; i++) {
            if (!result[i].isDirectory) {
                try {
                    const stat = await fs.stat(path.join(fullPath, result[i].name));
                    result[i].size = stat.size;
                } catch (e) {
                    // Ignore stat errors
                }
            }
        }

        return reply.send({ files: result });
    } catch (e) {
        reply.code(500).send({
            error: e.message
        });
    }
}

// 读取文件
export async function readFile(req, reply) {
    try {
        const { path: filePath } = req.query;

        if (!filePath || !isSafePath(filePath)) {
            return reply.code(403).send({
                error: '无效的文件路径'
            });
        }

        const fullPath = path.join(process.cwd(), filePath);

        if (!await fs.pathExists(fullPath)) {
            return reply.code(404).send({
                error: '文件不存在'
            });
        }

        const ext = path.extname(filePath).toLowerCase();
        const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.bmp', '.tiff', '.tif'];

        if (imageExts.includes(ext)) {
            // 图片文件 - 返回 base64
            const buffer = await fs.readFile(fullPath);
            const base64 = buffer.toString('base64');
            const mimeType = mime.lookup(fullPath) || 'image/png';

            return reply.send({
                type: 'image',
                mimeType,
                dataUrl: `data:${mimeType};base64,${base64}`
            });
        }

        // 文本文件
        let content = await fs.readFile(fullPath, 'utf-8');

        // 如果是 JS 文件，尝试解码
        if (ext === '.js') {
            try {
                const { decodeDsSource } = await import('../../utils/dsHelper.js');
                content = await decodeDsSource(content);
            } catch (e) {
                // 保持原样
            }
        }

        return reply.send({
            type: 'text',
            content
        });
    } catch (e) {
        reply.code(500).send({
            error: e.message
        });
    }
}

// 写入文件
export async function writeFile(req, reply) {
    try {
        const { path: filePath, content } = req.body;

        if (!filePath || !isSafePath(filePath)) {
            return reply.code(403).send({
                error: '无效的文件路径'
            });
        }

        const fullPath = path.join(process.cwd(), filePath);

        // 确保目录存在
        await fs.ensureDir(path.dirname(fullPath));

        // 写入文件
        await fs.writeFile(fullPath, content, 'utf-8');

        return reply.send({
            success: true,
            message: '文件保存成功'
        });
    } catch (e) {
        reply.code(500).send({
            error: e.message
        });
    }
}

// 删除文件
export async function deleteFile(req, reply) {
    try {
        const { path: filePath } = req.query; // in fastify, DELETE params might be in query or we can use body depending on client

        const fp = filePath || (req.body && req.body.path);

        if (!fp || !isSafePath(fp)) {
            return reply.code(403).send({
                error: '无效的文件路径'
            });
        }

        const fullPath = path.join(process.cwd(), fp);

        if (!await fs.pathExists(fullPath)) {
            return reply.code(404).send({
                error: '文件不存在'
            });
        }

        await fs.remove(fullPath);

        return reply.send({
            success: true,
            message: '文件删除成功'
        });
    } catch (e) {
        reply.code(500).send({
            error: e.message
        });
    }
}

function isSafePath(filePath) {
    if (!filePath || typeof filePath !== 'string') return false;
    
    // Prevent absolute paths from user input directly
    if (path.isAbsolute(filePath)) return false;

    // Resolve full path and check if it is within CWD
    const fullPath = path.resolve(process.cwd(), filePath);
    const cwd = process.cwd();
    
    // Ensure the resolved path is inside the current working directory
    if (!fullPath.startsWith(cwd)) return false;

    // Blacklist check for sensitive files/directories
    const blacklist = [
        'node_modules', 
        'database.db', 
        '.git', 
        '.env',
        'package-lock.json',
        'yarn.lock'
    ];
    
    // Check if any part of the relative path matches the blacklist
    // We check against the relative path to avoid matching parts of CWD
    const relativePath = path.relative(cwd, fullPath);
    if (blacklist.some(item => relativePath.includes(item))) return false;

    return true;
}
