/**
 * 系统管理控制器
 * 提供健康检查、服务重启等系统级功能
 */

import {logError} from '../../utils/log.js';
import os from 'os';
import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import fs from '../../utils/fsWrapper.js';
import { isPhpAvailable, phpVersion } from '../../utils/phpEnv.js';
import { daemon } from '../../utils/daemonManager.js';
import { PROJECT_ROOT } from '../../utils/pathHelper.js';

const execPromise = util.promisify(exec);

// 健康检查
export async function getHealth(req, reply) {
    try {
        const uptime = process.uptime();
        const memory = process.memoryUsage();
        const packageJson = await fs.readJson(path.join(PROJECT_ROOT, 'package.json'));

        let pythonAvailable = false;
        try {
            pythonAvailable = await daemon.isPythonAvailable();
        } catch (err) {
            logError('检查 Python 状态失败:', err);
        }

        return reply.send({
            status: 'ok',
            uptime: Math.floor(uptime),
            memory: {
                used: Math.round(memory.heapUsed / 1024 / 1024),
                total: Math.round(memory.heapTotal / 1024 / 1024),
                rss: Math.round(memory.rss / 1024 / 1024)
            },
            version: packageJson.version,
            platform: {
                arch: os.arch(),
                platform: os.platform(),
                nodeVersion: process.version
            },
            env: {
                php: isPhpAvailable ? (phpVersion || true) : false,
                python: pythonAvailable
            },
            timestamp: Date.now()
        });
    } catch (e) {
        reply.code(500).send({
            status: 'error',
            error: e.message
        });
    }
}

// 服务重启
export async function restartService(req, reply) {
    try {
        if (process.env.READ_ONLY_MODE === '1') {
            return reply.send({
                success: false,
                message: '系统当前处于只读模式，禁止远程重启服务'
            });
        }

        // 检查是否在 PM2 环境运行
        try {
            await execPromise('pm2 restart drpys');
            return reply.send({
                success: true,
                message: '服务已通过 PM2 重启'
            });
        } catch (pm2Error) {
            return reply.send({
                success: false,
                message: '当前未使用 PM2 运行。请在终端中手动重启服务：\n1. 按 Ctrl+C 停止当前服务\n2. 运行 npm run dev 重新启动'
            });
        }
    } catch (e) {
        reply.code(500).send({
            success: false,
            error: e.message
        });
    }
}

// API 文档：从 @fastify/swagger 生成的 OpenAPI 规范动态导出，与 Swagger UI 数据同源
const OPENAPI_METHODS = ['get', 'post', 'put', 'delete', 'patch'];

export async function getApiDocs(req, reply) {
    const spec = req.server.swagger();
    const byCategory = new Map();
    const push = (category, ep) => {
        if (!byCategory.has(category)) byCategory.set(category, []);
        byCategory.get(category).push(ep);
    };

    for (const [path, pathItem] of Object.entries(spec.paths || {})) {
        const methods = Object.keys(pathItem).filter((m) => OPENAPI_METHODS.includes(m));
        if (methods.length === 0) continue;
        // fastify.all 通配路由会在规范里展开为全方法条目，聚合为一条 ALL 展示
        const entries = methods.length > 5
            ? [{method: 'ALL', op: pathItem[methods[0]]}]
            : methods.map((m) => ({method: m, op: pathItem[m]}));

        for (const {method, op} of entries) {
            const category = Array.isArray(op.tags) && op.tags.length > 0 ? op.tags[0] : '其他';
            const params = {};
            for (const p of op.parameters || []) {
                params[p.name] = {
                    type: p.schema?.type || p.in || 'string',
                    description: p.description,
                    ...(p.required ? {required: true} : {}),
                };
            }
            const bodyProps = op.requestBody?.content?.['application/json']?.schema?.properties || {};
            for (const [name, prop] of Object.entries(bodyProps)) {
                params[name] = {
                    type: prop.type || 'json',
                    description: prop.description,
                    ...(op.requestBody.required ? {required: true} : {}),
                };
            }
            push(category, {
                path,
                method: method.toUpperCase(),
                description: op.summary || op.description || '',
                ...(Object.keys(params).length > 0 ? {params} : {}),
            });
        }
    }

    // 分类按 spec.tags 声明顺序输出；未归属 tag 的排入「其他」
    const result = (spec.tags || [])
        .map((t) => ({category: t.name, endpoints: byCategory.get(t.name) || []}))
        .filter((c) => c.endpoints.length > 0);
    const others = byCategory.get('其他');
    if (others) result.push({category: '其他', endpoints: others});
    return reply.send(result);
}
