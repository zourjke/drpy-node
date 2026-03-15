/**
 * API辅助工具模块
 * 提供文件监听、引擎选择等API相关的辅助功能
 * 支持热重载和多种引擎类型的动态选择
 */
import {watch} from 'fs';
import path from 'path';

// JSON文件监听器实例
let jsonWatcher = null;
// 防抖计时器映射，用于避免频繁触发文件变更事件
let debounceTimers = new Map(); 

/**
 * 启动JSON文件监听器
 * 在开发环境下监听JSON文件变化，自动清除模块缓存实现热重载
 * @param {Object} ENGINES - 引擎对象集合
 * @param {string} jsonDir - 要监听的JSON文件目录路径
 */
export function startJsonWatcher(ENGINES, jsonDir) {
    // 仅在开发环境下启用文件监听
    if (process.env.NODE_ENV !== 'development') return;

    try {
        // 创建文件监听器，递归监听目录下所有文件
        jsonWatcher = watch(jsonDir, {recursive: true}, (eventType, filename) => {
            // 只处理JSON文件的变更事件
            if (filename && filename.endsWith('.json')) {
                // 清除之前的防抖计时器
                if (debounceTimers.has(filename)) {
                    clearTimeout(debounceTimers.get(filename));
                }

                // 设置新的防抖计时器，避免频繁触发
                const timer = setTimeout(() => {
                    console.log(`[HotReload] ${filename} changed, clearing cache...`);
                    // 清除drpyS引擎的所有缓存
                    ENGINES.drpyS.clearAllCache();
                    // 清理已完成的计时器
                    debounceTimers.delete(filename);
                }, 100); // 100ms防抖延迟
                if (timer.unref) timer.unref();

                debounceTimers.set(filename, timer);
            }
        });

        // 允许监听器不阻止进程退出
        if (jsonWatcher.unref) jsonWatcher.unref();

        // console.log(`start json file hot reload success，listening path: ${jsonDir}`);
    } catch (error) {
        console.error('start json file listening failed with error:', error);
    }
}

/**
 * 根据适配器类型获取对应的API引擎
 * 支持多种引擎类型：py(hipy)、cat(catvod)、xbpq、默认(drpyS)
 * @param {Object} engines - 所有可用的引擎对象
 * @param {string} moduleName - 模块名称
 * @param {Object} query - 查询参数对象
 * @param {Object} options - 配置选项，包含各种目录路径
 * @returns {Object} 包含引擎、目录、扩展名和模块路径的对象
 */
export function getApiEngine(engines, moduleName, query, options) {
    // const adapt = query.adapt; // 旧版本参数名
    const adapt = query.do; // 新版本参数名，js或ds都视为ds
    let apiEngine; // API引擎实例
    let moduleDir; // 模块目录路径
    let _ext; // 文件扩展名

    // 根据适配器类型选择对应的引擎和配置
    switch (adapt) {
        case 'py':
            // Python引擎 - hipy
            apiEngine = engines.hipy;
            moduleDir = options.pyDir;
            _ext = '.py';
            break;
        case 'php':
            // PHP引擎 - php
            apiEngine = engines.php;
            moduleDir = options.phpDir;
            _ext = '.php';
            break;
        case 'cat':
            // CatVod引擎
            apiEngine = engines.catvod;
            moduleDir = options.catDir;
            _ext = '.js';
            break;
        case 'xbpq':
            // XBPQ引擎 - 使用JSON配置
            apiEngine = engines.xbpq;
            moduleDir = options.xbpqDir;
            _ext = '.json';
            break;
        default:
            // 默认引擎 - drpyS
            apiEngine = engines.drpyS;
            moduleDir = options.jsDir;
            _ext = '.js';
    }
    
    // 构建完整的模块文件路径
    const modulePath = path.join(moduleDir, `${moduleName}${_ext}`);
    
    return {
        apiEngine,    // 选中的API引擎
        moduleDir,    // 模块所在目录
        _ext,         // 文件扩展名
        modulePath,   // 完整的模块文件路径
    }
}