import {log} from '../utils/log.js';
import path from "path";
import {readFile} from "fs/promises";
import {getSitesMap} from "../utils/sites-map.js";
import {computeHash, deepCopy, getNowTime, urljoin} from "../utils/utils.js";
import {fileURLToPath} from 'url';
import {LRUCache} from 'lru-cache';
import {md5} from "../libs_drpy/crypto-util.js";
import {fastify} from "../controllers/fastlogger.js";
import {netCallPythonMethod} from '../spider/py/core/bridge.js';


// 缓存已初始化的模块和文件 hash 值（LRU 有界，淘汰=下次重新 init，与 refresh 路径等价）
const moduleCache = new LRUCache({max: 200, ttl: 1000 * 60 * 10});
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _config_path = path.join(__dirname, '../config');

const json2Object = function (json) {
    // log('json2Object:', json);
    if (!json) {
        return {}
    } else if (json && typeof json === 'object') {
        return json
    }
    return JSON.parse(json);
}

const loadEsmWithHash = async function (filePath, fileHash, env) {
    // 创建Python模块代理
    const spiderProxy = {};
    const spiderMethods = [
        'init', 'home', 'homeVod', 'homeContent', 'category',
        'detail', 'search', 'play', 'proxy', 'action'
    ];

    // 为代理对象添加方法
    spiderMethods.forEach(method => {
        spiderProxy[method] = async (...args) => {
            // return callPythonMethod(method, env, ...args);
            return netCallPythonMethod(filePath, method, env, ...args);
        };
    });

    return spiderProxy;
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
        // const default_init_cfg = { // T3才需要这种结构
        //     stype: 4, //T3/T4 源类型
        //     skey: `hipy_${moduleName}`,
        //     sourceKey: `hipy_${moduleName}`,
        //     ext: moduleExt,
        // };
        let SitesMap = getSitesMap(_config_path);
        if (moduleExt && SitesMap[moduleName]) {
            try {
                moduleExt = ungzip(moduleExt);
            } catch (e) {
                log(`[${moduleName}] ungzip解密moduleExt失败: ${e.message}`);
            }
            if (!SitesMap[moduleName].find(i => i.queryStr === moduleExt) && !SitesMap[moduleName].find(i => i.queryObject.params === moduleExt)) {
                throw new Error("moduleExt is wrong!")
            }
            if (moduleExt.startsWith('../json')) {
                moduleExt = urljoin(env.jsonUrl, moduleExt.slice(8));
            }
        }
        let hashMd5 = md5(filePath + '#pAq#' + moduleExt);
        if (moduleCache.has(hashMd5) && !refresh) {
            const cached = moduleCache.get(hashMd5);
            // 除hash外还必须保证proxyUrl实时相等，避免本地代理url的尴尬情况
            if (cached.hash === fileHash && cached.proxyUrl === env.proxyUrl) {
                // log('cached init');
                return cached.moduleObject;
            }
        }
        log(`Loading module: ${filePath}`);
        let t1 = getNowTime();
        let module;
        module = await loadEsmWithHash(filePath, fileHash, env);
        // log('module:', module);
        const rule = module;
        // const initValue = await rule.init(default_init_cfg) || {};
        const initValue = await rule.init(moduleExt) || {};
        let t2 = getNowTime();
        const moduleObject = deepCopy(rule);
        moduleObject.cost = t2 - t1;
        moduleCache.set(hashMd5, {moduleObject, hash: fileHash, proxyUrl: env.proxyUrl});
        // return moduleObject;
        return {...moduleObject, ...initValue};
    } catch (error) {
        log(`Error in hipy.init :${filePath}`, error);
        throw new Error(`Failed to initialize module:${error.message}`);
    }
}

const home = async function (filePath, env, filter = 1) {
    const moduleObject = await init(filePath, env);
    return json2Object(await moduleObject.home(filter));
}

const homeVod = async function (filePath, env) {
    const moduleObject = await init(filePath, env);
    const homeVodResult = json2Object(await moduleObject.homeVod());
    return homeVodResult && homeVodResult.list ? homeVodResult.list : homeVodResult;
}


const category = async function (filePath, env, tid, pg = 1, filter = 1, extend = {}) {
    const moduleObject = await init(filePath, env);
    return json2Object(await moduleObject.category(tid, pg, filter, extend));
}

const detail = async function (filePath, env, ids) {
    const moduleObject = await init(filePath, env);
    return json2Object(await moduleObject.detail(ids));
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