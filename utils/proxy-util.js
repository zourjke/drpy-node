/**
 * 代理工具模块
 * 提供代理控制器的公共函数和常量
 * @module proxy-util
 */

import {ENV} from './env.js';
import https from 'https';
import http from 'http';
import {URL} from 'url';

/**
 * 代理相关常量
 */
export const PROXY_CONSTANTS = {
    // 缓存超时时间（5分钟）
    CACHE_TIMEOUT: 5 * 60 * 1000,
    // M3U8 缓存超时时间（30秒，因为直播流更新频繁）
    M3U8_CACHE_TIMEOUT: 30 * 1000,
    // 请求超时时间（30秒）
    REQUEST_TIMEOUT: 30000,
    // HEAD请求超时时间（5秒，用于快速检测）
    HEAD_REQUEST_TIMEOUT: 5000,
    // 内容获取超时时间（15秒）
    CONTENT_FETCH_TIMEOUT: 15000,
    // 最大内容长度（10MB）
    MAX_CONTENT_LENGTH: 10 * 1024 * 1024,
    // 默认User-Agent
    DEFAULT_USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    // 缓存管理器配置
    CACHE_MANAGER: {
        // 默认最大缓存条目数
        DEFAULT_MAX_SIZE: 1000,
        // 默认过期时间（5分钟）
        DEFAULT_TTL: 5 * 60 * 1000,
        // M3U8缓存过期时间（30秒）
        M3U8_TTL: 30 * 1000,
        // 清理检查间隔（1分钟）
        CLEANUP_INTERVAL: 60 * 1000,
        // 内存压力阈值（当缓存条目超过此数量时触发积极清理）
        MEMORY_PRESSURE_THRESHOLD: 5000
    }
};

/**
 * 智能缓存管理器
 * 提供LRU淘汰、自动过期、内存监控等功能，防止内存泄漏
 */
export class SmartCacheManager {
    constructor(options = {}) {
        this.maxSize = options.maxSize || PROXY_CONSTANTS.CACHE_MANAGER.DEFAULT_MAX_SIZE;
        this.defaultTTL = options.defaultTTL || PROXY_CONSTANTS.CACHE_MANAGER.DEFAULT_TTL;
        this.cleanupInterval = options.cleanupInterval || PROXY_CONSTANTS.CACHE_MANAGER.CLEANUP_INTERVAL;
        this.name = options.name || 'SmartCache';
        
        // 缓存存储：key -> {value, timestamp, accessTime, ttl}
        this.cache = new Map();
        // 访问顺序链表（用于LRU）
        this.accessOrder = new Map();
        
        // 统计信息
        this.stats = {
            hits: 0,
            misses: 0,
            evictions: 0,
            expirations: 0,
            cleanups: 0
        };
        
        // 启动定期清理任务
        this.startCleanupTimer();
        
        // console.log(`[${this.name}] SmartCacheManager initialized: maxSize=${this.maxSize}, defaultTTL=${this.defaultTTL}ms`);
    }
    
    /**
     * 设置缓存项
     * @param {string} key - 缓存键
     * @param {*} value - 缓存值
     * @param {number} ttl - 过期时间（毫秒），可选
     */
    set(key, value, ttl = null) {
        const now = Date.now();
        const itemTTL = ttl || this.defaultTTL;
        
        // 如果已存在，先删除旧的
        if (this.cache.has(key)) {
            this.accessOrder.delete(key);
        }
        
        // 检查是否需要淘汰
        this._evictIfNeeded();
        
        // 添加新项
        const item = {
            value,
            timestamp: now,
            accessTime: now,
            ttl: itemTTL,
            expiresAt: now + itemTTL
        };
        
        this.cache.set(key, item);
        this.accessOrder.set(key, now);
        
        // 内存压力检查
        if (this.cache.size > PROXY_CONSTANTS.CACHE_MANAGER.MEMORY_PRESSURE_THRESHOLD) {
            console.warn(`[${this.name}] Memory pressure detected: ${this.cache.size} items, triggering aggressive cleanup`);
            this._aggressiveCleanup();
        }
    }
    
    /**
     * 获取缓存项
     * @param {string} key - 缓存键
     * @returns {*} 缓存值，如果不存在或已过期返回null
     */
    get(key) {
        const item = this.cache.get(key);
        
        if (!item) {
            this.stats.misses++;
            return null;
        }
        
        const now = Date.now();
        
        // 检查是否过期
        if (now > item.expiresAt) {
            this.cache.delete(key);
            this.accessOrder.delete(key);
            this.stats.misses++;
            this.stats.expirations++;
            return null;
        }
        
        // 更新访问时间（LRU）
        item.accessTime = now;
        this.accessOrder.delete(key);
        this.accessOrder.set(key, now);
        
        this.stats.hits++;
        return item.value;
    }
    
    /**
     * 检查缓存项是否存在且未过期
     * @param {string} key - 缓存键
     * @returns {boolean}
     */
    has(key) {
        return this.get(key) !== null;
    }
    
    /**
     * 删除缓存项
     * @param {string} key - 缓存键
     * @returns {boolean} 是否成功删除
     */
    delete(key) {
        const deleted = this.cache.delete(key);
        if (deleted) {
            this.accessOrder.delete(key);
        }
        return deleted;
    }
    
    /**
     * 清空所有缓存
     */
    clear() {
        const size = this.cache.size;
        this.cache.clear();
        this.accessOrder.clear();
        console.log(`[${this.name}] Cache cleared: ${size} items removed`);
    }
    
    /**
     * 获取缓存大小
     * @returns {number}
     */
    get size() {
        return this.cache.size;
    }
    
    /**
     * 获取统计信息
     * @returns {Object}
     */
    getStats() {
        const hitRate = this.stats.hits + this.stats.misses > 0 
            ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
            : '0.00';
            
        return {
            hits: this.stats.hits,
            misses: this.stats.misses,
            evictions: this.stats.evictions,
            expirations: this.stats.expirations,
            cleanups: this.stats.cleanups,
            size: this.cache.size,
            maxSize: this.maxSize,
            hitRate: `${hitRate}%`,
            memoryUsage: this._estimateMemoryUsage(),
            name: this.name,
            defaultTTL: this.defaultTTL,
            cleanupInterval: this.cleanupInterval
        };
    }
    
    /**
     * 启动定期清理任务
     */
    startCleanupTimer() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }
        
        this.cleanupTimer = setInterval(() => {
            this._performCleanup();
        }, this.cleanupInterval);
        
        // 允许进程在定时器存在时退出
        if (this.cleanupTimer.unref) {
            this.cleanupTimer.unref();
        }
        
        // 确保进程退出时清理定时器
        if (typeof process !== 'undefined') {
            process.on('exit', () => this.stopCleanupTimer());
        }
    }
    
    /**
     * 停止定期清理任务
     */
    stopCleanupTimer() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
    }
    
    /**
     * 执行清理任务
     */
    _performCleanup() {
        const before = this.cache.size;
        const now = Date.now();
        let expiredCount = 0;
        
        // 清理过期项
        for (const [key, item] of this.cache.entries()) {
            if (now > item.expiresAt) {
                this.cache.delete(key);
                this.accessOrder.delete(key);
                expiredCount++;
            }
        }
        
        if (expiredCount > 0) {
            this.stats.expirations += expiredCount;
            this.stats.cleanups++;
            console.log(`[${this.name}] Cleanup completed: ${expiredCount} expired items removed (${before} -> ${this.cache.size})`);
        }
    }
    
    /**
     * 积极清理（内存压力时）
     */
    _aggressiveCleanup() {
        const targetSize = Math.floor(this.maxSize * 0.7); // 清理到70%容量
        let removedCount = 0;
        
        // 首先清理过期项
        this._performCleanup();
        
        // 如果还是太多，按LRU淘汰
        while (this.cache.size > targetSize && this.accessOrder.size > 0) {
            const oldestKey = this.accessOrder.keys().next().value;
            this.cache.delete(oldestKey);
            this.accessOrder.delete(oldestKey);
            removedCount++;
        }
        
        if (removedCount > 0) {
            this.stats.evictions += removedCount;
            console.log(`[${this.name}] Aggressive cleanup: ${removedCount} items evicted`);
        }
    }
    
    /**
     * 检查是否需要淘汰并执行LRU淘汰
     */
    _evictIfNeeded() {
        while (this.cache.size >= this.maxSize && this.accessOrder.size > 0) {
            const oldestKey = this.accessOrder.keys().next().value;
            this.cache.delete(oldestKey);
            this.accessOrder.delete(oldestKey);
            this.stats.evictions++;
        }
    }
    
    /**
     * 估算内存使用量（简单估算）
     * @returns {string}
     */
    _estimateMemoryUsage() {
        const avgKeySize = 50; // 平均键长度
        const avgValueSize = 1024; // 平均值大小（1KB）
        const estimatedBytes = this.cache.size * (avgKeySize + avgValueSize);
        
        if (estimatedBytes < 1024) return `${estimatedBytes}B`;
        if (estimatedBytes < 1024 * 1024) return `${(estimatedBytes / 1024).toFixed(1)}KB`;
        return `${(estimatedBytes / (1024 * 1024)).toFixed(1)}MB`;
    }
}

/**
 * 验证身份认证
 * @param {Object} request - Fastify请求对象
 * @param {Object} reply - Fastify响应对象
 * @returns {boolean} 验证是否通过
 */
export function verifyAuth(request, reply) {
    const requiredAuth = ENV.get('PROXY_AUTH', 'drpys');
    const providedAuth = request.query.auth;
    
    if (!providedAuth || providedAuth !== requiredAuth) {
        reply.status(401).send({
            error: 'Unauthorized',
            message: 'Missing or invalid auth parameter',
            code: 401
        });
        return false;
    }
    return true;
}

/**
 * 解码参数 - 支持 base64 解码
 * @param {string} param - 需要解码的参数
 * @param {boolean} isJson - 是否为 JSON 格式
 * @returns {string|Object} 解码后的参数
 */
export function decodeParam(param, isJson = false) {
    if (!param) return isJson ? {} : '';

    let decoded = param;

    try {
        // 首先尝试 URL 解码
        decoded = decodeURIComponent(param);
    } catch (e) {
        // URL 解码失败，使用原始参数
        decoded = param;
    }

    // 对于 URL 参数，如果不是 http 开头，尝试 base64 解码
    if (!isJson && !decoded.startsWith('http://') && !decoded.startsWith('https://')) {
        try {
            const base64Decoded = Buffer.from(decoded, 'base64').toString('utf8');
            if (base64Decoded.startsWith('http://') || base64Decoded.startsWith('https://')) {
                decoded = base64Decoded;
            }
        } catch (e) {
            // base64 解码失败，保持原值
        }
    }

    // 对于 headers 参数，如果不是 JSON 格式，尝试 base64 解码
    if (isJson && !decoded.startsWith('{') && !decoded.endsWith('}')) {
        try {
            const base64Decoded = Buffer.from(decoded, 'base64').toString('utf8');
            if (base64Decoded.startsWith('{') && base64Decoded.endsWith('}')) {
                decoded = base64Decoded;
            }
        } catch (e) {
            // base64 解码失败，保持原值
        }
    }

    // 如果是 JSON 格式，尝试解析
    if (isJson) {
        try {
            return JSON.parse(decoded);
        } catch (e) {
            console.warn('Failed to parse headers as JSON:', decoded);
            return {};
        }
    }

    return decoded;
}

/**
 * 获取默认请求头
 * @param {Object} request - Fastify 请求对象
 * @returns {Object} 默认请求头
 */
export function getDefaultHeaders(request) {
    const defaultHeaders = {};

    // 复制一些重要的请求头
    const headersToForward = [
        'user-agent',
        'accept',
        'accept-language',
        'accept-encoding',
        'referer',
        'origin'
    ];

    headersToForward.forEach(header => {
        if (request.headers[header]) {
            defaultHeaders[header] = request.headers[header];
        }
    });

    // 如果没有 user-agent，设置默认值
    if (!defaultHeaders['user-agent']) {
        defaultHeaders['user-agent'] = PROXY_CONSTANTS.DEFAULT_USER_AGENT;
    }

    return defaultHeaders;
}

/**
 * 发起远程请求
 * @param {string} url - 远程文件 URL
 * @param {Object} headers - 请求头
 * @param {string} method - 请求方法
 * @param {string} range - Range 头
 * @param {number} timeout - 超时时间（毫秒）
 * @returns {Promise} 请求结果
 */
export function makeRemoteRequest(url, headers, method = 'GET', range = null, timeout = PROXY_CONSTANTS.REQUEST_TIMEOUT) {
    return new Promise((resolve, reject) => {
        let isResolved = false;
        
        try {
            const urlObj = new URL(url);
            const isHttps = urlObj.protocol === 'https:';
            const httpModule = isHttps ? https : http;

            const requestHeaders = { ...headers };
            if (range) {
                requestHeaders['range'] = range;
            }

            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port || (isHttps ? 443 : 80),
                path: urlObj.pathname + urlObj.search,
                method: method,
                headers: requestHeaders,
                timeout: timeout
            };

            const req = httpModule.request(options, (res) => {
                if (isResolved) return;
                isResolved = true;
                
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    stream: res
                });
            });

            req.on('error', (error) => {
                if (isResolved) return;
                isResolved = true;
                reject(new Error(`Request failed: ${error.message}`));
            });

            req.on('timeout', () => {
                if (isResolved) return;
                isResolved = true;
                req.destroy();
                reject(new Error('Request timeout'));
            });

            req.setTimeout(timeout, () => {
                if (isResolved) return;
                isResolved = true;
                req.destroy();
                reject(new Error('Request timeout'));
            });

            req.end();
        } catch (error) {
            if (isResolved) return;
            isResolved = true;
            reject(new Error(`Invalid URL or request setup: ${error.message}`));
        }
    });
}

/**
 * 发起远程HEAD请求检测内容类型
 * @param {string} url - 远程文件 URL
 * @param {Object} headers - 请求头
 * @returns {Promise} 请求结果
 */
export function makeHeadRequest(url, headers) {
    return makeRemoteRequest(url, headers, 'HEAD', null, PROXY_CONSTANTS.HEAD_REQUEST_TIMEOUT);
}

/**
 * 获取远程文件内容（文本）
 * @param {string} url - 远程文件 URL
 * @param {Object} headers - 请求头
 * @returns {Promise<string>} 文件内容
 */
export function getRemoteContent(url, headers) {
    return new Promise(async (resolve, reject) => {
        let isResolved = false;
        let timeoutId;
        
        try {
            // 设置总体超时
            timeoutId = setTimeout(() => {
                if (isResolved) return;
                isResolved = true;
                reject(new Error('Content fetch timeout'));
            }, PROXY_CONSTANTS.CONTENT_FETCH_TIMEOUT);
            
            const response = await makeRemoteRequest(url, headers, 'GET');
            
            if (response.statusCode >= 400) {
                if (isResolved) return;
                isResolved = true;
                clearTimeout(timeoutId);
                reject(new Error(`Remote server error: ${response.statusCode}`));
                return;
            }

            let content = '';
            let contentLength = 0;
            
            response.stream.on('data', chunk => {
                if (isResolved) return;
                
                contentLength += chunk.length;
                if (contentLength > PROXY_CONSTANTS.MAX_CONTENT_LENGTH) {
                    isResolved = true;
                    clearTimeout(timeoutId);
                    reject(new Error('Content too large'));
                    return;
                }
                
                content += chunk.toString('utf8');
            });

            response.stream.on('end', () => {
                if (isResolved) return;
                isResolved = true;
                clearTimeout(timeoutId);
                resolve(content);
            });

            response.stream.on('error', (error) => {
                if (isResolved) return;
                isResolved = true;
                clearTimeout(timeoutId);
                reject(error);
            });

        } catch (error) {
            if (isResolved) return;
            isResolved = true;
            clearTimeout(timeoutId);
            reject(error);
        }
    });
}

/**
 * 获取请求的基础 URL（协议 + 主机 + 端口）
 * @param {Object} request - Fastify 请求对象
 * @returns {string} 基础 URL
 */
export function getProxyBaseUrl(request) {
    const protocol = request.headers['x-forwarded-proto'] || 
                    (request.connection.encrypted ? 'https' : 'http');
    const host = request.headers['x-forwarded-host'] || 
                request.headers.host || 
                'localhost:3001';
    return `${protocol}://${host}`;
}

/**
 * 设置通用的CORS响应头
 * @param {Object} reply - Fastify响应对象
 */
export function setCorsHeaders(reply) {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Range, Content-Type');
}

/**
 * 转发重要的响应头
 * @param {Object} reply - Fastify响应对象
 * @param {Object} remoteHeaders - 远程响应头
 */
export function forwardResponseHeaders(reply, remoteHeaders) {
    const headersToForward = [
        'content-type',
        'content-length',
        'content-range',
        'accept-ranges',
        'last-modified',
        'etag',
        'cache-control',
        'expires'
    ];

    headersToForward.forEach(header => {
        if (remoteHeaders[header]) {
            reply.header(header, remoteHeaders[header]);
        }
    });
}

/**
 * 验证URL格式
 * @param {string} url - 要验证的URL
 * @returns {boolean} URL是否有效
 */
export function isValidUrl(url) {
    return url && (url.startsWith('http://') || url.startsWith('https://'));
}

/**
 * 检查是否为内网IP地址
 * @param {string} url - 要检查的URL
 * @returns {boolean} 是否为内网IP
 */
export function isInternalIp(url) {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname;
        
        // 检查是否为IP地址
        const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
        if (!ipRegex.test(hostname)) {
            return false; // 不是IP地址，可能是域名
        }
        
        const parts = hostname.split('.').map(Number);
        
        // 检查内网IP范围
        // 10.0.0.0/8
        if (parts[0] === 10) return true;
        
        // 172.16.0.0/12
        if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
        
        // 192.168.0.0/16
        if (parts[0] === 192 && parts[1] === 168) return true;
        
        // 127.0.0.0/8 (localhost)
        if (parts[0] === 127) return true;
        
        return false;
    } catch (error) {
        return false;
    }
}

/**
 * 创建缓存管理器工厂函数
 */
export const CacheManagerFactory = {
    /**
     * 创建标准请求缓存管理器
     * @param {string} name - 缓存名称
     * @returns {SmartCacheManager}
     */
    createRequestCache(name = 'RequestCache') {
        return new SmartCacheManager({
            name,
            maxSize: PROXY_CONSTANTS.CACHE_MANAGER.DEFAULT_MAX_SIZE,
            defaultTTL: PROXY_CONSTANTS.CACHE_MANAGER.DEFAULT_TTL,
            cleanupInterval: PROXY_CONSTANTS.CACHE_MANAGER.CLEANUP_INTERVAL
        });
    },
    
    /**
     * 创建M3U8缓存管理器（短TTL）
     * @param {string} name - 缓存名称
     * @returns {SmartCacheManager}
     */
    createM3U8Cache(name = 'M3U8Cache') {
        return new SmartCacheManager({
            name,
            maxSize: 500, // M3U8缓存较小
            defaultTTL: PROXY_CONSTANTS.CACHE_MANAGER.M3U8_TTL,
            cleanupInterval: 30 * 1000 // 30秒清理一次
        });
    },
    
    /**
     * 创建文件缓存管理器
     * @param {string} name - 缓存名称
     * @returns {SmartCacheManager}
     */
    createFileCache(name = 'FileCache') {
        return new SmartCacheManager({
            name,
            maxSize: 2000, // 文件缓存可以更大
            defaultTTL: PROXY_CONSTANTS.CACHE_MANAGER.DEFAULT_TTL,
            cleanupInterval: PROXY_CONSTANTS.CACHE_MANAGER.CLEANUP_INTERVAL
        });
    },
    
    /**
     * 创建客户端连接缓存管理器
     * @param {string} name - 缓存名称
     * @returns {SmartCacheManager}
     */
    createClientCache(name = 'ClientCache') {
        return new SmartCacheManager({
            name,
            maxSize: 100, // 客户端连接数量较少
            defaultTTL: PROXY_CONSTANTS.CACHE_MANAGER.DEFAULT_TTL,
            cleanupInterval: PROXY_CONSTANTS.CACHE_MANAGER.CLEANUP_INTERVAL
        });
    },
    
    /**
     * 创建自定义缓存管理器
     * @param {Object} options - 配置选项
     * @returns {SmartCacheManager}
     */
    createCustomCache(options) {
        return new SmartCacheManager(options);
    }
};

/**
 * 创建标准的健康检查响应
 * @param {string} serviceName - 服务名称
 * @param {Map|SmartCacheManager} requestCache - 请求缓存
 * @param {Map|SmartCacheManager} additionalCache - 额外缓存（可选）
 * @returns {Object} 健康检查响应
 */
export function createHealthResponse(serviceName, requestCache, additionalCache = null) {
    const response = {
        status: 'ok',
        service: serviceName,
        timestamp: new Date().toISOString(),
        cache: {}
    };
    
    // 支持新的SmartCacheManager和旧的Map
    if (requestCache) {
        if (typeof requestCache.getStats === 'function') {
            response.cache.requests = {
                size: requestCache.size,
                stats: requestCache.getStats()
            };
        } else {
            response.cache.requests = requestCache.size;
        }
    }
    
    if (additionalCache) {
        if (typeof additionalCache.getStats === 'function') {
            response.cache.additional = {
                size: additionalCache.size,
                stats: additionalCache.getStats()
            };
        } else {
            response.cache.additional = additionalCache.size;
        }
    }
    
    return response;
}

/**
 * 创建标准的状态响应
 * @param {string} serviceName - 服务名称
 * @param {string} version - 版本号
 * @param {Array} features - 功能列表
 * @param {Array} endpoints - 端点列表
 * @param {Map|SmartCacheManager} requestCache - 请求缓存
 * @param {Map|SmartCacheManager} additionalCache - 额外缓存（可选）
 * @param {Object} additionalInfo - 额外信息（可选）
 * @returns {Object} 状态响应
 */
export function createStatusResponse(serviceName, version, features, endpoints, requestCache, additionalCache = null, additionalInfo = {}) {
    const response = {
        service: serviceName,
        version: version,
        status: 'running',
        cache: {
            timeout: PROXY_CONSTANTS.CACHE_TIMEOUT
        },
        features: features,
        endpoints: endpoints,
        auth: {
            required: true,
            parameter: 'auth',
            description: 'Authentication code required for protected endpoints'
        },
        ...additionalInfo
    };
    
    // 支持新的SmartCacheManager和旧的Map
    if (requestCache) {
        if (typeof requestCache.getStats === 'function') {
            response.cache.requests = {
                size: requestCache.size,
                stats: requestCache.getStats()
            };
        } else {
            response.cache.requests = requestCache.size;
        }
    }
    
    if (additionalCache) {
        if (typeof additionalCache.getStats === 'function') {
            response.cache.additional = {
                size: additionalCache.size,
                stats: additionalCache.getStats()
            };
            response.cache.additionalTimeout = PROXY_CONSTANTS.M3U8_CACHE_TIMEOUT;
        } else {
            response.cache.additional = additionalCache.size;
            response.cache.additionalTimeout = PROXY_CONSTANTS.M3U8_CACHE_TIMEOUT;
        }
    }
    
    return response;
}