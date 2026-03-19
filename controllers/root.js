import path from 'path';
import {readdirSync, readFileSync, writeFileSync, existsSync, createReadStream} from 'fs';
import '../utils/marked.min.js';
// import { marked } from "marked";
import {computeHash} from '../utils/utils.js';
import {validateBasicAuth} from "../utils/api_validate.js";
import {daemon} from "../utils/daemonManager.js";
import {toBeijingTime} from "../utils/datetime-format.js"

export default (fastify, options, done) => {
    // 添加 / 接口
    fastify.get('/', {preHandler: validateBasicAuth}, async (request, reply) => {
        let readmePath = null;
        const indexHtmlPath = path.join(options.rootDir, 'public/index.html');
        // console.log(`indexHtmlPath:${indexHtmlPath}`);
        const files = readdirSync(options.rootDir);
        // console.log(files);
        for (const file of files) {
            if (/^readme\.md$/i.test(file)) {
                readmePath = path.join(options.rootDir, file);
                break;
            }
        }

        // 如果未找到 README.md 文件
        if (!readmePath && !process.env.VERCEL) {
            let fileHtml = files.map(file => `<li>${file}</li>`).join('');
            return reply.code(404).type('text/html;charset=utf-8').send(`<h1>README.md not found</h1><ul>${fileHtml}</ul>`);
        } else if (!readmePath && process.env.VERCEL) {
            const tmpIndexHtml = readFileSync(indexHtmlPath, 'utf-8');
            return reply.type('text/html;charset=utf-8').send(tmpIndexHtml);
        }

        // 读取 README.md 文件内容
        const markdownContent = readFileSync(readmePath, 'utf-8');

        // 将 Markdown 转换为 HTML
        const htmlContent = marked.parse(markdownContent).replaceAll('$pwd', process.env.API_PWD || '');
        const indexHtml = `
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>drpyS-README</title>
                </head>
                <body>
                    ${htmlContent}
                </body>
                </html>
            `;
        const indexHtmlHash = computeHash(indexHtml);
        if (!existsSync(indexHtmlPath)) {
            console.log(`将readme.md 本地文件:${indexHtmlPath}`);
            writeFileSync(indexHtmlPath, indexHtml, 'utf8');
        } else {
            const tmpIndexHtml = readFileSync(indexHtmlPath, 'utf-8');
            const tmpIndexHtmlHash = computeHash(tmpIndexHtml);
            if (indexHtmlHash !== tmpIndexHtmlHash) {
                console.log(`readme.md发生了改变，更新本地文件:${indexHtmlPath}`);
                writeFileSync(indexHtmlPath, indexHtml, 'utf8');
            }
        }

        // 返回 HTML 内容
        reply.type('text/html;charset=utf-8').send(indexHtml);
    });

    // 新增 /robots.txt 路由
    fastify.get('/robots.txt', (request, reply) => {
        const filePath = path.join(options.rootDir, 'public', 'robots.txt');
        const fileStream = createReadStream(filePath);
        // reply.type('text/plain;charset=utf-8').sendFile('robots.txt', path.join(options.rootDir, 'public'));
        reply.type('text/plain;charset=utf-8').send(fileStream);
    });

    // 新增 /favicon.ico 路由
    fastify.get('/favicon.ico', async (request, reply) => {
        try {
            // 设置文件路径
            const faviconPath = path.join(options.rootDir, 'public', 'favicon.ico');

            // 如果文件存在，返回图片
            if (existsSync(faviconPath)) {
                const fileStream = createReadStream(faviconPath);
                // return reply.sendFile('favicon.ico', path.join(options.rootDir, 'public')); // 直接返回图片
                return reply.type('image/x-icon').send(fileStream); // 直接返回图片
            } else {
                reply.status(404).send({error: 'Favicon not found'}); // 如果文件不存在，返回 404 错误
            }
        } catch (error) {
            reply.status(500).send({error: 'Failed to fetch favicon', details: error.message});
        }
    });

    fastify.get('/cat/index.html', {preHandler: validateBasicAuth}, async (request, reply) => {
        try {
            // 设置文件路径
            const catHtmlPath = path.join(options.rootDir, 'data/cat/index.html');

            if (existsSync(catHtmlPath)) {
                const protocol = request.headers['x-forwarded-proto'] || (request.socket.encrypted ? 'https' : 'http');  // http 或 https
                const hostname = request.hostname;
                // const port = request.socket.localPort;  // 获取当前服务的端口
                // let requestUrl = `${protocol}://${hostname}${request.url}`;
                let content = readFileSync(catHtmlPath, 'utf-8');
                const validUsername = process.env.API_AUTH_NAME || 'admin';
                const validPassword = process.env.API_AUTH_CODE || 'drpys';
                let catLink = `${protocol}://${validUsername}:${validPassword}@${hostname}/config/index.js.md5`;
                content = content.replace('$catLink', catLink);
                return reply.type('text/html').send(content);
            } else {
                reply.status(404).send({error: 'Favicon not found'}); // 如果文件不存在，返回 404 错误
            }
        } catch (error) {
            reply.status(500).send({error: 'Failed to fetch cat', details: error.message});
        }
    });

    // 健康检查端点
    fastify.get('/health', async (request, reply) => {
        return {
            status: 'ok',
            timestamp: toBeijingTime(new Date()),
            python: {
                available: await daemon.isPythonAvailable(),
                daemon_running: daemon.isDaemonRunning()
            }
        };
    });
    done();
};
