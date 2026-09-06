/**
 * Swagger 文档控制器（官方插件托管）
 *
 * 用 @fastify/swagger（static 模式，规范来源 docs/openapi.json）+ @fastify/swagger-ui
 * 托管 Swagger UI，替代手写的静态资源读取。
 *
 * 路由前缀仍在 /apps/admin/api-docs/swagger（/apps/ 前缀自动获得全局 Basic Auth）。
 *
 * 渐进演进路线：现有路由均未声明 schema，故采用 static 模式提供手写规范；
 * 后续路由补齐 schema 后可切换为 dynamic 模式（去掉 mode: 'static'），由路由自动生成。
 */

import path from 'path';
import fs from 'fs';
import fp from 'fastify-plugin';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { PROJECT_ROOT } from '../utils/pathHelper.js';

const OPENAPI_SPEC_PATH = path.join(PROJECT_ROOT, 'docs', 'openapi.json');
// 尾斜杠必须保留：UI 页面用 ./static 相对路径引用资源，无尾斜杠时浏览器会解析到上一级
const ROUTE_PREFIX = '/apps/admin/api-docs/swagger/';

export default fp(async function (fastify) {
    const specification = JSON.parse(fs.readFileSync(OPENAPI_SPEC_PATH, 'utf8'));

    // dynamic 模式：本文件提供全局配置（info/tags/security/虚拟路径条目），
    // 真实路由的文档由各路由 schema 生成；paths 与生成条目同路径时生成条目优先
    await fastify.register(swagger, {
        openapi: specification,
    });

    await fastify.register(swaggerUi, {
        routePrefix: ROUTE_PREFIX,
        title: 'drpyS API 文档',
        // 与管理面板入口一致的默认形态：折叠浏览、保留授权凭证
        uiConfig: {
            docExpansion: 'none',
            persistAuthorization: true,
            tryItOutEnabled: true,
        },
    });

    // 无尾斜杠访问重定向（避免落入 SPA fallback 的 index.html）
    fastify.get('/apps/admin/api-docs/swagger', (req, reply) => reply.redirect(ROUTE_PREFIX, 301));
});
