import { loadPluginsConfig, savePluginsConfig, USER_PLUGINS_CONFIG_PATH, EXAMPLE_PLUGINS_CONFIG_PATH } from '../../utils/pluginsConfigFile.js';
import { reloadPluginsConfig } from '../../utils/pluginManager.js';
import fs from '../../utils/fsWrapper.js';
import { getInstalledManifest } from '../../utils/pluginMarket.js';

/**
 * 获取插件列表（合并磁盘上的已安装版本信息：market 安装的插件有 plugin.json，版本可读；
 * 手工放置的目录无 manifest，版本显示为未知）
 */
export async function getPlugins(req, reply) {
    try {
        const { plugins, isDefault } = await loadPluginsConfig();
        const data = plugins.map(p => {
            const manifest = getInstalledManifest(p.name);
            return {
                ...p,
                installedVersion: manifest ? (manifest.version || null) : null,
                marketManaged: !!(manifest && manifest._source === 'market')
            };
        });

        return reply.send({
            success: true,
            data,
            isDefault
        });
    } catch (error) {
        req.log.error('获取插件列表失败:', error);
        return reply.code(500).send({
            success: false,
            error: '获取插件列表失败: ' + error.message
        });
    }
}

/**
 * 保存插件列表
 */
export async function savePlugins(req, reply) {
    try {
        const { plugins } = req.body;

        if (!Array.isArray(plugins)) {
            return reply.code(400).send({
                success: false,
                error: '参数格式错误，plugins必须是数组'
            });
        }

        savePluginsConfig(plugins);
        // 同步重载 pluginManager 内存配置，保存后的 env/params 重启插件即可生效（无需重启主服务）
        await reloadPluginsConfig();

        return reply.send({
            success: true,
            message: '插件配置已保存'
        });
    } catch (error) {
        req.log.error('保存插件配置失败:', error);
        return reply.code(500).send({
            success: false,
            error: '保存插件配置失败: ' + error.message
        });
    }
}

/**
 * 恢复默认插件配置
 */
export async function restorePlugins(req, reply) {
    try {
        if (await fs.pathExists(EXAMPLE_PLUGINS_CONFIG_PATH)) {
            await fs.copy(EXAMPLE_PLUGINS_CONFIG_PATH, USER_PLUGINS_CONFIG_PATH);
            await reloadPluginsConfig();
            return reply.send({
                success: true,
                message: '已恢复默认插件配置'
            });
        } else {
            return reply.code(404).send({
                success: false,
                error: '找不到默认配置文件 (.plugins.example.js)'
            });
        }
    } catch (error) {
        req.log.error('恢复默认插件配置失败:', error);
        return reply.code(500).send({
            success: false,
            error: '恢复默认插件配置失败: ' + error.message
        });
    }
}
