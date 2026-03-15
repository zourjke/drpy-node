import {readFile} from 'fs/promises';
import {XMLHttpRequest} from 'xmlhttprequest';
import WebSocket, {WebSocketServer} from 'ws';
import path from "path";
import vm from 'vm';
import zlib from 'zlib';
import JSONbig from 'json-bigint';
import forge from "node-forge";
import * as minizlib from 'minizlib';
import {LRUCache} from 'lru-cache';
import * as utils from '../utils/utils.js';
import * as misc from '../utils/misc.js';
import COOKIE from '../utils/cookieManager.js';
import AIS from '../utils/ais.js';
import PanS from '../utils/pans.js';
import {createWebDAVClient} from '../utils/webdav.js';
import {createFTPClient} from '../utils/ftp.js';
import {ENV} from '../utils/env.js';
import {getContentType, getMimeType} from "../utils/mime-type.js";
import {getParsesDict, getSitesMap, pathLib, executeParse, es6_extend_code, req_extend_code} from "../utils/file.js";
import {getFirstLetter} from "../utils/pinyin-tool.js";
import {reqs} from "../utils/req.js";
import {toBeijingTime} from "../utils/datetime-format.js"
import "../utils/random-http-ua.js";
import {initializeGlobalDollar, rootRequire} from "../libs_drpy/moduleLoader.js";
import {base64Decode, base64Encode, md5, rc4, rc4_decode, rc4Decrypt, rc4Encrypt} from "../libs_drpy/crypto-util.js";
import template from '../libs_drpy/template.js'
import batchExecute from '../libs_drpy/batchExecute.js';
import '../libs_drpy/drpyInject.js'
import {
    MOBILE_UA, PC_UA, UA, UC_UA, IOS_UA,
    RULE_CK, CATE_EXCLUDE, TAB_EXCLUDE, OCR_RETRY, OCR_API, nodata, SPECIAL_URL,
    setResult, setHomeResult, setResult2, urlDeal, tellIsJx,
    urlencode, encodeUrl,
    uint8ArrayToBase64, Utf8ArrayToStr,
    gzip, ungzip,
    encodeStr, decodeStr,
    getCryptoJS, RSA, fixAdM3u8Ai, forceOrder, getQuery, dealJson, OcrApi, getHome, buildUrl,
    parseQueryString, buildQueryString, encodeIfContainsSpecialChars, objectToQueryString,
    getOriginalJs,
    pako, gbkTool, JSEncrypt, CryptoJS, NODERSA, JSON5, jinja, atob, btoa, stringify,
    lrcToSrt, strExtract,
    jsEncoder
} from '../libs_drpy/drpyCustom.js';


import {
    pageRequestCache, cachedRequest, invokeWithInjectVars,
    homeParse, homeVodParse, cateParse,
    detailParse, searchParse, playParse, proxyParse,
    playParseAfter, detailParseAfter, cateParseAfter, searchParseAfter, homeParseAfter,
    commonClassParse, commonHomeListParse, commonCategoryListParse,
    commonDetailListParse, commonSearchListParse, commonLazyParse,
    executeJsCodeInSandbox,
} from './drpysParser.js'

import '../libs_drpy/es6-extend.js';

globalThis.JSONbig = JSONbig; // 抖音弹幕直播必须
globalThis._ENV = process.env;
globalThis._fetch = fetch;
globalThis.JsonBig = JSONbig({storeAsString: true});
globalThis.require = rootRequire;
initializeGlobalDollar();

const {Ali, Baidu, Baidu2, Cloud, Pan, Quark, UC, Yun, Xun} = PanS;
const {
    sleep, sleepSync, getNowTime, computeHash, deepCopy,
    urljoin, urljoin2, joinUrl, keysToLowerCase, naturalSort, $js,
    createBasicAuthHeaders, get_size,
} = utils;
// 缓存已初始化的模块和文件 hash 值
const CACHE_OPTIONS = {
    max: 100,
    ttl: 1000 * 60 * 10, // 10分钟
};
// const moduleCache = new Map();
// const ruleObjectCache = new Map();
// const jxCache = new Map();
const moduleCache = new LRUCache(CACHE_OPTIONS);
const ruleObjectCache = new LRUCache(CACHE_OPTIONS);
const jxCache = new LRUCache(CACHE_OPTIONS);

// 记录当前请求会话的标识，用于判断是否需要清理缓存
let currentSessionId = null;
let lastClearTime = 0;
// 记录当前会话是否已经清理过缓存
let sessionCacheCleared = false;
// 记录各个会话的缓存清理状态，支持并发访问
const sessionCacheStates = new Map();
let pupWebview = null;
if (typeof fetchByHiker === 'undefined') { // 判断是海阔直接放弃导入puppeteer
    try {
        // 尝试动态导入模块puppeteerHelper
        const {puppeteerHelper} = await import('../utils/headless-util.js');  // 使用动态 import
        pupWebview = new puppeteerHelper();
        log('[getSandbox] puppeteerHelper imported successfully');
    } catch (error) {
        // log('Failed to import puppeteerHelper:', error);
        log(`[getSandbox] Failed to import puppeteerHelper:${error.message}`);
    }
}
globalThis.pupWebview = pupWebview;

try {
    if (typeof fetchByHiker !== 'undefined' && typeof globalThis.import === 'function') {
        await globalThis.import('../libs_drpy/crypto-js-wasm.js'); // 海阔放在globalThis里去动态引入
    } else {
        await import('../libs_drpy/crypto-js-wasm.js'); // 使用动态 import规避海阔报错无法运行问题
    }
    globalThis.CryptoJSW = CryptoJSWasm;
} catch (error) {
    // log('Failed to import puppeteerHelper:', error);
    log(`[getSandbox] Failed to import CryptoJSWasm:${error.message}`);
    globalThis.CryptoJSW = {
        loadAllWasm: async function () {
        },
        // MD5: async function (str) {
        //     return md5(str)
        // },
        ...CryptoJS
    };
}

let simplecc = null;
try {
    // 尝试动态导入模块puppeteerHelper
    const simWasm = await import('simplecc-wasm');  // 使用动态 import
    simplecc = simWasm.simplecc;
    log('[getSandbox] simplecc imported successfully');
} catch (error) {
    // log('Failed to import puppeteerHelper:', error);
    log(`[getSandbox] Failed to import simplecc:${error.message}`);
}
globalThis.simplecc = simplecc;

let DataBase = null;
let database = null;
try {
    if (typeof fetchByHiker !== 'undefined' && typeof globalThis.import === 'function') {
        const sqliteUtil = await globalThis.import('../utils/database.js'); // 海阔放在globalThis里去动态引入
        DataBase = sqliteUtil.DataBase;
        database = sqliteUtil.database;
    } else {
        const sqliteUtil = await import('../utils/database.js');  // 使用动态 import
        DataBase = sqliteUtil.DataBase;
        database = sqliteUtil.database;
    }
    log('[getSandbox] sqlite3 database imported successfully');
} catch (error) {
    log(`[getSandbox] Failed to import sqlite3:${error.message}`);
}

globalThis.DataBase = DataBase;
globalThis.database = database;

// Static Sandbox Definitions
const STATIC_UTILS_SANDBOX = {
    sleep, sleepSync, utils, misc, computeHash, deepCopy, urljoin, urljoin2, joinUrl, naturalSort, $js,
    createBasicAuthHeaders, get_size, $, getContentType, getMimeType, getParsesDict, getFirstLetter
};

const STATIC_DRPY_SANDBOX = {
    jsp, pdfh, pd, pdfa, jsoup, pdfl, pjfh, pj, pjfa, pq, local, md5X, rsaX, aesX, desX, req, reqs,
    toBeijingTime, _fetch, XMLHttpRequest, AIS, batchFetch, JSProxyStream, JSFile, js2Proxy, log, print,
    jsonToCookie, cookieToJson, runMain, cachedRequest,
};

const STATIC_DRPY_CUSTOM_SANDBOX = {
    MOBILE_UA, PC_UA, UA, UC_UA, IOS_UA, RULE_CK, CATE_EXCLUDE, TAB_EXCLUDE, OCR_RETRY, OCR_API, nodata,
    SPECIAL_URL, setResult, setHomeResult, setResult2, urlDeal, tellIsJx, urlencode, encodeUrl,
    uint8ArrayToBase64, Utf8ArrayToStr, gzip, ungzip, encodeStr, decodeStr, getCryptoJS, RSA, fixAdM3u8Ai,
    forceOrder, getQuery, stringify, dealJson, OcrApi, getHome, buildUrl, keysToLowerCase, parseQueryString,
    buildQueryString, encodeIfContainsSpecialChars, objectToQueryString, forge, lrcToSrt, strExtract,
};

const STATIC_LIBS_SANDBOX = {
    matchesAll, cut, gbkTool, CryptoJS, JSEncrypt, NODERSA, pako, JSON5, jinja, template, batchExecute,
    atob, btoa, base64Encode, base64Decode, md5, rc4Encrypt, rc4Decrypt, rc4, rc4_decode, randomUa,
    jsonpath, hlsParser, axios, axiosX, URL, pathLib, executeParse, qs, Buffer, URLSearchParams, COOKIE,
    ENV, _ENV, Quark, Baidu, Baidu2, UC, Ali, Cloud, Yun, Pan, Xun, createWebDAVClient, createFTPClient,
    require: rootRequire, WebSocket, WebSocketServer, zlib, JSONbig, JsonBig, minizlib,
    iconv: globalThis.iconv, cheerio: globalThis.cheerio,
};

// 合并所有静态沙箱对象，减少创建沙箱时的属性拷贝开销
const GLOBAL_STATIC_SANDBOX = {
    ...STATIC_UTILS_SANDBOX,
    ...STATIC_DRPY_SANDBOX,
    ...STATIC_DRPY_CUSTOM_SANDBOX,
    ...STATIC_LIBS_SANDBOX,
};

// Precompiled Scripts
const REQ_EXTEND_SCRIPT = new vm.Script(req_extend_code);
const TEMPLATE_CHECK_FUNC_CODE = `
globalThis._checkTemplateFunc = async function(html, parseRuleStr) {
    try {
        let p = parseRuleStr.split(';');
        let p0 = p[0];
        let is_json = p0.startsWith('json:');
        p0 = p0.replace(/^(jsp:|json:|jq:)/, '');
        let classes = [];
        let $pdfa, $pdfh, $pd;
        if (is_json) {
            html = dealJson(html);
            $pdfa = pjfa; $pdfh = pjfh; $pd = pj;
        } else {
            $pdfa = pdfa; $pdfh = pdfh; $pd = pd;
        }
        if (is_json) {
            try {
                let list = $pdfa(html, p0);
                if (list && list.length > 0) classes = list;
            } catch (e) { log('[handleTemplateInheritance] json分类解析失败:' + e.message); }
        } else if (p.length >= 3) {
            try {
                let list = $pdfa(html, p0);
                if (list && list.length > 0) {
                    for (const it of list) {
                        try {
                            let name = $pdfh(it, p[1]);
                            let url = $pd(it, p[2]);
                            if (p.length > 3 && p[3]) {
                                let exp = new RegExp(p[3]);
                                let match = url.match(exp);
                                if (match && match[1]) url = match[1];
                            }
                            if (name.trim()) classes.push({ 'type_id': url.trim(), 'type_name': name.trim() });
                        } catch (e) { log('[handleTemplateInheritance] 分类列表解析元素失败:' + e.message); }
                    }
                }
            } catch (e) { log('[handleTemplateInheritance] 分类列表解析失败:' + e.message); }
        }
        return { class: classes };
    } catch (e) {
        log('[handleTemplateInheritance] 模板测试执行错误:', e.message);
        return { class: [] };
    }
};
`;
// 将 ES6 扩展和模板检查函数合并为一个脚本，减少 runInContext 调用次数
const SANDBOX_INIT_CODE = es6_extend_code + '\n' + TEMPLATE_CHECK_FUNC_CODE;
const SANDBOX_INIT_SCRIPT = new vm.Script(SANDBOX_INIT_CODE);

const TEMPLATE_CHECK_CALL_SCRIPT = new vm.Script(`_checkTemplateFunc(globalThis._tempHtml, globalThis._tempParse)`);
const CACHED_REQUEST_SCRIPT = new vm.Script(`
(async function() {
    try {
        return await cachedRequest(request, globalThis._tempHost, globalThis._tempHeaders, 'host');
    } catch (e) {
        log('[handleTemplateInheritance] 获取HOST页面失败:', e.message);
        return '';
    }
})()
`);

// 预编译 initParse 中的静态脚本
const INIT_HEADERS_SCRIPT = new vm.Script(`
globalThis.oheaders = rule.oheaders
globalThis.rule_fetch_params = rule.rule_fetch_params;
`);

const INIT_JSOUP_SCRIPT = new vm.Script(`
globalThis.jsp = new jsoup(rule.host||'');
globalThis.pdfh = pdfh;
globalThis.pd = pd;
globalThis.pdfa = pdfa;
globalThis.HOST = rule.host||'';
`);


export async function getSandbox(env = {}) {
    const {getProxyUrl, requestHost, hostUrl, fServer} = env;
    // (可选) 加载所有 wasm 文件
    await CryptoJSW.loadAllWasm();

    // 动态库依赖
    const dynamicLibsSandbox = {
        CryptoJSW,
        DataBase,
        database,
        simplecc,
        iconv: globalThis.iconv,
        cheerio: globalThis.cheerio,
    };

    const sandbox = {
        console,      // 将 console 注入沙箱，便于调试
        WebAssembly, // 允许使用原生 WebAssembly
        setTimeout,   // 注入定时器方法
        setInterval,
        clearTimeout,
        clearInterval,
        TextEncoder,
        TextDecoder,
        performance,
        module: {},   // 模块支持
        exports: {},   // 模块支持
        rule: {}, // 用于存放导出的 rule 对象
        jx: {},// 用于存放导出的 解析 对象
        lazy: async function () {
        }, // 用于导出解析的默认函数
        _asyncGetRule: null,
        _asyncGetLazy: null,
        ...GLOBAL_STATIC_SANDBOX, // 使用预合并的静态沙箱
        // 直接注入环境相关的工具函数，避免创建中间对象 dynamicUtilsSandbox
        pupWebview,
        getProxyUrl,
        requestHost,
        hostUrl,
        fServer,
        ...dynamicLibsSandbox,
    };
    // 创建一个上下文
    const context = vm.createContext(sandbox);
    // 注入扩展代码到沙箱中 (ES6扩展 + 模板检查函数)
    SANDBOX_INIT_SCRIPT.runInContext(context);

    // 设置沙箱到全局 $
    sandbox.$.setSandbox(sandbox);
    /*
    if (typeof fetchByHiker !== 'undefined') { // 临时解决海阔不支持eval问题，但是这个eval存在作用域问题，跟非海阔环境的有很大区别，属于残废版本
        sandbox.eval = function (code) {
            const evalScript = new vm.Script(code);
            return evalScript.runInContext(context);
        };
    }
    */
    return {
        sandbox,
        context
    }
}

/**
 * 初始化模块：加载并执行模块文件，存储初始化后的 rule 对象
 * 如果存在 `预处理` 属性且为函数，会在缓存前执行
 * @param {string} filePath - 模块文件路径
 * @param env
 * @param refresh 强制清除缓存
 * @returns {Promise<object>} - 返回初始化后的模块对象
 */
export async function init(filePath, env = {}, refresh) {
    try {
        // 读取文件内容
        const fileContent = await readFile(filePath, 'utf-8');
        // 计算文件的 hash 值
        const fileHash = computeHash(fileContent);
        const moduleName = path.basename(filePath, '.js');
        const SitesMap = getSitesMap();
        let moduleExt = env.ext || '';
        // log('moduleName:', moduleName);
        // log('moduleExt:', moduleExt);
        // log('SitesMap:', SitesMap);
        if (moduleExt && SitesMap[moduleName]) {
            try {
                moduleExt = ungzip(moduleExt);
            } catch (e) {
                log(`[init] [${moduleName}] ungzip解密moduleExt失败: ${e.message}`);
            }
            if (!SitesMap[moduleName].find(i => i.queryStr === moduleExt) && !SitesMap[moduleName].find(i => i.queryObject.params === moduleExt)) {
                throw new Error("moduleExt is wrong!")
            }
        }
        let hashMd5 = md5(filePath + '#pAq#' + moduleExt);

        // 检查缓存：是否有文件且未刷新且文件 hash 未变化
        if (moduleCache.has(hashMd5) && !refresh) {
            const cached = moduleCache.get(hashMd5);
            if (cached.hash === fileHash) {
                // log(`Module ${filePath} already initialized and unchanged, returning cached instance.`);
                return cached.moduleObject;
            }
        }
        log(`[init] Loading module: ${filePath}`);
        let t1 = getNowTime();
        const {sandbox, context} = await getSandbox(env);
        // 执行文件内容，将其放入沙箱中
        const js_code = await getOriginalJs(fileContent);
        // log('js_code:', js_code.slice(5000));
        const js_code_wrapper = `
    _asyncGetRule  = (async function() {
        ${js_code}
        return rule;
    })();
    `;
        const ruleScript = new vm.Script(js_code_wrapper);
        // ruleScript.runInContext(context);
        // const result = await ruleScript.runInContext(context);
        const executeWithTimeout = (script, context, timeout) => {
            let timer;
            return Promise.race([
                new Promise((_, reject) =>
                    timer = setTimeout(() => reject(new Error('Code execution timed out')), timeout)
                ),
                new Promise((resolve, reject) => {
                    try {
                        const result = script.runInContext(context); // 同步运行脚本
                        if (result && typeof result.then === 'function') {
                            // 如果结果是 Promise，则等待其解析
                            result.then(resolve).catch(reject);
                        } else {
                            // 如果结果是非异步值，直接返回
                            resolve(result);
                        }
                    } catch (error) {
                        reject(error);
                    }
                })
            ]).finally(() => {
                if (timer) clearTimeout(timer);
            });
        };
        const result = await executeWithTimeout(ruleScript, context, 30000);
        // log('result:', result);
        // sandbox.rule = await sandbox._asyncGetRule;
        sandbox.rule = result;

        // rule注入完毕后添加自定义req扩展request方法进入规则,这个代码里可以直接获取rule的任意对象，而且还是独立隔离的
        REQ_EXTEND_SCRIPT.runInContext(context);
        // 注意：不再直接挂载request/post函数到rule对象，避免内存占用和破坏沙箱隔离
        // 解析函数将通过executeSandboxFunction在沙箱内调用request/post

        // 访问沙箱中的 rule 对象。不进行deepCopy了,避免初始化或者预处理对rule.xxx进行修改后，在其他函数里使用却没生效问题
        // const moduleObject = deepCopy(sandbox.rule);
        const rule = sandbox.rule;
        if (moduleExt) { // 传了参数才覆盖rule参数，否则取rule内置
            // log('moduleExt:', moduleExt);
            if (moduleExt.startsWith('../json')) {
                rule.params = urljoin(env.jsonUrl, moduleExt.slice(8));
            } else {
                rule.params = moduleExt
            }
        }
        // 模板继承逻辑处理
        await handleTemplateInheritance(rule, context);

        await initParse(rule, env, vm, context);
        // otherScript放入到initParse去执行
//         const otherScript = new vm.Script(`
// globalThis.jsp = new jsoup(rule.host||'');
// globalThis.pdfh = pdfh;
// globalThis.pd = pd;
// globalThis.pdfa = pdfa;
// globalThis.HOST = rule.host||'';
//         `);
//         otherScript.runInContext(context);
        let t2 = getNowTime();
        // const moduleObject = deepCopy(rule);
        const moduleObject = rule;
        moduleObject.cost = t2 - t1;
        moduleObject.context = context; // 将沙箱上下文添加到moduleObject中
        // log(`${filePath} headers:`, moduleObject.headers);

        // 清理原始rule对象以减少内存占用
        // 由于已经深拷贝到moduleObject，原始rule不再需要
        // delete sandbox.rule;

        // 清理沙箱中的临时构建变量
        // delete sandbox._asyncGetRule;
        // delete sandbox.module;
        // delete sandbox.exports;

        // 缓存模块和文件的 hash 值
        moduleCache.set(hashMd5, {moduleObject, hash: fileHash});
        return moduleObject;
    } catch (error) {
        log(`[init] Error in drpy.init :${filePath}`, error);
        throw new Error(`[init] Failed to initialize module:${error.message}`);
    }
}

export async function getRuleObject(filePath, env, refresh) {
    try {
        // 读取文件内容
        const fileContent = await readFile(filePath, 'utf-8');
        // 计算文件的 hash 值
        const fileHash = computeHash(fileContent);

        // 检查缓存：是否有文件且未刷新且文件 hash 未变化
        if (ruleObjectCache.has(filePath) && !refresh) {
            const cached = ruleObjectCache.get(filePath);
            if (cached.hash === fileHash) {
                // log(`Module ${filePath} already initialized and unchanged, returning cached instance.`);
                return cached.ruleObject;
            }
        }
        // log(`Loading RuleObject: ${filePath} fileSize:${fileContent.length}`);
        let t1 = getNowTime();
        const {sandbox, context} = await getSandbox(env);
        const js_code = await getOriginalJs(fileContent);
        const js_code_wrapper = `
    _asyncGetRule  = (async function() {
        ${js_code}
        return rule;
    })();
    `;
        const ruleScript = new vm.Script(js_code_wrapper);
        ruleScript.runInContext(context);
        sandbox.rule = await sandbox._asyncGetRule;
        const rule = sandbox.rule;

        // 模板继承逻辑处理
        await handleTemplateInheritance(rule, context);
        let t2 = getNowTime();
        // const ruleObject = deepCopy(rule);
        const ruleObject = rule;
        // 设置可搜索、可筛选、可快搜等属性
        ruleObject.searchable = ruleObject.hasOwnProperty('searchable') ? Number(ruleObject.searchable) : 0;
        ruleObject.filterable = ruleObject.hasOwnProperty('filterable') ? Number(ruleObject.filterable) : 0;
        ruleObject.quickSearch = ruleObject.hasOwnProperty('quickSearch') ? Number(ruleObject.quickSearch) : 0;
        ruleObject.cost = t2 - t1;
        // log(`${filePath} headers:`, moduleObject.headers);

        // 清理原始rule对象以减少内存占用
        // 由于已经深拷贝到ruleObject，原始rule不再需要
        // delete sandbox.rule;

        // 清理沙箱中的临时构建变量
        // delete sandbox._asyncGetRule;
        // delete sandbox.module;
        // delete sandbox.exports;

        // 缓存模块和文件的 hash 值
        ruleObjectCache.set(filePath, {ruleObject, hash: fileHash});
        return ruleObject
    } catch (error) {
        log(`[getRuleObject] ${filePath} Error in drpy.getRuleObject:${error.message}`);
        return {}
    }
}

export async function initJx(filePath, env, refresh) {
    try {
        // 读取文件内容
        const fileContent = await readFile(filePath, 'utf-8');
        // 计算文件的 hash 值
        const fileHash = computeHash(fileContent);
        // env一定传的object。这里只有两种情况 1: 获取配置的时候env传的空{} 2:实际解析传的真实环境，所以hash值只需要0和1
        let hashMd5 = md5(filePath + '#pAq#' + (Object.keys(env).length === 0 ? 0 : 1));

        // 检查缓存：是否有文件且未刷新且文件 hash 未变化
        if (jxCache.has(hashMd5) && !refresh) {
            const cached = jxCache.get(hashMd5);
            if (cached.hash === fileHash) {
                // log(`Module ${filePath} already initialized and unchanged, returning cached instance.`);
                return cached.jxObj;
            }
        }
        log(`[initJx] Loading jx: ${filePath}, hash:${hashMd5}`);
        let t1 = getNowTime();
        // log('env:', env);
        const {sandbox, context} = await getSandbox(env);
        // 执行文件内容，将其放入沙箱中
        const js_code = await getOriginalJs(fileContent);
        const js_code_wrapper = `
    _asyncGetLazy  = (async function() {
        ${js_code}
        return {jx,lazy};
    })();
    `;
        const ruleScript = new vm.Script(js_code_wrapper);
        ruleScript.runInContext(context);
        const jxResult = await sandbox._asyncGetLazy;
        sandbox.lazy = jxResult.lazy;
        sandbox.jx = jxResult.jx;
        REQ_EXTEND_SCRIPT.runInContext(context);
        let t2 = getNowTime();
        const jxObj = {...sandbox.jx, lazy: sandbox.lazy};
        const cost = t2 - t1;
        log(`[initJx] 加载解析:${filePath} 耗时 ${cost}毫秒`)

        // 清理沙箱中的临时构建变量
        // delete sandbox._asyncGetLazy;
        // delete sandbox.module;
        // delete sandbox.exports;

        jxCache.set(hashMd5, {jxObj, hash: fileHash});
        return jxObj;
    } catch (error) {
        log(`[initJx] Error in drpy.initJx:${filePath}`, error);
        throw new Error(`[initJx] Failed to initialize jx:${error.message}`);
    }
}

export async function isLoaded() {
    if (jxCache && jxCache.size > 0) {
        log('[isLoaded] Map 不为空,已完成初始化');
        return true;
    } else {
        log('[isLoaded] Map 为空或未初始化');
        return false;
    }
}


/**
 * 调用模块的指定方法
 * @param {string} filePath - 模块文件路径
 * @param env 全局的环境变量-针对本规则，如代理地址
 * @param {string} method - 要调用的属性方法名称
 * @param args - 传递给方法的普通参数
 * @param {object} injectVars - 需要注入的变量（如 input 和 MY_URL）
 * @returns {Promise<any>} - 方法调用的返回值
 */
async function invokeMethod(filePath, env, method, args = [], injectVars = {}) {
    const moduleObject = await init(filePath, env); // 确保模块已初始化
    switch (method) {
        case 'get_rule':
            return moduleObject;
        case 'class_parse':
            injectVars = await homeParse(moduleObject, ...args);
            if (!injectVars) {
                return {}
            }
            break
        case '推荐':
            injectVars = await homeVodParse(moduleObject, ...args);
            if (!injectVars) {
                return {}
            }
            break
        case '一级':
            injectVars = await cateParse(moduleObject, ...args);
            if (!injectVars) {
                return {}
            }
            break
        case '二级':
            injectVars = await detailParse(moduleObject, ...args);
            if (!injectVars) {
                return {}
            }
            break;
        case '搜索':
            injectVars = await searchParse(moduleObject, ...args);
            if (!injectVars) {
                return {}
            }
            break;
        case 'lazy':
            injectVars = await playParse(moduleObject, ...args);
            if (!injectVars) {
                return {}
            }
            break;
        case 'proxy_rule':
            injectVars = await proxyParse(moduleObject, ...args);
            if (!injectVars) {
                return {}
            }
            break;
    }
    injectVars['method'] = method;
    // 环境变量扩展进入this区域
    Object.assign(injectVars, env);
    // 免嗅探代码特殊处理: 必须是函数或者没写
    if (method === 'lazy' && ((moduleObject[method] && typeof moduleObject[method] === 'function') || !moduleObject[method])) {
        return await commonLazyParse(moduleObject, method, injectVars, args)
    }
    // 字符串lazy且非js:直接返回嗅探
    else if (method === 'lazy' && typeof moduleObject[method] === 'string' && !moduleObject[method].startsWith('js:')) {
        return {
            parse: 1,
            url: injectVars.input,
            header: moduleObject.headers && Object.keys(moduleObject.headers).length > 0 ? moduleObject.headers : undefined
        }
    }
    // 分类动态解析特殊处理:允许不写
    else if (method === 'class_parse' && !moduleObject[method]) { // 新增特性，可以不写class_parse属性
        const tmpClassFunction = async function () {
        };
        return await invokeWithInjectVars(moduleObject, tmpClassFunction, injectVars, args);
    }
    // 特殊处理class_parse字符串
    else if (method === 'class_parse' && moduleObject[method] && typeof moduleObject[method] === 'string') {
        return await commonClassParse(moduleObject, method, injectVars, args);
    }
    // 函数直接执行
    else if (moduleObject[method] && typeof moduleObject[method] === 'function') {
        // log('injectVars:', injectVars);
        return await invokeWithInjectVars(moduleObject, moduleObject[method], injectVars, args);
    }
    // 特殊处理js:开头的字符串，在沙箱环境中执行
    else if (moduleObject[method] && typeof moduleObject[method] === 'string' && moduleObject[method].startsWith('js:')) {
        let result = await executeJsCodeInSandbox(moduleObject, method, injectVars, args);
        if (method === 'lazy') {
            result = await playParseAfter(moduleObject, result, args[1], args[0]);
            let ret_str = JSON.stringify(result);
            log(`[invokeMethod js:] 免嗅 ${injectVars.input} 执行完毕,结果为:`, ret_str.length < 100 ? ret_str : ret_str.slice(0, 100) + '...');
        } else if (method === '二级') {
            result = await detailParseAfter(result);
        } else if (method === '一级') {
            result = await cateParseAfter(moduleObject, result, args[1]);
            log(`[invokeMethod js:] 一级 ${injectVars.input} 执行完毕,结果为:`, JSON.stringify(result.list.slice(0, 2)));
        } else if (method === '搜索') {
            result = await searchParseAfter(moduleObject, result, args[2]);
            log(`[invokeMethod js:] 搜索 ${injectVars.input} 执行完毕,结果为:`, JSON.stringify(result.list.slice(0, 2)));
        } else if (method === 'class_parse') {
            result = await homeParseAfter(result, moduleObject.类型, moduleObject.hikerListCol, moduleObject.hikerClassListCol, moduleObject.mergeList, injectVars);
        }
        return result;
    }
    // 特殊处理一级字符串
    else if (method === '一级' && moduleObject[method] && typeof moduleObject[method] === 'string') {
        return await commonCategoryListParse(moduleObject, method, injectVars, args);
    }
    // 特殊处理搜索字符串
    else if (method === '搜索' && moduleObject[method] && typeof moduleObject[method] === 'string') {
        return await commonSearchListParse(moduleObject, method, injectVars, args);
    }
    // 特殊处理推荐字符串
    else if (method === '推荐' && moduleObject[method] && typeof moduleObject[method] === 'string') {
        return await commonHomeListParse(moduleObject, method, injectVars, args);
    }
    // 特殊处理二级字符串或对象
    else if (method === '二级' && (moduleObject[method] === '*' || (moduleObject[method] && typeof moduleObject[method] === 'object'))) {
        return await commonDetailListParse(moduleObject, method, injectVars, args);
    } else {
        // 其他未知函数或者函数属性是字符串
        if (['推荐', '一级', '搜索'].includes(method)) {
            return []
        } else if (['二级'].includes(method)) {
            return {}
        } else {  // class_parse一定要有，这样即使不返回数据都能自动取class_name和class_url的内容
            throw new Error(`Method ${method} not found in module ${filePath}`);
        }
    }
}


async function initParse(rule, env, vm, context) {
    rule.host = (rule.host || '').rstrip('/');
    // 检查并执行 `hostJs` 方法
    if (typeof rule.hostJs === 'function') {
        log('[initParse] Executing hostJs...');
        try {
            let HOST = await rule.hostJs.apply({input: rule.host, MY_URL: rule.host, HOST: rule.host});
            if (HOST) {
                rule.host = HOST.rstrip('/');
                log(`[initParse] 已动态设置规则【${rule.title}】的host为: ${rule.host}`);
            }
        } catch (e) {
            log(`[initParse] hostJs执行错误:${e.message}`);
        }
    }
    let rule_cate_excludes = (rule.cate_exclude || '').split('|').filter(it => it.trim());
    let rule_tab_excludes = (rule.tab_exclude || '').split('|').filter(it => it.trim());
    rule_cate_excludes = rule_cate_excludes.concat(CATE_EXCLUDE.split('|').filter(it => it.trim()));
    rule_tab_excludes = rule_tab_excludes.concat(TAB_EXCLUDE.split('|').filter(it => it.trim()));

    rule.cate_exclude = rule_cate_excludes.join('|');
    rule.tab_exclude = rule_tab_excludes.join('|');

    rule.类型 = rule.类型 || '影视'; // 影视|听书|漫画|小说
    rule.url = rule.url || '';
    rule.double = rule.double || false;
    rule.homeUrl = rule.homeUrl || '';
    rule.detailUrl = rule.detailUrl || '';
    rule.searchUrl = rule.searchUrl || '';
    rule.homeUrl = rule.host && rule.homeUrl ? urljoin(rule.host, rule.homeUrl) : (rule.homeUrl || rule.host);
    rule.homeUrl = jinja.render(rule.homeUrl, {rule: rule});
    rule.detailUrl = rule.host && rule.detailUrl ? urljoin(rule.host, rule.detailUrl) : rule.detailUrl;
    rule.二级访问前 = rule.二级访问前 || '';
    if (rule.url.includes('[') && rule.url.includes(']')) {
        let u1 = rule.url.split('[')[0]
        let u2 = rule.url.split('[')[1].split(']')[0]
        rule.url = rule.host && rule.url ? urljoin(rule.host, u1) + '[' + urljoin(rule.host, u2) + ']' : rule.url;
    } else {
        rule.url = rule.host && rule.url ? urljoin(rule.host, rule.url) : rule.url;
    }
    if (rule.searchUrl.includes('[') && rule.searchUrl.includes(']') && !rule.searchUrl.includes('#')) {
        let u1 = rule.searchUrl.split('[')[0]
        let u2 = rule.searchUrl.split('[')[1].split(']')[0]
        rule.searchUrl = rule.host && rule.searchUrl ? urljoin(rule.host, u1) + '[' + urljoin(rule.host, u2) + ']' : rule.searchUrl;
    } else {
        rule.searchUrl = rule.host && rule.searchUrl ? urljoin(rule.host, rule.searchUrl) : rule.searchUrl;
    }
    rule.timeout = rule.timeout || 5000;
    rule.encoding = rule.编码 || rule.encoding || 'utf-8';
    rule.search_encoding = rule.搜索编码 || rule.search_encoding || '';
    rule.图片来源 = rule.图片来源 || '';
    rule.图片替换 = rule.图片替换 || '';
    rule.play_json = rule.hasOwnProperty('play_json') ? rule.play_json : [];
    rule.pagecount = rule.hasOwnProperty('pagecount') ? rule.pagecount : {};
    rule.proxy_rule = rule.hasOwnProperty('proxy_rule') ? rule.proxy_rule : '';
    if (!rule.hasOwnProperty('sniffer')) { // 默认关闭辅助嗅探
        rule.sniffer = false;
    }
    // 二级为*自动添加mergeList属性允许跳过形式二级
    if (!rule.hasOwnProperty('mergeList') && rule.二级 === '*') {
        rule.mergeList = 1;
    }
    rule.sniffer = rule.hasOwnProperty('sniffer') ? rule.sniffer : '';
    rule.sniffer = !!(rule.sniffer && rule.sniffer !== '0' && rule.sniffer !== 'false');
    rule.isVideo = rule.hasOwnProperty('isVideo') ? rule.isVideo : '';
    if (rule.sniffer && !rule.isVideo) { // 默认辅助嗅探自动增强嗅探规则
        rule.isVideo = 'http((?!http).){12,}?\\.(m3u8|mp4|flv|avi|mkv|rm|wmv|mpg|m4a|mp3)\\?.*|http((?!http).){12,}\\.(m3u8|mp4|flv|avi|mkv|rm|wmv|mpg|m4a|mp3)|http((?!http).)*?video/tos*|http((?!http).)*?obj/tos*';
    }

    rule.tab_remove = rule.hasOwnProperty('tab_remove') ? rule.tab_remove : [];
    rule.tab_order = rule.hasOwnProperty('tab_order') ? rule.tab_order : [];
    rule.tab_rename = rule.hasOwnProperty('tab_rename') ? rule.tab_rename : {};

    if (rule.headers && typeof (rule.headers) === 'object') {
        try {
            let header_keys = Object.keys(rule.headers);
            for (let k of header_keys) {
                if (k.toLowerCase() === 'user-agent') {
                    let v = rule.headers[k];
                    if (['MOBILE_UA', 'PC_UA', 'UC_UA', 'IOS_UA', 'UA'].includes(v)) {
                        rule.headers[k] = eval(v);
                        log('[initParse]', rule.headers[k])
                    }
                } else if (k.toLowerCase() === 'cookie') {
                    let v = rule.headers[k];
                    if (v && v.startsWith('http')) {
                        try {
                            // 直接请求，不使用缓存
                            v = await request(v, {headers: rule.headers || {}});
                            rule.headers[k] = v;
                        } catch (e) {
                            log(`[initParse] 从${v}获取cookie发生错误:${e.message}`);
                        }
                    }
                }
            }
        } catch (e) {
            log(`[initParse] 处理headers发生错误:${e.message}`);
        }
    } else {
        rule.headers = {}
    }
    // 新版放入规则内部
    rule.oheaders = deepCopy(rule.headers);
    rule.rule_fetch_params = {'headers': rule.headers, 'timeout': rule.timeout, 'encoding': rule.encoding};
    INIT_HEADERS_SCRIPT.runInContext(context);

    // 检查并执行 `预处理` 方法
    if (typeof rule.预处理 === 'function') {
        log('[initParse] Executing 预处理...');
        await rule.预处理(env);
    }

    INIT_JSOUP_SCRIPT.runInContext(context);
    return rule
}

export async function home(filePath, env, filter = 1) {
    // 只有在使用commonClassParse时才需要清理缓存
    const moduleObject = await init(filePath, env);
    if (moduleObject.class_parse && typeof moduleObject.class_parse === 'string') {
        const sessionKey = md5(filePath + JSON.stringify(env));
        clearPageRequestCache(sessionKey, 'home', moduleObject.host);
    }

    return await invokeMethod(filePath, env, 'class_parse', [filter], {
        input: '$.homeUrl',
        MY_URL: '$.homeUrl'
    });
}

export async function homeVod(filePath, env) {
    // 只有在使用commonHomeListParse时才需要清理缓存
    const moduleObject = await init(filePath, env);
    if (moduleObject['推荐'] && typeof moduleObject['推荐'] === 'string') {
        const sessionKey = md5(filePath + JSON.stringify(env));
        clearPageRequestCache(sessionKey, 'homeVod', moduleObject.host);
    }

    return await invokeMethod(filePath, env, '推荐', [], {
        input: '$.homeUrl',
        MY_URL: '$.homeUrl'
    });
}

export async function category(filePath, env, tid, pg = 1, filter = 1, extend = {}) {
    // category函数不使用缓存，无需清理
    return await invokeMethod(filePath, env, '一级', [tid, pg, filter, extend], {
        input: '$.url',
        MY_URL: '$.url'
    });
}

export async function detail(filePath, env, ids) {
    // detail函数不使用缓存，无需清理
    if (!Array.isArray(ids)) throw new Error('Parameter "ids" must be an array');
    return await invokeMethod(filePath, env, '二级', [ids], {
        input: `${ids[0]}`,
        MY_URL: `${ids[0]}`
    });
}

export async function search(filePath, env, wd, quick = 0, pg = 1) {
    // search函数不使用缓存，无需清理
    return await invokeMethod(filePath, env, '搜索', [wd, quick, pg], {
        input: '$.searchUrl',
        MY_URL: '$.searchUrl'
    });
}

export async function play(filePath, env, flag, id, flags) {
    flags = flags || [];
    if (!Array.isArray(flags)) throw new Error('Parameter "flags" must be an array');
    return await invokeMethod(filePath, env, 'lazy', [flag, id, flags], {
        input: `${id}`,
        MY_URL: `${id}`,
    });
}

export async function proxy(filePath, env, params) {
    params = params || {};
    try {
        return await invokeMethod(filePath, env, 'proxy_rule', [deepCopy(params)], {
            input: `${params.url}`,
            MY_URL: `${params.url}`,
        });
    } catch (e) {
        return [500, 'text/plain', '代理规则错误:' + e.message]
    }
}

export async function action(filePath, env, action, value) {
    try {
        return await invokeMethod(filePath, env, 'action', [action, value], {});
    } catch (e) {
        return '动作规则错误:' + e.message
    }
}

export async function getRule(filePath, env) {
    return await invokeMethod(filePath, env, 'get_rule', [], {});
}

export async function jx(filePath, env, params) {
    params = params || {};
    try {
        const jxObj = await initJx(filePath, env); // 确保模块已初始化
        const lazy = await jxObj.lazy;
        const result = await lazy(params.url || '', params);
        // log(`[jx]: ${JSON.stringify(result)}`);
        return result;
    } catch (e) {
        return {code: 404, url: '', msg: `${filePath} 代理解析错误:${e.message}`, cost: ''}
    }
}

export async function getJx(filePath) {
    try {
        // 确保模块已初始化
        const jxObj = await initJx(filePath, {});
        // log('jxObj:', jxObj);
        return jxObj;
    } catch (e) {
        return {code: 403, error: `${filePath} 获取代理信息错误:${e.message}`}
    }
}


/**
 * 执行main函数
 * 示例  function main(text){return gzip(text)}
 * @param main_func_code
 * @param arg
 */
export async function runMain(main_func_code, arg) {
    let mainFunc = async function () {
        return ''
    };
    try {
        eval(main_func_code + '\nmainFunc=main;');
        return mainFunc(arg);
    } catch (e) {
        log(`[runMain] 执行main_func_code发生了错误:${e.message}`);
        return ''
    }
}


// 清理缓存函数
export function clearAllCache() {
    const excludeList = ['APP模板配置'];
    let clearedCount = 0;

    // 清理moduleCache，跳过排除列表中的模块
    const moduleKeysToDelete = [];
    for (const [key, value] of moduleCache.entries()) {
        let shouldSkip = false;

        // 检查是否在排除列表中
        for (const excludeName of excludeList) {
            if (value.moduleObject && value.moduleObject.title &&
                value.moduleObject.title.includes(excludeName)) {
                log(`[clearAllCache] 跳过清理模块缓存: ${value.moduleObject.title}`);
                shouldSkip = true;
                break;
            }
        }

        if (!shouldSkip) {
            moduleKeysToDelete.push(key);
        }
    }
    moduleKeysToDelete.forEach(key => {
        moduleCache.delete(key);
        clearedCount++;
    });

    // 清理ruleObjectCache，跳过排除列表中的模块
    const ruleKeysToDelete = [];
    for (const [filePath, value] of ruleObjectCache.entries()) {
        let shouldSkip = false;

        for (const excludeName of excludeList) {
            if (filePath.includes(excludeName)) {
                log(`[clearAllCache] 跳过清理规则缓存: ${filePath}`);
                shouldSkip = true;
                break;
            }
        }

        if (!shouldSkip) {
            ruleKeysToDelete.push(filePath);
        }
    }
    ruleKeysToDelete.forEach(key => {
        ruleObjectCache.delete(key);
        clearedCount++;
    });

    // 清理jxCache，跳过排除列表中的模块
    const jxKeysToDelete = [];
    for (const [key, value] of jxCache.entries()) {
        let shouldSkip = false;

        for (const excludeName of excludeList) {
            if (key.includes(excludeName)) {
                log(`[clearAllCache] 跳过清理解析缓存: ${key}`);
                shouldSkip = true;
                break;
            }
        }

        if (!shouldSkip) {
            jxKeysToDelete.push(key);
        }
    }
    jxKeysToDelete.forEach(key => {
        jxCache.delete(key);
        clearedCount++;
    });

    // 清理页面请求缓存
    pageRequestCache.clear();
    log('[clearAllCache] 已清理页面请求缓存');

    // 重置会话状态
    currentSessionId = null;
    sessionCacheCleared = false;
    sessionCacheStates.clear();
    log('[clearAllCache] 重置会话状态');

    log(`[clearAllCache] 已清理 ${clearedCount} 个模块缓存，排除了 ${excludeList.join(', ')} 相关缓存`);
}


/**
 * 清理页面请求缓存
 * 按sessionKey和host清理对应的缓存项，支持多个并发会话
 * @param {string} sessionKey - 会话键（基于filePath和env的MD5）
 * @param {string} sessionType - 会话类型（home/homeVod等）
 * @param {string} host - 主机地址，用于区分不同host的缓存
 */
function clearPageRequestCache(sessionKey = null, sessionType = 'unknown', host = '') {
    if (!sessionKey) {
        pageRequestCache.clear();
        sessionCacheStates.clear();
        sessionCacheCleared = false;
        log('[clearPageRequestCache] 强制清理所有缓存');
        return;
    }

    // 检查当前会话是否已清理过缓存
    const sessionCacheKey = `${sessionKey}:${host}`;
    const isSessionCleared = sessionCacheStates.get(sessionCacheKey);
    if (!isSessionCleared) {
        // 清理属于当前host的缓存项
        const keysToDelete = [];
        for (const [cacheKey] of pageRequestCache) {
            // 缓存键格式: host:md5(url+options)
            // 只清理匹配当前host的缓存项
            if (cacheKey.startsWith(`${host}:`)) {
                keysToDelete.push(cacheKey);
            }
        }

        // 清理缓存项
        keysToDelete.forEach(key => pageRequestCache.delete(key));

        // 标记当前会话已清理
        sessionCacheStates.set(sessionCacheKey, true);
        currentSessionId = sessionKey;
        sessionCacheCleared = true;
        lastClearTime = Date.now();
        log(`[clearPageRequestCache] ${sessionType}会话开始，清理${keysToDelete.length}个${host}的缓存项: ${sessionKey}`);
    } else {
        // log(`[clearPageRequestCache] ${sessionType}会话复用${host}的缓存: ${sessionKey}`);
    }
}


/**
 * 处理模板继承逻辑
 * @param {Object} rule - 规则对象
 * @param {Object} context - VM上下文
 */
async function handleTemplateInheritance(rule, context) {
    try {
        // 获取模板字典
        const muban = template.getMubans();

        // 处理自动模板匹配
        if (rule['模板'] === '自动') {
            try {
                let host_headers = rule['headers'] || {};

                // 使用cachedRequest统一缓存管理，避免重复缓存
                log(`[handleTemplateInheritance] 请求HOST页面: ${rule.host}`);

                // 设置临时变量
                context._tempHost = rule.host;
                context._tempHeaders = host_headers;

                // 执行预编译脚本
                let host_html = await CACHED_REQUEST_SCRIPT.runInContext(context);

                let match_muban = '';
                let muban_keys = Object.keys(muban).filter(it => !/默认|短视2|采集1/.test(it));

                for (let muban_key of muban_keys) {
                    try {
                        // 检查模板是否有class_parse
                        if (muban[muban_key].class_parse) {
                            let class_parse = muban[muban_key].class_parse;

                            // 设置临时变量
                            context._tempHtml = host_html;
                            context._tempParse = class_parse;

                            // 执行预编译脚本
                            const host_data = await TEMPLATE_CHECK_CALL_SCRIPT.runInContext(context);

                            if (host_data.class && host_data.class.length > 0) {
                                match_muban = muban_key;
                                log(`[handleTemplateInheritance] 自动匹配模板:【${muban_key}】`);
                                break;
                            }
                        }
                    } catch (e) {
                        log(`[handleTemplateInheritance] 自动匹配模板:【${muban_key}】错误:${e.message}`);
                    }
                }

                if (match_muban) {
                    muban['自动'] = muban[match_muban];
                } else {
                    delete rule['模板'];
                }
            } catch (e) {
                log('[handleTemplateInheritance] 自动模板匹配失败:', e.message);
                delete rule['模板'];
            }
        }

        // 处理模板修改 - 在模板继承之前统一执行，避免重复执行
        if (rule['模板修改'] && typeof rule['模板修改'] === 'function' && rule.模板 && muban.hasOwnProperty(rule.模板)) {
            try {
                // 将muban传入函数，让模板修改能够修改模板
                await rule['模板修改'](muban);
            } catch (e) {
                log('[handleTemplateInheritance] 模板修改执行失败:', e.message);
            }
        }

        // 处理普通模板继承
        if (rule.模板 && muban.hasOwnProperty(rule.模板)) {
            log('[handleTemplateInheritance] 继承模板:' + rule.模板);

            // 使用Object.assign进行模板继承，模板属性在前，rule属性在后（rule属性优先级更高）
            const templateRule = muban[rule.模板];
            const originalRule = {...rule};
            Object.assign(rule, templateRule, originalRule);
        }

        // 清理模板相关属性
        delete rule['模板'];
        delete rule['模板修改'];

        // 清理临时变量
        delete context._tempHost;
        delete context._tempHeaders;
        delete context._tempHtml;
        delete context._tempParse;

    } catch (error) {
        log('[handleTemplateInheritance] 模板继承处理失败:', error.message);
    }
}

export {jsEncoder}