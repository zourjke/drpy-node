/**
 * 日志管理控制器
 * 提供日志读取
 */

import fs from '../../utils/fsWrapper.js';
import path from 'path';
import { PROJECT_ROOT } from '../../utils/pathHelper.js';

// 读取日志
export async function getLogs(req, reply) {
    try {
        const lines = parseInt(req.query.lines) || 50;
        const logDir = path.join(PROJECT_ROOT, 'logs');

        if (!await fs.pathExists(logDir)) {
            return reply.send({
                file: null,
                content: '日志目录不存在'
            });
        }

        const files = await fs.readdir(logDir);
        const logFiles = files
            .filter(f => f.endsWith('.log.txt'))
            .sort()
            .reverse();

        if (logFiles.length === 0) {
            return reply.send({
                file: null,
                content: '没有日志文件'
            });
        }

        const latestLog = path.join(logDir, logFiles[0]);
        const content = await fs.readFile(latestLog, 'utf-8');
        const allLines = content.trim().split('\n');
        const lastLines = allLines.slice(-lines);

        return reply.send({
            file: logFiles[0],
            content: lastLines.join('\n')
        });
    } catch (e) {
        reply.code(500).send({
            error: e.message
        });
    }
}



async function streamLogs(socket, lines) {
    try {
        const logDir = path.join(PROJECT_ROOT, 'logs');
        const files = await fs.readdir(logDir);
        const logFiles = files
            .filter(f => f.endsWith('.log.txt'))
            .sort()
            .reverse();

        if (logFiles.length === 0) {
            socket.send(JSON.stringify({
                type: 'error',
                message: '没有日志文件'
            }));
            return;
        }

        const latestLog = path.join(logDir, logFiles[0]);
        const content = await fs.readFile(latestLog, 'utf-8');
        const allLines = content.trim().split('\n');
        const lastLines = allLines.slice(-lines);

        // 发送现有日志
        for (const line of lastLines) {
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({
                    type: 'log',
                    timestamp: Date.now(),
                    content: line
                }));
            }
        }

        socket.send(JSON.stringify({
            type: 'end',
            message: `已读取 ${lastLines.length} 行日志`
        }));
    } catch (e) {
        socket.send(JSON.stringify({
            type: 'error',
            message: e.message
        }));
    }
}
