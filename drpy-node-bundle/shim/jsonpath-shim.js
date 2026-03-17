import * as lib from './original-jsonpath.js';

// 获取对象
// Rolldown/ESM interop 可能会把 export 放在 default 或 namespace
const JP = lib.JSONPath || lib.default?.JSONPath || lib.default;

// 确保全局挂载
if (typeof globalThis !== 'undefined') {
    if (!globalThis.JSONPath) {
        globalThis.JSONPath = {}; // 初始化容器
    }
    // min.js 的逻辑是 globalThis.JSONPath.JSONPath = F
    // 如果 JP 是 F (构造函数)
    if (typeof JP === 'function') {
        globalThis.JSONPath.JSONPath = JP;
    } else if (JP && JP.JSONPath) {
        // 如果 JP 已经是 { JSONPath: F }
        globalThis.JSONPath = JP;
    }
    
    // 如果 htmlParser.js 直接使用 JSONPath 变量而不是 globalThis.JSONPath
    // 在 Bundle 环境下这是不可能的，除非它是全局变量。
    // 但是在 Node 环境下，全局变量可以直接访问。
    // 我们这里只能保证 globalThis.JSONPath 存在。
}

// 导出，虽然 htmlParser.js 没用到，但为了模块完整性
export { JP as JSONPath };
export default JP;
