import {log, logError, logWarn} from './log.js';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { prepareBinary } from './binHelper.js';

const execFileAsync = promisify(execFile);

export let isPhpAvailable = false;
export let phpVersion = '';

export const checkPhpAvailable = async () => {
    let phpPath = process.env.PHP_PATH || 'php';
    
    // Check existence and permissions
    const validPath = prepareBinary(phpPath);
    if (!validPath) {
        logWarn(`⚠️ PHP binary not found or invalid: ${phpPath}`);
        isPhpAvailable = false;
        phpVersion = '';
        return false;
    }
    phpPath = validPath;

    try {
        log(`[phpEnv] Verifying PHP executable: ${phpPath}`);
        const { stdout } = await execFileAsync(phpPath, ['-v']);
        const match = stdout.match(/PHP\s+([0-9.]+)/i);
        phpVersion = match ? match[1] : 'ON';
        isPhpAvailable = true;
        log(`✅ PHP environment check passed (${phpPath}, v${phpVersion}).`);
    } catch (e) {
        isPhpAvailable = false;
        phpVersion = '';
        logWarn(`⚠️ PHP environment check failed. PHP features will be disabled.`);
        logWarn(`[phpEnv] Error details:`, e.message);
        // logError(e);
    }
    return isPhpAvailable;
};
