/**
 * FetchAxios - 基于原生fetch API的HTTP客户端
 * 提供类似axios的API接口，支持请求/响应拦截器、超时控制等功能
 */
import {log, logError} from '../utils/log.js';
import FormData from 'form-data';
import https from "https";
import diagnosticsChannel from 'diagnostics_channel';
import {resolveDoh, getSystemProxy} from '../utils/dns_doh.js';
import {ProxyAgent, Agent} from 'undici';

let undiciStripUASubscribed = false;

// undici Agent 单例缓存 (L7)：
// 历史上每个请求都 new Agent()/ProxyAgent()（各含一套连接池）且从不 close，
// keep-alive socket 随对象被丢弃后反复建断，高流量下 FD/内存持续攀升。
// 按"无代理 → 全局单例；有代理 → 按代理地址缓存（带上限）"复用实例。
let defaultDispatcher = null;
const proxyDispatchers = new Map();
const PROXY_DISPATCHER_MAX = 8;

function getFetchDispatcher(proxy) {
    if (proxy) {
        let dispatcher = proxyDispatchers.get(proxy);
        if (!dispatcher) {
            if (proxyDispatchers.size >= PROXY_DISPATCHER_MAX) {
                const oldestKey = proxyDispatchers.keys().next().value;
                const oldest = proxyDispatchers.get(oldestKey);
                proxyDispatchers.delete(oldestKey);
                try {
                    Promise.resolve(oldest?.close?.()).catch(() => {});
                } catch {}
            }
            try {
                dispatcher = new ProxyAgent({uri: proxy, connect: {rejectUnauthorized: false}});
            } catch {
                // 极端无效 URI 时退化为默认直连 agent，保持与旧行为一致的可用性
                dispatcher = getFetchDispatcher(null);
            }
            proxyDispatchers.set(proxy, dispatcher);
        }
        return dispatcher;
    }
    if (!defaultDispatcher) {
        defaultDispatcher = new Agent({connect: {rejectUnauthorized: false}});
    }
    return defaultDispatcher;
}

function ensureUndiciStripUASubscription() {
    if (undiciStripUASubscribed) {
        return;
    }
    undiciStripUASubscribed = true;

    diagnosticsChannel.channel('undici:request:create').subscribe(({request}) => {
        if (!request || !Array.isArray(request.headers)) {
            return;
        }
        const headers = request.headers;

        let shouldStrip = false;
        for (let i = 0; i < headers.length; i += 2) {
            const k = headers[i];
            if (typeof k === 'string' && k.toLowerCase() === 'x-remove-user-agent') {
                shouldStrip = true;
                break;
            }
        }
        if (!shouldStrip) {
            return;
        }

        for (let i = 0; i < headers.length; i += 2) {
            const k = headers[i];
            if (typeof k === 'string' && k.toLowerCase() === 'x-remove-user-agent') {
                headers.splice(i, 2);
                i -= 2;
            }
        }
        for (let i = 0; i < headers.length; i += 2) {
            const k = headers[i];
            if (typeof k === 'string' && k.toLowerCase() === 'user-agent') {
                headers.splice(i, 2);
                i -= 2;
            }
        }
    });
}

/**
 * 从 Headers 对象提取响应头，正确处理多个 set-cookie
 * Node.js 的 Headers.entries() 对 set-cookie 只保留最后一个值，需特殊处理
 */
function extractResponseHeaders(response) {
    const headers = Object.fromEntries(response.headers.entries());
    // getSetCookie() 返回独立的 set-cookie 数组 (Node.js 18+)
    if (typeof response.headers.getSetCookie === 'function') {
        const setCookies = response.headers.getSetCookie();
        if (setCookies && setCookies.length > 0) {
            headers['set-cookie'] = setCookies.length === 1 ? setCookies[0] : setCookies;
        }
    }
    return headers;
}

/**
 * FetchAxios类 - HTTP客户端实现
 * 基于原生fetch API，提供axios风格的接口
 */
class FetchAxios {
    /**
     * 构造函数
     * @param {Object} defaultConfig - 默认配置
     */
    constructor(defaultConfig = {}) {
        // 默认配置
        this.defaults = {
            baseURL: '',
            headers: {},
            timeout: 0,
            responseType: 'json', // json, text 或 arraybuffer
            withCredentials: false,
            httpsAgent: null,
            maxRedirects: 5, // 默认允许5次重定向
            validateStatus: function (status) {
                return status >= 200 && status < 300; // 默认只有 2xx 状态码被认为是成功
            },
            ...defaultConfig,
        };
        // 拦截器存储
        this.interceptors = {request: [], response: []};
    }

    /**
     * 添加请求拦截器
     * @param {Function} fn - 拦截器函数
     */
    useRequestInterceptor(fn) {
        this.interceptors.request.push(fn);
    }

    /**
     * 添加响应拦截器
     * @param {Function} fn - 拦截器函数
     */
    useResponseInterceptor(fn) {
        this.interceptors.response.push(fn);
    }

    /**
     * 发送HTTP请求
     * @param {string|Object} urlOrConfig - URL字符串或配置对象
     * @param {Object} config - 请求配置
     * @returns {Promise} 请求结果
     */
    async request(urlOrConfig, config = {}) {
        let finalConfig = {};
        // 判断调用方式
        if (typeof urlOrConfig === 'string') {
            // URL字符串方式调用
            finalConfig = {...this.defaults, ...config, url: this.defaults.baseURL + urlOrConfig};
        } else {
            // 配置对象方式调用
            finalConfig = {...this.defaults, ...urlOrConfig, url: this.defaults.baseURL + (urlOrConfig.url || '')};
        }

        // 执行请求拦截器
        for (const interceptor of this.interceptors.request) {
            finalConfig = await interceptor(finalConfig) || finalConfig;
        }

        if (finalConfig.headers) {
            const headerKeys = Object.keys(finalConfig.headers);
            for (const key of headerKeys) {
                if (key.toLowerCase() === 'user-agent' && finalConfig.headers[key] === 'RemoveUserAgent') {
                    delete finalConfig.headers[key];
                    finalConfig.headers['x-remove-user-agent'] = '1';
                    ensureUndiciStripUASubscription();
                    break;
                }
            }
        }

        // Proxy and DOH Handling
        let fetchDispatcher = null;
        try {
            const proxy = await getSystemProxy();
            // L7：按代理地址复用 Agent 单例，替代逐请求新建
            fetchDispatcher = getFetchDispatcher(proxy);
            if (!proxy) {
                // Only use DOH if NO proxy is configured
                // DOH / DNS over HTTPS handling
                let fullUrl = finalConfig.url;
                // Handle relative URLs if baseURL is provided - though finalConfig.url usually has it already
                if (finalConfig.baseURL && !/^https?:\/\//i.test(fullUrl)) {
                    try {
                        const parsed = new URL(fullUrl, finalConfig.baseURL);
                        fullUrl = parsed.toString();
                    } catch (e) {
                    }
                }
                const urlObj = new URL(fullUrl);
                const hostname = urlObj.hostname;

                if (hostname && !/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) && hostname !== 'localhost') {
                    const ip = await resolveDoh(hostname);
                    if (ip && ip !== hostname) {
                        // Set Host header if missing
                        let hasHost = false;
                        const headerKeys = Object.keys(finalConfig.headers || {});
                        for (const k of headerKeys) {
                            if (k.toLowerCase() === 'host') {
                                hasHost = true;
                                break;
                            }
                        }
                        if (!hasHost) {
                            finalConfig.headers = finalConfig.headers || {};
                            finalConfig.headers['Host'] = hostname;
                        }

                        // Replace hostname with IP
                        urlObj.hostname = ip;
                        finalConfig.url = urlObj.toString();

                        // Clear baseURL to avoid double-prefixing issues if url became absolute
                        if (finalConfig.baseURL) {
                            delete finalConfig.baseURL;
                        }
                    }
                }
            }
        } catch (e) {
            // Ignore URL parse/Proxy errors
            // logError('[fetchAxios] Proxy/DOH setup error:', e);
        }

        // 拼接查询参数
        if (finalConfig.params) {
            const query = new URLSearchParams(finalConfig.params).toString();
            finalConfig.url += (finalConfig.url.includes('?') ? '&' : '?') + query;
        }

        // 设置超时控制
        const controller = new AbortController();
        let timeoutId;
        if (finalConfig.timeout && finalConfig.timeout > 0) {
            timeoutId = setTimeout(() => controller.abort(), finalConfig.timeout);
        }

        // 构建fetch选项
        const fetchOptions = {
            method: (finalConfig.method || 'GET').toUpperCase(),
            headers: {...finalConfig.headers},
            signal: controller.signal,
            credentials: finalConfig.withCredentials ? 'include' : 'same-origin',
            agent: finalConfig.httpsAgent || undefined,
            // 处理重定向控制
            redirect: finalConfig.maxRedirects === 0 ? 'manual' : 'follow',
        };

        // 处理请求体数据
        if (finalConfig.data instanceof FormData) {
            // FormData类型数据
            fetchOptions.body = finalConfig.data;
            Object.assign(fetchOptions.headers, finalConfig.data.getHeaders());
        } else if (finalConfig.data) {
            // 其他类型数据
            if (typeof finalConfig.data === 'object' && !fetchOptions.headers['Content-Type']) {
                fetchOptions.headers['Content-Type'] = 'application/json';
            }
            fetchOptions.body = fetchOptions.headers['Content-Type'] === 'application/json'
                ? JSON.stringify(finalConfig.data)
                : finalConfig.data;
        }

        try {
            if (fetchDispatcher) {
                fetchOptions.dispatcher = fetchDispatcher;
            }
            // 发送HTTP请求
            let response = await fetch(finalConfig.url, fetchOptions);

            // 处理手动重定向（当 maxRedirects 为 0 时）
            if (finalConfig.maxRedirects === 0 && response.status >= 300 && response.status < 400) {
                // 清除超时定时器
                if (timeoutId) clearTimeout(timeoutId);

                // 根据 responseType 返回对应的空数据，保持与 axios 行为一致
                let emptyData;
                if (finalConfig.responseType === 'json') {
                    emptyData = null; // JSON 类型返回 null
                } else if (finalConfig.responseType === 'arraybuffer') {
                    emptyData = new ArrayBuffer(0); // ArrayBuffer 类型返回空 buffer
                } else {
                    emptyData = ''; // text 类型返回空字符串
                }

                // 构建重定向响应对象
                const redirectResult = {
                    data: emptyData,
                    status: response.status,
                    statusText: response.statusText,
                    headers: extractResponseHeaders(response),
                    config: finalConfig,
                    request: finalConfig.url,
                };

                // 检查 validateStatus 函数，如果没有定义或返回 false，则抛出错误
                if (!finalConfig.validateStatus || !finalConfig.validateStatus(response.status)) {
                    // log(`[fetchAxios] redirect error:`, redirectResult);
                    // 创建符合 axios 标准的错误对象
                    const redirectError = new Error(`Request failed with status code ${response.status}`);
                    redirectError.code = 'ERR_BAD_REQUEST';
                    redirectError.config = finalConfig;
                    redirectError.request = finalConfig.url;
                    redirectError.response = redirectResult;
                    redirectError.isAxiosError = true;
                    throw redirectError; // 抛出符合 axios 标准的错误
                } else {
                    // log(`[fetchAxios] redirect result:`, redirectResult);
                    return redirectResult; // 如果 validateStatus 返回 true，则正常返回
                }
            }

            // 清除超时定时器（请求成功完成）
            if (timeoutId) clearTimeout(timeoutId);

            let responseData;

            // 根据响应类型处理数据
            if (finalConfig.responseType === 'json') {
                responseData = await response.json().catch(() => null);
            } else if (finalConfig.responseType === 'arraybuffer') {
                responseData = await response.arrayBuffer();
            } else {
                responseData = await response.text();
            }

            // 构建响应结果
            let result = {
                data: responseData,
                status: response.status,
                statusText: response.statusText,
                headers: extractResponseHeaders(response),
                config: finalConfig,
                request: finalConfig.url,
            };

            // 执行响应拦截器
            for (const interceptor of this.interceptors.response) {
                result = await interceptor(result) || result;
            }

            // 检查响应状态，使用 validateStatus 函数
            if (!finalConfig.validateStatus(response.status)) {
                // 创建符合 axios 标准的错误对象
                const statusError = new Error(`Request failed with status code ${response.status}`);
                statusError.code = response.status >= 400 && response.status < 500 ? 'ERR_BAD_REQUEST' : 'ERR_BAD_RESPONSE';
                statusError.config = finalConfig;
                statusError.request = finalConfig.url;
                statusError.response = result;
                statusError.isAxiosError = true;
                throw statusError;
            }
            return result;
        } catch (err) {
            // 清除超时定时器
            if (timeoutId) clearTimeout(timeoutId);

            // 处理不同类型的错误
            if (err.name === 'AbortError') {
                // 超时错误
                const timeoutError = new Error(`Request timeout of ${finalConfig.timeout}ms exceeded`);
                timeoutError.code = 'ECONNABORTED';
                timeoutError.config = finalConfig;
                timeoutError.request = finalConfig.url;
                throw timeoutError;
            } else if (err.name === 'TypeError' && err.message.includes('fetch')) {
                // 网络错误
                const networkError = new Error('Network Error');
                networkError.code = 'NETWORK_ERROR';
                networkError.config = finalConfig;
                networkError.request = finalConfig.url;
                throw networkError;
            } else {
                // 其他错误直接抛出
                throw err;
            }
        }
    }

    /**
     * GET请求
     * @param {string} url - 请求URL
     * @param {Object} config - 请求配置
     * @returns {Promise} 请求结果
     */
    get(url, config) {
        return this.request(url, {...config, method: 'GET'});
    }

    /**
     * POST请求
     * @param {string} url - 请求URL
     * @param {*} data - 请求数据
     * @param {Object} config - 请求配置
     * @returns {Promise} 请求结果
     */
    post(url, data, config) {
        return this.request(url, {...config, method: 'POST', data});
    }

    /**
     * PUT请求
     * @param {string} url - 请求URL
     * @param {*} data - 请求数据
     * @param {Object} config - 请求配置
     * @returns {Promise} 请求结果
     */
    put(url, data, config) {
        return this.request(url, {...config, method: 'PUT', data});
    }

    /**
     * DELETE请求
     * @param {string} url - 请求URL
     * @param {Object} config - 请求配置
     * @returns {Promise} 请求结果
     */
    delete(url, config) {
        return this.request(url, {...config, method: 'DELETE'});
    }
}

/**
 * 创建FetchAxios实例
 * @param {Object} defaultConfig - 默认配置
 * @returns {Function} 实例函数
 */
export function createInstance(defaultConfig) {
    const context = new FetchAxios(defaultConfig);

    // 创建可调用函数
    const instance = context.request.bind(context);

    // 挂载方法到实例
    ['get', 'post', 'put', 'delete', 'useRequestInterceptor', 'useResponseInterceptor'].forEach(method => {
        instance[method] = context[method].bind(context);
    });

    return instance;
}

// HTTPS代理 - 忽略证书错误
export const httpsAgent = new https.Agent({rejectUnauthorized: false});

/**
 * 创建HTTPS实例
 * @returns {Function} HTTPS实例
 */
export function createHttpsInstance() {
    return createInstance({
        headers: {'User-Agent': 'Mozilla/5.0'},
        timeout: 10000,
        responseType: 'arraybuffer',
        httpsAgent: httpsAgent
    });
}

// 导出供内存泄露回归测试与调试使用（L7）
export {getFetchDispatcher};
