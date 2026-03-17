import {execSync} from 'child_process';
import {existsSync, statSync, readdirSync, copyFileSync, mkdirSync} from 'fs';
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

// 需要额外复制的特定文件列表 (文件名，相对于 spider/js)
const EXTRA_FILES = [
    '30wMV[听].js',
    '爱推图[画].js',
    '央视大全[官].js',
    '设置中心.js',
    '听友[听].js',
];

// 获取脚本所在目录 (e:\gitwork\drpy-node)
const getScriptDir = () => dirname(resolve(url.fileURLToPath(import.meta.url)));

// 复制 _lib 开头的文件及额外指定的文件到 bundle 目录
const copyFiles = (scriptDir) => {
    const sourceDir = join(scriptDir, 'spider', 'js');
    const targetDir = join(scriptDir, 'drpy-node-bundle', 'spider', 'js');

    if (!existsSync(sourceDir)) {
        console.warn(`警告: 源目录 ${sourceDir} 不存在，跳过复制文件。`);
        return;
    }

    if (!existsSync(targetDir)) {
        console.log(`创建目标目录: ${targetDir}`);
        mkdirSync(targetDir, {recursive: true});
    }

    console.log(`正在从 ${sourceDir} 复制文件到 ${targetDir}...`);

    try {
        const files = readdirSync(sourceDir);
        let libCount = 0;
        let extraCount = 0;
        
        for (const file of files) {
            let shouldCopy = false;
            
            // 检查是否是 _lib 文件
            if (file.startsWith('_lib') && (file.endsWith('.js') || file.endsWith('.cjs'))) {
                shouldCopy = true;
                libCount++;
            } 
            // 检查是否在额外文件列表中
            else if (EXTRA_FILES.includes(file)) {
                shouldCopy = true;
                extraCount++;
            }

            if (shouldCopy) {
                const srcPath = join(sourceDir, file);
                const destPath = join(targetDir, file);
                copyFileSync(srcPath, destPath);
                // console.log(`已复制: ${file}`);
            }
        }
        console.log(`成功复制了 ${libCount} 个 lib 文件和 ${extraCount} 个额外文件。`);
    } catch (error) {
        console.error(`复制文件失败: ${error.message}`);
    }
};

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
    copyFiles(scriptDir);
    compressBundle(scriptDir);
};

main();
