import fs from 'fs';
import path from 'path';
import {stat} from 'fs/promises';
import {pathToFileURL} from 'url';
import {PROJECT_ROOT} from './pathHelper.js';

/**
 * .plugins.js 配置文件的统一读写层
 * 使用方：utils/pluginManager.js（启动加载/重载）、controllers/admin/pluginsController.js（管理界面）、
 * utils/pluginMarket.js（市场安装登记/卸载移除）
 */

export const USER_PLUGINS_CONFIG_PATH = path.join(PROJECT_ROOT, '.plugins.js');
export const EXAMPLE_PLUGINS_CONFIG_PATH = path.join(PROJECT_ROOT, '.plugins.example.js');

// 以文件 mtime 作为动态 import 的 cache-buster：
// 仅当 .plugins.js 内容变化时才产生新的模块 URL，避免每次请求都向 ESM registry 永久堆一份模块实例
async function importPluginsModule(filePath) {
    let bust = 0;
    try {
        bust = Math.floor((await stat(filePath)).mtimeMs);
    } catch {
        // 读不到 mtime 时退化为固定 URL（复用缓存）
    }
    return import(`${pathToFileURL(filePath).href}?v=${bust}`);
}

/**
 * 加载插件配置：优先用户 .plugins.js，缺失时回退 .plugins.example.js
 * @returns {Promise<{plugins: Array, isDefault: boolean}>}
 */
export async function loadPluginsConfig() {
    if (fs.existsSync(USER_PLUGINS_CONFIG_PATH)) {
        const mod = await importPluginsModule(USER_PLUGINS_CONFIG_PATH);
        return {plugins: mod.default || [], isDefault: false};
    }
    if (fs.existsSync(EXAMPLE_PLUGINS_CONFIG_PATH)) {
        const mod = await importPluginsModule(EXAMPLE_PLUGINS_CONFIG_PATH);
        return {plugins: mod.default || [], isDefault: true};
    }
    return {plugins: [], isDefault: false};
}

/**
 * 保存插件配置到用户 .plugins.js
 * @param {Array} plugins 插件配置数组
 */
export function savePluginsConfig(plugins) {
    if (!Array.isArray(plugins)) throw new TypeError('plugins must be an array');
    const fileContent = `/**
 * 插件配置文件 (自动生成)
 */

const plugins = ${JSON.stringify(plugins, null, 4)};

export default plugins;
`;
    fs.writeFileSync(USER_PLUGINS_CONFIG_PATH, fileContent, 'utf-8');
}
