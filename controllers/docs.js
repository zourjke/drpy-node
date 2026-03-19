/**
 * 文档服务控制器
 * 提供文档文件的访问和渲染功能
 * 支持Markdown文件渲染为HTML，以及其他静态文件的直接访问
 */
import path from 'path';
import {existsSync, readFileSync} from 'fs';
import {getMimeType} from '../utils/mime-type.js';
import '../utils/marked.min.js'; // Markdown解析库
// import { marked } from "marked";
import {validateBasicAuth} from "../utils/api_validate.js";

/**
 * 文档路由插件
 * 注册文档访问路由，支持Markdown渲染和静态文件访问
 * @param {Object} fastify - Fastify实例
 * @param {Object} options - 配置选项，包含docsDir文档目录路径
 * @param {Function} done - 插件注册完成回调
 */
export default (fastify, options, done) => {
    /**
     * 文档访问路由
     * 处理/docs/*路径下的所有文件访问请求
     * 支持Markdown文件渲染和其他文件类型的直接访问
     */
    fastify.get('/docs/*', {preHandler: validateBasicAuth}, async (request, reply) => {
        // 捕获整个路径参数
        const fullPath = request.params['*']; 
        console.log(`Request received for path: ${fullPath}`);
        try {
            // 将相对路径解析为绝对路径
            const resolvedPath = path.resolve(options.docsDir, fullPath); 

            // 安全检查：确保resolvedPath在docsDir目录下，防止路径遍历攻击
            if (!resolvedPath.startsWith(options.docsDir)) {
                reply.status(403).send(`<h1>403 Forbidden</h1><p>Access to the requested file is forbidden.</p>`);
                return;
            }
            fastify.log.info(`Resolved path: ${resolvedPath}`);

            // 检查文件是否存在
            if (!existsSync(resolvedPath)) {
                reply.status(404).send(`<h1>404 Not Found</h1><p>File "${fullPath}" not found in /docs.</p>`);
                return;
            }

            // 获取文件扩展名
            const ext = path.extname(resolvedPath).toLowerCase();

            // 处理Markdown文件
            if (ext === '.md') {
                // 读取Markdown文件内容
                const markdownContent = readFileSync(resolvedPath, 'utf8');
                // 解析Markdown为HTML，并替换$pwd占位符为实际密码
                const htmlContent = marked.parse(markdownContent).replaceAll('$pwd', process.env.API_PWD || '');

                // 返回完整的HTML页面
                reply.type('text/html').send(`
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>drpyS-${fullPath}</title>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 20px; padding: 0; }
                        h1, h2, h3 { color: #333; }
                        pre { background: #f4f4f4; padding: 10px; border-radius: 5px; }
                        code { font-family: monospace; }
                    </style>
                </head>
                <body>
                    ${htmlContent}
                </body>
                </html>
            `);
            } else {
                // 处理其他类型文件
                try {
                    // 获取文件MIME类型
                    const mimeType = getMimeType(ext);

                    // 根据MIME类型决定读取方式
                    if (mimeType.startsWith('text') || mimeType.includes('json') || mimeType.includes('javascript')) {
                        // 文本类型文件以UTF-8编码读取
                        const fileContent = readFileSync(resolvedPath, 'utf8'); 
                        reply.type(mimeType).send(fileContent);
                    } else {
                        // 二进制文件直接读取
                        const fileContent = readFileSync(resolvedPath);
                        reply.type(mimeType).send(fileContent);
                    }

                } catch (e) {
                    // 文件读取错误处理
                    console.log(e);
                }
            }
        } catch (error) {
            // 全局错误处理
            reply.status(500).send(`<h1>500 Internal Server Error</h1><p>Error reading or rendering file: ${error.message}</p>`);
        }
    });

    // 插件注册完成
    done();
};
