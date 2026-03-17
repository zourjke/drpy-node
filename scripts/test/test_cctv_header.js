import fs from 'fs/promises';
import path from 'path';
import {fileURLToPath} from 'url';
import FileHeaderManager from '../../utils/fileHeaderManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 源文件路径
const sourceFile = path.resolve(__dirname, '../../spider/js/央视大全[官].js');
// 测试文件路径
const testFile = path.resolve(__dirname, 'test_cctv_header_temp.js');

async function runTest() {
    console.log('=== 开始测试文件头操作 ===');
    console.log(`源文件: ${sourceFile}`);
    console.log(`测试文件: ${testFile}`);

    try {
        // 1. 复制文件
        console.log('\n[1/6] 正在复制源文件到测试文件...');
        try {
            await fs.copyFile(sourceFile, testFile);
            console.log('✅ 复制完成。');
        } catch (e) {
            console.error('❌ 复制失败:', e.message);
            return;
        }

        // 2. 读取文件头
        console.log('\n[2/6] 正在读取文件头...');
        const startTime = performance.now();
        let header = await FileHeaderManager.readHeader(testFile);
        const endTime = performance.now();
        const duration = endTime - startTime;
        console.log(`⏱️ 读取耗时: ${duration.toFixed(4)} ms`);

        if (header) {
            console.log('✅ 读取到的文件头:', JSON.stringify(header, null, 2));
        } else {
            console.log('⚠️ 未找到文件头，将尝试创建新文件头。');
            header = {};
        }

        // 3. 修改文件头
        console.log('\n[3/6] 正在修改并写入文件头...');
        const timestamp = Date.now();
        const originalTitle = header.title || 'Unknown';
        header.title = `${originalTitle}_TEST_${timestamp}`;
        header.test_timestamp = timestamp;

        try {
            await FileHeaderManager.writeHeader(testFile, header);
            console.log('✅ 写入操作完成。');
        } catch (e) {
            console.error('❌ 写入失败:', e.message);
            throw e;
        }

        // 4. 再次读取验证
        console.log('\n[4/6] 再次读取以验证写入...');
        const newHeader = await FileHeaderManager.readHeader(testFile);
        console.log('读取到的新文件头:', JSON.stringify(newHeader, null, 2));

        if (newHeader && newHeader.test_timestamp === timestamp) {
            console.log('✅ 验证成功：新字段已存在且值正确。');
        } else {
            console.error('❌ 验证失败：新字段未找到或值不匹配。');
            throw new Error('Verification failed');
        }

        // 5. 移除文件头
        console.log('\n[5/6] 正在移除文件头...');
        // 注意：removeHeader 返回处理后的内容字符串，不自动写入文件
        const contentWithoutHeader = await FileHeaderManager.removeHeader(testFile);

        // 我们需要手动写入文件以验证
        await fs.writeFile(testFile, contentWithoutHeader);
        console.log('✅ 移除操作完成，已写回文件。');

        // 6. 验证移除结果
        console.log('\n[6/6] 验证移除结果...');
        const headerAfterRemove = await FileHeaderManager.readHeader(testFile);
        if (!headerAfterRemove || Object.keys(headerAfterRemove).length === 0) {
            console.log('✅ 验证成功：文件头已移除。');
        } else {
            console.log('❌ 验证失败：文件头仍然存在:', headerAfterRemove);
            throw new Error('Removal verification failed');
        }

        // 7. 性能测试 (循环 10000 次)
        const iterations = 10000;
        console.log(`\n[7/10] 性能基准测试 (读取 ${iterations} 次取平均)...`);
        // 确保文件有头
        await fs.copyFile(sourceFile, testFile);
        
        const perfStart = performance.now();
        for(let i=0; i<iterations; i++) {
            await FileHeaderManager.readHeader(testFile);
        }
        const perfEnd = performance.now();
        const totalTime = perfEnd - perfStart;
        const avgTime = totalTime / iterations;
        console.log(`总耗时: ${totalTime.toFixed(2)} ms`);
        console.log(`平均每次读取耗时: ${avgTime.toFixed(4)} ms`);
        console.log('✅ 性能测试完成。');

        // 8. (已移除优化对比，直接全量读取更快)
        console.log('\n[8/10] 跳过 Partial Read 性能测试 (全量读取更快)...');

        // 9. 写文件头性能测试
        console.log(`\n[9/10] 写文件头性能测试 (循环 ${iterations} 次)...`);
        // 注意：写文件涉及磁盘IO，次数不宜过多，且每次都会修改文件
        // 预热：确保 header 对象存在
        const headerForWrite = await FileHeaderManager.readHeader(testFile) || {};
        headerForWrite.perf_test = true;
        
        const perfStartWrite = performance.now();
        for(let i=0; i<iterations; i++) {
            headerForWrite.perf_counter = i;
            // 禁用备份以测试纯粹的写入性能，避免大量备份文件
            await FileHeaderManager.writeHeader(testFile, headerForWrite, { createBackup: false });
        }
        const perfEndWrite = performance.now();
        const totalTimeWrite = perfEndWrite - perfStartWrite;
        const avgTimeWrite = totalTimeWrite / iterations;
        console.log(`总耗时 (Write ${iterations}次): ${totalTimeWrite.toFixed(2)} ms`);
        console.log(`平均每次写入耗时: ${avgTimeWrite.toFixed(4)} ms`);
        
        // 验证 Buffer 模式是否生效 (检查耗时是否显著低于 String 模式)
        // 理论上 Buffer 模式会快很多
        if (avgTimeWrite < 1.0) {
             console.log('✅ 写入性能极佳，推测已启用 Buffer 优化。');
        }

        // 10. 移除文件头性能测试
        console.log(`\n[10/10] 移除文件头性能测试 (循环 ${iterations} 次)...`);
        // 注意：removeHeader 主要是内存操作（如果传入的是内容），或者 读+内存操作（如果传入的是路径）
        // 这里测试传入路径的情况，包含读取文件
        
        // 先确保文件有头
        await FileHeaderManager.writeHeader(testFile, headerForWrite, { createBackup: false });
        
        const perfStartRemove = performance.now();
        for(let i=0; i<iterations; i++) {
            // 每次循环前需要重置文件状态吗？
            // removeHeader 返回的是字符串，不写回文件。所以这里测试的是 "读取+正则处理" 的性能。
            // 这是一个纯计算 + 读取的测试，不会修改磁盘文件。
            await FileHeaderManager.removeHeader(testFile);
        }
        const perfEndRemove = performance.now();
        const totalTimeRemove = perfEndRemove - perfStartRemove;
        const avgTimeRemove = totalTimeRemove / iterations;
        console.log(`总耗时 (Remove ${iterations}次): ${totalTimeRemove.toFixed(2)} ms`);
        console.log(`平均每次移除耗时 (计算): ${avgTimeRemove.toFixed(4)} ms`);


        console.log('\n=== 测试全部通过 ===');

    } catch (error) {
        console.error('\n❌ 测试过程中发生错误:', error);
    } finally {
        // 8. 清理
        console.log('\n[8/8] 清理测试文件...');

        try {
            await fs.unlink(testFile);
            console.log('✅ 测试文件已删除。');
        } catch (e) {
            console.error('⚠️ 删除测试文件失败 (可能文件不存在):', e.message);
        }
    }
}

runTest();
