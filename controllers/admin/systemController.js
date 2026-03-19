/**
 * 系统管理控制器
 * 提供健康检查、服务重启等系统级功能
 */

import os from 'os';
import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import fs from '../../utils/fsWrapper.js';

const execPromise = util.promisify(exec);

// 健康检查
export async function getHealth(req, reply) {
    try {
        const uptime = process.uptime();
        const memory = process.memoryUsage();
        const packageJson = await fs.readJson(path.join(process.cwd(), 'package.json'));

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

// API 文档
export async function getApiDocs(req, reply) {
    const apiDocs = [
        {
            category: "系统管理",
            endpoints: [
                {
                    path: "/api/admin/health",
                    method: "GET",
                    description: "获取系统健康状态，包括内存使用、运行时间、版本等信息"
                },
                {
                    path: "/api/admin/restart",
                    method: "POST",
                    description: "尝试重启服务（仅在 PM2 环境下有效）"
                },
                {
                    path: "/api/admin/docs",
                    method: "GET",
                    description: "获取 API 文档列表"
                }
            ]
        },
        {
            category: "日志管理",
            endpoints: [
                {
                    path: "/api/admin/logs",
                    method: "GET",
                    description: "获取最近的系统日志"
                },
                {
                    path: "/ws",
                    method: "WS",
                    description: "WebSocket 实时日志流连接端点（全局）"
                }
            ]
        },
        {
            category: "配置管理",
            endpoints: [
                {
                    path: "/api/admin/config",
                    method: "GET",
                    description: "获取系统配置，支持通过 key 参数获取特定配置项"
                },
                {
                    path: "/api/admin/config",
                    method: "POST",
                    description: "更新系统配置"
                },
                {
                    path: "/api/admin/env",
                    method: "GET",
                    description: "获取关键环境变量配置"
                }
            ]
        },
        {
            category: "源管理",
            endpoints: [
                {
                    path: "/api/admin/sources",
                    method: "GET",
                    description: "获取所有 JS 和 CatVod 源列表"
                },
                {
                    path: "/api/admin/sources/validate",
                    method: "POST",
                    description: "验证源文件的格式和必要字段"
                },
                {
                    path: "/api/admin/sources/syntax",
                    method: "POST",
                    description: "检查源文件的语法正确性"
                },
                {
                    path: "/api/admin/sources/template",
                    method: "GET",
                    description: "获取标准源文件模板"
                },
                {
                    path: "/api/admin/sources/libs",
                    method: "GET",
                    description: "获取爬虫相关库函数和解析规则说明"
                }
            ]
        },
        {
            category: "文件管理",
            endpoints: [
                {
                    path: "/api/admin/files/list",
                    method: "GET",
                    description: "列出指定目录下的文件和文件夹"
                },
                {
                    path: "/api/admin/files/read",
                    method: "GET",
                    description: "读取指定文件的内容"
                },
                {
                    path: "/api/admin/files/write",
                    method: "POST",
                    description: "写入内容到指定文件"
                },
                {
                    path: "/api/admin/files/delete",
                    method: "DELETE",
                    description: "删除指定的文件"
                }
            ]
        },
        {
            category: "数据库管理",
            endpoints: [
                {
                    path: "/api/admin/db/query",
                    method: "POST",
                    description: "执行 SQL 查询语句"
                },
                {
                    path: "/api/admin/db/tables",
                    method: "GET",
                    description: "获取数据库所有表名"
                },
                {
                    path: "/api/admin/db/tables/:table/schema",
                    method: "GET",
                    description: "获取指定表的结构定义"
                }
            ]
        }
    ];

    return reply.send(apiDocs);
}
