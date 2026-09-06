// drpyS 源离线调试器：脱离 5757 沙箱，打桩 request/log/setResult 后直接调用源方法。
// 用于区分「源逻辑错误」与「引擎层问题」（如惯例字段缺失导致前置 parse 拦截、方法根本不被调用）。
// 用法：
//   node scripts/debug-source.mjs <源文件路径> [方法] [JSON参数数组] [orId]
// 例：
//   node scripts/debug-source.mjs "spider/js/红果短剧[短].js" 搜索 '["闪婚",false,1]'
//   node scripts/debug-source.mjs "spider/js/红果短剧[短].js" 一级 '["all",1,false,{}]'
//   node scripts/debug-source.mjs "spider/js/红果短剧[短].js" 二级 '[]' '7123456789'
//   node scripts/debug-source.mjs "spider/js/红果短剧[短].js" class_parse
import {readFileSync} from 'fs';
import {createRequire} from 'module';
import path from 'path';
import axios from 'axios';

const file = path.resolve(process.argv[2] || '');
const method = process.argv[3] || '';
const args = process.argv[4] ? JSON.parse(process.argv[4]) : [];

const code = readFileSync(file, 'utf8');
const mod = {exports: {}};
const injected = {
    request: async (url, obj = {}) => {
        const r = await fetch(url, {headers: obj.headers || {}, signal: AbortSignal.timeout(30000)});
        return await r.text();
    },
    req: async (url, obj = {}) => {
        const r = await fetch(url, {headers: obj.headers || {}, signal: AbortSignal.timeout((obj.timeout || 5000))});
        return {code: r.status, headers: Object.fromEntries(r.headers), content: await r.text()};
    },
    axios,
    require: createRequire(import.meta.url), // 沙箱 rootRequire 直通真实 require，此处保持一致
    log: (...a) => console.log('[log]', ...a),
    setResult: d => ({list: d}),
};
// rule 方法禁止箭头函数 → 它们是普通 function，转调时补 this 上下文（二级用 orId，lazy/proxy 用 requestHost）
const ctx = {requestHost: process.env.DS_HOST || 'http://127.0.0.1:5757', hostUrl: process.env.DS_HOST || 'http://127.0.0.1:5757', orId: process.argv[5] || ''};
const fn = new Function('module', 'exports', ...Object.keys(injected), code + '\nmodule.exports = rule;');
fn(mod, mod.exports, ...Object.values(injected));
const rule = mod.exports;

if (!method) {
    console.log('可用方法:', Object.keys(rule).join(', '));
    process.exit(0);
}
if (typeof rule[method] !== 'function') {
    console.error(`方法 ${method} 不存在或不是函数（检查方法名拼写：引擎约定为 中文方法名/lazy/proxy_rule）`);
    process.exit(1);
}
const result = await rule[method].apply(ctx, args);
console.log('返回:', JSON.stringify(result, null, 1).slice(0, 3000));
