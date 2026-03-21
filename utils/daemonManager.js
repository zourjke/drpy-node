/**
 * Python守护进程管理器
 * 
 * 该模块提供了管理Python守护进程的功能，包括启动、停止、状态检查等。
 * 主要用于管理爬虫系统的Python后端服务。
 * 
 * @author drpy-node
 * @version 1.0.0
 */

import {PythonShell} from 'python-shell';
import path from 'path';
import fs from 'fs';
import net from 'net';
import {promisify} from 'util';
import {exec} from 'child_process';
import {fileURLToPath} from "url";

// 将exec转换为Promise形式
const execAsync = promisify(exec);
// 获取当前模块的目录路径
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// 项目根目录路径
const rootDir = path.join(__dirname, '../');
// 检查是否有写权限（非Vercel环境）
const hasWriteAccess = !process.env.VERCEL; // 非vercel环境才有write权限

/**
 * 确保目录存在，如果不存在则创建
 * @param {string} dir - 目录路径
 */
function ensureDir(dir) {
    if (hasWriteAccess) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, {recursive: true});
        }
    }
}

/**
 * 记录日志到文件和控制台
 * @param {string} logFile - 日志文件路径
 * @param {string} level - 日志级别 (INFO, ERROR, CRITICAL, WARN)
 * @param {string} msg - 日志消息
 */
function log(logFile, level, msg) {
    const line = `${new Date().toISOString()} [${level}] ${msg}\n`;
    fs.appendFileSync(logFile, line);
    if (level === 'ERROR' || level === 'CRITICAL') {
        console.error(line.trim());
    } else {
        console.log(line.trim());
    }
}

/**
 * Python守护进程管理器类
 * 
 * 负责管理Python守护进程的生命周期，包括启动、停止、状态监控等功能。
 * 支持两种模式：完整模式和轻量模式。
 */
export class DaemonManager {
    /**
     * 构造函数
     * @param {string} rootDir - 项目根目录路径
     * @param {number} daemonMode - 守护进程模式 (0: 完整模式, 1: 轻量模式)
     */
    constructor(rootDir, daemonMode = 0) {
        this.rootDir = rootDir;
        this.daemonShell = null; // Python进程实例
        this.daemonFile = daemonMode ? 't4_daemon_lite.py' : 't4_daemon.py' // 根据模式选择守护进程文件
        this.config = this.getDaemonConfig(); // 获取守护进程配置
    }

    /**
     * 获取守护进程配置
     * @returns {Object} 配置对象，包含PID文件、日志文件、脚本路径等
     */
    getDaemonConfig() {
        const logsDir = path.join(this.rootDir, 'logs');
        ensureDir(logsDir); // 确保日志目录存在

        return {
            pidFile: path.join(this.rootDir, 't4_daemon.pid'), // PID文件路径
            logFile: path.join(logsDir, 'daemon.log'), // 日志文件路径
            daemonScript: path.join(this.rootDir, 'spider/py/core', this.daemonFile), // 守护进程脚本路径
            clientScript: path.join(this.rootDir, 'spider/py/core', 'bridge.py'), // 客户端脚本路径
            host: '127.0.0.1', // 服务器主机
            port: 57570, // 服务器端口
        };
    }

    /**
     * 获取Python解释器路径
     * @returns {string} Python解释器路径
     */
    getPythonPath() {
        // 优先使用环境变量指定的Python路径
        if (process.env.PYTHON_PATH) return process.env.PYTHON_PATH;
        // 如果在虚拟环境中，使用虚拟环境的Python
        if (process.env.VIRTUAL_ENV) {
            return process.platform === 'win32'
                ? path.join(process.env.VIRTUAL_ENV, 'Scripts', 'python')
                : path.join(process.env.VIRTUAL_ENV, 'bin', 'python');
        }
        // 默认Python路径
        return process.platform === 'win32' ? 'python.exe' : 'python3';
    }

    /**
     * 检查Python是否可用
     * @returns {Promise<string|boolean>} Python是否可用，可用则返回版本号字符串，否则返回false
     */
    async isPythonAvailable() {
        try {
            const {stdout, stderr} = await execAsync(`${this.getPythonPath()} --version`);
            const out = stdout || stderr;
            if (out && out.includes('Python')) {
                const match = out.match(/Python\s+([0-9.]+)/i);
                return match ? match[1] : true;
            }
            return false;
        } catch {
            return false;
        }
    }

    /**
     * 清理守护进程相关文件（PID文件等）
     */
    cleanupFiles() {
        if (hasWriteAccess) {
            try {
                if (fs.existsSync(this.config.pidFile)) fs.unlinkSync(this.config.pidFile);
            } catch {
                // 忽略删除失败的错误
            }
        }
    }

    /**
     * 检查守护进程是否正在运行
     * @returns {boolean} 守护进程是否运行中
     */
    isDaemonRunning() {
        // 检查PID文件是否存在
        if (!fs.existsSync(this.config.pidFile)) return false;
        // 读取PID并检查进程是否存在
        const pid = parseInt(fs.readFileSync(this.config.pidFile, 'utf8'), 10);
        try {
            process.kill(pid, 0); // 发送信号0检查进程是否存在
            return true;
        } catch {
            return false;
        }
    }

    /**
     * 等待服务器启动
     * @param {number} timeoutMs - 超时时间（毫秒）
     * @returns {Promise<boolean>} 服务器是否成功启动
     */
    async waitForServer(timeoutMs = 5000) {
        const {host, port} = this.config;
        const deadline = Date.now() + timeoutMs;

        return new Promise((resolve, reject) => {
            const tryConnect = () => {
                // 尝试连接到服务器
                const socket = net.connect({host, port}, () => {
                    socket.end();
                    resolve(true);
                });
                socket.on('error', () => {
                    if (Date.now() > deadline) {
                        reject(new Error('守护进程未能在超时时间内启动'));
                    } else {
                        setTimeout(tryConnect, 300); // 300ms后重试
                    }
                });
            };
            tryConnect();
        });
    }

    /**
     * 启动守护进程
     * @returns {Promise<void>}
     */
    async startDaemon() {
        // 检查守护进程是否已在运行
        if (this.isDaemonRunning()) {
            log(this.config.logFile, 'INFO', 'Python 守护进程已在运行');
            return;
        }
        // 检查Python是否可用
        if (!await this.isPythonAvailable()) {
            log(this.config.logFile, 'INFO', '当前环境不支持Python,跳过启动守护进程');
            return;
        }

        this.cleanupFiles(); // 清理旧文件

        // 配置Python Shell选项
        const options = {
            mode: 'text',
            pythonPath: this.getPythonPath(),
            pythonOptions: ['-u'], // 无缓冲输出
            scriptPath: path.dirname(this.config.daemonScript),
            env: {PYTHONIOENCODING: 'utf-8'}, // 设置编码
            args: [
                '--pid-file', this.config.pidFile,
                '--log-file', this.config.logFile,
                '--host', this.config.host,
                '--port', this.config.port,
            ],
        };

        log(this.config.logFile, 'INFO', `正在启动 Python 守护进程 [${this.daemonFile}]...`);
        // 创建Python Shell实例
        const daemonShell = new PythonShell(path.basename(this.config.daemonScript), options);
        this.daemonShell = daemonShell;

        // 设置事件监听器
        daemonShell.on('message', (m) => log(this.config.logFile, 'INFO', `[守护进程] ${m}`));
        daemonShell.on('stderr', (m) => log(this.config.logFile, 'INFO', `[守护进程] ${m}`));
        daemonShell.on('error', (err) => log(this.config.logFile, 'CRITICAL', `错误: ${err.message}`));
        daemonShell.on('close', (code, signal) => {
            if (code !== null && code !== undefined) {
                log(this.config.logFile, 'INFO', `[ON CLOSE]守护进程关闭，退出码: ${code}`);
            } else {
                log(this.config.logFile, 'WARN', `守护进程异常退出（可能被 kill），未返回退出码`);
            }
            this.cleanupFiles();
            this.daemonShell = null;
        });

        // 监听进程启动事件
        daemonShell.childProcess.on('spawn', () => {
            if (hasWriteAccess) {
                // 写入PID文件
                fs.writeFileSync(this.config.pidFile, daemonShell.childProcess.pid.toString());
            }
            log(this.config.logFile, 'INFO', `守护进程启动成功，PID: ${daemonShell.childProcess.pid}`);
        });

        // 等待服务器启动
        await this.waitForServer();
    }

    /**
     * 停止守护进程
     * @returns {Promise<void>}
     */
    async stopDaemon() {
        // 检查守护进程是否在运行
        if (!this.isDaemonRunning()) {
            log(this.config.logFile, 'INFO', '没有运行的守护进程');
            return;
        }

        log(this.config.logFile, 'INFO', '正在停止守护进程...');
        // 读取PID
        const pid = parseInt(fs.readFileSync(this.config.pidFile, 'utf8'), 10);

        // 根据平台选择终止方式
        if (process.platform === 'win32') {
            exec(`taskkill /PID ${pid} /T /F`); // Windows使用taskkill
        } else {
            try {
                process.kill(pid, 'SIGTERM'); // Unix系统使用SIGTERM信号
            } catch {
                // 忽略错误
            }
        }

        // 等待进程退出
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // 如果进程仍在运行，强制终止
        if (this.isDaemonRunning()) {
            log(this.config.logFile, 'WARN', '守护进程未退出，强制终止...');
            try {
                process.kill(pid, 'SIGKILL'); // 强制终止
            } catch {
                // 忽略错误
            }
        }

        this.cleanupFiles(); // 清理文件
        this.daemonShell = null;
        log(this.config.logFile, 'INFO', '守护进程已停止');
    }
}

// 导出守护进程管理器实例
export const daemon = new DaemonManager(rootDir, Number(process.env.daemonMode) || 0);