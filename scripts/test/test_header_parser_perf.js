
import FileHeaderManager from '../../utils/fileHeaderManager.js';

// 旧的算法实现 (为了对比)
function findHeaderBlockOld(text, ext) {
    const startMarker = '@header(';
    const startIndex = text.indexOf(startMarker);
    if (startIndex === -1) return null;

    let index = startIndex + startMarker.length;
    let balance = 1;
    let inString = false;
    let stringChar = '';
    let escape = false;
    let inLineComment = false;
    let inBlockComment = false;

    for (; index < text.length; index++) {
        const char = text[index];

        if (inLineComment) {
            if (char === '\n') inLineComment = false;
            continue;
        }

        if (inBlockComment) {
            if (char === '*' && text[index + 1] === '/') {
                inBlockComment = false;
                index++;
            }
            continue;
        }

        if (inString) {
            if (escape) {
                escape = false;
            } else if (char === '\\') {
                escape = true;
            } else if (char === stringChar) {
                inString = false;
            }
            continue;
        }

        // Start of comment
        if (char === '/' && text[index + 1] === '/') {
            inLineComment = true;
            index++; 
        } else if (char === '/' && text[index + 1] === '*') {
            inBlockComment = true;
            index++;
        } else if (ext === '.py' && char === '#') {
            inLineComment = true;
        } else if (char === '"' || char === "'") {
            inString = true;
            stringChar = char;
        } else if (char === '(') {
            balance++;
        } else if (char === ')') {
            balance--;
            if (balance === 0) {
                return {
                    start: startIndex,
                    end: index + 1,
                    content: text.substring(startIndex + startMarker.length, index)
                };
            }
        }
    }
    return null;
}

// 构造测试数据
const simpleHeader = `
/*
@header({
    title: "Simple",
    version: 1
})
*/
`;

const complexHeader = `
/*
@header({
    title: "Complex Header",
    description: "Contains strings with parens ) and comments // inside strings",
    nested: {
        obj: { a: 1, b: 2 },
        arr: [1, 2, 3, "string with )"]
    },
    regex: "cctv://(.+)",
    // This is a comment inside the block
    /* Another block comment */
    code: "function() { return 'ok'; }"
})
*/
`;

const largeHeader = `
/*
@header({
    title: "Large Header",
    data: "${'x'.repeat(5000)}",
    items: [
        ${Array(100).fill('{ name: "item", value: "test string with ) inside" }').join(',\n')}
    ]
})
*/
`;

async function runBenchmark() {
    console.log('=== findHeaderBlock 算法性能基准测试 ===');
    const iterations = 100000; // 增加循环次数以放大差异

    const testCases = [
        { name: 'Simple Header', data: simpleHeader },
        { name: 'Complex Header', data: complexHeader },
        { name: 'Large Header (~10KB)', data: largeHeader }
    ];

    for (const testCase of testCases) {
        console.log(`\n测试场景: ${testCase.name} (循环 ${iterations} 次)`);
        
        // 1. 测试旧算法
        const startOld = performance.now();
        for (let i = 0; i < iterations; i++) {
            findHeaderBlockOld(testCase.data, '.js');
        }
        const endOld = performance.now();
        const timeOld = endOld - startOld;
        console.log(`[旧算法] 总耗时: ${timeOld.toFixed(4)} ms | 平均: ${(timeOld/iterations).toFixed(5)} ms`);

        // 2. 测试新算法
        const startNew = performance.now();
        for (let i = 0; i < iterations; i++) {
            FileHeaderManager.findHeaderBlock(testCase.data, '.js');
        }
        const endNew = performance.now();
        const timeNew = endNew - startNew;
        console.log(`[新算法] 总耗时: ${timeNew.toFixed(4)} ms | 平均: ${(timeNew/iterations).toFixed(5)} ms`);

        // 3. 计算提升
        const improvement = ((timeOld - timeNew) / timeOld * 100).toFixed(2);
        console.log(`🚀 性能提升: ${improvement}%`);
        
        // 验证正确性
        const resOld = findHeaderBlockOld(testCase.data, '.js');
        const resNew = FileHeaderManager.findHeaderBlock(testCase.data, '.js');
        if (resOld?.content !== resNew?.content) {
            console.error('❌ 结果不一致!');
            console.log('Old Content Length:', resOld?.content?.length);
            console.log('New Content Length:', resNew?.content?.length);
            // console.log('Old:', resOld?.content);
            // console.log('New:', resNew?.content);
        } else {
             console.log('✅ 结果一致');
        }
    }
}

runBenchmark();
