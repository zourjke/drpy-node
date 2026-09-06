import {log, logError} from '../utils/log.js';
import {readFileSync, existsSync, readdirSync, statSync, unlinkSync, mkdirSync, copyFileSync, lstatSync, writeFileSync} from 'fs';
import {createReadStream} from 'fs';
import {execSync} from 'child_process';
import path from 'path';
import {fileURLToPath} from 'url';
import {createHash} from 'crypto';
import {ENV} from '../utils/env.js';
import COOKIE from '../utils/cookieManager.js';
import {validateBasicAuth} from '../utils/api_validate.js';

const COOKIE_AUTH_CODE = process.env.COOKIE_AUTH_CODE || 'drpys';
const IS_VERCEL = process.env.VERCEL;
const DOWNLOAD_AUTH_SECRET = process.env.DOWNLOAD_AUTH_SECRET || 'drpys_download_secret';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRootDir = path.dirname(__dirname);
const pkg = JSON.parse(readFileSync(path.join(projectRootDir, 'package.json'), 'utf-8'));

const generateDownloadToken = (filename) => {
    const timestamp = Date.now();
    const data = `${filename}-${timestamp}-${DOWNLOAD_AUTH_SECRET}`;
    const token = createHash('md5').update(data).digest('hex');
    return `${token}-${timestamp}`;
};

const validateDownloadToken = (filename, token) => {
    if (!token) return false;
    const parts = token.split('-');
    if (parts.length < 2) return false;
    const timestamp = parseInt(parts.pop());
    const hash = parts.join('-');
    const data = `${filename}-${timestamp}-${DOWNLOAD_AUTH_SECRET}`;
    const expectedHash = createHash('md5').update(data).digest('hex');
    const now = Date.now();
    return hash === expectedHash && (now - timestamp) < 3600000;
};

const findLatestPackage = (projectDir, packageName) => {
    try {
        const parentDir = path.dirname(projectDir);
        const files = readdirSync(parentDir);

        const isGreen = packageName.includes('-green');
        const ext = packageName.split('.').pop();
        const baseName = packageName.replace(/-green\.[^.]+$/, '').replace(/\.[^.]+$/, '');
        const pattern = new RegExp(`^(?:${baseName.replace(/\./g, '\\.')}|drpy-node)-\\d{8}${isGreen ? '-green' : ''}\\.${ext}`);

        log(`查找包: ${packageName}, 正则: ${pattern.source}, 父目录: ${parentDir}`);
        log('目录中的文件:', files.filter(f => f.includes('drpy-node')));

        const packageFiles = files
            .filter(file => pattern.test(file))
            .map(file => {
                const filePath = path.join(parentDir, file);
                const stats = statSync(filePath);
                return {file, filePath, mtime: stats.mtime, size: stats.size};
            })
            .sort((a, b) => b.mtime - a.mtime);

        log('匹配到的文件:', packageFiles.map(f => f.file));
        return packageFiles.length > 0 ? packageFiles[0] : null;
    } catch (error) {
        logError('查找包失败:', error.message);
        return null;
    }
};

const buildPackage = (packageName) => {
    try {
        let command = 'node package.js';
        if (packageName.includes('-green')) {
            command += ' -g';
        }
        if (packageName.includes('.zip')) {
            command += ' -z';
        }

        log(`执行打包命令: ${command}, 目录: ${projectRootDir}`);
        const output = execSync(command, {cwd: projectRootDir, stdio: 'pipe'});
        log('打包输出:', output.toString());
        const result = findLatestPackage(projectRootDir, packageName);
        log('打包后查找结果:', result ? result.file : '未找到');
        return result;
    } catch (error) {
        logError('打包失败:', error.message);
        logError('错误详情:', error.stdout?.toString(), error.stderr?.toString());
        throw error;
    }
};

export default (fastify, options, done) => {
    fastify.get('/admin/encoder', async (request, reply) => {
        const encoderFilePath = path.join(options.appsDir, 'encoder/index.html'); // 获取 encoder.html 文件的路径

        // 检查文件是否存在
        if (!existsSync(encoderFilePath)) {
            return reply.status(404).send({error: 'encoder.html not found'});
        }

        try {
            // 读取 HTML 文件内容
            const htmlContent = readFileSync(encoderFilePath, 'utf-8');
            reply.type('text/html').send(htmlContent); // 返回 HTML 文件内容
        } catch (error) {
            fastify.log.error(`Failed to read encoder.html: ${error.message}`);
            return reply.status(500).send({error: 'Failed to load encoder page'});
        }
    });

    fastify.post('/admin/cookie-set', async (request, reply) => {
        try {
            // 从请求体中获取参数
            const {cookie_auth_code, key, value} = request.body;

            // 验证参数完整性
            if (!cookie_auth_code || !key || !value) {
                return reply.code(400).send({
                    success: false,
                    message: 'Missing required parameters: cookie_auth_code, key, or value',
                });
            }

            // 验证 cookie_auth_code 是否正确
            if (cookie_auth_code !== COOKIE_AUTH_CODE) {
                return reply.code(403).send({
                    success: false,
                    message: 'Invalid cookie_auth_code',
                });
            }

            let cookie_obj = COOKIE.parse(value);
            let cookie_str = value;

            if (['quark_cookie', 'uc_cookie'].includes(key)) {
                // log(cookie_obj);
                cookie_str = COOKIE.stringify({
                    __pus: cookie_obj.__pus || '',
                    __puus: cookie_obj.__puus || '',
                });
                log(cookie_str);
            }
            // 调用 ENV.set 设置环境变量
            ENV.set(key, cookie_str);

            // 返回成功响应
            return reply.code(200).send({
                success: true,
                message: 'Cookie value has been successfully set',
                data: {key, value},
            });
        } catch (error) {
            // 捕获异常并返回错误响应
            logError('Error setting cookie:', error.message);
            return reply.code(500).send({
                success: false,
                message: 'Internal server error',
            });
        }
    });

    fastify.get('/admin/download', {
        preHandler: validateBasicAuth
    }, async (request, reply) => {
        try {
            if (IS_VERCEL) {
                return reply.code(403).send({
                    success: false,
                    message: 'Vercel 环境不支持文件下载功能',
                });
            }

            const projectName = path.basename(projectRootDir);
            const templatePath = path.join(projectRootDir, 'public', 'download.html');

            if (!existsSync(templatePath)) {
                return reply.code(500).send({
                    success: false,
                    message: '下载页面模板不存在',
                });
            }

            let html = readFileSync(templatePath, 'utf-8');

            const files = [
                {name: `${projectName}.7z`, desc: '7z 压缩包（标准版）'},
                {name: `${projectName}.zip`, desc: 'ZIP 压缩包（标准版）'},
                {name: `${projectName}-green.7z`, desc: '7z 压缩包（绿色版，不含[密]文件）'},
                {name: `${projectName}-green.zip`, desc: 'ZIP 压缩包（绿色版，不含[密]文件）'}
            ];

            const formatFileSize = (bytes) => {
                if (!bytes || bytes === 0) return '未打包';
                const mb = bytes / (1024 * 1024);
                return mb.toFixed(2) + ' MB';
            };

            const downloadItems = files.map(file => {
                const latestPackage = findLatestPackage(projectRootDir, file.name);
                const fileSize = latestPackage ? formatFileSize(latestPackage.size) : '未打包';
                const sizeClass = latestPackage ? '' : ' not-packed';
                const token = generateDownloadToken(file.name);
                const downloadUrl = `/admin/download/${file.name}?auth=${token}`;
                
                let buildTime = '未打包';
                if (latestPackage && latestPackage.mtime) {
                    const date = new Date(latestPackage.mtime);
                    buildTime = date.toLocaleString('zh-CN', { hour12: false });
                }

                return '<div class="download-item">' +
                    '<div class="download-info">' +
                    '<div class="download-name">' + file.name + '</div>' +
                    '<div class="file-type">' + file.desc + '</div>' +
                    '<div class="build-info">版本: ' + pkg.version + ' | 打包时间: ' + buildTime + '</div>' +
                    '</div>' +
                    '<div class="download-size' + sizeClass + '">' + fileSize + '</div>' +
                    '<div class="download-actions">' +
                    '<a href="' + downloadUrl + '" class="download-btn">下载</a>' +
                    '<button class="copy-btn" onclick="copyLink(\'' + downloadUrl + '\')">复制链接</button>' +
                    '</div>' +
                    '</div>';
            }).join('');

            html = html.replace(/\{\{projectName\}\}/g, projectName);
            html = html.replace(/\{\{downloadItems\}\}/g, downloadItems);

            reply.type('text/html').send(html);
        } catch (error) {
            logError('获取下载页面失败:', error.message);
            return reply.code(500).send({
                success: false,
                message: '获取下载页面失败',
                error: error.message,
            });
        }
    });

    fastify.get('/admin/download/:filename', {
        preHandler: async (request, reply) => {
            const {auth} = request.query;
            if (validateDownloadToken(request.params.filename, auth)) {
                return;
            }
            const authHeader = request.headers.authorization;
            if (!authHeader) {
                reply.header('WWW-Authenticate', 'Basic');
                return reply.code(401).send('Authentication required');
            }
            const base64Credentials = authHeader.split(' ')[1];
            const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
            const [username, password] = credentials.split(':');
            const validUsername = process.env.API_AUTH_NAME || '';
            const validPassword = process.env.API_AUTH_CODE || '';
            if (username === validUsername && password === validPassword) {
                return;
            }
            reply.header('WWW-Authenticate', 'Basic');
            return reply.code(401).send('Invalid credentials');
        }
    }, async (request, reply) => {
        try {
            if (IS_VERCEL) {
                return reply.code(403).send({
                    success: false,
                    message: 'Vercel 环境不支持文件下载功能',
                });
            }

            const {filename} = request.params;
            const projectName = path.basename(projectRootDir);

            const validFilenames = [
                `${projectName}.7z`,
                `${projectName}.zip`,
                `${projectName}-green.7z`,
                `${projectName}-green.zip`
            ];

            if (!validFilenames.includes(filename)) {
                return reply.code(400).send({
                    success: false,
                    message: '无效的文件名',
                });
            }

            let latestPackage = findLatestPackage(projectRootDir, filename);

            if (!latestPackage) {
                log(`未找到 ${filename}，开始打包...`);
                latestPackage = buildPackage(filename);
                if (!latestPackage) {
                    return reply.code(500).send({
                        success: false,
                        message: '打包失败，无法创建压缩文件',
                    });
                }
            }

            const fileStream = createReadStream(latestPackage.filePath);
            const contentType = filename.endsWith('.zip') ? 'application/zip' : 'application/x-7z-compressed';
            reply.header('Content-Type', contentType);
            reply.header('Content-Disposition', `attachment; filename="${encodeURIComponent(latestPackage.file)}"`);
            return reply.send(fileStream);
        } catch (error) {
            logError('下载文件失败:', error.message);
            return reply.code(500).send({
                success: false,
                message: '下载失败',
                error: error.message,
            });
        }
    });

    fastify.post('/admin/download/clear', {
        preHandler: validateBasicAuth
    }, async (request, reply) => {
        try {
            if (IS_VERCEL) {
                return reply.code(403).send({
                    success: false,
                    message: 'Vercel 环境不支持文件操作',
                });
            }

            const parentDir = path.dirname(projectRootDir);
            const projectName = path.basename(projectRootDir);
            const files = readdirSync(parentDir);
            const pattern = new RegExp(`^${projectName.replace(/\./g, '\\.')}-\\d{8}(-green)?\\.(7z|zip)$`);

            let deletedCount = 0;
            const deletedFiles = [];

            for (const file of files) {
                if (pattern.test(file)) {
                    const filePath = path.join(parentDir, file);
                    try {
                        unlinkSync(filePath);
                        deletedFiles.push(file);
                        deletedCount++;
                    } catch (error) {
                        logError(`删除文件失败: ${file}`, error.message);
                    }
                }
            }

            return reply.send({
                success: true,
                count: deletedCount,
                deletedFiles,
                message: `已清除 ${deletedCount} 个历史文件`
            });
        } catch (error) {
            logError('清除历史文件失败:', error.message);
            return reply.code(500).send({
                success: false,
                message: '清除历史文件失败',
                error: error.message,
            });
        }
    });

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
        if (!existsSync(infoPath)) {
            return null;
        }
        try {
            const content = readFileSync(infoPath, 'utf-8');
            return JSON.parse(content);
        } catch (e) {
            return null;
        }
    };

    const saveBackinfo = (backupDir, data) => {
        const infoPath = getBackinfoPath(backupDir);
        writeFileSync(infoPath, JSON.stringify(data, null, 2), 'utf-8');
    };

    const getEffectiveBackupPaths = (backupDir) => {
        const info = loadBackinfo(backupDir);
        if (info && Array.isArray(info.paths) && info.paths.length > 0) {
            return {paths: info.paths, info};
        }
        return {paths: BACKUP_PATHS, info};
    };

    const copyRecursiveSync = (src, dest) => {
        const stats = lstatSync(src);
        if (stats.isDirectory()) {
            if (!existsSync(dest)) {
                mkdirSync(dest, { recursive: true });
            }
            readdirSync(src).forEach((childItemName) => {
                copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
            });
        } else {
            const destDir = path.dirname(dest);
            if (!existsSync(destDir)) {
                mkdirSync(destDir, { recursive: true });
            }
            copyFileSync(src, dest);
        }
    };

    fastify.get('/admin/backup/config', {
        preHandler: validateBasicAuth
    }, async (request, reply) => {
        const backupDir = getBackupRootDir();
        let paths;
        let lastBackupAt = null;
        let lastRestoreAt = null;
        if (!existsSync(backupDir)) {
            paths = BACKUP_PATHS;
        } else {
            const result = getEffectiveBackupPaths(backupDir);
            paths = result.paths;
            if (result.info) {
                lastBackupAt = result.info.lastBackupAt || null;
                lastRestoreAt = result.info.lastRestoreAt || null;
            }
        }
        return reply.send({success: true, paths, lastBackupAt, lastRestoreAt});
    });

    fastify.post('/admin/backup', {
        preHandler: validateBasicAuth
    }, async (request, reply) => {
        if (IS_VERCEL) {
            return reply.code(403).send({ success: false, message: 'Vercel环境不支持备份' });
        }
        try {
            const backupDir = getBackupRootDir();
            if (!existsSync(backupDir)) {
                mkdirSync(backupDir, { recursive: true });
            }

            const {paths, info} = getEffectiveBackupPaths(backupDir);
            const details = [];
            for (const item of paths) {
                const srcPath = path.join(projectRootDir, item);
                const destPath = path.join(backupDir, item);
                
                if (existsSync(srcPath)) {
                    copyRecursiveSync(srcPath, destPath);
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

            return reply.send({ success: true, message: '备份完成', backupDir, details });
        } catch (error) {
            fastify.log.error(`Backup failed: ${error.message}`);
            return reply.code(500).send({ success: false, message: '备份失败: ' + error.message });
        }
    });

    fastify.post('/admin/restore', {
        preHandler: validateBasicAuth
    }, async (request, reply) => {
        if (IS_VERCEL) {
            return reply.code(403).send({ success: false, message: 'Vercel环境不支持恢复' });
        }
        try {
            const backupDir = getBackupRootDir();
            if (!existsSync(backupDir)) {
                return reply.code(404).send({ success: false, message: '备份目录不存在' });
            }

            const {paths, info} = getEffectiveBackupPaths(backupDir);
            const details = [];
            for (const item of paths) {
                const srcPath = path.join(backupDir, item);
                const destPath = path.join(projectRootDir, item);
                
                if (existsSync(srcPath)) {
                    copyRecursiveSync(srcPath, destPath);
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

            return reply.send({ success: true, message: '恢复完成', backupDir, details });
        } catch (error) {
            fastify.log.error(`Restore failed: ${error.message}`);
            return reply.code(500).send({ success: false, message: '恢复失败: ' + error.message });
        }
    });

    done();
};
