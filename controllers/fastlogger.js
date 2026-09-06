import fs from "fs";
import path from 'path';
import pino from "pino";
import Fastify from "fastify";
import {fileURLToPath} from 'url';
import {createStream} from 'rotating-file-stream';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 使用 Symbol 作为全局键，防止命名冲突
const FASTIFY_INSTANCE_KEY = Symbol.for('drpy-node.fastify.instances');

// 初始化函数，仅执行一次
function initializeFastify() {
    if (globalThis[FASTIFY_INSTANCE_KEY]) {
        return globalThis[FASTIFY_INSTANCE_KEY];
    }

    dotenv.config();

    const LOG_WITH_FILE = Number(process.env.LOG_WITH_FILE) || 0;
    const LOG_LEVEL = process.env.LOG_LEVEL && ['trace', 'debug', 'info', 'warn', 'error', 'fatal'].includes(process.env.LOG_LEVEL) ? process.env.LOG_LEVEL : 'info';

    let _logger = true;
    let logStream = null;
    const logDirectory = path.join(__dirname, '../logs');

    // 自定义时间戳函数
    const customTimestamp = () => {
        const now = new Date();
        return `,"time":"${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}"`;
    };

    // 安全的文件路径生成函数
    const safeFileNameGenerator = (time, index) => {
        if (!time) return "output.log";
        const dateStr = `${time.getFullYear()}-${String(time.getMonth() + 1).padStart(2, '0')}-${String(time.getDate()).padStart(2, '0')}`;
        return `output-${dateStr}.log.${index || 1}`;
    };

    if (LOG_WITH_FILE) {
        if (!fs.existsSync(logDirectory)) {
            try {
                fs.mkdirSync(logDirectory, {recursive: true});
            } catch (e) {
                console.error('[FastLogger] Failed to create log directory:', e);
            }
        }

        const streamOptions = {
            size: '500M',
            compress: false,
            interval: '1d',
            path: logDirectory,
            maxFiles: 30
        };

        try {
            logStream = createStream(safeFileNameGenerator, streamOptions);
            logStream.on('error', (err) => {
                // console.error('日志流错误:', err);
            });
            logStream.on('rotated', (filename) => {
                console.log('日志轮转完成:', filename);
            });

            _logger = pino({
                level: LOG_LEVEL,
                serializers: {
                    req: pino.stdSerializers.req,
                    res: pino.stdSerializers.res,
                },
                timestamp: customTimestamp,
            }, logStream);
            console.log('日志输出到文件');
        } catch (error) {
            console.error('[FastLogger] Failed to initialize file logger, falling back to console:', error);
            _logger = pino({
                level: LOG_LEVEL,
                timestamp: customTimestamp,
            });
        }
    } else {
        _logger = pino({
            level: LOG_LEVEL,
            serializers: {
                req: pino.stdSerializers.req,
                res: pino.stdSerializers.res,
            },
            timestamp: customTimestamp,
        });
        console.log('日志输出到控制台');
    }

    const _fastify = Fastify({
        logger: _logger,
    });

    const _wsApp = Fastify({
        logger: _logger,
    });

    // 添加CORS支持的钩子
    [_fastify, _wsApp].forEach(server => {
        server.addHook('onRequest', async (request, reply) => {
            reply.header('Access-Control-Allow-Origin', '*');
            reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
            reply.header('Access-Control-Allow-Credentials', 'true');

            if (request.method === 'OPTIONS') {
                reply.status(200).send();
                return;
            }
        });
    });

    const instances = {
        fastify: _fastify,
        wsApp: _wsApp,
        logger: _logger,
        logStream
    };

    globalThis[FASTIFY_INSTANCE_KEY] = instances;
    return instances;
}

const {fastify: fastifyInstance, wsApp: wsAppInstance} = initializeFastify();

export const fastify = fastifyInstance;
export const wsApp = wsAppInstance;

/**
 * 关闭并 flush 日志文件流 (L19)
 * 历史上进程退出链从不 end() rotating-file-stream，
 * pm2 高频重启时可能丢失尾部日志或截断轮转边界。
 */
export function closeLogStream() {
    const stream = globalThis[FASTIFY_INSTANCE_KEY]?.logStream;
    if (stream && typeof stream.end === 'function') {
        try {
            stream.end();
        } catch {
            // 流已关闭时忽略
        }
    }
}

// 安全的轮转测试端点
// if (LOG_WITH_FILE && logStream) {
//     fastify.get('/test-rotate', async (request, reply) => {
//         try {
//             // 确保日志流可用
//             if (!logStream || typeof logStream.write !== 'function') {
//                 throw new Error('日志流不可用');
//             }
//
//             // 写入轮转前的日志
//             const preRotateLog = '--- 手动触发轮转前的测试日志 ---\n';
//             await new Promise((resolve, reject) => {
//                 logStream.write(preRotateLog, 'utf8', (err) => {
//                     if (err) reject(err);
//                     else resolve();
//                 });
//             });
//
//             // 确保写入完成
//             await new Promise(resolve => setTimeout(resolve, 100));
//
//             // 触发轮转
//             logStream.rotate();
//
//             // 等待轮转完成
//             await new Promise((resolve) => {
//                 logStream.once('rotated', resolve);
//             });
//
//             // 确保日志流在轮转后仍然可用
//             if (!logStream || typeof logStream.write !== 'function') {
//                 throw new Error('轮转后日志流不可用');
//             }
//
//             // 写入轮转后的日志
//             const postRotateLog = '--- 手动触发轮转后的测试日志 ---\n';
//             await new Promise((resolve, reject) => {
//                 logStream.write(postRotateLog, 'utf8', (err) => {
//                     if (err) reject(err);
//                     else resolve();
//                 });
//             });
//
//             reply.send({
//                 status: 'success',
//                 message: '日志轮转已手动触发',
//                 logDirectory: path.resolve(logDirectory)
//             });
//         } catch (err) {
//             console.error('轮转过程中出错:', err);
//             reply.status(500).send({
//                 status: 'error',
//                 message: '轮转失败',
//                 error: err.message
//             });
//         }
//     });
//
//     console.log('测试端点已注册: GET /test-rotate');
// }