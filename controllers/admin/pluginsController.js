import path from 'path';
import fs from '../../utils/fsWrapper.js';
import { pathToFileURL } from 'url';
import { PROJECT_ROOT } from '../../utils/pathHelper.js';

const ROOT_DIR = PROJECT_ROOT;
const userConfigPath = path.join(ROOT_DIR, '.plugins.js');
const exampleConfigPath = path.join(ROOT_DIR, '.plugins.example.js');

/**
 * 获取插件列表
 */
export async function getPlugins(req, reply) {
    try {
        let plugins = [];
        let isDefault = false;

        // 加载插件配置
        if (await fs.pathExists(userConfigPath)) {
            // 使用时间戳作为查询参数强制重新加载模块，避免模块缓存
            const modulePath = `${pathToFileURL(userConfigPath).href}?t=${Date.now()}`;
            const mod = await import(modulePath);
            plugins = mod.default || [];
        } else if (await fs.pathExists(exampleConfigPath)) {
            const modulePath = `${pathToFileURL(exampleConfigPath).href}?t=${Date.now()}`;
            const mod = await import(modulePath);
            plugins = mod.default || [];
            isDefault = true;
        }

        return reply.send({
            success: true,
            data: plugins,
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

        const fileContent = `/**
 * 插件配置文件 (自动生成)
 */

const plugins = ${JSON.stringify(plugins, null, 4)};

export default plugins;
`;

        await fs.writeFile(userConfigPath, fileContent, 'utf-8');

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
        if (await fs.pathExists(exampleConfigPath)) {
            await fs.copy(exampleConfigPath, userConfigPath);
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
