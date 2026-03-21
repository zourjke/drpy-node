/**
 * Admin Controller - 后台管理主控制器
 * 重构版：移除 MCP 依赖，直接实现业务逻辑
 */

import path from 'path';
import fs from '../utils/fsWrapper.js';
import { validateBasicAuth } from '../utils/api_validate.js';

// 导入子控制器
import * as systemController from './admin/systemController.js';
import * as logsController from './admin/logsController.js';
import * as sourcesController from './admin/sourcesController.js';
import * as filesController from './admin/filesController.js';
import * as dbController from './admin/dbController.js';
import * as subController from './admin/subController.js';
import * as backupController from './admin/backupController.js';
import * as pluginsController from './admin/pluginsController.js';
import * as terminalController from './admin/terminalController.js';
import * as cryptoController from './admin/cryptoController.js';
import { PROJECT_ROOT } from '../utils/pathHelper.js';

// 配置常量
const CONFIG_PATH = path.join(PROJECT_ROOT, 'config/env.json');

const FULL_ENV_TEMPLATE = {
    "ali_token": "",
    "ali_refresh_token": "",
    "quark_cookie": "",
    "quark_token_cookie": "",
    "uc_cookie": "",
    "uc_token_cookie": "",
    "baidu_cookie": "",
    "xun_username": "",
    "xun_password": "",
    "cloud_account": "",
    "cloud_password": "",
    "cloud_cookie": "",
    "yun_account": "",
    "yun_cookie": "",
    "pan_passport": "",
    "pan_password": "",
    "pan_auth": "",
    "pikpak_token": "",
    "now_ai": "1",
    "spark_ai_authKey": "",
    "deepseek_apiKey": "",
    "kimi_apiKey": "",
    "sparkBotObject": {},
    "thread": "6",
    "api_pwd": "",
    "hide_adult": "1",
    "enable_old_config": "0",
    "show_curl": "0",
    "show_req": "0",
    "enable_rule_name": "0",
    "enable_dr2": "1",
    "enable_py": "1",
    "enable_php": "1",
    "enable_cat": "1",
    "enable_self_jx": "0",
    "enable_system_proxy": "1",
    "play_proxy_mode": "1",
    "play_local_proxy_type": "1",
    "PROXY_AUTH": "drpys",
    "enable_doh": "0",
    "allow_forward": "0",
    "allow_ftp_cache_clear": "0",
    "allow_webdav_cache_clear": "0",
    "link_url": "",
    "enable_link_data": "0",
    "enable_link_push": "0",
    "enable_link_jar": "0",
    "cat_sub_code": "all",
    "must_sub_code": "0",
    "bili_cookie": "",
    "mg_hz": "4"
};

// 导出路由配置
export default async function adminController(fastify, options) {
    // 注册 Basic Auth 验证钩子
    fastify.addHook('preHandler', (request, reply, done) => {
        // 只对 /api/admin/* 接口进行验证
        if (request.url.startsWith('/api/admin')) {
            validateBasicAuth(request, reply, done);
        } else {
            done();
        }
    });

    // ==================== 系统管理 API ====================
    fastify.get('/api/admin/health', systemController.getHealth);
    fastify.post('/api/admin/restart', systemController.restartService);
    fastify.get('/api/admin/terminal/status', terminalController.getTerminalStatus);
    fastify.get('/api/admin/terminal/ws', { websocket: true }, terminalController.handleTerminalWs);

    // ==================== 日志 API ====================
    fastify.get('/api/admin/logs', logsController.getLogs);

    // ==================== 配置管理 API ====================
    fastify.get('/api/admin/config', getConfig);
    fastify.post('/api/admin/config', updateConfig);
    fastify.get('/api/admin/env', getEnv);
    fastify.get('/api/admin/version', getVersion);

    // ==================== 源管理 API ====================
    fastify.get('/api/admin/sources', sourcesController.listSources);
    fastify.post('/api/admin/sources/validate', sourcesController.validateSpider);
    fastify.post('/api/admin/sources/syntax', sourcesController.checkSyntax);
    fastify.get('/api/admin/sources/template', sourcesController.getTemplate);
    fastify.get('/api/admin/sources/libs', sourcesController.getLibsInfo);

    // ==================== 文件管理 API ====================
    fastify.get('/api/admin/files/list', filesController.listDirectory);
    fastify.get('/api/admin/files/read', filesController.readFile);
    fastify.post('/api/admin/files/write', filesController.writeFile);
    fastify.delete('/api/admin/files/delete', filesController.deleteFile);

    // ==================== 数据库 API ====================
    fastify.post('/api/admin/db/query', dbController.executeQuery);
    fastify.get('/api/admin/db/tables', dbController.getTables);
    fastify.get('/api/admin/db/tables/:table/schema', dbController.getTableSchema);

    // ==================== Sub文件管理 API ====================
    fastify.get('/api/admin/sub/files', subController.getSubFiles);
    fastify.get('/api/admin/sub/file', subController.getSubFileContent);
    fastify.post('/api/admin/sub/file', subController.saveSubFileContent);

    // ==================== 备份恢复 API ====================
    fastify.get('/api/admin/backup/config', backupController.getBackupConfig);
    fastify.post('/api/admin/backup/config', backupController.updateBackupConfig);
    fastify.post('/api/admin/backup/config/reset', backupController.resetBackupConfig);
    fastify.post('/api/admin/backup/create', backupController.createBackup);
    fastify.post('/api/admin/backup/restore', backupController.restoreBackup);

    // ==================== 插件管理 API ====================
    fastify.get('/api/admin/plugins', pluginsController.getPlugins);
    fastify.post('/api/admin/plugins', pluginsController.savePlugins);
    fastify.post('/api/admin/plugins/restore', pluginsController.restorePlugins);

    // ==================== 路由信息 API ====================
    fastify.get('/api/admin/routes', getRoutesInfo);
    fastify.get('/api/admin/docs', systemController.getApiDocs);

    // ==================== 加解密 API ====================
    fastify.post('/api/admin/crypto/decode', cryptoController.decode);

    // MCP 兼容层
    const ENABLE_MCP_COMPAT = process.env.ENABLE_MCP_COMPAT !== 'false';
    if (ENABLE_MCP_COMPAT) {
        fastify.post('/admin/mcp', async (req, reply) => {
            const { name, arguments: args } = req.body;
            try {
                // 仅作最低限度的兼容，或者提示用户升级
                return reply.code(400).send({ error: 'MCP API 已弃用，请更新 drpy-node-admin 到最新版本' });
            } catch (e) {
                return reply.code(500).send({ error: e.message });
            }
        });
    }
}

// ==================== 辅助函数 ====================

async function getConfig(req, reply) {
    try {
        const { key } = req.query;

        let config = {};
        if (await fs.pathExists(CONFIG_PATH)) {
            const configContent = await fs.readFile(CONFIG_PATH, 'utf-8');
            try {
                config = JSON.parse(configContent);
            } catch (e) {
                // ignore parse error
            }
        }
        
        // Merge with template to ensure all keys exist
        config = { ...FULL_ENV_TEMPLATE, ...config };

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

async function updateConfig(req, reply) {
    try {
        const { key, value } = req.body;

        if (!key) {
            return reply.code(400).send({ error: 'Key is required' });
        }

        let config = {};
        if (await fs.pathExists(CONFIG_PATH)) {
            const configContent = await fs.readFile(CONFIG_PATH, 'utf-8');
            try {
                config = JSON.parse(configContent);
            } catch (e) {
                // If it's malformed, start fresh
            }
        }

        // 设置嵌套值
        const keys = key.split('.');
        let target = config;
        for (let i = 0; i < keys.length - 1; i++) {
            if (!target[keys[i]]) {
                target[keys[i]] = {};
            }
            target = target[keys[i]];
        }

        // 尝试解析为 JSON
        let parsedValue = value;
        try {
            parsedValue = JSON.parse(value);
        } catch {
            // 保持字符串
        }

        target[keys[keys.length - 1]] = parsedValue;

        // 写回文件
        try {
            await fs.ensureDir(path.dirname(CONFIG_PATH));
            await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
        } catch (writeError) {
            req.log.error(`[Admin Config] Failed to write config file: ${writeError.message}`);
            return reply.code(500).send({ 
                success: false, 
                error: `保存配置失败 (可能是权限问题，如在 Vercel 等只读环境): ${writeError.message}` 
            });
        }

        return reply.send({
            success: true,
            message: `配置项 ${key} 已更新`
        });
    } catch (e) {
        reply.code(500).send({ error: e.message });
    }
}

async function getEnv(req, reply) {
    try {
        const envData = {};

        // 从 process.env 读取关键配置
        const keys = [
            'PORT', 'NODE_ENV', 'MAX_TEXT_SIZE', 'MAX_IMAGE_SIZE',
            'QUARK_COOKIE', 'ALI_TOKEN', 'bili_cookie'
        ];

        for (const key of keys) {
            if (process.env[key]) {
                envData[key] = process.env[key];
            }
        }

        return reply.send(envData);
    } catch (e) {
        reply.code(500).send({ error: e.message });
    }
}

async function getVersion(req, reply) {
    try {
        const packageJson = await fs.readJson(path.join(PROJECT_ROOT, 'package.json'));
        return reply.send({ version: packageJson.version });
    } catch (e) {
        reply.code(500).send({ error: e.message });
    }
}

async function getRoutesInfo(req, reply) {
    try {
        const indexControllerPath = path.join(PROJECT_ROOT, 'controllers/index.js');

        if (!await fs.pathExists(indexControllerPath)) {
            return reply.send({
                file: 'controllers/index.js',
                registered_controllers: []
            });
        }

        const content = await fs.readFile(indexControllerPath, 'utf-8');
        const lines = content.split('\n');
        const registered = lines
            .filter(l => l.trim().startsWith('fastify.register('))
            .map(l => l.trim());

        return reply.send({
            file: 'controllers/index.js',
            registered_controllers: registered
        });
    } catch (e) {
        reply.code(500).send({ error: e.message });
    }
}
