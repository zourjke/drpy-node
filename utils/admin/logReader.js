import fs from '../fsWrapper.js';
import path from 'path';
import { PROJECT_ROOT } from '../pathHelper.js';

export async function readLogLines(lines = 50) {
    const logDir = path.join(PROJECT_ROOT, 'logs');
    
    if (!await fs.pathExists(logDir)) {
        return { file: null, content: '日志目录不存在' };
    }

    const files = await fs.readdir(logDir);
    const logFiles = files
        .filter(f => f.endsWith('.log.txt'))
        .sort()
        .reverse();

    if (logFiles.length === 0) {
        return { file: null, content: '没有日志文件' };
    }

    const latestLog = path.join(logDir, logFiles[0]);
    const content = await fs.readFile(latestLog, 'utf-8');
    const allLines = content.trim().split('\n');
    const lastLines = allLines.slice(-lines);

    return { file: logFiles[0], content: lastLines.join('\n'), lastLines };
}
