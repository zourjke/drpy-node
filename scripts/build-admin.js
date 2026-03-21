import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { PROJECT_ROOT } from '../utils/pathHelper.js';

console.log('🔨 开始构建 drpy-node-admin...');

// 1. 进入 admin 目录
process.chdir(path.join(PROJECT_ROOT, 'drpy-node-admin'));

// 2. 安装依赖（如果需要）
if (!fs.existsSync('node_modules')) {
    console.log('📦 安装依赖...');
    execSync('npm install', { stdio: 'inherit' });
}

// 3. 构建
console.log('🏗️  构建生产版本...');
execSync('npm run build:apps', { stdio: 'inherit' });

// 4. 验证构建结果
const adminDistPath = path.join(PROJECT_ROOT, 'apps/admin');
if (!fs.existsSync(adminDistPath)) {
    console.error('❌ 构建失败：未找到输出目录');
    process.exit(1);
}

const indexHtml = path.join(adminDistPath, 'index.html');
if (!fs.existsSync(indexHtml)) {
    console.error('❌ 构建失败：未找到 index.html');
    process.exit(1);
}

console.log('✅ 构建成功！');
console.log(`📂 输出目录: ${adminDistPath}`);
console.log('');
console.log('现在可以通过以下地址访问管理面板:');
console.log('  http://localhost:5757/apps/admin/');
