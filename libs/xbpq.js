/**
 * XBPQ (小白盘棋) 模块
 *
 * @deprecated 自 v2 重构起标记：内部 init 链路存在疑似坏死逻辑（对空对象调用 init），
 * 该引擎从未稳定可用；因仍被 controllers/api.js 引擎注册表引用而暂保留，
 * 计划下个大版本与路由一并下线。请勿基于此模块开发新功能。
 *
 * 提供视频源规则的加载、缓存和执行功能
 * 支持首页、分类、详情、搜索、播放等核心功能
 *
 * 主要功能：
 * - 规则文件的动态加载和缓存
 * - 视频源的各种操作接口
 * - 模块生命周期管理
 *
 * @author drpy-node
 * @version 1.0.0
 */

import {log} from '../utils/log.js';
import {computeHash, deepCopy} from "../utils/utils.js";
import {readFile} from "fs/promises";
import {LRUCache} from 'lru-cache';
import {md5} from "../libs_drpy/crypto-util.js";

// 模块缓存，用于存储已加载的模块以提高性能（LRU 有界）
const moduleCache = new LRUCache({max: 200, ttl: 1000 * 60 * 10});

/**
 * 获取规则的JSON字符串表示
 * 
 * @param {string} filePath - 规则文件路径
 * @param {Object} env - 环境变量和配置
 * @returns {Promise<string>} 规则对象的JSON字符串
 */
const getRule = async function (filePath, env) {
    const moduleObject = await init(filePath, env);
    return JSON.stringify(moduleObject);
}

/**
 * 将JSON字符串或对象转换为JavaScript对象
 * 
 * @param {string|Object} json - JSON字符串或对象
 * @returns {Object} 转换后的JavaScript对象
 */
const json2Object = function (json) {
    if (!json) {
        return {}
    } else if (json && typeof json === 'object') {
        return json
    }
    return JSON.parse(json);
}

/**
 * 初始化模块
 * 
 * 加载指定路径的规则文件，支持缓存机制以提高性能
 * 如果文件内容未变化且缓存存在，则直接返回缓存的模块对象
 * 
 * @param {string} filePath - 规则文件路径
 * @param {Object} env - 环境变量，包含ext等配置
 * @param {boolean} refresh - 是否强制刷新缓存
 * @returns {Promise<Object>} 初始化后的模块对象
 * @throws {Error} 当模块初始化失败时抛出错误
 */
const init = async function (filePath, env = {}, refresh) {
    try {
        // 读取文件内容并计算哈希值用于缓存验证
        const fileContent = await readFile(filePath, 'utf-8');
        const fileHash = computeHash(fileContent);
        let moduleExt = env.ext || '';
        let hashMd5 = md5(filePath + '#pAq#' + moduleExt);
        
        // 检查缓存是否存在且有效
        if (moduleCache.has(hashMd5) && !refresh) {
            const cached = moduleCache.get(hashMd5);
            if (cached.hash === fileHash) {
                return cached.moduleObject;
            }
        }
        
        log(`Loading module: ${filePath}`);
        let rule = {};
        // 初始化规则模块
        await rule.init(moduleExt || {});
        const moduleObject = deepCopy(rule);
        
        // 将模块对象存入缓存
        moduleCache.set(hashMd5, {moduleObject, hash: fileHash});
        return moduleObject;
    } catch (error) {
        log(`Error in xbpq.init :${filePath}`, error);
        throw new Error(`Failed to initialize module:${error.message}`);
    }
}

/**
 * 获取首页数据
 * 
 * @param {string} filePath - 规则文件路径
 * @param {Object} env - 环境变量
 * @param {number} filter - 过滤器参数，默认为1
 * @returns {Promise<Object>} 首页数据对象
 */
const home = async function (filePath, env, filter = 1) {
    const moduleObject = await init(filePath, env);
    return json2Object(await moduleObject.home(filter));
}

/**
 * 获取首页推荐视频数据
 * 
 * @param {string} filePath - 规则文件路径
 * @param {Object} env - 环境变量
 * @returns {Promise<Object>} 首页推荐视频数据对象
 */
const homeVod = async function (filePath, env) {
    const moduleObject = await init(filePath, env);
    return json2Object(await moduleObject.homeVod());
}

/**
 * 获取分类页面数据
 * 
 * @param {string} filePath - 规则文件路径
 * @param {Object} env - 环境变量
 * @param {string} tid - 分类ID
 * @param {number} pg - 页码，默认为1
 * @param {number} filter - 过滤器参数，默认为1
 * @param {Object} extend - 扩展参数，默认为空对象
 * @returns {Promise<Object>} 分类页面数据对象
 */
const category = async function (filePath, env, tid, pg = 1, filter = 1, extend = {}) {
    const moduleObject = await init(filePath, env);
    return json2Object(await moduleObject.category(tid, pg, filter, extend));
}

/**
 * 获取视频详情数据
 * 
 * @param {string} filePath - 规则文件路径
 * @param {Object} env - 环境变量
 * @param {string} ids - 视频ID列表
 * @returns {Promise<Object>} 视频详情数据对象
 */
const detail = async function (filePath, env, ids) {
    const moduleObject = await init(filePath, env);
    return json2Object(await moduleObject.detail(ids));
}

/**
 * 执行搜索操作
 * 
 * @param {string} filePath - 规则文件路径
 * @param {Object} env - 环境变量
 * @param {string} wd - 搜索关键词
 * @param {number} quick - 快速搜索标志，默认为0
 * @param {number} pg - 页码，默认为1
 * @returns {Promise<Object>} 搜索结果数据对象
 */
const search = async function (filePath, env, wd, quick = 0, pg = 1) {
    const moduleObject = await init(filePath, env);
    return json2Object(await moduleObject.search(wd, quick, pg));
}

/**
 * 获取播放地址
 * 
 * @param {string} filePath - 规则文件路径
 * @param {Object} env - 环境变量
 * @param {string} flag - 播放标志
 * @param {string} id - 播放ID
 * @param {Array} flags - 播放标志列表
 * @returns {Promise<Object>} 播放地址数据对象
 */
const play = async function (filePath, env, flag, id, flags) {
    const moduleObject = await init(filePath, env);
    return json2Object(await moduleObject.play(flag, id, flags));
}

/**
 * 代理请求处理
 * 
 * @param {string} filePath - 规则文件路径
 * @param {Object} env - 环境变量
 * @param {Object} params - 代理参数
 * @returns {Promise<Object>} 代理响应数据对象
 */
const proxy = async function (filePath, env, params) {
    const moduleObject = await init(filePath, env);
    return json2Object(await moduleObject.proxy(params));
}

/**
 * 执行自定义动作
 * 
 * @param {string} filePath - 规则文件路径
 * @param {Object} env - 环境变量
 * @param {string} action - 动作名称
 * @param {*} value - 动作参数值
 * @returns {Promise<Object>} 动作执行结果数据对象
 */
const action = async function (filePath, env, action, value) {
    const moduleObject = await init(filePath, env);
    return json2Object(await moduleObject.action(action, value));
}

// 导出所有API方法
export default {
    getRule,    // 获取规则
    init,       // 初始化模块
    home,       // 首页数据
    homeVod,    // 首页推荐
    category,   // 分类数据
    detail,     // 详情数据
    search,     // 搜索功能
    play,       // 播放地址
    proxy,      // 代理请求
    action,     // 自定义动作
}