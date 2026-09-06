/**
 * 文件管理控制器
 * 提供文件列表、读取、写入、删除功能
 */

import fs from '../../utils/fsWrapper.js';
import path from 'path';
import mime from 'mime-types';
import { PROJECT_ROOT } from '../../utils/pathHelper.js';
import {safePath, findBlacklistedItem, DEFAULT_PATH_BLACKLIST} from '../../utils/pathGuard.js';
import {isWritableCreatePath, isProtectedPath, isEditablePath, isDeletablePath, createTypeHint} from '../../utils/filePolicy.js';

// 列出目录
export async function listDirectory(req, reply) {
    try {
        const dirPath = req.query.path || '.';

        if (!isSafePath(dirPath)) {
            return reply.code(403).send({
                error: '访问被拒绝'
            });
        }

        const fullPath = path.join(PROJECT_ROOT, dirPath);
        const files = await fs.readdir(fullPath, { withFileTypes: true });

        const result = files.map(f => {
            const isDir = f.isDirectory();
            const relPath = dirPath === '.' ? f.name : `${dirPath}/${f.name}`;
            return {
                name: f.name,
                path: relPath,
                isDirectory: isDir,
                size: isDir ? undefined : 0, // fs.stat is expensive to do for all files, so omit size here unless needed
                protected: !isDir && isProtectedPath(relPath),
                editable: !isDir && fs.existsSync(path.join(PROJECT_ROOT, relPath)) && isEditablePath(relPath),
                deletable: !isDir && isDeletablePath(relPath),
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
                error: pathRejectMessage(filePath, '读取')
            });
        }

        const fullPath = path.join(PROJECT_ROOT, filePath);

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
        if (process.env.READ_ONLY_MODE === '1') {
            return reply.code(403).send({
                error: '系统当前处于只读模式，禁止修改文件'
            });
        }

        const { path: filePath, content } = req.body;

        if (!filePath || !isSafePath(filePath)) {
            return reply.code(403).send({
                error: pathRejectMessage(filePath, '修改')
            });
        }

        const relPath = filePath;
        const fullPath = path.join(PROJECT_ROOT, relPath);
        const exists = await fs.pathExists(fullPath);

        // 新建/修改分别校验（docs/file-manage-design.md §3）：
        // - 新建：仅白名单三处目录（根目录 json / config / json 下的 js|json）
        // - 修改：维持现状范围不收紧（源编辑器保存依赖此路径），但 json/ 下框架 json 只读保护
        //   （.txt/.m3u 数据文件豁免——设计明确其可编辑）
        if (!exists) {
            if (!isWritableCreatePath(relPath)) {
                // 区分两种拒绝原因：托管目录内类型不符 vs 目录本身不允许新建
                const dir = path.posix.dirname(relPath.replace(/\\/g, '/'));
                const dirOk = /^\/?(config|json)(\/|$)/i.test(dir);
                return reply.code(403).send({
                    error: dirOk
                        ? `不支持创建该类型的文件，${createTypeHint()}`
                        : '该目录不允许创建文件（源文件请走源管理的上传入口）'
                });
            }
        } else {
            const norm = relPath.replace(/\\/g, '/');
            const isFrameworkReadOnly = isProtectedPath(norm)
                && norm.toLowerCase().startsWith('json/')
                && !/\.(txt|m3u)$/i.test(norm);
            if (isFrameworkReadOnly) {
                return reply.code(403).send({
                    error: '框架文件受保护，禁止修改'
                });
            }
        }

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
        if (process.env.READ_ONLY_MODE === '1') {
            return reply.code(403).send({
                error: '系统当前处于只读模式，禁止删除文件'
            });
        }

        const { path: filePath } = req.query; // in fastify, DELETE params might be in query or we can use body depending on client

        const fp = filePath || (req.body && req.body.path);

        if (!fp || !isSafePath(fp)) {
            return reply.code(403).send({
                error: pathRejectMessage(fp, '删除')
            });
        }

        // 删除范围收紧（docs/file-manage-design.md §3）：仅白名单内的用户自建/生成缓存文件可删，
        // 框架保护文件 403 明确提示，范围外（spider/** 等）引导走源管理专用入口
        if (!isDeletablePath(fp)) {
            if (isProtectedPath(fp)) {
                return reply.code(403).send({
                    error: '框架文件受保护，不可删除'
                });
            }
            return reply.code(403).send({
                error: '该文件不允许通过文件管理删除（源文件请走源管理的删除入口）'
            });
        }

        const fullPath = path.join(PROJECT_ROOT, fp);

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

// P2：路径安全校验收敛至 utils/pathGuard.js（原为本文件内的重复实现）
const FILE_CONTROLLER_BLACKLIST = [
    ...DEFAULT_PATH_BLACKLIST,
    'package-lock.json',
    'yarn.lock'
];

function isSafePath(filePath) {
    return safePath(filePath, {blacklist: FILE_CONTROLLER_BLACKLIST});
}

// 403 提示区分两种拒绝原因：命中保护名单（如 .env/yarn.lock）给明确说明，其余才是路径无效
function pathRejectMessage(filePath, action) {
    const blocked = filePath && findBlacklistedItem(filePath, FILE_CONTROLLER_BLACKLIST);
    return blocked ? `该文件受安全策略保护，禁止${action}` : '无效的文件路径';
}
