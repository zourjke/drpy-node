/**
 * HTTP请求工具模块
 *
 * 该模块基于axios创建了预配置的HTTP客户端实例，提供了优化的网络请求功能。
 * 包含了连接池管理、SSL证书验证配置等网络优化设置。
 *
 * @author drpy-node
 * @version 1.0.0
 */

import _axios from 'axios';
import https from 'https';
import http from 'http';
import {resolveDoh, getSystemProxy} from './dns_doh.js';
import {HttpsProxyAgent} from 'https-proxy-agent';

/**
 * 默认的HTTP请求客户端
 *
 * 配置特性：
 * - 启用HTTP/HTTPS连接池（keepAlive: true）
 * - 禁用HTTPS证书验证（rejectUnauthorized: false）
 * - 适用于大多数网络请求场景
 * - 启用DOH支持
 * - 自动继承系统代理
 */
const req = _axios.create({
    httpsAgent: new https.Agent({keepAlive: true, rejectUnauthorized: false}), // HTTPS代理配置
    httpAgent: new http.Agent({keepAlive: true}), // HTTP代理配置
});

// Add System Proxy & DOH interceptor
req.interceptors.request.use(async config => {
    if (!config.url) return config;

    try {
        // 1. Check System Proxy first
        const proxy = await getSystemProxy();
        if (proxy) {
            const agent = new HttpsProxyAgent(proxy);
            config.httpsAgent = agent;
            config.proxy = false; // Disable axios internal proxy handling
            return config; // Return early if proxy is used (let proxy handle DNS)
        }

        // 2. DOH Logic (Only if no proxy)
        let fullUrl = config.url;
        // Handle relative URLs if baseURL is provided
        if (config.baseURL && !/^https?:\/\//i.test(fullUrl)) {
            try {
                const parsed = new URL(fullUrl, config.baseURL);
                fullUrl = parsed.toString();
            } catch (e) {
            }
        }

        const urlObj = new URL(fullUrl);
        const hostname = urlObj.hostname;

        // Skip if not a domain or localhost
        if (!hostname || /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname === 'localhost') {
            return config;
        }

        const ip = await resolveDoh(hostname);
        if (ip && ip !== hostname) {
            // Keep original Host header if not set
            if (!config.headers) config.headers = {};
            // check case-insensitive host header
            let hasHost = false;
            const keys = Object.keys(config.headers);
            for (const k of keys) {
                if (k.toLowerCase() === 'host') {
                    hasHost = true;
                    break;
                }
            }
            if (!hasHost) {
                config.headers.Host = hostname;
            }

            urlObj.hostname = ip;
            config.url = urlObj.toString();

            // Clear baseURL to avoid double-prefixing if we converted to absolute
            if (config.baseURL) {
                delete config.baseURL;
            }
        }
    } catch (e) {
        // Ignore URL parse errors
    }
    return config;
});

/**
 * 简化版HTTP请求客户端
 *
 * 配置特性：
 * - 仅禁用HTTPS证书验证
 * - 不启用连接池
 * - 适用于简单的一次性请求
 * - 启用DOH支持
 * - 自动继承系统代理
 */
export const reqs = new _axios.create({
    httpsAgent: new https.Agent({
        rejectUnauthorized: false // 禁用SSL证书验证
    })
});

// Add System Proxy & DOH interceptor to reqs as well
// reqs.interceptors.request.use(async config => {
//     if (!config.url) return config;
//     try {
//         // 1. Check System Proxy
//         const proxy = await getSystemProxy();
//         if (proxy) {
//             const agent = new HttpsProxyAgent(proxy);
//             config.httpsAgent = agent;
//             config.proxy = false;
//             return config;
//         }
//
//         // 2. DOH
//         let fullUrl = config.url;
//         if (config.baseURL && !/^https?:\/\//i.test(fullUrl)) {
//             try {
//                 const parsed = new URL(fullUrl, config.baseURL);
//                 fullUrl = parsed.toString();
//             } catch (e) {
//             }
//         }
//         const urlObj = new URL(fullUrl);
//         const hostname = urlObj.hostname;
//         if (!hostname || /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname === 'localhost') return config;
//         const ip = await resolveDoh(hostname);
//         if (ip && ip !== hostname) {
//             if (!config.headers) config.headers = {};
//             let hasHost = false;
//             const keys = Object.keys(config.headers);
//             for (const k of keys) {
//                 if (k.toLowerCase() === 'host') {
//                     hasHost = true;
//                     break;
//                 }
//             }
//             if (!hasHost) config.headers.Host = hostname;
//             urlObj.hostname = ip;
//             config.url = urlObj.toString();
//             if (config.baseURL) delete config.baseURL;
//         }
//     } catch (e) {
//     }
//     return config;
// });

// 导出默认的HTTP请求客户端
export default req;
