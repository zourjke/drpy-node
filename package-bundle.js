import {execSync} from 'child_process';
import {existsSync, statSync} from 'fs';
import {join, basename, dirname, resolve} from 'path';
import url from 'url';

// 要打包的文件/目录列表 (相对于 drpy-node-bundle 目录)
const INCLUDE_ITEMS = [
    'libs',
    'spider',
    'jx',
    'localt5.js',
    'localDsCoreTest.js'
];

// 获取脚本所在目录 (e:\gitwork\drpy-node)
const getScriptDir = () => dirname(resolve(url.fileURLToPath(import.meta.url)));

// 压缩 drpy-node-bundle 目录
const compressBundle = (scriptDir) => {
    // drpy-node-bundle 目录路径
    const bundleDir = join(scriptDir, 'drpy-node-bundle');

    if (!existsSync(bundleDir)) {
        console.error(`错误: 目录 ${bundleDir} 不存在!`);
        return;
    }

    // 生成压缩包名称
    const currentDirName = basename(bundleDir); // drpy-node-bundle
    const currentTime = new Date().toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).replace(/\//g, '');

    const archiveName = `${currentDirName}-${currentTime}.7z`;

    // 输出路径 (与 drpy-node 的打包输出位置一致，即项目根目录的上一级)
    const parentDir = resolve(scriptDir, '..');
    const archivePath = join(parentDir, archiveName);

    // 构建包含参数
    const includeParams = [];
    for (const item of INCLUDE_ITEMS) {
        const itemPath = join(bundleDir, item);
        if (existsSync(itemPath)) {
            // 使用相对路径，以便在 cwd 切换后正确引用
            includeParams.push(`"${item}"`);
        } else {
            console.warn(`警告: ${item} 不存在于 ${bundleDir}，将被跳过。`);
        }
    }

    if (includeParams.length === 0) {
        console.error('错误: 没有找到需要打包的文件或目录!');
        return;
    }

    // 构建 7z 命令
    // 使用 cd 切换到 bundleDir 目录，这样打包的内容就是相对路径（不包含 drpy-node-bundle 目录本身）
    // 7z a "archivePath" item1 item2 ...
    const command = `7z a -t7z "${archivePath}" ${includeParams.join(' ')}`;

    console.log(`正在打包到: ${archivePath}`);
    console.log(`执行命令 (在 ${bundleDir} 下): ${command}`);

    try {
        // 在 bundleDir 目录下执行命令
        execSync(command, {
            stdio: 'inherit',
            cwd: bundleDir
        });
        console.log(`压缩完成: ${archivePath}`);
    } catch (error) {
        console.error(`压缩失败: ${error.message}`);
    }
};

// 主程序入口
const main = () => {
    const scriptDir = getScriptDir();
    compressBundle(scriptDir);
};

main();
