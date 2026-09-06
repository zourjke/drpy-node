import {log, logError} from '../utils/log.js';
import path from "path";
import {readFile} from "fs/promises";
import {getSitesMap} from "../utils/sites-map.js";
import {computeHash, deepCopy, getNowTime, urljoin} from "../utils/utils.js";
import {fileURLToPath, pathToFileURL} from 'url';
import {LRUCache} from 'lru-cache';
import {md5} from "../libs_drpy/crypto-util.js";
import {fastify} from "../controllers/fastlogger.js";
// 缓存已初始化的模块和文件 hash 值
// L6：历史上是两个裸 Map（ruleObjectCache 甚至从未被使用），条目按 源×ext 组合只增不减；
// 现统一为与 drpyS 同款 LRU(100/10min)。注意 ESM registry 层（?v=fileHash 的动态 import）
// 无用户侧回收手段，属于 Node 运行时限制，生产环境建议配置 pm2 max_memory_restart 兜底。
const CAT_CACHE_OPTIONS = {max: 100, ttl: 1000 * 60 * 10};
const moduleCache = new LRUCache(CAT_CACHE_OPTIONS);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _data_path = path.join(__dirname, '../data');
const _config_path = path.join(__dirname, '../config');
const _lib_path = path.join(__dirname, '../spider/catvod');
const enable_cat_debug = Number(process.env.CAT_DEBUG) !== 2;

// log('enable_cat_debug:', enable_cat_debug);

const json2Object = function (json) {
    if (!json) {
        return {}
    } else if (json && typeof json === 'object') {
        return json
    }
    return JSON.parse(json);
}

const loadEsmWithHash = async function (filePath, fileHash, env) {
    const scriptUrl = `${pathToFileURL(filePath).href}?v=${fileHash}`;
    const module = await import(scriptUrl);
    const initEnv = module.initEnv;
    if (typeof initEnv === 'function' && env) {
        initEnv(env);
    }
    return module
}

const loadEsmWithEnv = async function (filePath, env) {
    const rawCode = await readFile(filePath, 'utf8');
    let injectedCode = rawCode;
    // 不用管这里,CAT_DEBUG=0的时候走这个逻辑也是会被esm-register处理
    // let injectedCode = rawCode.replaceAll('assets://js/lib/', '../catLib/'); // esm-register处理了，这里不管
    // log('loadEsmWithEnv:', env);
    const esm_flag1 = 'export function __jsEvalReturn';
    const esm_flag2 = 'export default';
    const polyfill_code = `
var _ENV={};
var getProxyUrl=null;
var getProxy=null;
export function initEnv(env){
    _ENV = env;
    if(env.getProxyUrl){
        getProxyUrl=env.getProxyUrl;
        getProxy=env.getProxyUrl
    }
}`.trim() + '\n';
    if (injectedCode.includes(esm_flag1)) {
        injectedCode = injectedCode.replace(esm_flag1, `${polyfill_code}${esm_flag1}`)
    } else if (injectedCode.includes('export default')) {
        injectedCode = injectedCode.replace(esm_flag2, `${polyfill_code}${esm_flag2}`)
    }

    // 改为在 esm-register.mjs 里实现，这里注释掉
    // if (injectedCode.includes('../catLib/crypto-js.js')) {
    //     const cryptoJsPath = path.join(_lib_path, '../catLib', 'crypto-js.js');
    //     // log('cryptoJsPath:',cryptoJsPath);
    //     const cryptoHref = pathToFileURL(cryptoJsPath).href;
    //     log('cryptoHref:', cryptoHref);
    //     // const cryptoJsCode = await readFile(cryptoJsPath, 'utf-8');
    //     // const cryptoJsBase64 = Buffer.from(cryptoJsCode).toString('base64');
    //     injectedCode = injectedCode.replace(
    //         '../catLib/crypto-js.js',
    //         // `data:text/javascript;base64,${cryptoJsBase64}`
    //         cryptoHref
    //     );
    // }

    // log('injectedCode:\n', injectedCode);
    // // 创建数据URI模块
    const dataUri = `data:text/javascript;base64,${Buffer.from(injectedCode).toString('base64')}`;
    const module = await import(dataUri);
    const initEnv = module.initEnv;
    if (typeof initEnv === 'function' && env) {
        initEnv(env);
    }
    return module
}

const getRule = async function (filePath, env) {
    const moduleObject = await init(filePath, env);
    return JSON.stringify(moduleObject);
}

const init = async function (filePath, env = {}, refresh) {
    try {
        const fileContent = await readFile(filePath, 'utf-8');
        const fileHash = computeHash(fileContent);
        const moduleName = path.basename(filePath, '.js');
        let moduleExt = env.ext || '';
        const default_init_cfg = {
            stype: 4, //T3/T4 源类型
            skey: `catvod_${moduleName}`,
            sourceKey: `catvod_${moduleName}`,
            ext: moduleExt,
        };
        let SitesMap = getSitesMap(_config_path);
        if (moduleExt && SitesMap[moduleName]) {
            try {
                moduleExt = ungzip(moduleExt);
            } catch (e) {
                log(`[${moduleName}] ungzip解密moduleExt失败: ${e.message}`);
            }
            log(`[${moduleName}] moduleExt:`, moduleExt);
            if (!SitesMap[moduleName].find(i => i.queryStr === moduleExt) && !SitesMap[moduleName].find(i => i.queryObject.params === moduleExt)) {
                throw new Error("moduleExt is wrong!")
            }
            if (moduleExt.startsWith('../json')) {
                moduleExt = urljoin(env.jsonUrl, moduleExt.slice(8));
            }
            default_init_cfg.ext = moduleExt;
        }
        let hashMd5 = md5(filePath + '#pAq#' + moduleExt);
        if (moduleCache.has(hashMd5) && !refresh) {
            const cached = moduleCache.get(hashMd5);
            // 除hash外还必须保证proxyUrl实时相等，避免本地代理url的尴尬情况
            if (cached.hash === fileHash && cached.proxyUrl === env.proxyUrl) {
                return cached.moduleObject;
            }
        }
        log(`[catvod] Loading module: ${filePath} | enable_cat_debug:${enable_cat_debug}`);
        let t1 = getNowTime();
        let module;
        if (enable_cat_debug) {
            module = await loadEsmWithHash(filePath, fileHash, env);
        } else {
            module = await loadEsmWithEnv(filePath, env);
        }
        // log('module:', module);
        let rule;
        if (module && module.__jsEvalReturn && typeof module.__jsEvalReturn === 'function') {
            rule = module.__jsEvalReturn();
        } else {
            rule = module.default || module;
        }
        // log('rule:', rule);
        // log('globalThis.ENV:', globalThis.ENV);
        // log('globalThis.getProxyUrl:', globalThis.getProxyUrl);
        // 加载 init
        if (typeof rule.init === 'function') {
            await rule.init(default_init_cfg);
        }
        let t2 = getNowTime();
        const moduleObject = deepCopy(rule);
        moduleObject.cost = t2 - t1;
        moduleCache.set(hashMd5, {moduleObject, hash: fileHash, proxyUrl: env.proxyUrl});
        return moduleObject;
    } catch (error) {
        log(`Error in catvod.init :${filePath}`, error);
        throw new Error(`Failed to initialize module:${error.message}`);
    }
}

const home = async function (filePath, env, filter = 1) {
    const moduleObject = await init(filePath, env);
    return json2Object(await moduleObject.home(filter));
}

const homeVod = async function (filePath, env) {
    const moduleObject = await init(filePath, env);
    try {
        const homeVodResult = json2Object(await moduleObject.homeVod());
        return homeVodResult && homeVodResult.list ? homeVodResult.list : homeVodResult;
    } catch (e) {
        logError(e);
        // fastify.log.error(e);
        return []
    }
}


const category = async function (filePath, env, tid, pg = 1, filter = 1, extend = {}) {
    const moduleObject = await init(filePath, env);
    return json2Object(await moduleObject.category(tid, pg, filter, extend));
}

const detail = async function (filePath, env, ids) {
    const moduleObject = await init(filePath, env);
    const vod_id = Array.isArray(ids) ? ids[0] : ids;
    let detailResult = '{}';
    // log('type of detailContent:', typeof moduleObject.detailContent);
    if (moduleObject.detailContent) { // tvbox形式猫源二级参数传ids列表
        detailResult = await moduleObject.detailContent(ids);
    } else { // ds/cat传非id
        detailResult = await moduleObject.detail(vod_id);
    }
    return json2Object(detailResult);
}

const search = async function (filePath, env, wd, quick = 0, pg = 1) {
    const moduleObject = await init(filePath, env);
    return json2Object(await moduleObject.search(wd, quick, pg));
}

const play = async function (filePath, env, flag, id, flags) {
    const moduleObject = await init(filePath, env);
    return json2Object(await moduleObject.play(flag, id, flags));
}


const proxy = async function (filePath, env, params) {
    const moduleObject = await init(filePath, env);
    return json2Object(await moduleObject.proxy(params));
}

const action = async function (filePath, env, action, value) {
    const moduleObject = await init(filePath, env);
    return json2Object(await moduleObject.action(action, value));
}

export default {
    getRule,
    init,
    home,
    homeVod,
    category,
    detail,
    search,
    play,
    proxy,
    action,
}