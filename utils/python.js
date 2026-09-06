import {log} from './log.js';
export function extractNameFromCode(code) {
    // 正则表达式解释：
    // def getName\(self\):   -- 匹配方法定义
    // [\s\S]*?              -- 非贪婪匹配任意字符（包括换行）
    // return\s+(["'])(.*?)\1 -- 匹配 return 语句中的字符串（单引号或双引号）
    const regex = /def\s+getName\(self\):[\s\S]*?return\s+(["'])(.*?)\1/;
    const match = code.match(regex);

    // 如果匹配成功，返回第二个捕获组（字符串内容）；否则返回空字符串
    return match ? match[2] : '';
}

// 使用示例
// const code = `
// class Spider(BaseSpider):  # 元类 默认的元类 type
//     def getName(self):
//         return "新浪资源"  # 除去少儿不宜的内容
//
//     filterate = False
// `;
//
// log(extractNameFromCode(code)); // 输出："新浪资源"