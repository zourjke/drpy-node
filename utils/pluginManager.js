import {log, logError, logWarn} from './log.js';
import { PROJECT_ROOT } from './pathHelper.js';
import fs from "fs";
import path from "path";
import {spawn, spawnSync, exec} from "child_process";
import {fileURLToPath} from "url";
import {ensureExecutable} from "./binHelper.js";
import {loadPluginsConfig} from "./pluginsConfigFile.js";
import {registry, setProc} from "./pluginRegistry.js";

/**
 * 同步安装插件依赖（阻塞式，仅首次启动时调用一次）
 * 失败不抛错，返回 false 由调用方决定是否跳过启动
 * 规避 npm optional dependencies bug (https://github.com/npm/cli/issues/4828)：
 * native binding（如 music-tag-native-darwin-x64）在 --production 下可能漏装，
 * 因此删除 lock 文件后重装，并显式补装当前平台对应的 native binding 兜底
 */
function installPluginDeps(pluginDir, pluginName) {
    const nodeModulesPath = path.join(pluginDir, 'node_modules');
    if (fs.existsSync(nodeModulesPath)) return true;
    if (!fs.existsSync(path.join(pluginDir, 'package.json'))) {
        // 零依赖插件：无 package.json 无需安装；且裸跑 npm install 会向上逃逸到主项目 package.json，必须挡住
        log(`[pluginManager] ${pluginName} 无 package.json，零依赖插件跳过依赖安装`);
        return true;
    }

    log(`[pluginManager] ${pluginName} 首次启动，自动安装依赖（可能需要几分钟）...`);
    try {
        // 删除 lock 文件，规避 npm optional deps bug
        const lockPath = path.join(pluginDir, 'package-lock.json');
        if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath);

        const result = spawnSync('npm', ['install', '--production', '--no-package-lock'], {
            cwd: pluginDir,
            stdio: 'inherit',
            timeout: 600000, // 10分钟超时
            shell: process.platform === 'win32'
        });
        if (result.status !== 0 || !fs.existsSync(nodeModulesPath)) {
            logError(`[pluginManager] ${pluginName} 依赖安装失败 (exit=${result.status})，请手动执行: cd ${pluginDir} && npm install --production`);
            return false;
        }
        log(`[pluginManager] ${pluginName} 依赖安装完成`);
        return true;
    } catch (err) {
        logError(`[pluginManager] ${pluginName} 依赖安装异常:`, err.message);
        return false;
    }
}

/**
 * 兜底安装 native binding：检测依赖中是否存在平台特定的 native binding 包未装上
 * 规避 npm optional deps bug 的最后一道防线
 * 返回 true 表示装上了（或无需装）
 */
function ensureNativeBindings(pluginDir, pluginName) {
    const missing = detectMissingNativeBindings(pluginDir);
    if (missing.length === 0) return true;

    log(`[pluginManager] ${pluginName} 检测到 ${missing.length} 个 native binding 缺失，尝试补装: ${missing.join(', ')}`);
    for (const bindingName of missing) {
        const r = spawnSync('npm', ['install', bindingName, '--no-save', '--no-package-lock'], {
            cwd: pluginDir,
            stdio: 'inherit',
            timeout: 300000,
            shell: process.platform === 'win32'
        });
        if (r.status !== 0) {
            logError(`[pluginManager] 补装 ${bindingName} 失败 (exit=${r.status})`);
        }
    }
    return true;
}

/**
 * 探测缺失的 native binding（只读扫描，不安装，毫秒级）
 * ponytail: 仅扫描顶层包的 optionalDependencies，@scope 嵌套 binding 不覆盖——现状与原 ensureNativeBindings 一致
 */
export function detectMissingNativeBindings(pluginDir) {
    const nodeModulesPath = path.join(pluginDir, 'node_modules');
    if (!fs.existsSync(nodeModulesPath)) return [];

    const plat = process.platform;
    const arch = process.arch;
    const bindingSuffix = {
        'darwin-x64': 'darwin-x64',
        'darwin-arm64': 'darwin-arm64',
        'linux-x64': 'linux-x64-gnu',
        'linux-arm64': 'linux-arm64-gnu',
        'win32-x64': 'win32-x64-msvc'
    }[`${plat}-${arch}`];

    if (!bindingSuffix) return [];

    const missing = [];
    const pkgs = fs.readdirSync(nodeModulesPath).filter(n => !n.startsWith('.'));
    for (const name of pkgs) {
        if (name.startsWith('@')) continue;
        const pkgJsonPath = path.join(nodeModulesPath, name, 'package.json');
        if (!fs.existsSync(pkgJsonPath)) continue;
        let pkg;
        try { pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8')); } catch { continue; }
        const opts = pkg.optionalDependencies || {};
        const bindingName = Object.keys(opts).find(k => k.endsWith('-' + bindingSuffix));
        if (bindingName && !fs.existsSync(path.join(nodeModulesPath, bindingName))) {
            missing.push(bindingName);
        }
    }
    return missing;
}

// ==================== Python 插件支持 ====================

/** 读插件目录 manifest（plugin.json），缺失/解析失败返回 null */
function readPluginManifest(pluginDir) {
    try {
        return JSON.parse(fs.readFileSync(path.join(pluginDir, 'plugin.json'), 'utf-8'));
    } catch {
        return null;
    }
}

/** 插件声明的依赖清单文件（manifest.python.requirements，缺省 requirements.txt） */
export function getPluginRequirementsFile(rootDir, pluginPath) {
    const mf = readPluginManifest(path.join(rootDir, pluginPath));
    return (mf && mf.python && mf.python.requirements) || 'requirements.txt';
}

/** 插件 venv 内的 python 解释器路径；venv 未创建返回 null */
export function getVenvPython(pluginDir) {
    const exe = process.platform === 'win32'
        ? path.join(pluginDir, '.venv', 'Scripts', 'python.exe')
        : path.join(pluginDir, '.venv', 'bin', 'python');
    return fs.existsSync(exe) ? exe : null;
}

/** 系统 python 启动名（与 daemonManager 同口径：PYTHON_PATH 优先→VIRTUAL_ENV→python/python3） */
function getSystemPython() {
    if (process.env.PYTHON_PATH && fs.existsSync(process.env.PYTHON_PATH)) return process.env.PYTHON_PATH;
    if (process.env.VIRTUAL_ENV) {
        const venvPython = process.platform === 'win32'
            ? path.join(process.env.VIRTUAL_ENV, 'Scripts', 'python.exe')
            : path.join(process.env.VIRTUAL_ENV, 'bin', 'python');
        if (fs.existsSync(venvPython)) return venvPython;
    }
    return process.platform === 'win32' ? 'python' : 'python3';
}

/**
 * 异步准备 Python 型插件的运行依赖：创建插件内 .venv 并安装 requirements.txt
 * （幂等：.venv 已存在则跳过建 venv 只确保依赖安装过——以 .venv 存在为完成标志，
 * 重复调用不再重装，与 node 侧 node_modules 同口径）
 * @param {string} rootDir 项目根
 * @param {string} pluginPath 插件相对路径（plugins/<name>）
 * @param {string} pluginName 插件名
 * @param {Function} [onOutput] (line) => void，pip 输出实时尾行
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function preparePythonPluginDeps(rootDir, pluginPath, pluginName, onOutput) {
    const pluginDir = path.join(rootDir, pluginPath);
    const reqFile = getPluginRequirementsFile(rootDir, pluginPath);
    const reqPath = path.join(pluginDir, reqFile);
    if (!fs.existsSync(reqPath)) {
        return {ok: true}; // 无依赖声明，无需准备
    }
    const venvPython = getVenvPython(pluginDir);
    if (venvPython) {
        return {ok: true}; // venv 已建好（与 node 的 node_modules 同口径：存在即视为就绪）
    }
    const systemPython = getSystemPython();
    // exec 失败时把 stderr 尾部带回给上层（如 Ubuntu 缺 python3-venv 时 ensurepip 的提示）
    const errTail = (err, n = 400) => {
        const t = String(err?.stderr || err?.message || '').trim();
        return t ? t.slice(-n) : '';
    };
    const cleanupBrokenVenv = () => {
        // 半成品 .venv 会被 getVenvPython 的"存在即就绪"检查误判，失败时best effort清掉
        try {
            fs.rmSync(path.join(pluginDir, '.venv'), {recursive: true, force: true});
        } catch {}
    };
    const run = (cmdArgs, timeout, label, pythonExe) => new Promise((resolve) => {
        const py = pythonExe || systemPython;
        const child = exec(`"${py}" ${cmdArgs}`, {
            cwd: pluginDir,
            timeout,
            encoding: 'utf-8',
            maxBuffer: 64 * 1024 * 1024,
            shell: process.platform === 'win32'
        }, (err) => resolve(err));
        child.stdout?.on('data', (d) => {
            for (const line of String(d).split(/\r?\n/)) {
                if (line.trim()) { try { onOutput?.(line.trim()); } catch {} }
            }
        });
        child.stderr?.on('data', (d) => {
            for (const line of String(d).split(/\r?\n/)) {
                if (line.trim()) { try { onOutput?.(line.trim()); } catch {} }
            }
        });
        log(`[pluginManager] ${pluginName} ${label}: ${py} ${cmdArgs}`);
    });

    try {
        const venvErr = await run(`-m venv .venv`, 300000, '创建虚拟环境');
        const venvPythonPath = getVenvPython(pluginDir);
        if (venvErr || !venvPythonPath) {
            cleanupBrokenVenv();
            const tail = errTail(venvErr);
            const hint = /ensurepip/i.test(tail) ? '（Ubuntu/Debian 需先安装: sudo apt install python3-venv python3-pip）' : '（Ubuntu/Debian 常见原因：缺 python3-venv，sudo apt install python3-venv）';
            return {ok: false, error: `${pluginName} 创建 venv 失败: ${venvErr?.message || 'venv 未生成'} ${hint}${tail ? '\n' + tail : ''}`};
        }
        const upgradeErr = await run(`-m pip install --upgrade pip -q`, 300000, '升级 pip', venvPythonPath);
        if (upgradeErr) {
            cleanupBrokenVenv();
            return {ok: false, error: `${pluginName} pip 升级失败: ${upgradeErr.message}\n${errTail(upgradeErr)}`};
        }
        const pipErr = await run(`-m pip install -r "${reqFile}"`, 900000, '安装依赖', venvPythonPath);
        if (pipErr) {
            cleanupBrokenVenv();
            const tail = errTail(pipErr);
            const hint = /externally-managed/i.test(tail) ? '（PEP 668 限制，应安装在 venv 内——请删除残留环境后重试依赖准备）' : '';
            return {ok: false, error: `${pluginName} 依赖安装失败: ${pipErr.message} ${hint}\n${tail}`};
        }
        return {ok: true};
    } catch (err) {
        return {ok: false, error: err.message};
    }
}

/**
 * 异步准备 Node 型插件的运行依赖（npm install 不阻塞事件循环，供管理 API 启动路径使用）
 * 与 startPlugin 内同步版 installPluginDeps/ensureNativeBindings 的差异：exec 异步执行，HTTP 请求可安全等待
 * @param {Function} [onOutput] (line) => void，npm 输出实时尾行（供任务进度展示）
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function prepareNodePluginDeps(pluginDir, pluginName, onOutput) {    const runNpm = (args, timeout) => new Promise((resolve) => {
        const child = exec(`npm ${args}`, {
            cwd: pluginDir,
            timeout,
            shell: process.platform === 'win32',
            maxBuffer: 64 * 1024 * 1024
        }, (err) => resolve(err));
        child.stdout?.on('data', (d) => {
            for (const line of String(d).split(/\r?\n/)) {
                if (line.trim()) { try { onOutput?.(line.trim()); } catch {} }
            }
        });
        child.stderr?.on('data', (d) => {
            for (const line of String(d).split(/\r?\n/)) {
                if (line.trim()) { try { onOutput?.(line.trim()); } catch {} }
            }
        });
    });

    try {
        if (!fs.existsSync(path.join(pluginDir, 'node_modules'))) {
            if (!fs.existsSync(path.join(pluginDir, 'package.json'))) {
                // 零依赖插件：目录无 package.json（如最小 index.js），无需也无法 npm install
                return {ok: true};
            }

            log(`[pluginManager] ${pluginName} 首次启动，后台安装依赖（可能需要几分钟）...`);
            const err = await runNpm('install --production --no-package-lock', 600000);
            if (err || !fs.existsSync(path.join(pluginDir, 'node_modules'))) {
                return {ok: false, error: `${pluginName} 依赖安装失败: ${err?.message || 'node_modules 未生成'}`};
            }
            log(`[pluginManager] ${pluginName} 依赖安装完成`);
        }
        const missing = detectMissingNativeBindings(pluginDir);
        for (const bindingName of missing) {
            log(`[pluginManager] ${pluginName} 补装 native binding: ${bindingName}`);
            const err = await runNpm(`install ${bindingName} --no-save --no-package-lock`, 300000);
            if (err) logError(`[pluginManager] 补装 ${bindingName} 失败:`, err.message);
        }
        return {ok: true};
    } catch (err) {
        return {ok: false, error: err.message};
    }
}

let plugins = [];
let pluginsIsDefault = false;

/**
 * 自动探测：如果 plugins/lxserver 目录存在且含 index.js，自动启用 lxserver 插件
 * 这样无需配置文件即可"放目录即用"，方便后续升级（直接覆盖目录）
 */
function autoDetectLxserver(rootDir) {
    const lxDir = path.join(rootDir, 'plugins', 'lxserver');
    const lxEntry = path.join(lxDir, 'index.js');
    if (!fs.existsSync(lxEntry)) return null;
    // 依赖是否已安装由启动时 installPluginDeps 自动处理，这里只负责探测目录
    return {
        name: 'lxserver',
        path: 'plugins/lxserver',
        runtime: 'node',
        entry: 'index.js',
        params: '',
        env: { PORT: process.env.LX_PORT || '9527' },
        desc: 'LX Music 同步服务 + Web播放器（自动探测启用）',
        active: true
    };
}

/**
 * 自动探测：如果 plugins/hongguo 目录存在且含 bridge.py，自动启用红果播放桥插件
 * 与 lxserver 一致的「放目录即用」体验；端口固定 57577，由插件目录 config.json 管理
 */
function autoDetectHongguo(rootDir) {
    const hgDir = path.join(rootDir, 'plugins', 'hongguo');
    const hgEntry = path.join(hgDir, 'bridge.py');
    if (!fs.existsSync(hgEntry)) return null;
    // venv 是否已就绪由启动时 setupPythonPlugin 自动处理，这里只负责探测目录
    return {
        name: 'hongguo',
        path: 'plugins/hongguo',
        runtime: 'python',
        entry: 'bridge.py',
        params: '',
        desc: '红果短剧播放桥（签名/CENC解密/流式代理，自动探测启用）',
        active: true
    };
}

async function initPlugins() {
    try {
        const cfg = await loadPluginsConfig();
        plugins = cfg.plugins;
        pluginsIsDefault = cfg.isDefault;
        log(`[pluginManager] 使用${pluginsIsDefault ? '默认 .plugins.example.js' : '用户 .plugins.js'}配置`);

        // 自动探测 lxserver：若配置文件未显式包含 lxserver，且目录存在，则自动注入
        const hasLxConfig = plugins.some(p => p.name === 'lxserver');
        if (!hasLxConfig) {
            const autoLx = autoDetectLxserver(PROJECT_ROOT);
            if (autoLx) {
                plugins.push(autoLx);
                log("[pluginManager] 自动探测到 plugins/lxserver，已启用（无需配置文件）");
            }
        }
        // 自动探测 hongguo：若配置文件未显式包含 hongguo，且目录存在，则自动注入
        const hasHgConfig = plugins.some(p => p.name === 'hongguo');
        if (!hasHgConfig) {
            const autoHg = autoDetectHongguo(PROJECT_ROOT);
            if (autoHg) {
                plugins.push(autoHg);
                log("[pluginManager] 自动探测到 plugins/hongguo，已启用（无需配置文件）");
            }
        }
    } catch (err) {
        logError("[pluginManager] 加载插件配置失败:", err);
        plugins = [];
    }
}

await initPlugins();

/**
 * 当前生效的插件配置（pluginManager 启动时加载的内存副本）
 */
export function getPluginsConfig() {
    return plugins;
}

export function isUsingDefaultConfig() {
    return pluginsIsDefault;
}

/**
 * 重新加载 .plugins.js（市场安装/卸载、管理界面保存后调用）
 */
export async function reloadPluginsConfig() {
    await initPlugins();
    return plugins;
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
        log("[getPluginBinary] Unsupported platform: " + platform);
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

    // Node 脚本插件：runtime === 'node'，用 node 启动指定入口文件
    if (plugin.runtime === 'node') {
        const pluginDir = path.join(rootDir, plugin.path);
        const entryFile = path.join(pluginDir, plugin.entry || 'index.js');
        if (!fs.existsSync(entryFile)) {
            logError(`[pluginManager] Node插件 ${plugin.name} 入口文件不存在: ${entryFile}`);
            return null;
        }

        // 首次启动自动安装依赖（运行时方案C）
        if (!installPluginDeps(pluginDir, plugin.name)) {
            logError(`[pluginManager] Node插件 ${plugin.name} 因依赖未就绪，本次跳过启动`);
            return null;
        }

        // 兜底：补装平台对应的 native binding（规避 npm optional deps bug）
        ensureNativeBindings(pluginDir, plugin.name);

        const args = plugin.params ? plugin.params.split(" ") : [];
        log(`[pluginManager] 启动Node插件 ${plugin.name}: node ${plugin.entry || 'index.js'} ${plugin.params || ""}`);

        // 合并环境变量（允许插件配置独立 env，如端口配置）
        const env = { ...process.env, ...(plugin.env || {}) };

        let proc;
        try {
            proc = spawn(process.execPath, [entryFile, ...args], {
                cwd: pluginDir,
                env,
                stdio: ["ignore", "pipe", "pipe"]
            });

            if (!proc || !proc.pid) {
                logError(`[pluginManager] Node插件 ${plugin.name} 启动失败 (无效的进程 PID)`);
                return null;
            }

            proc.stdout.on("data", (data) => {
                log(`[${plugin.name}]`, data.toString().trim());
            });

            proc.stderr.on("data", (data) => {
                log(`[${plugin.name}-STD]`, data.toString().trim());
            });

            proc.on("error", (err) => {
                logError(`[pluginManager] Node插件 ${plugin.name} 运行中出错:`, err.message);
                proc._failedToSpawn = true;
            });

            proc.on("exit", (code, signal) => {
                if (proc._failedToSpawn) return;
                log(`[pluginManager] Node插件 ${plugin.name} 退出 (code=${code}, signal=${signal})`);
            });

            return proc;
        } catch (err) {
            logError(`[pluginManager] Node插件 ${plugin.name} 启动失败 (spawn 出错):`, err.message);
            return null;
        }
    }

    // Python 插件：runtime === 'python'，用 venv（优先）或系统 python 启动入口脚本。
    // 依赖不在此处自动安装（pip 装依赖可达数分钟，同步阻塞不可接受），走 preparePythonPluginDeps 异步管线，
    // 缺 .venv 时提示先依赖准备（与 startPluginByKey 的 needDeps 守卫配合）
    if (plugin.runtime === 'python') {
        const pluginDir = path.join(rootDir, plugin.path);
        const entryFile = path.join(pluginDir, plugin.entry || 'main.py');
        if (!fs.existsSync(entryFile)) {
            logError(`[pluginManager] Python插件 ${plugin.name} 入口文件不存在: ${entryFile}`);
            return null;
        }

        const venvPython = getVenvPython(pluginDir);
        const reqFile = getPluginRequirementsFile(rootDir, plugin.path);
        if (!venvPython && fs.existsSync(path.join(pluginDir, reqFile))) {
            logError(`[pluginManager] Python插件 ${plugin.name} 因依赖未就绪（缺 .venv），本次跳过启动；请通过管理界面启动（会先自动准备依赖）`);
            return null;
        }
        const pythonExe = venvPython || getSystemPython();

        const args = plugin.params ? plugin.params.split(" ") : [];
        log(`[pluginManager] 启动Python插件 ${plugin.name}: ${venvPython ? 'venv ' : ''}${pythonExe} ${plugin.entry || 'main.py'} ${plugin.params || ""}`);

        const env = { ...process.env, ...(plugin.env || {}) };

        let proc;
        try {
            proc = spawn(pythonExe, ['-u', entryFile, ...args], {
                cwd: pluginDir,
                env,
                stdio: ["ignore", "pipe", "pipe"]
            });

            if (!proc || !proc.pid) {
                logError(`[pluginManager] Python插件 ${plugin.name} 启动失败 (无效的进程 PID)`);
                return null;
            }

            proc.stdout.on("data", (data) => {
                log(`[${plugin.name}]`, data.toString().trim());
            });

            proc.stderr.on("data", (data) => {
                log(`[${plugin.name}-STD]`, data.toString().trim());
            });

            proc.on("error", (err) => {
                logError(`[pluginManager] Python插件 ${plugin.name} 运行中出错:`, err.message);
                proc._failedToSpawn = true;
            });

            proc.on("exit", (code, signal) => {
                if (proc._failedToSpawn) return;
                log(`[pluginManager] Python插件 ${plugin.name} 退出 (code=${code}, signal=${signal})`);
            });

            return proc;
        } catch (err) {
            logError(`[pluginManager] Python插件 ${plugin.name} 启动失败 (spawn 出错):`, err.message);
            return null;
        }
    }

    // 默认：二进制插件（原逻辑）
    const binary = getPluginBinary(rootDir, plugin.path, plugin.name);
    if (!binary || !fs.existsSync(binary)) {
        logError(`[pluginManager] 插件 ${plugin.name} 的二进制文件不存在: ${binary}`);
        return null;
    }

    log(`[pluginManager] 启动插件 ${plugin.name}: ${binary} ${plugin.params || ""}`);

    const args = plugin.params ? plugin.params.split(" ") : [];
    let proc;

    try {
        ensureExecutable(binary);
        // 用 pipe 方式，便于我们捕获插件日志
        proc = spawn(binary, args, {stdio: ["ignore", "pipe", "pipe"]});

        // 检查是否真的启动了
        if (!proc || !proc.pid) {
            logError(`[pluginManager] 插件 ${plugin.name} 启动失败 (无效的进程 PID)`);
            return null;
        }

        proc.stdout.on("data", (data) => {
            log(`[${plugin.name}]`, data.toString().trim());
        });

        proc.stderr.on("data", (data) => {
            log(`[${plugin.name}-STD]`, data.toString().trim());
        });

        proc.on("error", (err) => {
            if (err.code === "EACCES") {
                logError(`[pluginManager] 插件 ${plugin.name} 无法执行: 没有执行权限，请运行: chmod +x ${binary}`);
            } else if (err.code === "ENOENT") {
                logError(`[pluginManager] 插件 ${plugin.name} 启动失败: 找不到可执行文件 ${binary}`);
            } else {
                logError(`[pluginManager] 插件 ${plugin.name} 运行中出错:`, err.message);
            }
            // 标记为“启动失败”，避免 exit 再重复打印
            proc._failedToSpawn = true;
        });

        proc.on("exit", (code, signal) => {
            if (proc._failedToSpawn) return; // 忽略 spawn 失败导致的 exit
            log(`[pluginManager] 插件 ${plugin.name} 退出 (code=${code}, signal=${signal})`);
        });

        return proc;
    } catch (err) {
        logError(`[pluginManager] 插件 ${plugin.name} 启动失败 (spawn 出错):`, err.message);
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
 * 启动所有插件（index.js 启动时调用一次），进程句柄写入 pluginRegistry
 * @param {string} rootDir 项目根目录
 */
export function startAllPlugins(rootDir = PROJECT_ROOT) {
    log("[pluginManager] 准备启动所有插件...");
    const started = {};
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
            setProc(key, proc, plugin.name);
            started[key] = proc;
            log(`[pluginManager] 插件已启动并注册进程: ${key} (pid=${proc.pid})`);
        } else {
            logError(`[pluginManager] 插件 ${key} 启动失败，未注册进程`);
        }
    });

    // 如果有未激活的插件，在一行中显示
    if (inactivePlugins.length > 0) {
        log(`[pluginManager] 跳过未激活的插件: [${inactivePlugins.map(name => `'${name}'`).join(',')}]`);
    }

    return started;
}

/**
 * 按插件名启动单个插件（管理 API 用）
 * ponytail: 返回 plain object 而非抛错，调用方按 ok/needDeps/running 分支处理
 * @returns {{ok: boolean, key?: string, pid?: number, error?: string, needDeps?: boolean, running?: boolean}}
 */
export async function startPluginByKey(name, rootDir = PROJECT_ROOT) {
    const index = plugins.findIndex(p => p.name === name);
    if (index === -1) return {ok: false, error: `未找到插件配置: ${name}`};

    // 已有同名进程在运行（先停再启，避免端口冲突）
    const existing = Object.entries(registry.procs).find(([, e]) => e.name === name);
    if (existing) return {ok: false, running: true, error: `插件 ${name} 已在运行中 (pid=${existing[1].proc.pid})`};

    const plugin = plugins[index];
    if (plugin.runtime === 'node') {
        const entryFile = path.join(rootDir, plugin.path, plugin.entry || 'index.js');
        if (!fs.existsSync(entryFile)) {
            return {ok: false, error: `Node插件 ${name} 入口文件不存在: ${plugin.path}/${plugin.entry || 'index.js'}`};
        }
        // 与 prepareNodePluginDeps 守卫一致：零依赖插件（无 package.json）不要求 node_modules
        const hasPkgJson = fs.existsSync(path.join(rootDir, plugin.path, 'package.json'));
        if (hasPkgJson && !fs.existsSync(path.join(rootDir, plugin.path, 'node_modules'))) {
            return {ok: false, needDeps: true, error: `插件 ${name} 依赖未安装，请先执行依赖准备`};
        }
    } else if (plugin.runtime === 'python') {
        const entryFile = path.join(rootDir, plugin.path, plugin.entry || 'main.py');
        if (!fs.existsSync(entryFile)) {
            return {ok: false, error: `Python插件 ${name} 入口文件不存在: ${plugin.path}/${plugin.entry || 'main.py'}`};
        }
        // 与 preparePythonPluginDeps 守卫一致：无 requirements 的插件不要求 venv
        const reqFile = getPluginRequirementsFile(rootDir, plugin.path);
        if (fs.existsSync(path.join(rootDir, plugin.path, reqFile)) && !getVenvPython(path.join(rootDir, plugin.path))) {
            return {ok: false, needDeps: true, error: `插件 ${name} 依赖未安装，请先执行依赖准备`};
        }
    } else {
        const binary = getPluginBinary(rootDir, plugin.path, plugin.name);
        if (!binary || !fs.existsSync(binary)) {
            return {ok: false, error: `插件 ${name} 的二进制文件不存在: ${plugin.name}-*`};
        }
    }

    const key = getProcessKey(plugin, index);
    const proc = startPlugin(plugin, rootDir);
    if (!proc) return {ok: false, error: `插件 ${name} 启动失败（spawn 出错或启动即退出）`};

    // 收集 stderr 输出，用于启动失败时诊断
    const stderrLines = [];
    proc.stderr.on('data', (d) => {
        for (const line of String(d).split(/\r?\n/)) {
            if (line.trim()) stderrLines.push(line.trim());
        }
    });

    // 等待 1.5 秒检查进程是否立即退出（避免误判：spawn 成功但进程马上崩溃）
    await new Promise((resolve) => {
        const timer = setTimeout(resolve, 1500);

        proc.on('exit', () => { clearTimeout(timer); resolve(); });
    });

    if (proc.exitCode !== null) {
        const tail = stderrLines.slice(-15).join('\n');
        logError(`[pluginManager] 插件 ${name} 启动后立即退出 (code=${proc.exitCode})`);
        return {ok: false, error: `插件 ${name} 启动后立即退出 (code=${proc.exitCode})${tail ? '\n' + tail : ''}`};
    }

    setProc(key, proc, plugin.name);
    log(`[pluginManager] 插件已启动并注册进程: ${key} (pid=${proc.pid})`);
    return {ok: true, key, pid: proc.pid};
}

/**
 * 停止指定 key 的插件进程（句柄从 pluginRegistry 取）
 * 确保 SIGTERM 后进程真正退出，3秒后仍存活则 SIGKILL 强制杀死
 * 避免 lxserver 等插件因未处理 SIGTERM 或有未完成异步操作而成为孤儿进程，
 * 导致端口残留（如 9527），重启时新进程 EADDRINUSE 无法绑定端口
 * @param {string} key 插件唯一 key
 * @returns {Promise<void>} 等待进程退出完成
 */
export function stopPlugin(key) {
    const entry = registry.procs[key];
    if (!entry) {
        logWarn(`[pluginManager] 未找到插件进程: ${key}`);
        return Promise.resolve();
    }
    const proc = entry.proc;
    const pid = proc.pid;

    log(`[pluginManager] 停止插件: ${key} (pid=${pid})`);

    // 先移除 stdout/stderr 监听器，避免日志干扰
    if (proc.stdout) proc.stdout.removeAllListeners();
    if (proc.stderr) proc.stderr.removeAllListeners();

    return new Promise((resolve) => {
        let settled = false;
        const done = () => {
            if (settled) return;
            settled = true;
            delete registry.procs[key];
            resolve();
        };

        // 监听 exit 事件，进程退出后 resolve
        proc.once("exit", (code, signal) => {
            log(`[pluginManager] 插件 ${key} (pid=${pid}) 已退出 (code=${code}, signal=${signal})`);
            done();
        });

        try {
            proc.kill("SIGTERM");
        } catch (err) {
            logError(`[pluginManager] 停止插件 ${key} 失败:`, err);
            done();
            return;
        }

        // 3秒后仍存活则强制 SIGKILL
        // 某些插件（如 lxserver）未处理 SIGTERM 或被 uncaughtException handler 吞掉信号，
        // 需要兜底强制杀死，否则端口残留导致重启失败
        const killTimer = setTimeout(() => {
            try {
                // process.kill(pid, 0) 不发信号，仅检查进程是否存在
                process.kill(pid, 0);
                logWarn(`[pluginManager] 插件 ${key} (pid=${pid}) 3秒内未响应 SIGTERM，强制 SIGKILL`);
                try {
                    process.kill(pid, "SIGKILL");
                } catch (_) {}
                // SIGKILL 后等 exit 事件触发 done
                // 兜底：1秒后仍未 exit 则强制 resolve
                setTimeout(done, 1000).unref();
            } catch (_) {
                // 进程已退出
                done();
            }
        }, 3000);
        killTimer.unref();
    });
}

/**
 * 按插件名停止其运行中的进程（管理 API 用）
 * @returns {Promise<{stopped: boolean}>}
 */
export function stopPluginByName(name) {
    for (const [key, entry] of Object.entries(registry.procs)) {
        if (entry.name === name) {
            return stopPlugin(key).then(() => ({stopped: true}));
        }
    }
    return Promise.resolve({stopped: false});
}

/**
 * 重启单个插件：停止 → 启动
 */
export async function restartPluginByName(name, rootDir = PROJECT_ROOT) {
    await stopPluginByName(name);
    return await startPluginByKey(name, rootDir);
}

/**
 * 停止所有插件（优雅关闭时调用，避免子进程成为孤儿）
 * 等待所有插件进程真正退出（最多 3+1 秒），确保端口释放
 * @returns {Promise<void>}
 */
export async function stopAllPlugins() {
    const keys = Object.keys(registry.procs);
    if (!keys.length) return;
    log(`[pluginManager] 正在停止所有插件（${keys.length}个）...`);
    await Promise.all(keys.map(key => stopPlugin(key)));
}
