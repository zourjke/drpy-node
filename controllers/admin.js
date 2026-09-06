/**
 * Admin Controller - 后台管理主控制器
 * 重构版：移除 MCP 依赖，直接实现业务逻辑
 */

import path from 'path';
import fs from '../utils/fsWrapper.js';
import multipart from '@fastify/multipart';
import { validateBasicAuth } from '../utils/api_validate.js';
import { MAX_UPLOAD_BYTES } from '../utils/pluginMarket.js';

// 导入子控制器
import * as systemController from './admin/systemController.js';
import * as changelogController from './admin/changelogController.js';
import * as logsController from './admin/logsController.js';
import * as sourcesController from './admin/sourcesController.js';
import * as filesController from './admin/filesController.js';
import * as dbController from './admin/dbController.js';
import * as subController from './admin/subController.js';
import * as backupController from './admin/backupController.js';
import * as pluginsController from './admin/pluginsController.js';
import * as pluginMarketController from './admin/pluginMarketController.js';
import * as terminalController from './admin/terminalController.js';
import * as cryptoController from './admin/cryptoController.js';
import { PROJECT_ROOT } from '../utils/pathHelper.js';
import { ENV } from '../utils/env.js';

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
    "mg_hz": "4",
    "unified_proxy_self_redirect": "0"
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

    // multipart：仅插件 zip 上传使用（流式落盘，不驻留内存；上限与市场下载一致 500MB）
    await fastify.register(multipart, {
        limits: {files: 1, fileSize: MAX_UPLOAD_BYTES}
    });

    // ==================== 系统管理 API ====================
    fastify.get('/api/admin/health', {
        schema: {
            tags: ['系统管理'], summary: '获取系统健康状态',
            description: '运行时间、内存使用、版本及运行环境等。',
        },
    }, systemController.getHealth);
    fastify.post('/api/admin/restart', {
        schema: {
            tags: ['系统管理'], summary: '重启服务（PM2 环境）',
        },
    }, systemController.restartService);
    fastify.get('/api/admin/terminal/status', {
        schema: {tags: ['系统管理'], summary: '终端可用性'},
    }, terminalController.getTerminalStatus);
    fastify.get('/api/admin/terminal/ws', { websocket: true }, terminalController.handleTerminalWs);

    // ==================== 日志 API ====================
    fastify.get('/api/admin/logs', {
        schema: {
            tags: ['日志'], summary: '读取系统日志',
            querystring: {type: 'object', properties: {lines: {type: 'integer', default: 50, description: '读取最新行数'}}},
        },
    }, logsController.getLogs);

    // ==================== 配置管理 API ====================
    fastify.get('/api/admin/config', {
        schema: {
            tags: ['配置管理'], summary: '获取配置（config/env.json）',
            querystring: {type: 'object', properties: {key: {type: 'string', description: '支持点语法 a.b.c；缺省返回全部'}}},
        },
    }, getConfig);
    fastify.post('/api/admin/config', {
        schema: {
            tags: ['配置管理'], summary: '更新配置项',
            body: {
                type: 'object',
                properties: {
                    key: {type: 'string', description: '支持点语法'},
                    value: {description: '任意类型'},
                },
                required: ['key', 'value'],
            },
        },
    }, updateConfig);
    fastify.get('/api/admin/env', {
        schema: {tags: ['配置管理'], summary: '获取关键环境变量'},
    }, getEnv);
    fastify.get('/api/admin/version', {
        schema: {tags: ['配置管理'], summary: '获取版本号'},
    }, getVersion);

    // ==================== 源管理 API ====================
    fastify.get('/api/admin/sources', {
        schema: {tags: ['源管理'], summary: '获取源文件列表', description: '按引擎（js/catvod/php/py 等）分组。'},
    }, sourcesController.listSources);
    fastify.post('/api/admin/sources/validate', {
        schema: {
            tags: ['源管理'], summary: '验证源文件有效性',
            body: {type: 'object', properties: {path: {type: 'string', description: '源文件相对路径'}}, required: ['path']},
        },
    }, sourcesController.validateSpider);
    fastify.post('/api/admin/sources/syntax', {
        schema: {
            tags: ['源管理'], summary: '源文件语法检查',
            body: {type: 'object', properties: {path: {type: 'string', description: '源文件相对路径'}}, required: ['path']},
        },
    }, sourcesController.checkSyntax);
    fastify.get('/api/admin/sources/template', {
        schema: {tags: ['源管理'], summary: '获取源开发模板'},
    }, sourcesController.getTemplate);
    fastify.get('/api/admin/sources/libs', {
        schema: {tags: ['源管理'], summary: '获取内置库信息'},
    }, sourcesController.getLibsInfo);
    fastify.post('/api/admin/sources/upload', {
        bodyLimit: 5 * 1024 * 1024,
        schema: {
            tags: ['源管理'], summary: '上传源文件',
            description: '写入源引擎目录（js/js_dr2/catvod/php/py）。同名已存在且未带 overwrite 时返回 409；落盘后自动语法校验（fail-soft，失败仍保留并在 check 中返回原因）。',
            body: {
                type: 'object',
                properties: {
                    engine: {type: 'string', description: '源类型：js / dr2 / catvod / php / py'},
                    filename: {type: 'string', description: '源文件名（仅 basename，扩展名需匹配该引擎）'},
                    content: {type: 'string', description: '源文件全文（≤5MB）'},
                    overwrite: {type: 'boolean', default: false, description: '同名源已存在时是否覆盖'},
                },
                required: ['engine', 'filename', 'content'],
            },
        },
    }, sourcesController.uploadSource);
    fastify.post('/api/admin/sources/delete', {
        schema: {
            tags: ['源管理'], summary: '删除源文件',
            description: '仅允许删除源目录（spider/js、js_dr2、catvod、php、py）内的单个源文件，路径越界返回 403。',
            body: {
                type: 'object',
                properties: {path: {type: 'string', description: '源文件相对路径，如 spider/js/示例.js'}},
                required: ['path'],
            },
        },
    }, sourcesController.deleteSource);
    fastify.post('/api/admin/sources/verify-flow', {
        schema: {
            tags: ['源管理'], summary: '源接口全流程验证',
            description: '服务端自调用该源 /api 接口，依次验证 首页→分类→详情→搜索 协议链路（每步独立超时），可选深度验证播放。返回每步状态/耗时/数据量与总体 verdict（healthy/partial/dead）。进程内单飞互斥（并发 409）。',
            body: {
                type: 'object',
                properties: {
                    path: {type: 'string', description: '源文件相对路径，如 spider/js/示例.js'},
                    options: {
                        type: 'object',
                        properties: {
                            searchKeyword: {type: 'string', description: '搜索关键词，缺省「爱」'},
                            perStepTimeoutMs: {type: 'integer', description: '每步超时毫秒（默认 10000，上限 30000）'},
                            verifyPlay: {type: 'boolean', description: '深度验证播放（默认 false，不计入评分）'},
                        },
                    },
                },
                required: ['path'],
            },
        },
    }, sourcesController.verifySourceFlow);
    fastify.post('/api/admin/sources/enabled', {
        schema: {
            tags: ['源管理'], summary: '批量设置源启用/停用',
            description: '停用后 /config 与订阅配置不再分发该源；healthy=0 的全源检测不受影响。单源操作传单元素数组即可。写盘后异步重建 index.json 缓存。',
            body: {
                type: 'object',
                properties: {
                    paths: {type: 'array', items: {type: 'string'}, description: '源文件相对路径数组（≤200 项），如 spider/js/示例.js'},
                    enabled: {type: 'boolean', description: 'true=启用 false=停用'},
                },
                required: ['paths', 'enabled'],
            },
        },
    }, sourcesController.setSourcesEnabled);

    // ==================== 文件管理 API ====================
    fastify.get('/api/admin/files/list', {
        schema: {
            tags: ['文件管理'], summary: '获取目录列表',
            querystring: {type: 'object', properties: {path: {type: 'string', default: '.', description: '相对项目根目录的路径'}}},
        },
    }, filesController.listDirectory);
    fastify.get('/api/admin/files/read', {
        schema: {
            tags: ['文件管理'], summary: '读取文件内容',
            description: '文本返回 {type:text, content}；图片返回 {type:image, dataUrl}。受保护文件（.env、yarn.lock 等）返回 403。',
            querystring: {type: 'object', properties: {path: {type: 'string', description: '文件相对路径'}}, required: ['path']},
        },
    }, filesController.readFile);
    fastify.post('/api/admin/files/write', {
        schema: {
            tags: ['文件管理'], summary: '写入文件',
            body: {type: 'object', properties: {path: {type: 'string'}, content: {type: 'string'}}, required: ['path', 'content']},
        },
    }, filesController.writeFile);
    fastify.delete('/api/admin/files/delete', {
        schema: {
            tags: ['文件管理'], summary: '删除文件/目录',
            querystring: {type: 'object', properties: {path: {type: 'string', description: '文件相对路径'}}, required: ['path']},
        },
    }, filesController.deleteFile);

    // ==================== 数据库 API ====================
    fastify.post('/api/admin/db/query', {
        schema: {
            tags: ['数据库'], summary: '执行只读 SQL 查询',
            description: '仅允许 SELECT / PRAGMA，禁止写入。',
            body: {
                type: 'object',
                properties: {
                    sql: {type: 'string'},
                    params: {description: 'SQL 绑定参数（数组或对象）'},
                },
                required: ['sql'],
            },
        },
    }, dbController.executeQuery);
    fastify.get('/api/admin/db/tables', {
        schema: {tags: ['数据库'], summary: '获取表列表'},
    }, dbController.getTables);
    fastify.get('/api/admin/db/tables/:table/schema', {
        schema: {
            tags: ['数据库'], summary: '获取表结构',
            params: {type: 'object', properties: {table: {type: 'string'}}, required: ['table']},
        },
    }, dbController.getTableSchema);

    // ==================== Sub文件管理 API ====================
    fastify.get('/api/admin/sub/files', {
        schema: {tags: ['订阅管理'], summary: '获取订阅文件列表'},
    }, subController.getSubFiles);
    fastify.get('/api/admin/sub/file', {
        schema: {
            tags: ['订阅管理'], summary: '读取订阅文件',
            querystring: {type: 'object', properties: {name: {type: 'string'}}, required: ['name']},
        },
    }, subController.getSubFileContent);
    fastify.post('/api/admin/sub/file', {
        schema: {
            tags: ['订阅管理'], summary: '保存订阅文件',
            body: {type: 'object', properties: {name: {type: 'string'}, content: {type: 'string'}}, required: ['name', 'content']},
        },
    }, subController.saveSubFileContent);

    // ==================== 备份恢复 API ====================
    fastify.get('/api/admin/backup/config', {
        schema: {tags: ['备份恢复'], summary: '获取备份配置'},
    }, backupController.getBackupConfig);
    fastify.post('/api/admin/backup/config', {
        schema: {
            tags: ['备份恢复'], summary: '更新备份配置',
            body: {type: 'object', properties: {paths: {type: 'array', items: {type: 'string'}, description: '文件相对路径数组'}}, required: ['paths']},
        },
    }, backupController.updateBackupConfig);
    fastify.post('/api/admin/backup/config/reset', {
        schema: {tags: ['备份恢复'], summary: '重置备份配置为默认'},
    }, backupController.resetBackupConfig);
    fastify.post('/api/admin/backup/create', {
        schema: {tags: ['备份恢复'], summary: '创建备份'},
    }, backupController.createBackup);
    fastify.post('/api/admin/backup/restore', {
        schema: {tags: ['备份恢复'], summary: '恢复备份'},
    }, backupController.restoreBackup);

    // ==================== 插件管理 API ====================
    fastify.get('/api/admin/plugins', {
        schema: {tags: ['插件管理'], summary: '获取插件配置列表'},
    }, pluginsController.getPlugins);
    fastify.post('/api/admin/plugins', {
        schema: {
            tags: ['插件管理'], summary: '保存插件配置',
            body: {type: 'object', properties: {plugins: {type: 'array', items: {type: 'object'}}}, required: ['plugins']},
        },
    }, pluginsController.savePlugins);
    fastify.post('/api/admin/plugins/restore', {
        schema: {tags: ['插件管理'], summary: '恢复默认插件配置'},
    }, pluginsController.restorePlugins);

    fastify.post('/api/admin/plugins/upload', {
        schema: {
            tags: ['插件管理'], summary: '上传插件 zip 包安装（异步任务）',
            description: 'multipart/form-data 上传安装包：流式落盘后走完整安装管线（ZipSlip 防护/剥壳/manifest/登记/回滚），与市场安装共用单任务互斥与 /api/admin/market/install/status 进度轮询。立即返回 taskId。表单字段：file（zip 必填，≤500MB）、active（"true" 随服务启动）、start（"true" 装后立即启动）、sha256（可选完整性校验）。multipart 请求不适用 JSON body 校验，故仅声明 consumes。',
            consumes: ['multipart/form-data'],
        },
    }, pluginMarketController.uploadPlugin);

    // ==================== 插件运行时控制 API ====================
    fastify.get('/api/admin/plugins/status', {
        schema: {tags: ['插件管理'], summary: '获取插件运行状态'},
    }, pluginMarketController.getPluginsRuntimeStatus);
    fastify.post('/api/admin/plugins/start', {
        schema: {
            tags: ['插件管理'], summary: '启动插件',
            description: 'Node 型插件首次启动会自动准备依赖（npm install 等），可能耗时数分钟。',
            body: {type: 'object', properties: {name: {type: 'string'}}, required: ['name']},
        },
    }, pluginMarketController.startPluginHandler);
    fastify.post('/api/admin/plugins/stop', {
        schema: {
            tags: ['插件管理'], summary: '停止插件',
            body: {type: 'object', properties: {name: {type: 'string'}}, required: ['name']},
        },
    }, pluginMarketController.stopPluginHandler);
    fastify.post('/api/admin/plugins/restart', {
        schema: {
            tags: ['插件管理'], summary: '重启插件',
            body: {type: 'object', properties: {name: {type: 'string'}}, required: ['name']},
        },
    }, pluginMarketController.restartPluginHandler);

    // ==================== 插件市场 API ====================
    fastify.get('/api/admin/market/list', {
        schema: {
            tags: ['插件市场'], summary: '获取市场列表',
            description: '聚合所有市场源并与本地安装状态合并；GitHub 系链接直连失败时自动走 ghProxy 兜底。默认缓存 60 秒。',
            querystring: {type: 'object', properties: {refresh: {type: 'string', description: '传 1 强制刷新缓存，其他值忽略'}}},
        },
    }, pluginMarketController.getMarketList);
    fastify.get('/api/admin/market/install/status', {
        schema: {tags: ['插件市场'], summary: '查询安装/更新任务进度'},
    }, pluginMarketController.getInstallTaskStatus);
    fastify.get('/api/admin/market/sources', {
        schema: {tags: ['插件市场'], summary: '读取市场源配置（config/market.json）'},
    }, pluginMarketController.getMarketSources);
    fastify.post('/api/admin/market/sources', {
        schema: {
            tags: ['插件市场'], summary: '保存市场源配置',
            body: {
                type: 'object',
                properties: {
                    sources: {type: 'array', items: {type: 'string'}, description: 'HTTP(S) URL 或项目内 JSON 路径'},
                    ghProxy: {type: 'string', description: 'GitHub 加速前缀，留空表示直连'},
                },
                required: ['sources'],
            },
        },
    }, pluginMarketController.saveMarketSources);
    fastify.post('/api/admin/market/install', {
        schema: {
            tags: ['插件市场'], summary: '安装插件（异步任务）',
            description: '立即返回 taskId，安装转后台执行；同一时间仅允许一个任务（并发返回 409）。',
            body: {
                type: 'object',
                properties: {
                    name: {type: 'string'},
                    version: {type: 'string', description: '缺省安装最新版'},
                    active: {type: 'boolean', default: false, description: '登记为随服务启动'},
                    start: {type: 'boolean', default: false, description: '安装完成后立即启动'},
                },
                required: ['name'],
            },
        },
    }, pluginMarketController.installMarketPlugin);
    fastify.post('/api/admin/market/update', {
        schema: {
            tags: ['插件市场'], summary: '更新插件（异步任务）',
            description: '运行中先停止 → 覆盖安装（保留用户已改的 params/env/active）→ 原在运行则自动重启。',
            body: {type: 'object', properties: {name: {type: 'string'}}, required: ['name']},
        },
    }, pluginMarketController.updateMarketPlugin);
    fastify.post('/api/admin/market/uninstall', {
        schema: {
            tags: ['插件市场'], summary: '卸载插件',
            description: '运行中先停止，删除 plugins/<name>/ 并从 .plugins.js 移除配置。不可恢复。',
            body: {type: 'object', properties: {name: {type: 'string'}}, required: ['name']},
        },
    }, pluginMarketController.uninstallMarketPlugin);

    // ==================== 路由信息 API ====================
    fastify.get('/api/admin/routes', {
        schema: {tags: ['系统管理'], summary: '获取已注册路由控制器信息'},
    }, getRoutesInfo);
    fastify.get('/api/admin/docs', {
        schema: {tags: ['系统管理'], summary: '获取 API 文档列表', description: '后台「API 文档」页面的数据源。'},
    }, systemController.getApiDocs);

    // ==================== 更新日志 API ====================
    fastify.get('/api/admin/changelog', {
        schema: {
            tags: ['更新日志'], summary: '获取更新日志',
            description: '数据源为 docs/changelog/ 目录（每版本一个 Markdown 文件），版本降序；archive 为早期无版本号历史归档。',
        },
    }, changelogController.getChangelog);

    // ==================== 加解密 API ====================
    fastify.post('/api/admin/crypto/decode', {
        schema: {
            tags: ['加解密'], summary: '数据解密',
            description: '支持 base64 / gzip / aes / rsa 等类型。',
            body: {
                type: 'object',
                properties: {
                    type: {type: 'string', description: '解密类型：base64 / gzip / aes / rsa 等'},
                    code: {type: 'string', description: '密文内容'},
                },
                required: ['type', 'code'],
            },
        },
    }, cryptoController.decode);

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
            const r = JSON.parse(value);
            parsedValue = r && typeof r === 'object' ? r : value;
        } catch {}

        target[keys[keys.length - 1]] = parsedValue;

        // 写回文件
        try {
            await fs.ensureDir(path.dirname(CONFIG_PATH));
            await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
            // 清除 ENV 缓存，确保后续 ENV.get 读取到最新值
            ENV.clearCache();
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
