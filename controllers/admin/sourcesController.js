/**
 * 源管理控制器
 * 提供源列表、验证、语法检查、模板获取等功能
 */

import fs from '../../utils/fsWrapper.js';
import path from 'path';
import vm from 'vm';
import { execFile } from 'child_process';
import util from 'util';
import { PROJECT_ROOT } from '../../utils/pathHelper.js';
import {safePath} from '../../utils/pathGuard.js';

// P3：源路径工具与引擎映射收敛至 utils/sourceState.js（本文件保持 re-export 兼容既有引用）
import {SOURCE_ENGINES, validateSourceFilename, matchSourceEngine, removeDisabledPaths, setSourcesEnabled as applySourcesEnabled, getDisabledSet, regenerateIndexAsync} from '../../utils/sourceState.js';
import {resolveFlowTarget, runVerifyFlow} from '../../utils/sourceVerify.js';

const execFileAsync = util.promisify(execFile);

// 兼容既有引用（tests/unit/source-upload.test.js 等）：工具实现已迁 utils/sourceState.js
export {SOURCE_ENGINES, validateSourceFilename, matchSourceEngine};

// 列出所有源（附 disabled 全量路径清单，前端据此渲染每行的启用/停用状态）
export async function listSources(req, reply) {
    try {
        const result = {};
        for (const [engine, cfg] of Object.entries(SOURCE_ENGINES)) {
            const dir = path.join(PROJECT_ROOT, cfg.dir);
            result[engine] = await fs.pathExists(dir)
                ? (await fs.readdir(dir)).filter(f => f.endsWith(cfg.ext) && !f.startsWith('_')).sort()
                : [];
        }
        result.disabled = [...getDisabledSet()].sort();
        return reply.send(result);
    } catch (e) {
        reply.code(500).send({
            error: e.message
        });
    }
}

/**
 * POST /api/admin/sources/enabled  { paths: string[], enabled: boolean }
 * 单个与批量共用端点（单操作 = 单元素数组）；写盘成功后异步重建 index.json/custom.json
 */
export async function setSourcesEnabled(req, reply) {
    try {
        if (process.env.READ_ONLY_MODE === '1') {
            return reply.code(403).send({success: false, error: '系统当前处于只读模式，禁止修改源'});
        }
        const {paths, enabled} = req.body || {};
        if (!Array.isArray(paths) || paths.length === 0) {
            return reply.code(400).send({success: false, error: 'paths 必须为非空数组'});
        }
        if (typeof enabled !== 'boolean') {
            return reply.code(400).send({success: false, error: 'enabled 必须为布尔值'});
        }
        if (paths.length > 200) {
            return reply.code(400).send({success: false, error: '单次最多操作 200 个源'});
        }
        const r = applySourcesEnabled(paths, enabled);
        if (r.updated > 0) regenerateIndexAsync(); // 异步重建缓存配置，失败不影响本次响应
        return reply.send({success: true, data: {updated: r.updated, skipped: r.skipped}});
    } catch (e) {
        req.log.error('设置源启用状态失败:', e);
        reply.code(500).send({success: false, error: e.message});
    }
}

// 验证源文件
export async function validateSpider(req, reply) {
    try {
        const { path: filePath } = req.body;

        if (!filePath || !isSafePath(filePath)) {
            return reply.code(400).send({
                isValid: false,
                error: '无效的文件路径'
            });
        }

        const fullPath = path.join(PROJECT_ROOT, filePath);
        if (!await fs.pathExists(fullPath)) {
            return reply.code(404).send({
                isValid: false,
                error: '文件不存在'
            });
        }

        let code = await fs.readFile(fullPath, 'utf-8');

        // PHP 文件验证
        if (filePath.endsWith('.php')) {
            try {
                await execFileAsync('php', ['-l', fullPath]);
                return reply.send({
                    isValid: true,
                    message: 'PHP 语法检查通过 (结构验证暂不支持)'
                });
            } catch (e) {
                return reply.send({
                    isValid: false,
                    error: `PHP 语法错误: ${e.message}`
                });
            }
        }

        // Python 文件验证
        if (filePath.endsWith('.py')) {
            try {
                await execFileAsync('python', ['-m', 'py_compile', fullPath]);
                return reply.send({
                    isValid: true,
                    message: 'Python 语法检查通过 (结构验证暂不支持)'
                });
            } catch (e) {
                return reply.send({
                    isValid: false,
                    error: `Python 语法错误: ${e.message}`
                });
            }
        }

        // 如果是 JS 文件，尝试解码
        if (filePath.endsWith('.js')) {
            try {
                const { decodeDsSource } = await import('../../utils/dsHelper.js');
                code = await decodeDsSource(code);
            } catch (e) {
                // 解码失败，使用原始代码
            }
        }

        // 创建沙箱执行
        const sandbox = {
            console: { log: () => {} },
            require: () => {},
            rule: null
        };

        try {
            vm.createContext(sandbox);
            new vm.Script(code).runInContext(sandbox);

            if (!sandbox.rule) {
                return reply.send({
                    isValid: false,
                    error: '源文件中缺少 rule 对象'
                });
            }

            // 基本验证
            const required = ['title', 'host', 'url'];
            const missing = required.filter(k => !sandbox.rule[k]);

            if (missing.length > 0) {
                return reply.send({
                    isValid: false,
                    error: `rule 对象缺少必填字段: ${missing.join(', ')}`
                });
            }

            return reply.send({
                isValid: true,
                message: '验证通过'
            });
        } catch (e) {
            return reply.send({
                isValid: false,
                error: `执行错误: ${e.message}`
            });
        }
    } catch (e) {
        reply.code(500).send({
            error: e.message
        });
    }
}

// 检查语法（控制器壳：路径校验后委托 syntaxCheckFile；错误统一 400 + isValid:false）
export async function checkSyntax(req, reply) {
    try {
        const { path: filePath } = req.body;

        if (!filePath || !isSafePath(filePath)) {
            return reply.code(400).send({
                isValid: false,
                error: '无效的文件路径'
            });
        }

        if (!await fs.pathExists(path.join(PROJECT_ROOT, filePath))) {
            return reply.code(400).send({
                isValid: false,
                error: '文件不存在'
            });
        }

        return reply.send(await syntaxCheckFile(filePath));
    } catch (e) {
        reply.code(400).send({
            isValid: false,
            error: `语法错误: ${e.message}`
        });
    }
}

/**
 * 语法检查核心（供 checkSyntax 与上传后自动校验共用）：
 * .php → php -l；.py → python -m py_compile；.js → 解码后 vm 编译检查
 * @returns {Promise<{isValid: true, message: string}>} 失败时抛出异常（message 含原因）
 */
async function syntaxCheckFile(filePath) {
    const fullPath = path.join(PROJECT_ROOT, filePath);

    if (filePath.endsWith('.php')) {
        await execFileAsync('php', ['-l', fullPath]);
        return {isValid: true, message: 'PHP 语法检查通过'};
    }

    if (filePath.endsWith('.py')) {
        // fix: 原 execAsync 从未定义（恒抛 ReferenceError 被吞成语法错误），
        // 与 PHP 检查统一使用 execFileAsync，避免 shell 注入面
        await execFileAsync('python', ['-m', 'py_compile', fullPath]);
        return {isValid: true, message: 'Python 语法检查通过'};
    }

    let code = await fs.readFile(fullPath, 'utf-8');

    if (filePath.endsWith('.js')) {
        try {
            const { decodeDsSource } = await import('../../utils/dsHelper.js');
            code = await decodeDsSource(code);
        } catch (e) {
            // 解码失败，使用原始代码
        }
    }

    new vm.Script(code);
    return {isValid: true, message: '语法检查通过'};
}

/**
 * POST /api/admin/sources/upload
 * 上传源文件（JSON body 文本 content，路由级 bodyLimit 5MB）。
 * 落盘后自动语法校验（fail-soft：校验失败仍保留文件，响应 check.ok=false 由用户决定修改或删除）
 */
export async function uploadSource(req, reply) {
    try {
        if (process.env.READ_ONLY_MODE === '1') {
            return reply.code(403).send({success: false, error: '系统当前处于只读模式，禁止修改源'});
        }
        const { engine, filename, content, overwrite } = req.body || {};

        const v = validateSourceFilename(engine, filename);
        if (!v.ok) return reply.code(400).send({success: false, error: v.error});

        if (typeof content !== 'string' || content.length === 0) {
            return reply.code(400).send({success: false, error: '源文件内容不能为空'});
        }
        if (content.length > 5 * 1024 * 1024) {
            return reply.code(413).send({success: false, error: '源文件内容超过 5MB 上限'});
        }

        const cfg = SOURCE_ENGINES[engine];
        const rel = `${cfg.dir}/${v.name}`;
        // safePath 终检（双层防护的第二层，见 docs/upload-design.md §6）
        if (!isSafePath(rel)) {
            return reply.code(403).send({success: false, error: '目标路径未通过安全校验'});
        }

        const abs = path.join(PROJECT_ROOT, cfg.dir, v.name);
        if (await fs.pathExists(abs) && overwrite !== true) {
            return reply.code(409).send({success: false, error: `同名源已存在: ${v.name}`, data: {exists: true}});
        }

        await fs.writeFile(abs, content, 'utf-8');

        let check = {ok: true, message: '未执行校验'};
        try {
            const r = await syntaxCheckFile(rel);
            check = {ok: r.isValid, message: r.message};
        } catch (e) {
            check = {ok: false, message: e.message};
        }

        return reply.send({success: true, data: {path: rel, engine, check}});
    } catch (e) {
        reply.code(500).send({success: false, error: e.message});
    }
}

/**
 * POST /api/admin/sources/delete  { path }
 * 仅允许删除源目录白名单内的单个源文件（防借道删除项目其他文件）
 */
export async function deleteSource(req, reply) {
    try {
        if (process.env.READ_ONLY_MODE === '1') {
            return reply.code(403).send({success: false, error: '系统当前处于只读模式，禁止修改源'});
        }
        const { path: relPath } = req.body || {};
        const m = matchSourceEngine(relPath);
        if (!m) {
            return reply.code(403).send({
                success: false,
                error: '仅允许删除源目录（spider/js、js_dr2、catvod、php、py）内的文件'
            });
        }
        const cfg = SOURCE_ENGINES[m.engine];
        const name = m.name;
        // 仅单文件：不含子路径段（'/' 挡住 spider/js/../../.env 类穿越），排除目录引用
        if (!name || name.includes('/') || name === '..' || name === '.' || name.startsWith('_')) {
            return reply.code(403).send({success: false, error: '仅允许删除源目录内的单个源文件'});
        }
        if (!name.endsWith(cfg.ext)) {
            return reply.code(403).send({success: false, error: `${m.engine} 类型源仅支持删除 ${cfg.ext} 文件`});
        }

        const abs = path.join(PROJECT_ROOT, cfg.dir, name);
        if (!await fs.pathExists(abs)) {
            return reply.code(404).send({success: false, error: '源文件不存在'});
        }
        const stat = await fs.stat(abs);
        if (!stat.isFile()) {
            return reply.code(403).send({success: false, error: '目标不是文件，拒绝删除'});
        }

        await fs.unlink(abs);
        removeDisabledPaths([`${cfg.dir}/${name}`]); // 联动清理停用列表残留
        regenerateIndexAsync(); // 已删源不在新配置中，缓存配置同样需要重建
        return reply.send({success: true, data: {path: `${cfg.dir}/${name}`, engine: m.engine}});
    } catch (e) {
        reply.code(500).send({success: false, error: e.message});
    }
}

// 获取模板
export async function getTemplate(req, reply) {
    const template = `/*
* @File     : drpy-node spider template
* @Author   : user
* @Date     : ${new Date().toISOString().split('T')[0]}
* @Comments :
*/

var rule = {
    // 影视|漫画|小说
    类型: '影视',
    // 源标题
    title: 'Site Name',
    // 源主域名
    host: 'https://example.com',
    // 源主页链接
    homeUrl: '/latest/',
    // 源一级列表链接
    url: '/category/fyclass/page/fypage',
    // 源搜索链接
    searchUrl: '/search?wd=**&pg=fypage',
    // 允许搜索、允许快搜、允许筛选
    searchable: 2,
    quickSearch: 0,
    filterable: 1,
    // 请求头
    headers: {
        'User-Agent': 'MOBILE_UA',
    },
    // 超时时间
    timeout: 5000,
    // 静态分类
    class_name: '电影&电视剧&综艺&动漫',
    class_url: '1&2&3&4',

    // 是否需要调用免嗅
    play_parse: true,
    // 免嗅lazy执行函数
    lazy: '',
    // 首页推荐数量
    limit: 6,
    // 是否双层列表
    double: true,

    // 推荐列表
    推荐: '.recommend .item;a&&title;img&&src;.remarks&&Text;a&&href',
    // 一级列表
    一级: '.list .item;a&&title;img&&src;.remarks&&Text;a&&href',
    // 二级详情
    二级: {
        "title": "h1&&Text",
        "img": ".poster img&&src",
        "desc": ".desc&&Text",
        "content": ".content&&Text",
        "tabs": ".tabs span",
        "lists": ".playlists ul"
    },
    // 搜索
    搜索: '.search-result .item;a&&title;img&&src;.remarks&&Text;a&&href',
}`;

    return reply.send({ template });
}

export async function getLibsInfo(req, reply) {
    const info = {
        globalObjects: [
            "request(url, options) - HTTP Request",
            "post(url, options) - HTTP POST Request",
            "pdfa(html, rule) - Parse List",
            "pdfh(html, rule) - Parse Single Node",
            "pd(html, rule) - Parse URL",
            "setItem(k, v) - Persistent storage",
            "getItem(k) - Retrieve storage",
            "clearItem(k) - Delete storage",
            "urljoin(base, path) - Resolve URL"
        ],
        parsingRules: [
            "Format: selector;attr1;attr2...",
            "pdfa (list): Returns array",
            "pdfh (single): Returns string",
            "pd (url): Returns resolved URL string",
            "Special Attrs: Text, Html, href, src, style, data-*",
            "Syntax: && (nested), || (backup), :eq(n) (index), * (all)"
        ]
    };
    return reply.send(info);
}

// P2：路径安全校验收敛至 utils/pathGuard.js（原为本文件内的重复实现）
const isSafePath = safePath;

// ==================== 接口全流程验证（docs/source-verify-design.md） ====================

// 进程内单飞互斥：同一时间仅允许一个流程验证（步骤含真实外站请求，避免叠加）
let flowVerifyRunning = false;

/**
 * POST /api/admin/sources/verify-flow
 * 对单个源真实走一遍 首页→分类→详情→搜索（→可选播放）协议链路。
 * 服务端自调用 http://127.0.0.1:{localPort}/api/{module}，pwd 取 process.env.API_PWD，不向前端暴露。
 * 停用源同样可验证（验证是诊断工具，与启用/停用正交）。
 */
export async function verifySourceFlow(req, reply) {
    const {path: relPath, options = {}} = req.body || {};
    if (!relPath) {
        return reply.code(400).send({success: false, error: '缺少源路径 path'});
    }
    const target = resolveFlowTarget(relPath);
    if (!target.supported) {
        return reply.code(400).send({success: false, error: target.reason});
    }
    if (flowVerifyRunning) {
        return reply.code(409).send({success: false, error: '已有验证任务进行中，请稍后再试'});
    }

    flowVerifyRunning = true;
    try {
        const base = `http://127.0.0.1:${req.socket.localPort}`;
        const pwd = process.env.API_PWD || '';
        const data = await runVerifyFlow({
            base,
            moduleName: target.moduleName,
            engine: target.engine,
            doParam: target.doParam,
            pwd,
            searchKeyword: typeof options.searchKeyword === 'string' && options.searchKeyword.trim()
                ? options.searchKeyword.trim() : '爱',
            perStepTimeoutMs: options.perStepTimeoutMs,
            verifyPlay: options.verifyPlay === true,
        });
        return reply.send({success: true, data: {module: target.moduleName, engine: target.engine, ...data}});
    } catch (e) {
        req.log.error('源流程验证失败:', e);
        return reply.code(500).send({success: false, error: '流程验证失败: ' + e.message});
    } finally {
        flowVerifyRunning = false;
    }
}
