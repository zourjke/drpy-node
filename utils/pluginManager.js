import { PROJECT_ROOT } from './pathHelper.js';
import fs from "fs";
import path from "path";
import {spawn} from "child_process";
import {fileURLToPath, pathToFileURL} from "url";
import {ensureExecutable} from "./binHelper.js";

// 获取 pluginManager.js 的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .plugins.js 和 .plugins.example.js 在上级目录
const userConfigPath = path.join(__dirname, "../.plugins.js");
const exampleConfigPath = path.join(__dirname, "../.plugins.example.js");

// 尝试加载用户配置，如果没有就用 example
let plugins = [];
try {
    // console.log(`检查插件配置文件: ${userConfigPath} 是否存在`);
    if (fs.existsSync(userConfigPath)) {
        plugins = (await import(pathToFileURL(userConfigPath).href)).default;
        console.log("[pluginManager] 使用用户 .plugins.js 配置");
    } else if (fs.existsSync(exampleConfigPath)) {
        plugins = (await import(pathToFileURL(exampleConfigPath).href)).default;
        console.log("[pluginManager] 使用默认 .plugins.example.js 配置");
    }
} catch (err) {
    console.error("[pluginManager] 加载插件配置失败:", err);
    plugins = [];
}

/**
 * 获取插件对应的二进制文件路径
 * @param {string} rootDir 项目根目录
 * @param {string} pluginPath 插件目录路径 (例: plugins/req-proxy)
 * @param {string} pluginName 插件名 (例: req-proxy)
 */
function getPluginBinary(rootDir, pluginPath, pluginName) {
    const platform = process.platform;
    const binDir = path.join(rootDir, pluginPath);

    let binaryName = null;
    if (platform === "win32") {
        binaryName = `${pluginName}-win.exe`;
    } else if (platform === "linux") {
        binaryName = `${pluginName}-linux`;
    } else if (platform === "darwin") {
        binaryName = `${pluginName}-darwin`;
    } else if (platform === "android") {
        binaryName = `${pluginName}-android`;
    } else {
        console.log("[getPluginBinary] Unsupported platform: " + platform);
        return null;
    }

    return path.join(binDir, binaryName);
}

/**
 * 启动插件
 * @param {Object} plugin 插件配置
 * @param {string} rootDir 项目根目录
 */
function startPlugin(plugin, rootDir) {
    if (!plugin.active) {
        // 这个检查主要用于直接调用startPlugin函数的情况
        // 正常情况下startAllPlugins已经在调用前检查了激活状态
        return null;
    }

    const binary = getPluginBinary(rootDir, plugin.path, plugin.name);
    if (!binary || !fs.existsSync(binary)) {
        console.error(`[pluginManager] 插件 ${plugin.name} 的二进制文件不存在: ${binary}`);
        return null;
    }

    console.log(`[pluginManager] 启动插件 ${plugin.name}: ${binary} ${plugin.params || ""}`);

    const args = plugin.params ? plugin.params.split(" ") : [];
    let proc;

    try {
        ensureExecutable(binary);
        // 用 pipe 方式，便于我们捕获插件日志
        proc = spawn(binary, args, {stdio: ["ignore", "pipe", "pipe"]});

        // 检查是否真的启动了
        if (!proc || !proc.pid) {
            console.error(`[pluginManager] 插件 ${plugin.name} 启动失败 (无效的进程 PID)`);
            return null;
        }

        proc.stdout.on("data", (data) => {
            console.log(`[${plugin.name}]`, data.toString().trim());
        });

        proc.stderr.on("data", (data) => {
            console.log(`[${plugin.name}-STD]`, data.toString().trim());
        });

        proc.on("error", (err) => {
            if (err.code === "EACCES") {
                console.error(`[pluginManager] 插件 ${plugin.name} 无法执行: 没有执行权限，请运行: chmod +x ${binary}`);
            } else if (err.code === "ENOENT") {
                console.error(`[pluginManager] 插件 ${plugin.name} 启动失败: 找不到可执行文件 ${binary}`);
            } else {
                console.error(`[pluginManager] 插件 ${plugin.name} 运行中出错:`, err.message);
            }
            // 标记为“启动失败”，避免 exit 再重复打印
            proc._failedToSpawn = true;
        });

        proc.on("exit", (code, signal) => {
            if (proc._failedToSpawn) return; // 忽略 spawn 失败导致的 exit
            console.log(`[pluginManager] 插件 ${plugin.name} 退出 (code=${code}, signal=${signal})`);
        });

        return proc;
    } catch (err) {
        console.error(`[pluginManager] 插件 ${plugin.name} 启动失败 (spawn 出错):`, err.message);
        return null;
    }
}

/**
 * 生成插件唯一 key
 * @param {Object} plugin 插件配置
 * @param {number} index 插件在配置里的序号
 */
function getProcessKey(plugin, index) {
    if (plugin.id) return plugin.id; // 用户自定义 id
    return `${plugin.name}#${index + 1}`;
}

/**
 * 启动所有插件
 * @param {string} rootDir 项目根目录
 */
export function startAllPlugins(rootDir = PROJECT_ROOT) {
    console.log("[pluginManager] 准备启动所有插件...");
    const processes = {};
    const inactivePlugins = [];
    
    plugins.forEach((plugin, index) => {
        const key = getProcessKey(plugin, index);
        
        // 先检查插件是否激活，未激活的插件收集到数组中
        if (!plugin.active) {
            inactivePlugins.push(plugin.name);
            return;
        }

        const proc = startPlugin(plugin, rootDir);

        if (proc) {
            processes[key] = proc;
            console.log(`[pluginManager] 插件已启动并注册进程: ${key} (pid=${proc.pid})`);
        } else {
            console.error(`[pluginManager] 插件 ${key} 启动失败，未加入到 processes`);
        }
    });
    
    // 如果有未激活的插件，在一行中显示
    if (inactivePlugins.length > 0) {
        console.log(`[pluginManager] 跳过未激活的插件: [${inactivePlugins.map(name => `'${name}'`).join(',')}]`);
    }
    
    return processes;
}

/**
 * 停止指定插件
 * @param {Object} processes 插件进程字典
 * @param {string} key 插件唯一 key
 */
export function stopPlugin(processes, key) {
    const proc = processes[key];
    if (!proc) {
        console.warn(`[pluginManager] 未找到插件进程: ${key}`);
        return;
    }

    console.log(`[pluginManager] 停止插件: ${key} (pid=${proc.pid})`);
    try {
        proc.kill("SIGTERM");
        delete processes[key];
    } catch (err) {
        console.error(`[pluginManager] 停止插件 ${key} 失败:`, err);
    }
}