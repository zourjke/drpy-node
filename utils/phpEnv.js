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
        console.warn(`⚠️ PHP binary not found or invalid: ${phpPath}`);
        isPhpAvailable = false;
        phpVersion = '';
        return false;
    }
    phpPath = validPath;

    try {
        console.log(`[phpEnv] Verifying PHP executable: ${phpPath}`);
        const { stdout } = await execFileAsync(phpPath, ['-v']);
        const match = stdout.match(/PHP\s+([0-9.]+)/i);
        phpVersion = match ? match[1] : 'ON';
        isPhpAvailable = true;
        console.log(`✅ PHP environment check passed (${phpPath}, v${phpVersion}).`);
    } catch (e) {
        isPhpAvailable = false;
        phpVersion = '';
        console.warn(`⚠️ PHP environment check failed. PHP features will be disabled.`);
        console.warn(`[phpEnv] Error details:`, e.message);
        // console.error(e);
    }
    return isPhpAvailable;
};
