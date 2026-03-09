import path from 'path';
import {fileURLToPath} from 'url';
import {existsSync} from 'fs';
//import {md5, base64Decode} from './libs_drpy/crypto-util.js';
import {startJsonWatcher, getApiEngine} from "../utils/api_helper.js";
import * as drpyS from '../libs/drpyS.js';
import php from '../libs/php.js';
import catvod from '../libs/catvod.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Determine if we are running from the dist/libs directory (bundled) or source
const isBundled = __dirname.endsWith('dist') || __dirname.endsWith('libs') || __dirname.endsWith('dist' + path.sep) || __dirname.endsWith('libs' + path.sep);

// Smart root directory detection
const possibleRoots = [
    __dirname,
    path.resolve(__dirname, '..'),
    path.resolve(__dirname, '../..'),
    path.resolve(__dirname, '../../..')
];
const rootDir = possibleRoots.find(d => existsSync(path.join(d, 'spider/js'))) || (isBundled ? path.resolve(__dirname, '../..') : path.resolve(__dirname, '..'));

// 定义options的目录
const jxDir = path.join(rootDir, 'jx');
const publicDir = path.join(rootDir, 'public');
const jsonDir = path.join(rootDir, 'json');
const jsDir = path.join(rootDir, 'spider/js');
const dr2Dir = path.join(rootDir, 'spider/js_dr2');
const phpDir = path.join(rootDir, 'spider/php');
const catDir = path.join(rootDir, 'spider/catvod');
const catLibDir = path.join(rootDir, 'spider/catLib');

const options = {
    rootDir,
    jxDir,
    publicDir,
    jsonDir,
    jsDir,
    dr2Dir,
    phpDir,
    catDir,
    catLibDir,
};
/**
 * 支持的引擎映射表
 * 包含drpyS、php、catvod
 */
const ENGINES = {
    drpyS,
    php,
    catvod,
};
//const query = {
//    do: 'ds',
//    pg: 1,
//    extend: '',
//};
async function getEngine(moduleName, query, inject_env) {
    // 壳子可以注入环境变量，内部自行构造env
    inject_env = inject_env || {};
    // 获取API引擎和模块路径
    let {apiEngine, moduleDir, _ext, modulePath} = getApiEngine(ENGINES, moduleName, query, options);

    // 检查模块文件是否存在
    if (!existsSync(modulePath)) {
        const error_msg = `Module ${moduleName} not found`;
        console.error(error_msg);
        return "";
    }

    // 获取模块扩展参数
    const moduleExt = query.extend || '';

    /**
     * 构建环境对象
     * 为规则执行提供必要的环境信息
     *
     * @param {string} moduleName - 模块名称
     * @returns {Object} 环境对象，包含各种URL和配置
     */
    function getEnv(moduleName) {
        // const proxyUrl = inject_env.proxyUrl || "http://127.0.0.1:9978/proxy?do=node";
        const {
            jsonUrl = "http://127.0.0.1:9978/file/drpy-node/json/",
            publicUrl = "http://127.0.0.1:9978/file/drpy-node/public/",
            requestHost = "http://127.0.0.1:9978",
            hostname = "127.0.0.1:9978",
            hostUrl = "127.0.0.1",
            proxyUrl = `http://127.0.0.1:9978/proxy?do=node&siteKey=${moduleName}`,
            proxyPath, httpUrl, imageApi, mediaProxyUrl, webdavProxyUrl, ftpProxyUrl,
            wsName, fServer,
        } = inject_env;
        const getProxyUrl = function () {
            return proxyUrl
        };
        return {
            httpUrl,
            imageApi,
            mediaProxyUrl,
            webdavProxyUrl,
            ftpProxyUrl,
            wsName,
            fServer,
            // 下面这些很常用
            hostUrl,
            jsonUrl,
            publicUrl,
            requestHost,
            hostname,
            proxyUrl,
            proxyPath, // 代理路径
            getProxyUrl,
            ext: moduleExt,
            moduleName: moduleName,
        }
    }

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
        const RULE = await apiEngine.getRule(_modulePath, _env);

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
                    return await RULE[_method](..._args);
                }
            }

            // 调用映射后的标准接口
            return await apiEngine[invokeMethod](_modulePath, _env, ..._args);
        };
        return RULE
    };

    // 获取页码参数
    const pg = Number(query.pg) || 1;


    // 根据 query 参数决定执行逻辑

    // 处理播放逻辑
    if ('play' in query) {
        const result = await apiEngine.play(modulePath, env, query.flag, query.play);
        return result;
    }

    // 处理分类逻辑
    if ('ac' in query && 't' in query) {
        let ext = query.ext;
        let extend = {};

        // 解析筛选参数
        if (ext) {
            try {
                extend = ext;
            } catch (e) {
                console.error(`筛选参数错误:${e.message}`);
            }
        }

        const result = await apiEngine.category(modulePath, env, query.t, pg, 1, extend);
        return result;
    }

    // 处理详情逻辑
    if ('ac' in query && 'ids' in query) {
        const result = await apiEngine.detail(modulePath, env, query.ids);
        return result;
    }

    // 处理动作逻辑
    if ('ac' in query && 'action' in query) {
        const result = await apiEngine.action(modulePath, env, query.action, query.value);
        return result;
    }

    // 处理搜索逻辑
    if ('wd' in query) {
        const quick = 'quick' in query ? query.quick : 0;
        const result = await apiEngine.search(modulePath, env, query.wd, quick, pg);
        return result;
    }

    // 处理代理逻辑
    if ('proxy' in query) {
        // return [200, 'text/plain', 'hello world', {'User-Agent':'okhttp/3.11'}, 0];
        const result = await apiEngine.proxy(modulePath, env, query);
        return result;
    }

    // 处理解析逻辑
    if ('parse' in query) {
        let t1 = (new Date()).getTime(); // 记录开始时间
        // 构建解析器文件路径
        const jxName = query.parse;
        const jxPath = path.join(options.jxDir, `${jxName}.js`);

        const backResp = await drpyS.jx(jxPath, env, query);

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

            let backRespSend = backResp;
            console.log(backRespSend);
            return backRespSend;
        }
        // 处理字符串类型的响应
        else if (typeof backResp === 'string') {
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

            let backRespSend = result;
            console.log(backRespSend);
            return backRespSend;
        } else {
            // 其他类型的响应，返回失败
            let t2 = (new Date()).getTime();

            let result = {
                code: 404,
                url: "",
                msg: `${jxName}解析失败`,
                cost: t2 - t1
            }
            let backRespSend = result;
            console.log(backRespSend);
            return backRespSend;
        }
    }

    // 处理强制刷新初始化逻辑
    if ('refresh' in query) {
        const refreshedObject = await apiEngine.init(modulePath, env, true);
        const {context, ...responseObject} = refreshedObject;
        return responseObject;
    }

    // 默认逻辑，返回 home + homeVod 接口
    if (!('filter' in query)) {
        query.filter = 1
    }

    const filter = 'filter' in query ? query.filter : 1;

    // 获取首页数据
    const resultHome = await apiEngine.home(modulePath, env, filter);

    // 获取推荐数据
    const resultHomeVod = await apiEngine.homeVod(modulePath, env);

    // 合并结果
    let result = {
        ...resultHome,
    };

    // 如果有推荐数据，添加到结果中
    if (Array.isArray(resultHomeVod) && resultHomeVod.length > 0) {
        Object.assign(result, {list: resultHomeVod})
    }

    return result;

};
global.getEngine = getEngine;