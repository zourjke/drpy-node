// 沙箱全局自检（bundle 上下文回归门）
//
// 背景：spider 沙箱的全局表里有多个 UMD 全局挂载型模块（CryptoJS/JSEncrypt/
// pako/JSON5/jinja/NODERSA/gbkTool/randomUa）。树版靠 UMD 的浏览器分支挂
// globalThis；rolldown 打包后会走 CJS 分支，全局丢失 → 源里裸引用即
// ReferenceError（典型：/api/设置中心 报 CryptoJS is not defined）。
//
// 这个入口由 rolldown 以与 server.bundle 相同的配置打成 sandbox-check.bundle.mjs，
// 放在 staging（干净目录、只有微型 node_modules）里运行，枚举两张全局表，
// 任一键 undefined 即 exit 1，作为出包前的硬门。
//
// 用法（打包脚本自动执行）：
//   node sandbox-check.bundle.mjs
import {STATIC_LIBS_SANDBOX, STATIC_DRPY_CUSTOM_SANDBOX} from '../libs/drpyS.js';

const tables = {
    STATIC_LIBS_SANDBOX,
    STATIC_DRPY_CUSTOM_SANDBOX,
};

// 沙箱两表之外、主服务图内裸引用的 UMD 全局（side-effect 导入型库）。
// 沙箱表盖不到它们——v2.0.7 bundle 首页 500 "marked is not defined" 即此盲区。
// 注意：必须同时在此 side-effect import 消费文件（check 入口走 drpyS，图里
// 天然不含 controllers；不 import 则模块不进 check bundle，校验假阴性）。
// 新增主服务 UMD 库时：下面加 import + 名单登记（审计法：grep "^import\s*['\"]"）
import '../utils/marked.min.js';

const SERVICE_UMD_GLOBALS = ['marked'];

const problems = [];
let total = 0;
for (const [tableName, table] of Object.entries(tables)) {
    for (const [key, value] of Object.entries(table)) {
        total++;
        if (value === undefined || value === null) {
            problems.push(`${tableName}.${key}`);
        }
    }
}
for (const name of SERVICE_UMD_GLOBALS) {
    total++;
    if (typeof globalThis[name] === 'undefined') {
        problems.push(`SERVICE_UMD_GLOBALS.${name}`);
    }
}

if (problems.length > 0) {
    console.error(`[sandbox-check] FAILED: ${problems.length}/${total} 个全局缺失`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
}

console.log(`[sandbox-check] OK: ${total} 个沙箱全局全部可用`);
// drpyS 顶层可能留下句柄（日志/数据库），显式退出
process.exit(0);
