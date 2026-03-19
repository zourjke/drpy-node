import path from 'path';
import fs from '../../utils/fsWrapper.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRootDir = path.resolve(__dirname, '../../');

const BACKUP_PATHS = [
    '.env',
    '.plugins.js',
    'config/env.json',
    'config/map.txt',
    'config/parses.conf',
    'config/player.json',
    'scripts/cron',
    'plugins'
];

const BACKINFO_FILENAME = '.backinfo';

const getBackupRootDir = () => {
    return path.join(path.dirname(projectRootDir), path.basename(projectRootDir) + '-backup');
};

const getBackinfoPath = (backupDir) => {
    return path.join(backupDir, BACKINFO_FILENAME);
};

const loadBackinfo = (backupDir) => {
    const infoPath = getBackinfoPath(backupDir);
    if (!fs.existsSync(infoPath)) {
        return null;
    }
    try {
        const content = fs.readFileSync(infoPath, 'utf-8');
        return JSON.parse(content);
    } catch (e) {
        return null;
    }
};

const saveBackinfo = (backupDir, data) => {
    const infoPath = getBackinfoPath(backupDir);
    fs.writeFileSync(infoPath, JSON.stringify(data, null, 2), 'utf-8');
};

const getEffectiveBackupPaths = (backupDir) => {
    const info = loadBackinfo(backupDir);
    if (info && Array.isArray(info.paths) && info.paths.length > 0) {
        return { paths: info.paths, info };
    }
    return { paths: BACKUP_PATHS, info };
};

export const getBackupConfig = async (request, reply) => {
    const backupDir = getBackupRootDir();
    let paths;
    let lastBackupAt = null;
    let lastRestoreAt = null;
    
    if (!fs.existsSync(backupDir)) {
        paths = BACKUP_PATHS;
    } else {
        const result = getEffectiveBackupPaths(backupDir);
        paths = result.paths;
        if (result.info) {
            lastBackupAt = result.info.lastBackupAt || null;
            lastRestoreAt = result.info.lastRestoreAt || null;
        }
    }
    return reply.send({ success: true, paths, lastBackupAt, lastRestoreAt });
};

export const updateBackupConfig = async (request, reply) => {
    try {
        const { paths } = request.body;
        if (!Array.isArray(paths)) {
            return reply.code(400).send({ success: false, message: 'paths must be an array' });
        }

        const backupDir = getBackupRootDir();
        await fs.ensureDir(backupDir);

        const info = loadBackinfo(backupDir) || {};
        const backinfoData = {
            ...info,
            paths
        };
        saveBackinfo(backupDir, backinfoData);

        return reply.send({ success: true, message: 'Backup configuration updated successfully', paths });
    } catch (error) {
        request.log.error(`Update backup config failed: ${error.message}`);
        return reply.code(500).send({ success: false, message: 'Update backup config failed: ' + error.message });
    }
};

export const resetBackupConfig = async (request, reply) => {
    try {
        const backupDir = getBackupRootDir();
        await fs.ensureDir(backupDir);

        const info = loadBackinfo(backupDir) || {};
        const backinfoData = {
            ...info,
            paths: BACKUP_PATHS
        };
        saveBackinfo(backupDir, backinfoData);

        return reply.send({ success: true, message: 'Backup configuration reset to defaults', paths: BACKUP_PATHS });
    } catch (error) {
        request.log.error(`Reset backup config failed: ${error.message}`);
        return reply.code(500).send({ success: false, message: 'Reset backup config failed: ' + error.message });
    }
};

export const createBackup = async (request, reply) => {
    if (process.env.VERCEL) {
        return reply.code(403).send({ success: false, message: 'Vercel environment does not support backup' });
    }
    try {
        const backupDir = getBackupRootDir();
        await fs.ensureDir(backupDir);

        const { paths, info } = getEffectiveBackupPaths(backupDir);
        const details = [];
        
        for (const item of paths) {
            const srcPath = path.join(projectRootDir, item);
            const destPath = path.join(backupDir, item);
            
            if (fs.existsSync(srcPath)) {
                await fs.copy(srcPath, destPath, { overwrite: true });
                details.push(`Backed up: ${item}`);
            } else {
                details.push(`Skipped (not found): ${item}`);
            }
        }

        const now = new Date().toISOString();
        const customPaths = info && Array.isArray(info.paths) && info.paths.length > 0 ? info.paths : [];
        const backinfoData = {
            paths: customPaths,
            lastBackupAt: now,
            lastRestoreAt: info && info.lastRestoreAt ? info.lastRestoreAt : null
        };
        saveBackinfo(backupDir, backinfoData);

        return reply.send({ success: true, message: 'Backup completed successfully', backupDir, details });
    } catch (error) {
        request.log.error(`Backup failed: ${error.message}`);
        return reply.code(500).send({ success: false, message: 'Backup failed: ' + error.message });
    }
};

export const restoreBackup = async (request, reply) => {
    if (process.env.VERCEL) {
        return reply.code(403).send({ success: false, message: 'Vercel environment does not support restore' });
    }
    try {
        const backupDir = getBackupRootDir();
        if (!fs.existsSync(backupDir)) {
            return reply.code(404).send({ success: false, message: 'Backup directory not found' });
        }

        const { paths, info } = getEffectiveBackupPaths(backupDir);
        const details = [];
        
        for (const item of paths) {
            const srcPath = path.join(backupDir, item);
            const destPath = path.join(projectRootDir, item);
            
            if (fs.existsSync(srcPath)) {
                await fs.copy(srcPath, destPath, { overwrite: true });
                details.push(`Restored: ${item}`);
            } else {
                details.push(`Skipped (not found in backup): ${item}`);
            }
        }

        const now = new Date().toISOString();
        const customPaths = info && Array.isArray(info.paths) && info.paths.length > 0 ? info.paths : [];
        const backinfoData = {
            paths: customPaths,
            lastBackupAt: info && info.lastBackupAt ? info.lastBackupAt : null,
            lastRestoreAt: now
        };
        saveBackinfo(backupDir, backinfoData);

        return reply.send({ success: true, message: 'Restore completed successfully', backupDir, details });
    } catch (error) {
        request.log.error(`Restore failed: ${error.message}`);
        return reply.code(500).send({ success: false, message: 'Restore failed: ' + error.message });
    }
};
