/**
 * 按规则的出站代理映射（2026-11-11，DsPlayer 站点「接口走本地代理」配套）
 *
 * 机制：
 * - libs/drpyS.js 在 AsyncLocalStorage 里携带当前规则脚本名执行规则方法；
 * - 请求底层（libs_drpy/drpyInject.js request / utils/createAxiosAgent.js
 *   拦截器）发请求前查映射：命中则经 mihomo 本地混合端口出站，未命中
 *   维持既有链路（系统代理/DOH/直连），其余源零影响；
 * - 映射来源 = JSON 文件（DsPlayer 站点开关变化时重写），mtime+size
 *   缓存热读——改文件/开关即生效，无需重启服务。
 *
 * 文件路径：env RULE_PROXY_FILE 可覆盖；默认 <PROJECT_ROOT>/config/rule_proxy.json
 * 文件形态：{"规则脚本名(不含.js)": "http://127.0.0.1:7890", ...}
 */
import fs from 'fs';
import path from 'path';
import {AsyncLocalStorage} from 'async_hooks';
import tunnel from 'tunnel';
import {ProxyAgent} from 'undici';
import {PROJECT_ROOT} from './pathHelper.js';
import {log, logError} from './log.js';

/** 规则执行上下文（drpyS.js invokeMethod/jx 写入，请求底层读取） */
export const ruleAls = new AsyncLocalStorage();

const DEFAULT_FILE = path.join(PROJECT_ROOT, 'config', 'rule_proxy.json');

let _map = {};
let _mtimeMs = 0;
let _size = 0;
let _loaded = false;

function fileOf() {
    return process.env.RULE_PROXY_FILE || DEFAULT_FILE;
}

function refreshMap() {
    const f = fileOf();
    let st;
    try {
        st = fs.statSync(f);
    } catch (e) {
        if (e.code !== 'ENOENT') {
            logError('[rule-proxy] 映射 stat 失败:', e.message);
        } else if (!_loaded) {
            log(`[rule-proxy] 映射文件不存在（服务进程视图）: ${f}`);
        }
        if (_loaded) return; // 已有旧映射，文件暂时不可见时不清空
        _map = {};
        _loaded = true;
        return;
    }
    if (_loaded && st.mtimeMs === _mtimeMs && st.size === _size) return;
    try {
        const parsed = JSON.parse(fs.readFileSync(f, 'utf-8'));
        _map = parsed && typeof parsed === 'object' ? parsed : {};
        _mtimeMs = st.mtimeMs;
        _size = st.size;
        _loaded = true;
        log(`[rule-proxy] 映射已加载 ${Object.keys(_map).length} 条 ← ${f}`);
    } catch (e) {
        logError('[rule-proxy] 映射读取失败:', e.message);
    }
}

/** 当前规则名（ALS 上下文之外返回 null） */
export function currentRule() {
    return ruleAls.getStore()?.rule || null;
}

/** 当前规则的出站代理地址；未配置返回 null */
export function ruleProxyOf(rule = currentRule()) {
    if (!rule) return null;
    refreshMap();
    const v = _map[rule];
    return typeof v === 'string' && v ? v : null;
}

// agent 备忘（Map 键控）：同一「代理地址×目标协议」复用同一 tunnel 实例
// （保住连接池；http/https 目标交替时不重建）
const _agentMemo = new Map();

function agentFor(proxyUrl, isHttpsTarget) {
    const key = `${proxyUrl}|${isHttpsTarget}`;
    let agent = _agentMemo.get(key);
    if (!agent) {
        const u = new URL(proxyUrl);
        const opts = {proxy: {host: u.hostname || '127.0.0.1', port: Number(u.port || 7890)}};
        agent = isHttpsTarget ? tunnel.httpsOverHttp(opts) : tunnel.httpOverHttp(opts);
        _agentMemo.set(key, agent);
    }
    return agent;
}

/**
 * 当前规则命中代理映射时返回 {agent, isHttpsTarget}，未命中返回 null。
 * url 形态与调用方一致（string 或 axios config 的 {url}）
 */
export function resolveRuleProxyAgent(url) {
    const proxy = ruleProxyOf();
    if (!proxy) return null;
    const raw = typeof url === 'object' && url !== null ? String(url.url ?? '') : String(url ?? '');
    const isHttpsTarget = raw.startsWith('https');
    const agent = agentFor(proxy, isHttpsTarget);
    log(`[rule-proxy] ${currentRule() || '?'} → ${proxy} ${raw.slice(0, 100)}`);
    return {agent, isHttpsTarget};
}

// 源内原生 fetch 的 undici 代理 dispatcher（按代理地址备忘复用连接池）
let _fetchDispatcherMemo = null;

/**
 * 源内原生 fetch 用：当前规则映射地址的 undici ProxyAgent（memo 复用）。
 * 未命中映射或无法解析返回 null（调用方回落原生直连 fetch）
 */
export function ruleFetchDispatcher(proxyUrl = ruleProxyOf()) {
    if (!proxyUrl) return null;
    if (_fetchDispatcherMemo?.proxy === proxyUrl) return _fetchDispatcherMemo.dispatcher;
    let dispatcher;
    try {
        dispatcher = new ProxyAgent({
            uri: proxyUrl,
            requestTls: {rejectUnauthorized: false},
        });
    } catch (e) {
        logError('[rule-proxy] fetch dispatcher 构建失败:', e.message);
        return null;
    }
    _fetchDispatcherMemo = {proxy: proxyUrl, dispatcher};
    return dispatcher;
}
