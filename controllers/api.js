/**
 * API控制器 - 处理drpy-node的核心API路由
 *
 * 功能说明：
 * 1. 提供统一的API接口，支持多种引擎（drpyS、hipy、xbpq、catvod）
 * 2. 处理视频源的首页、分类、详情、搜索、播放等操作
 * 3. 提供代理服务和解析服务
 * 4. 支持超时控制和错误处理
 *
 * 主要路由：
 * - /api/:module - 主API接口，支持GET/POST
 * - /proxy/:module/* - 代理接口
 * - /parse/:jx - 解析接口
 *
 * @author drpy-node
 * @version 1.0.0
 */

import {log, logError} from '../utils/log.js';
import path from 'path';
import {existsSync, readFileSync, statSync} from 'fs';
import {base64Decode} from '../libs_drpy/crypto-util.js';
import {ENV} from "../utils/env.js";
import {validatePwd} from "../utils/api_validate.js";
import {startJsonWatcher, getApiEngine} from "../utils/api_helper.js";
import {withTimeout as withTimeoutBase} from '../utils/with-timeout.js';
import {createRuleEnvContext} from '../utils/rule-env.js';
import {proxyStreamMedia} from './mediaProxy.js';
import * as drpyS from '../libs/drpyS.js';
import hipy from '../libs/hipy.js';
import php from '../libs/php.js';
import xbpq from '../libs/xbpq.js';
import catvod from '../libs/catvod.js';

/**
 * 支持的引擎映射表
 * 包含drpyS、hipy、phipy、xbpq、catvod五种引擎
 */
const ENGINES = {
    drpyS,
    hipy,
    php,
    xbpq,
    catvod,
};

// ===== 内容关键词过滤 =====
let _filterRegex = null;
let _filterMtime = 0;

function loadFilterRegex() {
    const filterPath = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'config', 'filter_keywords.json');
    try {
        const stat = statSync(filterPath);
        if (_filterRegex && stat.mtimeMs === _filterMtime) return _filterRegex;
        const raw = JSON.parse(readFileSync(filterPath, 'utf-8'));
        // 兼容两种格式：旧版纯数组 / 新版 {encoded: base64字符串}
        const keywords = Array.isArray(raw)
            ? raw
            : JSON.parse(Buffer.from(raw.encoded, 'base64').toString('utf-8'));
        // 转义正则特殊字符后拼接为单个正则，一次匹配替代逐词遍历
        const escaped = keywords.map(kw => kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        _filterRegex = new RegExp(escaped.join('|'), 'i');
        _filterMtime = stat.mtimeMs;
        return _filterRegex;
    } catch {
        return _filterRegex;
    }
}

function containsKeyword(text) {
    if (!text) return false;
    const re = loadFilterRegex();
    return re ? re.test(String(text)) : false;
}

/** 过滤 vod 列表条目和分类：命中关键词的移除（仅 hide_adult===2 时生效） */
function filterVodList(result) {
    if (ENV.get('hide_adult') !== '2') return result;
    if (!result || typeof result !== 'object') return result;

    // 过滤视频列表
    if (Array.isArray(result.list)) {
        const before = result.list.length;
        result.list = result.list.filter(item =>
            !containsKeyword(item.vod_name)
            && !containsKeyword(item.vod_remarks)
            && !containsKeyword(item.vod_content)
        );
        const removed = before - result.list.length;
        if (removed > 0) {
            log(`[ContentFilter] 过滤 ${removed} 条命中关键词的视频条目`);
        }
    }

    // 过滤分类（class 数组的 type_name）
    if (Array.isArray(result.class)) {
        const before = result.class.length;
        result.class = result.class.filter(item => !containsKeyword(item.type_name));
        const removed = before - result.class.length;
        if (removed > 0) {
            log(`[ContentFilter] 过滤 ${removed} 个命中关键词的分类`);
        }
    }

    return result;
}

/**
 * 创建带超时的Promise包装函数
 * 为API操作添加超时控制，防止长时间阻塞
 *
 * @param {Promise} promise - 要包装的Promise对象
 * @param {number|null} timeoutMs - 超时时间（毫秒），null则使用默认值
 * @param {string} operation - 操作描述，用于错误信息
 * @param {string|null} invokeMethod - 调用方法类型，用于确定超时时间
 * @returns {Promise} 包装后的Promise，会在超时时reject
 */
function withTimeout(promise, timeoutMs = null, operation = 'API操作', invokeMethod = null) {
    let defaultTimeout;

    // 根据invokeMethod确定超时时间
    if (invokeMethod === 'action') {
        // action接口使用专用超时时间，默认60秒
        defaultTimeout = parseInt(process.env.API_ACTION_TIMEOUT || '60') * 1000;
    } else {
        // 其他接口使用默认超时时间，默认20秒
        defaultTimeout = parseInt(process.env.API_TIMEOUT || '20') * 1000;
    }

    const actualTimeout = timeoutMs || defaultTimeout;

    // L10：改用公共超时包装器——原裸 Promise.race 的输家 setTimeout 永不清理，
    // 高并发搜索/翻页时每个请求遗留一个 20~60s 的 pending timer。
    return withTimeoutBase(promise, actualTimeout, operation);
}

/**
 * Fastify插件主函数
 * 注册所有API路由和中间件
 *
 * @param {Object} fastify - Fastify实例
 * @param {Object} options - 插件选项，包含jsonDir、jxDir等配置
 * @param {Function} done - 插件完成回调
 */
export default (fastify, options, done) => {
    // 启动JSON监听器，监控规则文件变化
    startJsonWatcher(ENGINES, options.jsonDir);

    /**
     * 主API路由 - 处理视频源的各种操作
     * 支持GET和POST请求，根据query参数执行不同逻辑
     *
     * 支持的操作：
     * - 默认：返回首页和推荐内容
     * - play：播放链接解析
     * - ac+t：分类列表
     * - ac+ids：详情信息
     * - ac+action：动作处理
     * - wd：搜索
     * - refresh：强制刷新
     */
    fastify.route({
        method: ['GET', 'POST'], // 同时支持 GET 和 POST
        url: '/api/:module',
        preHandler: validatePwd, // 密码验证中间件
        schema: {
            consumes: ['application/json', 'application/x-www-form-urlencoded'], // 声明支持的内容类型
            tags: ['协议接口'],
            summary: '模块数据接口（T4）',
            description: '按传参进入不同逻辑：play 播放 / ac+t 分类 / ac+ids 详情 / ac+action 动作 / wd 搜索 / refresh 刷新 / 缺省返回 home+homeVod。ext 必须是 Base64 编码的 JSON。',
            security: [], // pwd 参数鉴权，不走全局 Basic Auth
            params: {type: 'object', properties: {module: {type: 'string', description: '源文件名称，如 腾云驾雾[官]'}}, required: ['module']},
            // 兼容性注意（壳子协议回归教训）：querystring 值一律声明为 string——
            // v1 无 schema 时全按原始字符串传递；此前把 quick/filter/pg 声明为 integer，
            // 壳子传 filter=true / pg= 空值会被 ajv 打 400 导致大量壳子加载失败。
            // additionalProperties: string 显式容纳壳子附加的任意参数（token/type/h 等）。
            querystring: {
                type: 'object',
                additionalProperties: {type: 'string'},
                properties: {
                    pwd: {type: 'string', description: '访问密码（服务端设置了 API 密码时必填）'},
                    play: {type: 'string', description: '播放链接标识'},
                    flag: {type: 'string', description: '播放标志（配合 play）'},
                    ac: {type: 'string', description: '动作类型：list 分类 / detail 详情 / action 动作'},
                    t: {type: 'string', description: '分类 ID（配合 ac=list）'},
                    ids: {type: 'string', description: '详情 ID，逗号分隔（配合 ac=detail）'},
                    action: {type: 'string', description: '执行动作名（配合 ac=action）'},
                    value: {type: 'string', description: '执行动作值'},
                    wd: {type: 'string', description: '搜索关键字'},
                    quick: {type: 'string', description: '搜索模式：0 普通 / 1 快速（部分壳子传 true，保持原始字符串）'},
                    refresh: {type: 'string', description: '传任意值强制刷新初始化'},
                    filter: {type: 'string', description: '是否开启筛选（部分壳子传 true/false，保持原始字符串）'},
                    pg: {type: 'string', description: '页码（壳子可能传空值，服务端 Number()||1 兜底）'},
                    ext: {type: 'string', description: 'Base64 编码的 JSON 筛选参数'},
                    extend: {type: 'string', description: '扩展参数（与 /config 中 sites.ext 对应）'},
                    do: {type: 'string', description: '自定义源适配器'},
                },
            },
        },
        handler: async (request, reply) => {
            const moduleName = request.params.module;
            const method = request.method.toUpperCase();

            // 根据请求方法选择参数来源
            const query = method === 'GET' ? request.query : Object.assign(request.query || {}, request.body);

            // 获取API引擎和模块路径
            let {apiEngine, moduleDir, _ext, modulePath} = getApiEngine(ENGINES, moduleName, query, options);

            // 检查模块文件是否存在
            if (!existsSync(modulePath)) {
                const error_msg=`Module ${moduleName} not found`;
                logError(error_msg);
                fastify.log.error(error_msg);
                reply.status(404).send({error: error_msg});
                return;
            }

            // 获取模块扩展参数
            const moduleExt = query.extend || '';

            // P2：env 构建样板收敛至 utils/rule-env.js（原为三处逐字重复）
            const {getEnv} = createRuleEnvContext(request, options, query, moduleExt);

            const env = getEnv(moduleName);

            /**
             * 动态获取规则对象
             * 支持跨规则调用，为规则提供调用其他规则的能力
             *
             * @param {string} _moduleName - 目标模块名称
             * @returns {Object|null} 规则对象，包含callRuleFn方法
             */
            env.getRule = async function (_moduleName) {
                const _modulePath = path.join(moduleDir, `${_moduleName}${_ext}`);
                if (!existsSync(_modulePath)) {
                    return null;
                }
                const _env = getEnv(_moduleName);
                const RULE = await withTimeout(
                    apiEngine.getRule(_modulePath, _env),
                    null,
                    `获取规则[${_moduleName}]`
                );

                /**
                 * 规则函数调用方法
                 * 提供统一的规则方法调用接口
                 *
                 * @param {string} _method - 方法名称
                 * @param {Array} _args - 方法参数
                 * @returns {*} 方法执行结果
                 */
                RULE.callRuleFn = async function (_method, _args) {
                    let invokeMethod = null;

                    // 方法名映射到标准接口
                    switch (_method) {
                        case 'class_parse':
                            invokeMethod = 'home';
                            break;
                        case '推荐':
                            invokeMethod = 'homeVod';
                            break;
                        case '一级':
                            invokeMethod = 'category';
                            break;
                        case '二级':
                            invokeMethod = 'detail';
                            break;
                        case '搜索':
                            invokeMethod = 'search';
                            break;
                        case 'lazy':
                            invokeMethod = 'play';
                            break;
                        case 'proxy_rule':
                            invokeMethod = 'proxy';
                            break;
                        case 'action':
                            invokeMethod = 'action';
                            break;
                    }

                    // 如果没有映射的方法，直接调用规则对象的方法
                    if (!invokeMethod) {
                        if (typeof RULE[_method] !== 'function') {
                            return null
                        } else {
                            return await withTimeout(
                                RULE[_method],
                                null,
                                `规则方法[${_method}]`
                            )
                        }
                    }

                    // 调用映射后的标准接口
                    return await withTimeout(
                        apiEngine[invokeMethod](_modulePath, _env, ..._args),
                        null,
                        `规则调用[${_method}]`,
                        invokeMethod
                    )
                };
                return RULE
            };

            // 获取页码参数
            const pg = Number(query.pg) || 1;

            /** 统一响应出口：自动过滤 list 中的敏感条目 */
            function sendFiltered(result) {
                filterVodList(result);
                return reply.send(result);
            }

            try {
                // 根据 query 参数决定执行逻辑

                // 处理播放逻辑
                if ('play' in query) {
                    const result = await withTimeout(
                        apiEngine.play(modulePath, env, query.flag, query.play),
                        null,
                        `播放接口[${moduleName}]`
                    );
                    return sendFiltered(result);
                }

                // 处理分类逻辑
                if ('ac' in query && 't' in query) {
                    let ext = query.ext;
                    let extend = {};

                    // 解析筛选参数
                    if (ext) {
                        try {
                            extend = JSON.parse(base64Decode(ext))
                        } catch (e) {
                            fastify.log.error(`筛选参数错误:${e.message}`);
                        }
                    }

                    const result = await withTimeout(
                        apiEngine.category(modulePath, env, query.t, pg, 1, extend),
                        null,
                        `分类接口[${moduleName}]`
                    );
                    return sendFiltered(result);
                }

                // 处理详情逻辑
                if ('ac' in query && 'ids' in query) {
                    if (method === 'POST') {
                        fastify.log.info(`[${moduleName}] 二级已接收post数据: ${query.ids}`);
                    }

                    const result = await withTimeout(
                        apiEngine.detail(modulePath, env, query.ids.split(',')),
                        null,
                        `详情接口[${moduleName}]`
                    );
                    return sendFiltered(result);
                }

                // 处理动作逻辑
                if ('ac' in query && 'action' in query) {
                    const result = await withTimeout(
                        apiEngine.action(modulePath, env, query.action, query.value),
                        null,
                        `动作接口[${moduleName}]`,
                        'action'
                    );
                    return sendFiltered(result);
                }

                // 处理搜索逻辑
                if ('wd' in query) {
                    const quick = 'quick' in query ? query.quick : 0;
                    const result = await withTimeout(
                        apiEngine.search(modulePath, env, query.wd, quick, pg),
                        null,
                        `搜索接口[${moduleName}]`
                    );
                    return sendFiltered(result);
                }

                // 处理强制刷新初始化逻辑
                if ('refresh' in query) {
                    const refreshedObject = await withTimeout(
                        apiEngine.init(modulePath, env, true),
                        null,
                        `初始化接口[${moduleName}]`
                    );
                    const {context, ...responseObject} = refreshedObject;
                    return sendFiltered(responseObject);
                }

                // 默认逻辑，返回 home + homeVod 接口
                if (!('filter' in query)) {
                    query.filter = 1
                }

                const filter = 'filter' in query ? query.filter : 1;

                // 获取首页数据
                const resultHome = await withTimeout(
                    apiEngine.home(modulePath, env, filter),
                    null,
                    `首页接口[${moduleName}]`
                );

                // 获取推荐数据
                const resultHomeVod = await withTimeout(
                    apiEngine.homeVod(modulePath, env),
                    null,
                    `推荐接口[${moduleName}]`
                );

                // 合并结果
                let result = {
                    ...resultHome,
                };

                // 如果有推荐数据，添加到结果中
                if (Array.isArray(resultHomeVod) && resultHomeVod.length > 0) {
                    Object.assign(result, {list: resultHomeVod})
                }

                sendFiltered(result);

            } catch (error) {
                // 错误处理和日志记录
                const error_msg=`Failed to process module ${moduleName}: ${error.message}`;
                logError(error_msg);
                fastify.log.error(error_msg);
                reply.status(500).send({error: error_msg});
            }
        }
    });

    /**
     * 代理路由 - 处理模块的代理请求
     * 支持流媒体代理、文件代理等功能
     *
     * 路径格式：/proxy/:module/*
     * 支持Range请求头，用于视频流的断点续传
     */
    fastify.get('/proxy/:module/*', {
        schema: {
            tags: ['协议接口'],
            summary: '模块代理接口',
            description: '转发/代理模块相关资源，支持 Range 请求与流媒体；可能返回二进制、JSON/文本，或 302 重定向到 /mediaProxy 流代理。',
            security: [],
            params: {
                type: 'object',
                properties: {
                    module: {type: 'string', description: '模块名称'},
                    '*': {type: 'string', description: '代理目标路径（可含斜杠）'},
                },
                required: ['module', '*'],
            },
        },
    }, async (request, reply) => {
        const moduleName = request.params.module;
        const query = request.query; // 获取 query 参数

        // 获取API引擎和模块路径
        let {apiEngine, modulePath} = getApiEngine(ENGINES, moduleName, query, options);

        // 检查模块文件是否存在
        if (!existsSync(modulePath)) {
            const error_msg=`Module ${moduleName} not found`;
            logError(error_msg);
            fastify.log.error(error_msg);
            reply.status(404).send({error: error_msg});
            return;
        }

        const proxyPath = request.params['*']; // 捕获整个路径
        fastify.log.info(`try proxy for ${moduleName} -> ${proxyPath}: ${JSON.stringify(query)}`);

        const rangeHeader = request.headers.range; // 获取客户端的 Range 请求头
        const moduleExt = query.extend || '';

        // P2：env 构建样板收敛至 utils/rule-env.js（proxyPath 为本路由附加字段）
        const {getEnv} = createRuleEnvContext(request, options, query, moduleExt);

        function buildEnv(moduleName) {
            return getEnv(moduleName, {extra: {proxyPath}});
        }

        const env = buildEnv(moduleName);

        // 能力注入：`__` 前缀为框架保留字段（见 docs/t4api.md「代理接口与 toBytes 协议」）
        // __range      客户端 Range 请求头，源据此回 206 分段
        // __mediaProxy 服务端流式代理基址，源用它拼 toBytes=2/3 的流式出口
        query.__range = rangeHeader || '';
        query.__mediaProxy = env.mediaProxyUrl;

        try {
            // 调用模块的代理方法
            const backRespList = await withTimeout(
                apiEngine.proxy(modulePath, env, query),
                null,
                `代理接口[${moduleName}]`
            );

            // 解析代理响应
            const statusCode = backRespList[0];
            const mediaType = backRespList[1] || 'application/octet-stream';
            let content = backRespList[2] || '';
            const headers = backRespList.length > 3 ? backRespList[3] : null;
            const toBytes = backRespList.length > 4 ? backRespList[4] : null;

            // 如果需要转换为字节内容(尝试base64转bytes)
            if (toBytes === 1) {
                try {
                    if (content.includes('base64,')) {
                        content = unescape(content.split("base64,")[1]);
                    }
                    content = Buffer.from(content, 'base64');
                } catch (e) {
                    const error_msg = `Local Proxy toBytes error: ${e}`;
                    fastify.log.error(error_msg);
                    logError(error_msg);
                }
            }
            // 流代理 - 重定向到媒体代理服务
            else if (toBytes === 2 && content.startsWith('http')) {
                const new_headers = {
                    ...(headers ? headers : {}),
                    ...(rangeHeader ? {Range: rangeHeader} : {}), // 添加 Range 请求头
                }

                // 构建重定向URL，使用媒体代理服务
                const redirectUrl = `/mediaProxy?url=${encodeURIComponent(content)}&headers=${encodeURIComponent(JSON.stringify(new_headers))}&thread=${ENV.get('thread') || 1}`;

                // 执行重定向
                return reply.redirect(redirectUrl);
            }
            // 流代理 - 服务端内联流式 pipe（不 302：规避播放器跳转丢 header/不支持 302 的客户端，
            // Range/206/空闲断开语义与 /mediaProxy?stream=1 完全一致）
            else if (toBytes === 3 && content.startsWith('http')) {
                return await proxyStreamMedia(content, headers || {}, request, reply, 0);
            }

            // 根据媒体类型来决定如何设置字符编码
            if (typeof content === 'string') {
                // 如果返回的是文本内容（例如 JSON 或字符串）
                if (mediaType && (mediaType.includes('text') || mediaType === 'application/json')) {
                    // 对于文本类型，设置 UTF-8 编码
                    reply
                        .code(statusCode)
                        .type(`${mediaType}; charset=utf-8`)  // 设置编码为 UTF-8
                        .headers(headers || {})  // 如果有headers, 则加上
                        .send(content);
                } else {
                    // 对于其他类型的文本（例如 XML），直接返回，不指定 UTF-8 编码
                    reply
                        .code(statusCode)
                        .type(mediaType)
                        .headers(headers || {})
                        .send(content);
                }
            } else {
                // 如果返回的是二进制内容（例如图片或其他文件）
                reply
                    .code(statusCode)
                    .type(mediaType)  // 使用合适的媒体类型，如 image/png
                    .headers(headers || {})
                    .send(content);
            }

        } catch (error) {
            const error_msg = `Error proxy module ${moduleName}:${error.message}`;
            fastify.log.error(error_msg);
            logError(error_msg);
            reply.status(500).send({error: error_msg});
        }
    });

    /**
     * 解析路由 - 处理视频链接解析
     * 用于解析各种视频网站的播放链接
     *
     * 路径格式：/parse/:jx
     * 支持多种解析器，返回解析后的播放链接
     */
    fastify.get('/parse/:jx', {
        schema: {
            tags: ['协议接口'],
            summary: '解析接口',
            description: '调用解析脚本解析传入链接，code 200 成功 / 404 失败，cost 为耗时毫秒。',
            security: [],
            params: {type: 'object', properties: {jx: {type: 'string', description: '解析脚本名称（jx 目录下 .js 文件名）'}}, required: ['jx']},
            // 兼容性：不设 required——壳子可能空 url 探测；缺失/非法 url 由 handler 返回协议 JSON 错误（与 v1 一致），而非 400
            querystring: {
                type: 'object',
                additionalProperties: {type: 'string'},
                properties: {
                    url: {type: 'string', description: '待解析链接'},
                    extend: {type: 'string', description: '扩展参数'},
                },
            },
        },
    }, async (request, reply) => {
        let t1 = (new Date()).getTime(); // 记录开始时间
        const jxName = request.params.jx;
        const query = request.query; // 获取 query 参数

        // 构建解析器文件路径
        const jxPath = path.join(options.jxDir, `${jxName}.js`);

        // 检查解析器文件是否存在
        if (!existsSync(jxPath)) {
            const error_msg = `解析 ${jxName} not found`;
            fastify.log.error(error_msg);
            logError(error_msg);
            return reply.status(404).send({error: error_msg});
        }

        const moduleExt = query.extend || '';

        // P2：env 构建样板收敛至 utils/rule-env.js；
        // parse 路由需将 /parse/ 重写为 /proxy/，因此覆写 proxyUrl 模板
        const {protocol, hostname, getEnv} = createRuleEnvContext(request, options, query, moduleExt);

        const jxProxyUrlBase = `${protocol}://${hostname}${request.url}`.split('?')[0].replace('/parse/', '/proxy/');

        const env = getEnv('', {
            proxyUrl: jxProxyUrlBase + `/?do=${query.do || "ds"}&extend=${encodeURIComponent(moduleExt)}`,
        });

        try {
            // 调用drpyS引擎的解析方法
            const backResp = await withTimeout(
                drpyS.jx(jxPath, env, query),
                null,
                `解析接口[${jxName}]`
            );

            const statusCode = 200;
            const mediaType = 'application/json; charset=utf-8';

            // 处理对象类型的响应
            if (typeof backResp === 'object') {
                // 设置默认的状态码
                if (!backResp.code) {
                    let statusCode = backResp.url && backResp.url !== query.url ? 200 : 404;
                    backResp.code = statusCode
                }

                // 设置默认的消息
                if (!backResp.msg) {
                    let msgState = backResp.url && backResp.url !== query.url ? '成功' : '失败';
                    backResp.msg = `${jxName}解析${msgState}`;
                }

                // 计算耗时
                let t2 = (new Date()).getTime();
                backResp.cost = t2 - t1;

                let backRespSend = JSON.stringify(backResp);
                log(backRespSend);
                return reply.code(statusCode).type(`${mediaType}; charset=utf-8`).send(backRespSend);
            }
            // 处理字符串类型的响应
            else if (typeof backResp === 'string') {
                // 处理重定向响应
                if (backResp.startsWith('redirect://')) {
                    return reply.redirect(backResp.split('redirect://')[1]);
                }

                // 构建标准响应格式
                let statusCode = backResp && backResp !== query.url ? 200 : 404;
                let msgState = backResp && backResp !== query.url ? '成功' : '失败';
                let t2 = (new Date()).getTime();

                let result = {
                    code: statusCode,
                    url: backResp,
                    msg: `${jxName}解析${msgState}`,
                    cost: t2 - t1
                }

                let backRespSend = JSON.stringify(result);
                log(backRespSend);
                return reply.code(statusCode).type(`${mediaType}; charset=utf-8`).send(backRespSend);
            } else {
                // 其他类型的响应，返回失败
                const error_msg = `${jxName}解析失败`;
                fastify.log.error(error_msg);
                logError(error_msg);
                return reply.status(404).send({error: error_msg});
            }

        } catch (error) {
            // 错误处理和日志记录
            const error_msg = `Failed to proxy jx ${jxName}: ${error.message}`;
            fastify.log.error(error_msg);
            logError(error_msg);
            reply.status(500).send({error: error_msg});
        }
    });

    // 插件注册完成
    done();
};
