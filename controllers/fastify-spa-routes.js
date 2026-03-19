// Fastify SPA路由配置片段
// 在您现有的Fastify应用中添加以下代码来支持Vue SPA路由

import path from 'path';
import fs from 'fs';

// 在您现有的Fastify应用中添加这些路由
async function addSPARoutes(fastify, options) {
    // 支持的SPA应用列表，可以配置多个应用
    const spaApps = options.spaApps || ['drplayer'];

    // 为每个SPA应用注册路由回退
    for (const appName of spaApps) {
        // 1. 处理根路径重定向
        fastify.get(`/apps/${appName}`, async (request, reply) => {
            return reply.redirect(`/apps/${appName}/`, 301);
        });

        // 2. 处理应用根路径
        fastify.get(`/apps/${appName}/`, async (request, reply) => {
            const indexPath = path.join(options.appsDir, appName, 'index.html');

            try {
                const indexContent = await fs.promises.readFile(indexPath, 'utf8');
                return reply
                    .type('text/html')
                    .header('Cache-Control', 'no-cache, no-store, must-revalidate')
                    .send(indexContent);
            } catch (error) {
                return reply.code(404).send({ error: `${appName} application not found` });
            }
        });
    }

    // 3. 设置404处理器来处理SPA路由回退
    fastify.setNotFoundHandler(async (request, reply) => {
        const url = request.url;
        const pathname = url.split('?')[0];

        // 检查是否是SPA应用的路由请求
        for (const appName of spaApps) {
            const appPrefix = `/apps/${appName}/`;

            if (pathname.startsWith(appPrefix)) {
                // 检查是否是静态资源请求（有文件扩展名）
                const urlPath = pathname.replace(appPrefix, '');
                const hasExtension = /\.[a-zA-Z0-9]+$/.test(urlPath);

                if (!hasExtension) {
                    // 没有扩展名，可能是Vue路由，返回index.html
                    const indexPath = path.join(options.appsDir, appName, 'index.html');

                    try {
                        const indexContent = await fs.promises.readFile(indexPath, 'utf8');
                        return reply
                            .type('text/html')
                            .header('Cache-Control', 'no-cache, no-store, must-revalidate')
                            .send(indexContent);
                    } catch (error) {
                        return reply.code(404).send({ error: `${appName} application not found` });
                    }
                }
            }
        }

        // 不是SPA应用路由，返回默认404
        return reply.code(404).send({ error: 'Not Found' });
    });
}

export { addSPARoutes };

// 使用方法：
// import { addSPARoutes } from './fastify-spa-routes.js';
// import fastifyStatic from '@fastify/static';
//
// // 在您的Fastify应用中：
// await fastify.register(fastifyStatic, {
//     root: options.appsDir,
//     prefix: '/apps/',
//     decorateReply: false,
// });
//
// // 添加SPA路由支持
// await fastify.register(addSPARoutes, {
//     appsDir: options.appsDir,
//     spaApps: ['drplayer', 'admin-panel'] // 指定哪些应用需要SPA路由支持
// });