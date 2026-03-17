/**
 * Admin Controller - 后台管理界面控制器
 * 提供 admin 面板所需的 API 接口和静态文件服务
 */

import path from 'path';
import fs from 'fs';
import fastifyStatic from '@fastify/static';

// 配置相关
const CONFIG_PATH = path.join(process.cwd(), 'config/env.json');

// 获取配置
async function getConfig(req, reply) {
    try {
        const { key } = req.query;

        if (!fs.existsSync(CONFIG_PATH)) {
            return reply.send({});
        }

        const configContent = fs.readFileSync(CONFIG_PATH, 'utf-8');
        const config = JSON.parse(configContent);

        if (key) {
            const keys = key.split('.');
            let value = config;
            for (const k of keys) {
                value = value?.[k];
            }
            return reply.send(value !== undefined ? value : null);
        }

        return reply.send(config);
    } catch (e) {
        reply.code(500).send({ error: e.message });
    }
}

// 更新配置
async function updateConfig(req, reply) {
    try {
        const { action, key, value } = req.body;

        if (action === 'set') {
            const systemTools = await import('../drpy-node-mcp/tools/systemTools.js');
            const result = await systemTools.manage_config({ action, key, value: String(value) });
            if (result.isError) {
                return reply.code(400).send({ error: result.content[0].text });
            }
            return reply.send({ success: true, message: result.content[0].text });
        }

        reply.code(400).send({ error: 'Invalid action' });
    } catch (e) {
        reply.code(500).send({ error: e.message });
    }
}

// MCP 工具调用接口
async function callMCP(req, reply) {
    try {
        const { name, arguments: args } = req.body;

        let handler;
        switch (name) {
            case 'read_logs':
                const systemTools = await import('../drpy-node-mcp/tools/systemTools.js');
                handler = systemTools.read_logs;
                break;
            case 'restart_service':
                const systemTools2 = await import('../drpy-node-mcp/tools/systemTools.js');
                handler = systemTools2.restart_service;
                break;
            case 'list_sources':
                const spiderTools = await import('../drpy-node-mcp/tools/spiderTools.js');
                handler = spiderTools.list_sources;
                break;
            case 'get_routes_info':
                const spiderTools2 = await import('../drpy-node-mcp/tools/spiderTools.js');
                handler = spiderTools2.get_routes_info;
                break;
            case 'get_drpy_api_list':
                const apiTools = await import('../drpy-node-mcp/tools/apiTools.js');
                handler = apiTools.get_drpy_api_list;
                break;
            case 'validate_spider':
            case 'check_syntax':
            case 'get_spider_template':
            case 'debug_spider_rule':
                const spiderTools3 = await import('../drpy-node-mcp/tools/spiderTools.js');
                handler = spiderTools3[name];
                break;
            case 'sql_query':
                const dbTools = await import('../drpy-node-mcp/tools/dbTools.js');
                handler = dbTools.sql_query;
                break;
            case 'list_directory':
            case 'read_file':
                const fsTools = await import('../drpy-node-mcp/tools/fsTools.js');
                handler = fsTools[name];
                break;
            default:
                return reply.code(404).send({ error: 'Tool not found' });
        }

        if (!handler) {
            return reply.code(404).send({ error: 'Tool not found' });
        }

        const result = await handler(args || {});

        if (result.isError) {
            return reply.code(400).send({ error: result.content[0].text });
        }

        const content = result.content[0].text;
        try {
            return reply.send(JSON.parse(content));
        } catch {
            return reply.send(content);
        }
    } catch (e) {
        reply.code(500).send({ error: e.message });
    }
}

// 导出路由配置 - 使用标准控制器模式
export default (fastify, options, done) => {
    // Admin 面板静态文件目录
    const adminDistPath = path.join(process.cwd(), 'drpy-node-admin/dist');

    if (fs.existsSync(adminDistPath)) {
        fastify.log.info('Serving admin panel from ' + adminDistPath);

        // 注册静态文件服务（在 API 路由之前注册，避免冲突）
        fastify.register(fastifyStatic, {
            root: adminDistPath,
            prefix: '/admin/',
            decorateReply: false,
            index: ['index.html']
        });
    }

    // API 路由（必须在静态文件服务之后注册，避免被静态文件拦截）
    fastify.get('/admin/config', getConfig);
    fastify.post('/admin/config', updateConfig);
    fastify.post('/admin/mcp', callMCP);

    done();
}
