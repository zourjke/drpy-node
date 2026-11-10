/**
 * 出站 UTF-16 良构化（lone surrogate 闪退根治）
 *
 * 机理：响应里混入未配对代理项（孤立 D800-DFFF 码元）或上游 JSON 的坏转义
 * 序列（"\ud83c" 单独出现）时，Flutter/Dart 客户端 jsonDecode 后在文本 paint
 * 阶段抛 "string is not well-formed UTF-16" 直接闪退（浏览器/其它壳子同样
 * 踩雷）。服务端出口统一清洗是唯一根治面。
 *
 * 两条病态通道与对应洗法：
 *   ① 上游 JSON 文本透传：坏转义是 6 个 ASCII 字符（\ u d 8 3 c），Node 的
 *      utf8 Buffer 编码（U+FFFD 兜底）对它完全无效——必须修文本本身
 *      （scrubJsonText：把孤立的 \udXXX 转义改写为 \ufffd 转义）
 *   ② 运行时字符串含裸 lone surrogate（拼接/substring 切在代理对中间）：
 *      scrubString 替换为 U+FFFD（Buffer 编码路径本就等价处理，这里显式化）
 *
 * 性能设计：全部先 O(n) 原生正则预检（LONE.test / ESC_LONE.test），干净
 * 字符串零替换零分配；实测 200KB 响应预检 <1ms（见 tests 侧基准注释）。
 *
 * 挂载点（树版与 bundle 版同源生效，fastlogger 双实例收口）：
 *   - fastify preSerialization：对象 payload 深洗（scrubDeep）
 *   - fastify onSend：字符串 payload 走 scrubJsonText（raw 透传路由的兜底）
 *   - utils/log.js：日志消息出口 scrub（客户端服务页逐行渲染日志）
 */

// 未配对高代理 / 未配对低代理（test 无状态；替换需 /g 版本）
const LONE_TEST = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
const LONE_ALL = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
const FFFD = '\uFFFD';

// JSON 文本转义形态："\uD83C" 后不跟低代理转义 / 低代理转义前没有高代理转义。
// 坑（scan 脚本实测踩过）：RegExp 构造器字符串里 '\\u' 会退化成字面量 u，
// 把 base64 里的 "udb9f" 全误报——用字面量正则的 .source 拼接，杜绝二次转义
const ESC_H = /\\u[dD][89abAB][0-9a-fA-F]{2}/.source;
const ESC_L = /\\u[dD][c-fC-F][0-9a-fA-F]{2}/.source;
const ESC_LONE_TEST = new RegExp(`${ESC_H}(?!${ESC_L})|(?<!${ESC_H})${ESC_L}`);
const ESC_LONE_ALL = new RegExp(`${ESC_H}(?!${ESC_L})|(?<!${ESC_H})${ESC_L}`, 'g');
const ESC_FFFD = '\\ufffd'; // 写回转义形态，客户端解码得到 U+FFFD

/** 裸 lone surrogate → U+FFFD；干净串零成本直通 */
export function scrubString(s) {
    return LONE_TEST.test(s) ? s.replace(LONE_ALL, FFFD) : s;
}

/** JSON 文本双洗：裸孤代理 + 转义形态孤代理（上游透传通道）；干净文本直通 */
export function scrubJsonText(s) {
    let out = LONE_TEST.test(s) ? s.replace(LONE_ALL, FFFD) : s;
    return ESC_LONE_TEST.test(out) ? out.replace(ESC_LONE_ALL, ESC_FFFD) : out;
}

/**
 * 深洗对象内全部 string 值（迭代遍历，不递归防深栈）；Buffer/流/其它类型不动。
 * 原地修改并返回同一引用（preSerialization payload 语义）。
 */
export function scrubDeep(obj) {
    const queue = [obj];
    while (queue.length > 0) {
        const v = queue.pop();
        if (Buffer.isBuffer(v)) continue; // Buffer 按字节语义处理，不拆索引遍历
        if (Array.isArray(v)) {
            for (let i = 0; i < v.length; i++) {
                const item = v[i];
                if (typeof item === 'string') {
                    if (LONE_TEST.test(item)) v[i] = item.replace(LONE_ALL, FFFD);
                } else if (item !== null && typeof item === 'object') {
                    queue.push(item);
                }
            }
        } else if (v !== null && typeof v === 'object') {
            for (const k of Object.keys(v)) {
                const val = v[k];
                if (typeof val === 'string') {
                    if (LONE_TEST.test(val)) v[k] = val.replace(LONE_ALL, FFFD);
                } else if (val !== null && typeof val === 'object') {
                    queue.push(val);
                }
            }
        }
    }
    return obj;
}

/**
 * 给 fastify 实例挂出站清洗钩子（单一事实源，主服务 5757 与 wsApp 57575 共用）：
 * - preSerialization：对象 payload 在序列化前深洗（string/Buffer/stream 不走此钩子）
 * - onSend：字符串 payload（含上游 JSON 原文透传）走 scrubJsonText 双洗
 */
export function attachSanitizeHooks(server) {
    server.addHook('preSerialization', async (request, reply, payload) => {
        if (payload !== null && typeof payload === 'object') {
            scrubDeep(payload);
        }
        return payload;
    });
    server.addHook('onSend', async (request, reply, payload) => {
        if (typeof payload === 'string') {
            return scrubJsonText(payload);
        }
        return payload;
    });
}

// 判定工具（诊断脚本 / 测试复用）
export {LONE_TEST as LONE};
