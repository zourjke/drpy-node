import os from 'os';
import { PROJECT_ROOT } from '../../utils/pathHelper.js';

let pty;
let isPtyAvailable = false;

try {
    pty = await import('node-pty');
    // For ES modules, the default export might be nested depending on how it's built,
    // but usually import() gives an object where the module exports are properties.
    if (pty.default) {
        pty = pty.default;
    }
    isPtyAvailable = true;
} catch (error) {
    console.warn('[Terminal] node-pty load failed, terminal feature will be disabled.', error.message);
    isPtyAvailable = false;
}

export const getTerminalStatus = (req, reply) => {
    // 检查环境变量是否启用了终端功能，默认不启用 (0 或 false)
    const isTerminalEnabled = process.env.ENABLE_TERMINAL === '1' || process.env.ENABLE_TERMINAL === 'true';
    const isReadOnly = process.env.READ_ONLY_MODE === '1';
    
    return reply.send({ 
        available: isPtyAvailable && isTerminalEnabled && !isReadOnly 
    });
};

export const handleTerminalWs = (socket, req) => {
    const isTerminalEnabled = process.env.ENABLE_TERMINAL === '1' || process.env.ENABLE_TERMINAL === 'true';

    if (process.env.READ_ONLY_MODE === '1') {
        socket.send('\r\n\x1b[31m[!] Terminal feature is disabled because the system is in READ_ONLY_MODE.\x1b[0m\r\n');
        socket.close();
        return;
    }

    if (!isTerminalEnabled) {
        socket.send('\r\n\x1b[31m[!] Terminal feature is disabled. Please set ENABLE_TERMINAL=1 in .env to enable it.\x1b[0m\r\n');
        socket.close();
        return;
    }

    if (!isPtyAvailable) {
        socket.send('\r\n\x1b[31m[!] Terminal feature is not available on this platform (node-pty failed to load).\x1b[0m\r\n');
        socket.close();
        return;
    }

    // Determine shell based on platform
    const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';

    // Spawn pty process
    const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-color',
        cols: 80,
        rows: 30,
        cwd: PROJECT_ROOT,
        env: process.env
    });

    // Handle data from pty
    ptyProcess.onData((data) => {
        if (socket.readyState === 1) { // OPEN
            socket.send(data);
        }
    });

    // Handle messages from client
    socket.on('message', (message) => {
        const msgStr = Buffer.isBuffer(message) ? message.toString('utf8') : message.toString();
        // Check for resize message
        try {
            if (msgStr.startsWith('{"type":"resize"')) {
                const data = JSON.parse(msgStr);
                if (data.type === 'resize' && data.cols && data.rows) {
                    ptyProcess.resize(data.cols, data.rows);
                    return;
                }
            }
        } catch (e) {
            // Ignore parse error
        }
        
        // Write to terminal
        ptyProcess.write(msgStr);
    });

    // Clean up when connection closes
    socket.on('close', () => {
        ptyProcess.kill();
    });
};
