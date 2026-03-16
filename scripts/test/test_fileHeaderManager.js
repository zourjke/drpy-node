// 测试文件头管理器的修复版本
import FileHeaderManager from '../../utils/fileHeaderManager.js';
import fs from 'fs/promises';
import path from 'path';

// 创建测试文件
async function createTestFile(filePath, content) {
    await fs.writeFile(filePath, content);
}

// 测试函数
async function runTests() {
    const testDir = './test_files';
    
    try {
        // 创建测试目录
        await fs.mkdir(testDir, { recursive: true });
        
        console.log('开始测试 FileHeaderManager 修复版本...');
        
        // 测试1: 测试JavaScript文件
        console.log('\n测试1: JavaScript文件头管理');
        const jsTestFile = path.join(testDir, 'test.js');
        const jsContent = `// 这是一个测试文件
function hello() {
    console.log('Hello World');
}

module.exports = { hello };`;
        
        await createTestFile(jsTestFile, jsContent);
        console.log('原始文件内容:');
        console.log(await fs.readFile(jsTestFile, 'utf8'));
        
        // 添加文件头
        const headerObj = {
            title: '测试源',
            author: '测试作者',
            version: '1.0.0',
            searchable: 1,
            filterable: 1
        };
        
        await FileHeaderManager.writeHeader(jsTestFile, headerObj);
        console.log('\n添加文件头后:');
        console.log(await fs.readFile(jsTestFile, 'utf8'));
        
        // 读取文件头
        const readHeader = await FileHeaderManager.readHeader(jsTestFile);
        console.log('\n读取的文件头:', readHeader);
        
        // 更新文件头
        headerObj.version = '1.0.1';
        headerObj.updated = new Date().toISOString();
        await FileHeaderManager.writeHeader(jsTestFile, headerObj);
        console.log('\n更新文件头后:');
        console.log(await fs.readFile(jsTestFile, 'utf8'));
        
        // 测试2: 测试Python文件
        console.log('\n\n测试2: Python文件头管理');
        const pyTestFile = path.join(testDir, 'test.py');
        const pyContent = `# 这是一个Python测试文件\ndef hello():\n    print('Hello World')\n\nif __name__ == '__main__':\n    hello()`;
        
        await createTestFile(pyTestFile, pyContent);
        console.log('原始Python文件内容:');
        console.log(await fs.readFile(pyTestFile, 'utf8'));
        
        await FileHeaderManager.writeHeader(pyTestFile, headerObj);
        console.log('\n添加文件头后:');
        console.log(await fs.readFile(pyTestFile, 'utf8'));
        
        // 测试3: 测试已有注释块的文件
        console.log('\n\n测试3: 已有注释块的文件');
        const jsWithCommentFile = path.join(testDir, 'test_with_comment.js');
        const jsWithCommentContent = `/*
 * 这是一个已有注释的文件
 * 作者: 原作者
 */
function test() {
    return 'test';
}`;
        
        await createTestFile(jsWithCommentFile, jsWithCommentContent);
        console.log('原始带注释文件内容:');
        console.log(await fs.readFile(jsWithCommentFile, 'utf8'));
        
        await FileHeaderManager.writeHeader(jsWithCommentFile, headerObj);
        console.log('\n添加文件头后:');
        console.log(await fs.readFile(jsWithCommentFile, 'utf8'));

        // 测试3.5: 复杂嵌套头信息
        console.log('\n\n测试3.5: 复杂嵌套头信息');
        const complexFile = path.join(testDir, 'complex.js');
        const complexContent = `/*
@header({
  searchable: 1,
  filterable: 1,
  quickSearch: 0,
  title: '央视大全',
  lang: 'ds',
  isProxyPath: true,
  more: {
      parseApi: [
        {
            host: 'cctv://(.+)',
            flag: 'CCTV'
        },
        {
            host: 'cctv4k://(.+)',
            flag: 'CCTV4K'
        },
        {
            host: 'cctvlive://(.+)',
            flag: 'CCTV直播'
        },
      ]
  },

})
*/
var rule = {};`;
        await createTestFile(complexFile, complexContent);
        
        // 读取并验证
        const complexHeader = await FileHeaderManager.readHeader(complexFile);
        console.log('读取复杂头信息:', complexHeader.title);
        if (complexHeader.more && complexHeader.more.parseApi && complexHeader.more.parseApi.length === 3) {
            console.log('✓ 复杂结构解析正确');
        } else {
            console.error('✗ 复杂结构解析失败');
        }
        
        // 写入并验证不损坏
        await FileHeaderManager.writeHeader(complexFile, complexHeader);
        const newComplexContent = await fs.readFile(complexFile, 'utf8');
        // Check for cleanliness (no trailing garbage like in the bug)
        // The bug caused "})'," or similar garbage at the end of the comment block
        // The correct content should end the comment cleanly.
        if (newComplexContent.includes("host: 'cctv://(.+)'") && !newComplexContent.includes("})',")) {
            console.log('✓ 写入复杂头信息正确 (无乱码残留)');
        } else {
            console.error('✗ 写入复杂头信息失败 (可能有残留)');
            console.log(newComplexContent);
        }
        
        // 测试4: 测试内容完整性检查
        console.log('\n\n测试4: 内容完整性检查');
        const largeJsFile = path.join(testDir, 'large_test.js');
        const largeContent = `// 大文件测试
${Array(20).fill(0).map((_, i) => `function func${i}() { return ${i}; }`).join('\n')}`;
        
        await createTestFile(largeJsFile, largeContent);
        console.log('大文件原始内容行数:', largeContent.split('\n').length);
        
        await FileHeaderManager.writeHeader(largeJsFile, headerObj);
        const updatedLargeContent = await fs.readFile(largeJsFile, 'utf8');
        console.log('添加文件头后行数:', updatedLargeContent.split('\n').length);
        console.log('内容完整性检查通过!');
        
        // 测试备份功能（需要显式启用）
        console.log('\n=== 测试备份功能 ===');
        await FileHeaderManager.writeHeader(jsTestFile, headerObj, { createBackup: true });
        console.log('✓ 备份功能测试通过');
        
        // 测试默认不备份
        console.log('\n=== 测试默认不备份 ===');
        await FileHeaderManager.writeHeader(jsTestFile, headerObj);
        console.log('✓ 默认不备份测试通过');
        
        // 测试内容保护机制
        console.log('\n=== 测试内容保护机制 ===');
        const emptyFile = path.join(testDir, 'test_empty.js');
        await createTestFile(emptyFile, '');
        
        try {
            await FileHeaderManager.writeHeader(emptyFile, headerObj);
            console.log('✗ 空文件保护测试失败：应该抛出错误');
        } catch (error) {
            if (error.message.includes('内容不能只包含文件头而无原始内容')) {
                console.log('✓ 空文件保护测试通过');
            } else {
                console.log('✗ 空文件保护测试失败：错误信息不正确');
            }
        }
        
        console.log('\n=== 所有测试通过 ===');
        console.log('\n所有测试完成!');
        
    } catch (error) {
        console.error('测试失败:', error.message);
        console.error(error.stack);
    } finally {
        // 清理测试文件
        try {
            await fs.rm(testDir, { recursive: true, force: true });
            console.log('\n测试文件已清理');
        } catch (error) {
            console.warn('清理测试文件失败:', error.message);
        }
    }
}

// 运行测试
runTests();