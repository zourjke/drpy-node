/**
 * ill-formed UTF-16（未配对代理项 / 坏转义序列）诊断扫描
 *
 * 背景：响应数据含 lone surrogate（孤立 D800-DFFF 码元）或上游 JSON 的
 * 坏转义序列（"\ud83c" 单独出现）时，客户端（Flutter/Dart）在文本 paint
 * 阶段抛 "string is not well-formed UTF-16" 直接闪退。服务端是唯一根治面。
 *
 * 三类污染通道（本脚本逐一排查）：
 *   A. 本地配置文件（index.json/custom.json——源名/站点名是设置页直接渲染的头号嫌疑）
 *   B. 上游 JSON 透传（坏转义序列以 ASCII 文本形态混进响应，Buffer 编码救不了）
 *   C. 源码硬编码（spider/libs 源文件字符串字面量里的孤立 \uXXXX 转义）
 *   （D. 字符串截断逻辑产生的 lone surrogate 无法静态扫描，靠运行时清洗兜底）
 *
 * 用法：
 *   node scripts/scan-ill-formed.mjs                # 扫本地配置 + 源码
 *   node scripts/scan-ill-formed.mjs --http         # 追加活体探测（需服务已起，读 .env 取鉴权）
 *   node scripts/ill-formed.mjs --file <path>       # 扫单个 JSON 文件
 */

import {readFileSync, existsSync, readdirSync, statSync} from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ==================== 判定工具 ====================

// 未配对高代理 / 未配对低代理（Node 原生支持环视，O(n) 预检极快）
export const LONE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

// JSON 文本里的「转义形态孤代理」："\ud83c" 后面不跟低代理转义 / 低代理转义前面没有高代理转义。
// 这是上游透传通道的载体——纯 ASCII 文本，Buffer UTF-8 编码路径天然安全的结论对它无效。
// 坑：RegExp 构造器字符串里 '\\u' 会退化成字面量 u（把 base64 里的 udb9f 全误报），
// 必须写 '\\\\u' 才匹配「反斜杠+u+4位十六进制」这 6 个字符
const ESC_HIGH = '\\\\u[dD][89abAB][0-9a-fA-F]{2}';
const ESC_LOW = '\\\\u[dD][c-fC-F][0-9a-fA-F]{2}';
export const JSON_TEXT_LONE = new RegExp(`${ESC_HIGH}(?!${ESC_LOW})|(?<!${ESC_HIGH})${ESC_LOW}`);

/** 深走 JSON 收集命中（非递归，防深栈）。返回命中路径数组 */
export function findIllFormedStrings(obj, pathPrefix = '$', out = []) {
    const queue = [[pathPrefix, obj]];
    while (queue.length > 0) {
        const [p, v] = queue.shift();
        if (typeof v === 'string') {
            if (LONE.test(v)) out.push(`${p} (raw lone surrogate)`);
        } else if (Array.isArray(v)) {
            for (let i = 0; i < v.length; i++) queue.push([`${p}[${i}]`, v[i]]);
        } else if (v && typeof v === 'object') {
            for (const [k, val] of Object.entries(v)) queue.push([`${p}.${k}`, val]);
        }
    }
    return out;
}

/** 扫一段 JSON 文本：优先 parse 后深走（权威），parse 失败退回文本级正则 */
export function scanJsonText(text, label, out) {
    const escapedHits = text.match(new RegExp(JSON_TEXT_LONE, 'g'));
    try {
        const parsed = JSON.parse(text);
        for (const hit of findIllFormedStrings(parsed)) out.push(`${label}: ${hit}`);
    } catch {
        out.push(`${label}: <JSON 不可解析，跳过深走>`);
    }
    if (escapedHits) {
        out.push(`${label}: <转义形态孤代理 ×${escapedHits.length}> ${escapedHits.slice(0, 3).join(' ')}`);
    }
}

// ==================== 扫描面 A：本地配置 ====================

function scanLocalConfigs(out) {
    for (const file of ['index.json', 'custom.json']) {
        const p = path.join(ROOT, file);
        if (!existsSync(p)) continue;
        scanJsonText(readFileSync(p, 'utf8'), `A:本地配置 ${file}`, out);
    }
}

// ==================== 扫描面 C：源码硬编码（孤立 \uXXXX 转义字面量） ====================
// 注意：utf8 磁盘文件不可能存裸 lone surrogate（不可编码），源码级污染只能是转义形态

function* walkFiles(dir, depth = 0) {
    if (depth > 4) return;
    let entries;
    try {
        entries = readdirSync(dir);
    } catch {
        return;
    }
    for (const name of entries) {
        if (name === 'node_modules' || name === '.git') continue;
        const p = path.join(dir, name);
        let st;
        try {
            st = statSync(p);
        } catch {
            continue;
        }
        if (st.isDirectory()) yield* walkFiles(p, depth + 1);
        else if (/\.(js|mjs|cjs|json)$/.test(name)) yield p;
    }
}

function scanSources(out) {
    const dirs = ['spider', 'libs_drpy', 'libs'].map((d) => path.join(ROOT, d));
    let scanned = 0;
    for (const dir of dirs) {
        if (!existsSync(dir)) continue;
        for (const file of walkFiles(dir)) {
            scanned++;
            let text;
            try {
                text = readFileSync(file, 'utf8');
            } catch {
                continue;
            }
            const hits = text.match(new RegExp(JSON_TEXT_LONE, 'g'));
            if (hits) {
                const rel = path.relative(ROOT, file);
                out.push(`C:源码 ${rel}: <孤立 \\uXXXX 转义 ×${hits.length}> ${hits.slice(0, 3).join(' ')}`);
            }
        }
    }
    console.log(`  源码文件扫描数: ${scanned}`);
}

// ==================== 扫描面 B：活体 HTTP 探测 ====================

function readEnv(key) {
    // .env 是「KEY = value」等号带空格的写法，grep ^KEY= 匹配不上（历史坑）
    if (!existsSync(path.join(ROOT, '.env'))) return '';
    const line = readFileSync(path.join(ROOT, '.env'), 'utf8').split('\n')
        .find((l) => l.trim().startsWith(key));
    if (!line) return '';
    return line.slice(line.indexOf('=') + 1).trim();
}

async function scanHttp(out) {
    const pwd = readEnv('API_PWD');
    const authName = readEnv('API_AUTH_NAME');
    const authCode = readEnv('API_AUTH_CODE');
    const headers = authName ? {Authorization: 'Basic ' + Buffer.from(`${authName}:${authCode}`).toString('base64')} : {};
    const endpoints = [
        `/config/1?healthy=1&pwd=${pwd}`,
        `/api/${encodeURIComponent('腾云驾雾[官]')}?filter=1&pwd=${pwd}`,
        `/api/${encodeURIComponent('设置中心')}?pwd=${pwd}`,
    ];
    for (const ep of endpoints) {
        try {
            const resp = await fetch(`http://127.0.0.1:5757${ep}`, {headers});
            const text = await resp.text();
            const hits = [];
            scanJsonText(text, ep.split('?')[0], hits);
            // 文本级裸孤代理（理论上 Buffer 编码已洗，出现即说明有非 Buffer 出口）
            const raw = text.match(new RegExp(LONE, 'g'));
            if (raw) hits.push(`<响应文本含裸孤代理 ×${raw.length}>`);
            for (const h of hits) out.push(`B:HTTP ${h}`);
            if (hits.length === 0) console.log(`  HTTP ${ep.split('?')[0]} → 干净`);
        } catch (e) {
            console.log(`  HTTP ${ep.split('?')[0]} → 探测失败(${e.message})，服务起了吗？`);
        }
    }
}

// ==================== 入口 ====================

const args = process.argv.slice(2);
const single = args.indexOf('--file') !== -1 ? args[args.indexOf('--file') + 1] : null;

const out = [];
if (single) {
    scanJsonText(readFileSync(path.resolve(single), 'utf8'), `file:${single}`, out);
} else {
    console.log('[scan-ill-formed] A/C 面：本地配置 + 源码转义字面量 ...');
    scanLocalConfigs(out);
    scanSources(out);
    if (args.includes('--http')) {
        console.log('[scan-ill-formed] B 面：活体探测 ...');
        await scanHttp(out);
    }
}

if (out.length === 0) {
    console.log('[scan-ill-formed] 结论：全部扫描面干净，未发现 ill-formed UTF-16');
} else {
    console.log(`[scan-ill-formed] 发现 ${out.length} 处命中：`);
    for (const line of out) console.log('  ' + line);
    process.exitCode = 1;
}
