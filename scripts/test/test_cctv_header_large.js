
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import FileHeaderManager from '../../utils/fileHeaderManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceFile = path.resolve(__dirname, '../../spider/js/央视大全[官].js');
const testFile = path.resolve(__dirname, 'test_cctv_header_large_temp.js');

// 模拟 Buffer 模式的 Header 移除
async function removeHeaderBuffer(filePath) {
    const handle = await fs.open(filePath, 'r');
    try {
        const stats = await handle.stat();
        const buffer = Buffer.alloc(stats.size);
        await handle.read(buffer, 0, stats.size, 0);
        
        // 查找注释块
        // /* = 0x2f 0x2a
        // */ = 0x2a 0x2f
        const start = buffer.indexOf('/*');
        if (start === -1) return;
        
        const end = buffer.indexOf('*/', start);
        if (end === -1) return;
        
        // 提取注释内容进行检查
        const commentBuf = buffer.subarray(start, end + 2);
        const commentStr = commentBuf.toString('utf8');
        
        if (!commentStr.includes('@header(')) return;
        
        // 查找 @header
        const headerStart = commentStr.indexOf('@header(');
        // 这里简化处理：假设我们要移除整个 @header(...) 
        // 实际需要括号平衡逻辑，这里简单起见，假设只有一层括号或用 regex
        // 为了公平对比，我们只测试 "读取 Buffer -> 查找位置 -> 拼接 Buffer -> 写入" 的过程
        
        // 模拟：我们找到了 header 的 start 和 end
        // 实际逻辑应该复用 FileHeaderManager.findHeaderBlock
        // 但 findHeaderBlock 操作的是 string。
        
        // 关键在于：是否可以只把 commentBlock 转 string，找到 offset，
        // 然后在原始 Buffer 上进行 slice 和 concat？
        
        // 假设 headerStartOffset 和 headerEndOffset 是相对于 buffer 的
        const headerGlobalStart = start + headerStart;
        // 简单模拟 header 长度为 100 字节
        const headerGlobalEnd = headerGlobalStart + 100; 
        
        const newBuf = Buffer.concat([
            buffer.subarray(0, headerGlobalStart),
            buffer.subarray(headerGlobalEnd)
        ]);
        
        await fs.writeFile(filePath, newBuf);
        
    } finally {
        await handle.close();
    }
}

async function runTest() {
    console.log('=== 开始大文件性能对比测试 ===');
    
    // 1. 创建大文件 (500KB)
    console.log('正在生成 500KB 测试文件...');
    let content = await fs.readFile(sourceFile, 'utf8');
    // 重复内容直到达到 500KB
    while (Buffer.byteLength(content) < 500 * 1024) {
        content += '\n// Padding content to increase file size...\n' + content;
    }
    // 确保头部有 @header
    if (!content.includes('@header(')) {
        console.warn('源文件没有 @header，测试可能无效');
    }
    
    await fs.writeFile(testFile, content);
    const stats = await fs.stat(testFile);
    console.log(`测试文件大小: ${(stats.size / 1024).toFixed(2)} KB`);

    const iterations = 100; // 大文件操作慢，减少次数
    
    // 2. 测试现有 String 模式 (FileHeaderManager.removeHeader)
    console.log(`\n[String Mode] removeHeader 测试 (${iterations} 次)...`);
    
    // 预热
    const header = await FileHeaderManager.readHeader(testFile);
    
    const startString = performance.now();
    for (let i = 0; i < iterations; i++) {
        // removeHeader 目前只返回字符串，不写入
        // 为了模拟真实场景，我们需要包含 fs.readFile 和 fs.writeFile
        // FileHeaderManager.removeHeader 内部如果不传 path 传 content，则不包含读。
        // 如果传 path，则包含读。
        // 但它不包含写。
        
        // 模拟完整流程：读 -> 处理 -> 写
        const newContent = await FileHeaderManager.removeHeader(testFile); // 包含 readFile
        await fs.writeFile(testFile, newContent);
        
        // 恢复文件头以便下一次循环 (为了测试 remove，必须先有)
        // 这步不计入时间？不，这很麻烦。
        // 我们可以测试 "读取 -> 替换(即使没找到也算处理) -> 写入" 的开销
        // 或者只测试 removeHeader 的处理部分。
        
        // 为了简单，我们测试 "Write Header" 吧，因为 writeHeader 包含 读 -> 改 -> 写
        await FileHeaderManager.writeHeader(testFile, header, { createBackup: false });
    }
    const endString = performance.now();
    const timeString = endString - startString;
    console.log(`String Mode 总耗时: ${timeString.toFixed(2)} ms`);
    console.log(`String Mode 平均耗时: ${(timeString / iterations).toFixed(2)} ms`);


    // 3. 测试模拟 Buffer 模式
    // 由于 FileHeaderManager 没有 Buffer 模式，我们只能模拟 "读 Buffer -> 改 Buffer -> 写 Buffer"
    // 对比 "读 String -> 改 String -> 写 String"
    
    console.log(`\n[Buffer Mode (Simulated)] writeHeader 测试 (${iterations} 次)...`);
    
    const startBuffer = performance.now();
    for (let i = 0; i < iterations; i++) {
        const handle = await fs.open(testFile, 'r');
        const bufStats = await handle.stat();
        const buffer = Buffer.alloc(bufStats.size);
        await handle.read(buffer, 0, bufStats.size, 0);
        await handle.close();
        
        // 模拟修改：在 Buffer 中找到 header 位置并替换
        // 实际算法：
        // 1. 找到 comment block (buffer.indexOf) -> 极快
        // 2. 将 comment block 转 string (很短) -> 极快
        // 3. 在 comment string 中找 header -> 极快
        // 4. 拼接 Buffer -> 极快 (不需要编解码大段代码)
        
        const startComment = buffer.indexOf('/*');
        const endComment = buffer.indexOf('*/', startComment);
        
        // 假设我们找到了 offset，进行拼接
        // 这里不做真实解析，只做 Buffer 操作模拟开销
        const newBuf = Buffer.concat([
            buffer.subarray(0, startComment),
            Buffer.from('/* Updated Header */'), // 模拟新头
            buffer.subarray(endComment + 2)
        ]);
        
        await fs.writeFile(testFile, newBuf);
        
        // 恢复 (其实上面已经写入了，不需要额外恢复，因为每次都覆盖)
    }
    const endBuffer = performance.now();
    const timeBuffer = endBuffer - startBuffer;
    console.log(`Buffer Mode 总耗时: ${timeBuffer.toFixed(2)} ms`);
    console.log(`Buffer Mode 平均耗时: ${(timeBuffer / iterations).toFixed(2)} ms`);
    
    const improvement = ((timeString - timeBuffer) / timeString * 100).toFixed(2);
    console.log(`\n🚀 预计 Buffer 模式提升: ${improvement}%`);
    
    // 清理
    await fs.unlink(testFile);
}

runTest();
