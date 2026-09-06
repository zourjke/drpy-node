import {log, logError} from '../../utils/log.js';
import path from 'path';
import fs from 'fs';
import { pipeline } from 'stream/promises';
import { PROJECT_ROOT } from '../../utils/pathHelper.js';
import {
    getMarketIndex, loadMarketConfig, saveMarketConfig,
    listInstalledPlugins, compareVersions,
    installPlugin, uninstallPluginFiles,
    buildEntryFromZip, MAX_UPLOAD_BYTES
} from '../../utils/pluginMarket.js';
import {
    getPluginsConfig, reloadPluginsConfig, prepareNodePluginDeps, preparePythonPluginDeps,
    startPluginByKey, stopPluginByName, restartPluginByName
} from '../../utils/pluginManager.js';
import { getRuntimeStatus } from '../../utils/pluginRegistry.js';

// 上传安装包的临时落位目录与命名前缀（与市场下载 zip 同目录、同生命周期）
const TMP_DIR = path.join(PROJECT_ROOT, 'data', 'market-tmp');

// 安装/更新后台任务（单任务模型：同一时间只允许一个任务，status==='running' 即互斥锁；
// 完成后保留最后一次任务对象供前端查询终态）
let installTask = null;

/**
 * GET /api/admin/market/list
 * 聚合市场清单 ⊕ 本地安装状态（not_installed/installed/update_available/local_only）⊕ 运行状态
 */
export async function getMarketList(req, reply) {
    try {
        const refresh = req.query.refresh === '1';
        const market = await getMarketIndex({refresh});
        const ghProxy = loadMarketConfig().ghProxy;
        const installed = listInstalledPlugins();
        const installedMap = new Map(installed.map(i => [i.name, i]));
        const runtime = getRuntimeStatus();

        const marketNames = new Set(market.plugins.map(p => p.name));
        const cards = market.plugins.map(entry => {
            const inst = installedMap.get(entry.name);
            let status = 'not_installed';
            let installedVersion = null;
            if (inst && inst.manifest) {
                installedVersion = inst.manifest.version || null;
                status = compareVersions(entry.version, installedVersion) > 0 ? 'update_available' : 'installed';
            } else if (inst) {
                // 本地目录已存在但无 manifest（手工放置），占用该名字
                status = 'local_only';
            }
            const rt = runtime[entry.name];
            return {
                ...entry,
                status,
                installedVersion,
                running: !!rt,
                pid: rt?.pid || null,
                platformSupported: !entry.platforms || entry.platforms.length === 0
                    || entry.platforms.includes(process.platform)
                    || entry.platforms.includes(`${process.platform}-${process.arch}`)
                    || entry.platforms.includes('all')
            };
        });

        const localOnly = installed
            .filter(i => !i.manifest && !marketNames.has(i.name))
            .map(i => ({name: i.name, status: 'local_only', running: !!runtime[i.name]}));

        return reply.send({
            success: true,
            data: {
                plugins: cards,
                localOnly,
                errors: market.errors,
                currentPlatform: process.platform,
                ghProxy
            }
        });
    } catch (error) {
        req.log.error('获取插件市场列表失败:', error);
        return reply.code(500).send({success: false, error: '获取插件市场列表失败: ' + error.message});
    }
}

/**
 * GET /api/admin/market/sources
 */
export async function getMarketSources(req, reply) {
    try {
        return reply.send({success: true, data: loadMarketConfig()});
    } catch (error) {
        return reply.code(500).send({success: false, error: '读取市场源配置失败: ' + error.message});
    }
}

/**
 * POST /api/admin/market/sources  { sources: string[], ghProxy?: string }
 */
export async function saveMarketSources(req, reply) {
    try {
        const {sources, ghProxy} = req.body || {};
        if (!Array.isArray(sources)) {
            return reply.code(400).send({success: false, error: '参数格式错误，sources必须是数组'});
        }
        saveMarketConfig({sources, ghProxy});
        return reply.send({success: true, message: '市场源配置已保存'});
    } catch (error) {
        return reply.code(500).send({success: false, error: '保存市场源配置失败: ' + error.message});
    }
}

/**
 * 安装/更新后台任务管线（单任务模型：installTask.status==='running' 即互斥锁）：
 * 下载(0-70) → 校验(72) → 解压(76-84) → 登记(86-90) → 依赖(88-96) → 启动(97-100)
 * 进度实时写入 installTask，前端轮询 GET /market/install/status 渲染
 */
async function runInstallPipeline(task, entry, {active = false, start = false, zipPath = null} = {}) {
    try {
        await installPlugin({
            entry,
            zipPath,
            ghProxy: loadMarketConfig().ghProxy,
            active,
            onProgress: (stage, percent, message) => {
                task.stage = stage;
                if (percent != null) task.percent = Math.round(percent);
                if (message) task.message = message;
            }
        });
        log(`[pluginMarket] 插件 ${entry.name}@${entry.version} 安装完成，落位 plugins/${entry.name}`);

        await reloadPluginsConfig();

        if (start) {
            task.stage = 'deps';
            task.percent = Math.max(task.percent || 0, 88);
            const plugin = getPluginsConfig().find(p => p.name === entry.name);
            if (plugin && plugin.runtime === 'node') {
                task.message = '检查插件依赖...';
                const pluginDir = path.join(PROJECT_ROOT, plugin.path);
                const prep = await prepareNodePluginDeps(pluginDir, entry.name, (line) => {
                    task.logs = [...(task.logs || []), line.slice(0, 200)].slice(-8); // npm 实时输出，保留最近 8 行
                });
                if (!prep.ok) throw new Error(`依赖准备失败: ${prep.error}`);
            } else if (plugin && plugin.runtime === 'python') {
                task.message = '准备 Python 虚拟环境与依赖（首次可能需要数分钟）...';
                const prep = await preparePythonPluginDeps(PROJECT_ROOT, plugin.path, entry.name, (line) => {
                    task.logs = [...(task.logs || []), line.slice(0, 200)].slice(-8); // pip 实时输出，保留最近 8 行
                });
                if (!prep.ok) throw new Error(`依赖准备失败: ${prep.error}`);
            }
            task.stage = 'start';
            task.percent = 97;
            task.logs = [];
            task.message = '启动插件...';
            const r = await startPluginByKey(entry.name);
            task.result = {started: !!r.ok, pid: r.pid || null, error: r.error || null};
            task.percent = 100;
        } else {
            task.result = {started: false};
        }
        task.status = 'done';
        task.stage = 'done';
        task.percent = 100;
        task.message = start && task.result && task.result.started
            ? `安装完成，插件已启动 (pid=${task.result.pid})`
            : '安装完成';
    } catch (error) {
        task.status = 'error';
        task.error = error.message;
        task.message = error.message;
        logError(`[pluginMarket] 插件 ${entry.name} ${task.type}失败:`, error.message);
    } finally {
        task.finishedAt = Date.now();
    }
}

function createInstallTask(type, entry) {
    installTask = {
        id: `${type}-${Date.now()}`,
        type,
        name: entry.name,
        version: entry.version,
        status: 'running',
        stage: 'download',
        percent: 0,
        message: '准备安装...',
        logs: [],
        startedAt: Date.now(),
        finishedAt: null,
        error: null,
        result: null
    };
    return installTask;
}

function taskBusy() {
    return installTask && installTask.status === 'running';
}

/**
 * GET /api/admin/market/install/status
 * 当前/最近一次安装任务进度（单任务模型，无需 taskId）
 */
export async function getInstallTaskStatus(req, reply) {
    return reply.send({success: true, data: installTask});
}

const truthy = (v) => v === true || v === 'true' || v === '1';

/**
 * POST /api/admin/plugins/upload  (multipart/form-data)
 * 上传插件 zip 安装包：流式落盘临时目录 → 预读元信息 → 走 installPlugin 完整管线
 * （与市场安装共用 installTask 单任务互斥与 /market/install/status 进度轮询）
 * 字段：file(zip 必填) | active(随服务启动) | start(装后立即启动) | sha256(可选完整性校验)
 */
export async function uploadPlugin(req, reply) {
    if (taskBusy()) return reply.code(409).send({success: false, error: '已有安装任务进行中，请稍后再试'});

    const fail = (code, message) => {
        const e = new Error(message);
        e.statusCode = code;
        return e;
    };
    const tmpZip = path.join(TMP_DIR, `upload-${Date.now()}-${process.pid}.zip`);
    let handedOff = false; // taskId 返回后临时文件归安装管线清理
    const cleanup = () => fs.promises.rm(tmpZip, {force: true}).catch(() => {});

    try {
        await fs.promises.mkdir(TMP_DIR, {recursive: true});
        const fields = {};
        let saved = false;
        let uploadName = '';
        for await (const part of req.parts()) {
            if (part.type !== 'file') {
                fields[part.fieldname] = part.value;
                continue;
            }
            if (saved) throw fail(400, '仅允许一个文件字段 file');
            if (!/\.zip$/i.test(part.filename || '')) throw fail(400, '仅支持 .zip 安装包');
            uploadName = part.filename;
            await pipeline(part.file, fs.createWriteStream(tmpZip)); // 流式写盘，内存占用恒定
            saved = true;
        }
        if (!saved) throw fail(400, '缺少 zip 文件字段 file');

        let entry;
        try {
            entry = buildEntryFromZip(tmpZip, uploadName);
        } catch (e) {
            throw fail(400, e.message);
        }
        entry._source = 'upload';
        if (typeof fields.sha256 === 'string' && fields.sha256.trim()) entry.sha256 = fields.sha256.trim();

        const active = truthy(fields.active);
        const start = truthy(fields.start);
        const task = createInstallTask('upload', entry);
        log(`[pluginMarket] 开始安装上传的插件包 ${entry.name}${entry.version ? '@' + entry.version : ''} ...`);
        // 后台管线前置：同名旧插件运行中先停止（Windows 下运行中目录 rename 会 EBUSY），
        // 装完按 start 参数/原状态处理；对齐市场「更新」的先停后装模式
        (async () => {
            const wasRunning = !!getRuntimeStatus()[entry.name];
            if (wasRunning) {
                task.message = '停止运行中的旧版本...';
                await stopPluginByName(entry.name);
            }
            runInstallPipeline(task, entry, {active, start, zipPath: tmpZip});
            if (task.status === 'done') task.result = {...(task.result || {}), restarted: wasRunning};
        })();
        handedOff = true;
        return reply.send({success: true, data: {taskId: task.id}});
    } catch (error) {
        if (!handedOff) await cleanup();
        if (error.statusCode) return reply.code(error.statusCode).send({success: false, error: error.message});
        // multipart 超限等流错误
        const tooLarge = /fileSize|too large|truncated/i.test(error.message || '');
        req.log.error('上传插件安装失败:', error);
        return reply.code(tooLarge ? 413 : 500).send({
            success: false,
            error: tooLarge ? `安装包超过大小上限 ${MAX_UPLOAD_BYTES} 字节` : '上传安装失败: ' + error.message
        });
    }
}

/**
 * POST /api/admin/market/install  { name, version?, active?, start? }
 * 立即返回 taskId，安装转后台任务，进度轮询 GET /market/install/status
 */
export async function installMarketPlugin(req, reply) {
    const {name, version, active = false, start = false} = req.body || {};
    if (!name) return reply.code(400).send({success: false, error: '缺少插件名 name'});
    if (taskBusy()) return reply.code(409).send({success: false, error: '已有安装任务进行中，请稍后再试'});

    try {
        const market = await getMarketIndex();
        const entry = market.plugins.find(p => p.name === name && (!version || p.version === version));
        if (!entry) {
            return reply.code(404).send({success: false, error: `市场清单中未找到插件: ${name}${version ? '@' + version : ''}`});
        }
        const task = createInstallTask('install', entry);
        log(`[pluginMarket] 开始安装插件 ${name}@${entry.version} ...`);
        runInstallPipeline(task, entry, {active, start}); // 后台执行，不 await
        return reply.send({success: true, data: {taskId: task.id}});
    } catch (error) {
        req.log.error('插件市场安装失败:', error);
        return reply.code(500).send({success: false, error: '安装失败: ' + error.message});
    }
}

/**
 * POST /api/admin/market/update  { name }
 * 停止运行中进程 → 覆盖安装（保留原 active/params/env）→ 原来在运行则重新拉起
 */
export async function updateMarketPlugin(req, reply) {
    const {name} = req.body || {};
    if (!name) return reply.code(400).send({success: false, error: '缺少插件名 name'});
    if (taskBusy()) return reply.code(409).send({success: false, error: '已有安装任务进行中，请稍后再试'});

    try {
        const market = await getMarketIndex();
        const entry = market.plugins.find(p => p.name === name);
        if (!entry) return reply.code(404).send({success: false, error: `市场清单中未找到插件: ${name}`});
        if (!listInstalledPlugins().some(i => i.name === name)) {
            return reply.code(400).send({success: false, error: `插件 ${name} 未安装，无法更新`});
        }

        const wasRunning = !!getRuntimeStatus()[name];

        const task = createInstallTask('update', entry);
        log(`[pluginMarket] 开始更新插件 ${name}@${entry.version} ...`);
        // 后台管线前置：先停旧进程再走安装（active 传 null 保留用户已设值）
        (async () => {
            if (wasRunning) {
                task.message = '停止运行中的旧版本...';
                await stopPluginByName(name);
            }
            await runInstallPipeline(task, entry, {active: null, start: wasRunning});
            if (task.status === 'done') task.result = {...(task.result || {}), restarted: wasRunning};
        })();
        return reply.send({success: true, data: {taskId: task.id}});
    } catch (error) {
        req.log.error('插件市场更新失败:', error);
        return reply.code(500).send({success: false, error: '更新失败: ' + error.message});
    }
}

/**
 * POST /api/admin/market/uninstall  { name }
 * 运行中则先停止 → 删目录 → 移除配置
 */
export async function uninstallMarketPlugin(req, reply) {
    const {name} = req.body || {};
    if (!name) return reply.code(400).send({success: false, error: '缺少插件名 name'});
    try {
        await stopPluginByName(name);
        const result = await uninstallPluginFiles(name);
        await reloadPluginsConfig();
        log(`[pluginMarket] 插件 ${name} 已卸载 (removed=${result.removed})`);
        return reply.send({success: true, data: result});
    } catch (error) {
        req.log.error('插件市场卸载失败:', error);
        return reply.code(500).send({success: false, error: '卸载失败: ' + error.message});
    }
}

// ==================== 插件运行时控制（P1） ====================

/**
 * GET /api/admin/plugins/status → name -> { key, pid, running, startedAt }
 */
export async function getPluginsRuntimeStatus(req, reply) {
    return reply.send({success: true, data: getRuntimeStatus()});
}

/**
 * POST /api/admin/plugins/start  { name }
 */
export async function startPluginHandler(req, reply) {
    const {name} = req.body || {};
    if (!name) return reply.code(400).send({success: false, error: '缺少插件名 name'});
    try {
        const plugin = getPluginsConfig().find(p => p.name === name);
        if (plugin && plugin.runtime === 'node') {
            const prep = await prepareNodePluginDeps(path.join(PROJECT_ROOT, plugin.path), name);
            if (!prep.ok) return reply.code(500).send({success: false, error: prep.error});
        }
        if (plugin && plugin.runtime === 'python') {
            const prep = await preparePythonPluginDeps(PROJECT_ROOT, plugin.path, name);
            if (!prep.ok) return reply.code(500).send({success: false, error: prep.error});
        }
        const r = await startPluginByKey(name);
        if (!r.ok) {
            return reply.code(r.running ? 409 : 500).send({success: false, error: r.error});
        }
        return reply.send({success: true, data: r});
    } catch (error) {
        req.log.error('启动插件失败:', error);
        return reply.code(500).send({success: false, error: '启动插件失败: ' + error.message});
    }
}

/**
 * POST /api/admin/plugins/stop  { name }
 */
export async function stopPluginHandler(req, reply) {
    const {name} = req.body || {};
    if (!name) return reply.code(400).send({success: false, error: '缺少插件名 name'});
    try {
        const r = await stopPluginByName(name);
        return reply.send({success: true, data: r});
    } catch (error) {
        req.log.error('停止插件失败:', error);
        return reply.code(500).send({success: false, error: '停止插件失败: ' + error.message});
    }
}

/**
 * POST /api/admin/plugins/restart  { name }
 */
export async function restartPluginHandler(req, reply) {
    const {name} = req.body || {};
    if (!name) return reply.code(400).send({success: false, error: '缺少插件名 name'});
    try {
        const plugin = getPluginsConfig().find(p => p.name === name);
        if (plugin && plugin.runtime === 'node') {
            const prep = await prepareNodePluginDeps(path.join(PROJECT_ROOT, plugin.path), name);
            if (!prep.ok) return reply.code(500).send({success: false, error: prep.error});
        }
        if (plugin && plugin.runtime === 'python') {
            const prep = await preparePythonPluginDeps(PROJECT_ROOT, plugin.path, name);
            if (!prep.ok) return reply.code(500).send({success: false, error: prep.error});
        }
        const r = await restartPluginByName(name);
        if (!r.ok) {
            return reply.code(r.running ? 409 : 500).send({success: false, error: r.error});
        }
        return reply.send({success: true, data: r});
    } catch (error) {
        req.log.error('重启插件失败:', error);
        return reply.code(500).send({success: false, error: '重启插件失败: ' + error.message});
    }
}
