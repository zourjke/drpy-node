/**
 * WebSocket控制器模块
 * 提供WebSocket连接管理、实时日志广播和客户端通信功能
 * @module websocket-controller
 */

import {validateBasicAuth} from "../utils/api_validate.js";
import {toBeijingTime} from "../utils/datetime-format.js";

// WebSocket 客户端管理
const wsClients = new Set();

// 导出客户端管理函数
export function addClient(client) {
    wsClients.add(client);
}

export function removeClient(client) {
    wsClients.delete(client);
}

// 需要拦截的console方法列表
const CONSOLE_METHODS = [
    'log', 'error', 'warn', 'info', 'debug',
    'time', 'timeEnd', 'timeLog',
    'assert', 'clear', 'count', 'countReset',
    'dir', 'dirxml', 'group', 'groupCollapsed', 'groupEnd',
    'table', 'trace', 'profile', 'profileEnd'
];

// 原始 console 方法备份
const originalConsole = {};

// 动态备份所有console方法
CONSOLE_METHODS.forEach(method => {
    if (typeof console[method] === 'function') {
        originalConsole[method] = console[method];
    }
});

// 广播消息到所有 WebSocket 客户端
function broadcastToClients(message) {
    const deadClients = [];

    wsClients.forEach(client => {
        try {
            // 使用WebSocket的OPEN常量进行状态检查
            if (client.readyState === client.OPEN) {
                client.send(message);
            } else {
                deadClients.push(client);
            }
        } catch (error) {
            originalConsole.error('Error broadcasting to client:', error);
            deadClients.push(client);
        }
    });

    // 清理断开的连接
    deadClients.forEach(client => wsClients.delete(client));
}

// Console 拦截器
function interceptConsole() {
    const createInterceptor = (level, originalMethod) => {
        return function (...args) {
            // 调用原始方法
            originalMethod.apply(console, args);

            // 广播到所有 WebSocket 客户端
            if (wsClients.size > 0) {
                const message = {
                    type: 'console',
                    level: level,
                    timestamp: toBeijingTime(new Date()),
                    content: args.map(arg =>
                        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
                    ).join(' ')
                };

                broadcastToClients(JSON.stringify(message));
            }
        };
    };

    // 动态拦截所有console方法
    CONSOLE_METHODS.forEach(method => {
        if (originalConsole[method]) {
            console[method] = createInterceptor(method, originalConsole[method]);
        }
    });
}

// 恢复原始 console
function restoreConsole() {
    // 动态恢复所有console方法
    CONSOLE_METHODS.forEach(method => {
        if (originalConsole[method]) {
            console[method] = originalConsole[method];
        }
    });
}

// 启动 console 拦截
interceptConsole();

/**
 * WebSocket控制器插件
 * @param {Object} fastify - Fastify实例
 * @param {Object} options - 插件选项
 * @param {Function} done - 完成回调
 */
export default (fastify, options, done) => {
    /**
     * WebSocket连接路由
     * GET /ws - 建立WebSocket连接
     */
    fastify.get('/ws', {websocket: true}, (socket, req) => {
        const clientId = Date.now() + Math.random();
        originalConsole.log(`WebSocket client connected: ${clientId}`);
        originalConsole.log('Socket type:', typeof socket);
        originalConsole.log('Socket has send method:', typeof socket.send);

        // 添加到客户端集合
        wsClients.add(socket);

        // 设置连接属性
        socket.clientId = clientId;
        socket.isAlive = true;
        socket.lastPing = Date.now();

        // 发送欢迎消息 - 先检查send方法是否存在
        if (typeof socket.send === 'function') {
            socket.send(JSON.stringify({
                type: 'welcome',
                message: 'WebSocket connection established',
                clientId: clientId,
                timestamp: Date.now()
            }));
        } else {
            originalConsole.error('Socket does not have send method');
        }

        // 设置心跳检测
        const heartbeatInterval = setInterval(() => {
            if (!socket.isAlive) {
                originalConsole.log(`Client ${clientId} failed heartbeat, terminating`);
                clearInterval(heartbeatInterval);
                wsClients.delete(socket); // 修复内存泄露：从客户端集合中移除
                socket.terminate();
                return;
            }

            socket.isAlive = false;
            socket.ping();
        }, 30000); // 30秒心跳检测

        // 处理pong响应
        socket.on('pong', () => {
            socket.isAlive = true;
        });

        // 处理消息
        socket.on('message', (message) => {
            try {
                const data = JSON.parse(message.toString());
                if (data && data.type === 'heartbeat') {
                    originalConsole.debug(`Received from ${clientId}:`, data);
                } else {
                    originalConsole.log(`Received from ${clientId}:`, data);
                }

                // 回显消息
                if (socket.readyState === socket.OPEN) {
                    socket.send(JSON.stringify({
                        type: 'echo',
                        originalMessage: data,
                        timestamp: Date.now(),
                        clientId: clientId
                    }));
                }
            } catch (error) {
                originalConsole.error('Error processing message:', error);
                if (socket.readyState === socket.OPEN) {
                    socket.send(JSON.stringify({
                        type: 'error',
                        message: 'Invalid JSON format',
                        timestamp: Date.now()
                    }));
                }
            }
        });

        // 处理连接关闭
        socket.on('close', (code, reason) => {
            originalConsole.log(`Client ${clientId} disconnected: ${code} ${reason}`);
            wsClients.delete(socket);
            clearInterval(heartbeatInterval);
        });

        // 处理错误
        socket.on('error', (error) => {
            originalConsole.error(`WebSocket error for client ${clientId}:`, error);
            wsClients.delete(socket);
            clearInterval(heartbeatInterval);
        });
    });

    /**
     * WebSocket状态查询接口
     * GET /ws/status - 获取WebSocket服务状态
     */
    fastify.get('/ws/status', {preHandler: validateBasicAuth}, async (request, reply) => {
        return {
            status: 'ok',
            timestamp: toBeijingTime(new Date()),
            clients: wsClients.size,
            console_intercepted: true
        };
    });

    /**
     * 手动广播接口
     * POST /ws/broadcast - 向所有WebSocket客户端广播消息
     */
    fastify.post('/ws/broadcast', {preHandler: validateBasicAuth}, async (request, reply) => {
        const {message} = request.body;
        if (!message) {
            return reply.code(400).send({error: 'Message is required'});
        }

        const broadcastMessage = {
            type: 'broadcast',
            timestamp: toBeijingTime(new Date()),
            content: message
        };

        broadcastToClients(JSON.stringify(broadcastMessage));

        return {
            status: 'ok',
            timestamp: toBeijingTime(new Date()),
            message: 'Message broadcasted',
            clients: wsClients.size
        };
    });

    done();
};

// 导出工具函数供其他模块使用
export {wsClients, broadcastToClients, originalConsole, interceptConsole, restoreConsole};