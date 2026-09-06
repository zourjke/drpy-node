/**
 * WebDAV 工具类
 *
 * 该模块提供了完整的 WebDAV 客户端功能，支持文件和目录的各种操作。
 * 基于 axios 实现，支持身份验证、SSL 配置等高级功能。
 *
 * 主要功能：
 * - WebDAV 服务器连接和身份验证
 * - 目录浏览和创建
 * - 文件上传、下载、删除
 * - 文件和目录信息获取
 * - 移动和复制操作
 *
 * @author drpy-node
 * @version 1.0.0
 */

import {log, logError, logWarn} from './log.js';
import axios from 'axios';
import https from 'https';
import http from 'http';
import {createReadStream, createWriteStream} from 'fs';
import {pipeline} from 'stream/promises';
import path from 'path';
import * as cheerio from 'cheerio';

/**
 * WebDAV 客户端类
 */
export class WebDAVClient {
    /**
     * 构造函数
     * @param {Object} config - 配置对象
     * @param {string} config.baseURL - WebDAV 服务器基础 URL
     * @param {string} [config.username] - 用户名
     * @param {string} [config.password] - 密码
     * @param {boolean} [config.rejectUnauthorized=false] - 是否验证 SSL 证书
     * @param {number} [config.timeout=30000] - 请求超时时间（毫秒）
     * @param {Object} [config.headers] - 自定义请求头
     */
    constructor(config) {
        this.config = {
            rejectUnauthorized: false,
            timeout: 30000,
            ...config
        };

        // 创建 axios 实例
        this.client = axios.create({
            baseURL: this.config.baseURL,
            timeout: this.config.timeout,
            httpsAgent: new https.Agent({
                keepAlive: true,
                rejectUnauthorized: this.config.rejectUnauthorized
            }),
            httpAgent: new http.Agent({
                keepAlive: true
            }),
            headers: {
                'User-Agent': 'drpy-node-webdav/1.0.0',
                ...this.config.headers
            }
        });

        // 设置身份验证
        if (this.config.username && this.config.password) {
            this.client.defaults.auth = {
                username: this.config.username,
                password: this.config.password
            };
        }

        // 添加响应拦截器处理错误
        this.client.interceptors.response.use(
            response => response,
            error => {
                if (error.response) {
                    const {status, statusText, data} = error.response;
                    throw new Error(`WebDAV Error ${status}: ${statusText}${data ? ` - ${data}` : ''}`);
                }
                throw error;
            }
        );
    }

    /**
     * 测试连接
     * @returns {Promise<boolean>} 连接是否成功
     */
    async testConnection() {
        try {
            await this.client.request({
                method: 'OPTIONS',
                url: '/'
            });
            return true;
        } catch (error) {
            logError('WebDAV connection test failed:', error.message);
            return false;
        }
    }

    /**
     * 获取目录内容
     * @param {string} [remotePath='/'] - 远程目录路径
     * @param {number} [depth=1] - 查询深度（0=仅属性，1=直接子项，infinity=所有子项）
     * @returns {Promise<Array>} 目录内容列表
     */
    async listDirectory(remotePath = '/', depth = 1) {
        try {
            // log('remotePath:',remotePath);
            const normalizedPath = this._normalizePath(remotePath);
            // log('normalizedPath:',normalizedPath)
            const response = await this.client.request({
                method: 'PROPFIND',
                url: normalizedPath,
                headers: {
                    'Depth': depth === Infinity ? 'infinity' : depth.toString(),
                    'Content-Type': 'application/xml'
                },
                data: `<?xml version="1.0" encoding="utf-8" ?>
                    <D:propfind xmlns:D="DAV:">
                        <D:allprop/>
                    </D:propfind>`
            });

            return this._parseMultiStatus(response.data, normalizedPath);
        } catch (error) {
            throw new Error(`Failed to list directory ${remotePath}: ${error.message}`);
        }
    }

    /**
     * 获取文件或目录信息
     * @param {string} remotePath - 远程路径
     * @returns {Promise<Object>} 文件/目录信息
     */
    async getInfo(remotePath) {
        try {
            const response = await this.client.request({
                method: 'PROPFIND',
                url: this._normalizePath(remotePath),
                headers: {
                    'Depth': '0',
                    'Content-Type': 'application/xml'
                },
                data: `<?xml version="1.0" encoding="utf-8" ?>
                    <D:propfind xmlns:D="DAV:">
                        <D:allprop/>
                    </D:propfind>`
            });

            // 添加调试信息
            if (Number(process.env.WEBDAV_DEBUG)) {
                log('WebDAV PROPFIND response for', remotePath, ':', response.data);
            }

            const items = this._parseMultiStatus(response.data);

            if (items.length === 0) {
                throw new Error(`Resource not found or no accessible properties: ${remotePath}`);
            }

            return items[0];
        } catch (error) {
            if (error.response && error.response.status === 404) {
                throw new Error(`Resource not found: ${remotePath}`);
            }
            throw new Error(`Failed to get info for ${remotePath}: ${error.message}`);
        }
    }

    /**
     * 检查文件或目录是否存在
     * @param {string} remotePath - 远程路径
     * @returns {Promise<boolean>} 是否存在
     */
    async exists(remotePath) {
        try {
            await this.getInfo(remotePath);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * 创建目录
     * @param {string} remotePath - 远程目录路径
     * @param {boolean} [recursive=false] - 是否递归创建父目录
     * @returns {Promise<boolean>} 创建是否成功
     */
    async createDirectory(remotePath, recursive = false) {
        try {
            const normalizedPath = this._normalizePath(remotePath);

            if (recursive) {
                const pathParts = normalizedPath.split('/').filter(part => part);
                let currentPath = '';

                for (const part of pathParts) {
                    currentPath += '/' + part;
                    if (!(await this.exists(currentPath))) {
                        await this.client.request({
                            method: 'MKCOL',
                            url: currentPath
                        });
                    }
                }
            } else {
                await this.client.request({
                    method: 'MKCOL',
                    url: normalizedPath
                });
            }

            return true;
        } catch (error) {
            throw new Error(`Failed to create directory ${remotePath}: ${error.message}`);
        }
    }

    /**
     * 上传文件
     * @param {string|Buffer|ReadableStream} source - 本地文件路径、Buffer 或可读流
     * @param {string} remotePath - 远程文件路径
     * @param {Object} [options] - 上传选项
     * @param {boolean} [options.overwrite=true] - 是否覆盖已存在的文件
     * @param {string} [options.contentType] - 内容类型
     * @param {Function} [options.onProgress] - 进度回调函数
     * @returns {Promise<boolean>} 上传是否成功
     */
    async uploadFile(source, remotePath, options = {}) {
        const {overwrite = true, contentType, onProgress} = options;

        try {
            const normalizedPath = this._normalizePath(remotePath);

            // 检查文件是否存在
            if (!overwrite && await this.exists(normalizedPath)) {
                throw new Error(`File ${remotePath} already exists and overwrite is disabled`);
            }

            let data;
            let headers = {};

            if (typeof source === 'string') {
                // 本地文件路径
                data = createReadStream(source);
                if (!contentType) {
                    headers['Content-Type'] = this._getContentType(source);
                }
            } else if (Buffer.isBuffer(source)) {
                // Buffer
                data = source;
                headers['Content-Length'] = source.length;
            } else {
                // 可读流
                data = source;
            }

            if (contentType) {
                headers['Content-Type'] = contentType;
            }

            await this.client.request({
                method: 'PUT',
                url: normalizedPath,
                data,
                headers,
                onUploadProgress: onProgress
            });

            return true;
        } catch (error) {
            throw new Error(`Failed to upload file to ${remotePath}: ${error.message}`);
        }
    }

    /**
     * 下载文件
     * @param {string} remotePath - 远程文件路径
     * @param {string} [localPath] - 本地保存路径，如果不提供则返回 Buffer
     * @param {Object} [options] - 下载选项
     * @param {Function} [options.onProgress] - 进度回调函数
     * @returns {Promise<Buffer|boolean>} 如果提供 localPath 返回 boolean，否则返回 Buffer
     */
    async downloadFile(remotePath, localPath, options = {}) {
        const {onProgress} = options;

        try {
            const normalizedPath = this._normalizePath(remotePath);

            const response = await this.client.request({
                method: 'GET',
                url: normalizedPath,
                responseType: localPath ? 'stream' : 'arraybuffer',
                onDownloadProgress: onProgress
            });

            if (localPath) {
                // 保存到本地文件
                const writeStream = createWriteStream(localPath);
                await pipeline(response.data, writeStream);
                return true;
            } else {
                // 返回 Buffer
                return Buffer.from(response.data);
            }
        } catch (error) {
            throw new Error(`Failed to download file ${remotePath}: ${error.message}`);
        }
    }

    /**
     * 获取文件流（用于直链服务）
     * @param {string} remotePath - 远程文件路径
     * @param {Object} [options] - 选项
     * @param {Object} [options.headers] - 额外的请求头（如 Range）
     * @returns {Promise<{stream: ReadableStream, headers: Object, size: number}>} 文件流和相关信息
     */
    async getFileStream(remotePath, options = {}) {
        try {
            const normalizedPath = this._normalizePath(remotePath);
            const {headers: extraHeaders = {}} = options;

            // 首先获取文件信息
            const fileInfo = await this.getInfo(normalizedPath);
            if (!fileInfo || fileInfo.isDirectory) {
                throw new Error(`File not found or is a directory: ${remotePath}`);
            }

            // 准备请求头
            const requestHeaders = {...extraHeaders};

            const response = await this.client.request({
                method: 'GET',
                url: normalizedPath,
                responseType: 'stream',
                headers: requestHeaders
            });

            return {
                stream: response.data,
                headers: response.headers,
                size: fileInfo.size,
                contentType: fileInfo.contentType || 'application/octet-stream',
                lastModified: fileInfo.lastModified,
                etag: fileInfo.etag
            };
        } catch (error) {
            throw new Error(`Failed to get file stream for ${remotePath}: ${error.message}`);
        }
    }

    /**
     * 删除文件或目录
     * @param {string} remotePath - 远程路径
     * @returns {Promise<boolean>} 删除是否成功
     */
    async delete(remotePath) {
        try {
            await this.client.request({
                method: 'DELETE',
                url: this._normalizePath(remotePath)
            });
            return true;
        } catch (error) {
            throw new Error(`Failed to delete ${remotePath}: ${error.message}`);
        }
    }

    /**
     * 移动文件或目录
     * @param {string} sourcePath - 源路径
     * @param {string} destinationPath - 目标路径
     * @param {boolean} [overwrite=false] - 是否覆盖目标
     * @returns {Promise<boolean>} 移动是否成功
     */
    async move(sourcePath, destinationPath, overwrite = false) {
        try {
            const headers = {
                'Destination': this._getAbsoluteUrl(destinationPath)
            };

            if (overwrite) {
                headers['Overwrite'] = 'T';
            }

            await this.client.request({
                method: 'MOVE',
                url: this._normalizePath(sourcePath),
                headers
            });

            return true;
        } catch (error) {
            throw new Error(`Failed to move ${sourcePath} to ${destinationPath}: ${error.message}`);
        }
    }

    /**
     * 复制文件或目录
     * @param {string} sourcePath - 源路径
     * @param {string} destinationPath - 目标路径
     * @param {boolean} [overwrite=false] - 是否覆盖目标
     * @returns {Promise<boolean>} 复制是否成功
     */
    async copy(sourcePath, destinationPath, overwrite = false) {
        try {
            // 首先检查源文件是否存在
            const sourceExists = await this.exists(sourcePath);
            if (!sourceExists) {
                throw new Error(`Source file does not exist: ${sourcePath}`);
            }

            // 规范化路径
            const normalizedSource = this._normalizePath(sourcePath);
            const normalizedDestination = this._normalizePath(destinationPath);

            // 构建目标 URL - 使用完整的绝对 URL
            const destinationUrl = this._getAbsoluteUrl(destinationPath);

            const headers = {
                'Destination': destinationUrl
            };

            if (overwrite) {
                headers['Overwrite'] = 'T';
            } else {
                headers['Overwrite'] = 'F';
            }

            // 添加调试信息
            if (Number(process.env.WEBDAV_DEBUG)) {
                log('WebDAV COPY operation:');
                log('  Source:', normalizedSource);
                log('  Destination URL:', destinationUrl);
                log('  Headers:', headers);
            }

            const response = await this.client.request({
                method: 'COPY',
                url: normalizedSource,
                headers
            });

            // 检查响应状态
            if (response.status >= 200 && response.status < 300) {
                return true;
            } else {
                throw new Error(`Unexpected response status: ${response.status}`);
            }

        } catch (error) {
            if (error.response) {
                const status = error.response.status;
                const statusText = error.response.statusText || 'Unknown Error';
                throw new Error(`Failed to copy ${sourcePath} to ${destinationPath}: WebDAV Error ${status}: ${statusText}`);
            }
            throw new Error(`Failed to copy ${sourcePath} to ${destinationPath}: ${error.message}`);
        }
    }

    /**
     * 获取文件内容（文本）
     * @param {string} remotePath - 远程文件路径
     * @param {string} [encoding='utf8'] - 文本编码
     * @returns {Promise<string>} 文件内容
     */
    async getFileContent(remotePath, encoding = 'utf8') {
        try {
            const buffer = await this.downloadFile(remotePath);
            return buffer.toString(encoding);
        } catch (error) {
            throw new Error(`Failed to get file content ${remotePath}: ${error.message}`);
        }
    }

    /**
     * 写入文件内容（文本）
     * @param {string} remotePath - 远程文件路径
     * @param {string} content - 文件内容
     * @param {string} [encoding='utf8'] - 文本编码
     * @param {boolean} [overwrite=true] - 是否覆盖已存在的文件
     * @returns {Promise<boolean>} 写入是否成功
     */
    async putFileContent(remotePath, content, encoding = 'utf8', overwrite = true) {
        try {
            const buffer = Buffer.from(content, encoding);
            return await this.uploadFile(buffer, remotePath, {overwrite});
        } catch (error) {
            throw new Error(`Failed to put file content ${remotePath}: ${error.message}`);
        }
    }

    // 私有方法

    /**
     * 标准化路径
     * 将输入路径转换为相对于 WebDAV 基础路径的路径
     * @private
     */
    _normalizePath(remotePath) {
        if (!remotePath) return '/';
        
        // 确保路径以 / 开头
        if (!remotePath.startsWith('/')) {
            remotePath = '/' + remotePath;
        }
        
        // 清理多余的斜杠
        remotePath = remotePath.replace(/\/+/g, '/');
        
        // 获取 WebDAV 基础路径
        const baseUrl = new URL(this.config.baseURL);
        const basePath = baseUrl.pathname;
        
        // 解码基础路径和输入路径以进行正确比较
        const decodedBasePath = decodeURIComponent(basePath);
        const decodedRemotePath = decodeURIComponent(remotePath);
        
        // 如果输入路径包含基础路径，则移除基础路径前缀
        if (decodedRemotePath.startsWith(decodedBasePath)) {
            let relativePath = decodedRemotePath.substring(decodedBasePath.length);
            
            // 确保相对路径以 / 开头
            if (!relativePath.startsWith('/')) {
                relativePath = '/' + relativePath;
            }
            
            // 如果结果只是 /，保持为 /
            return relativePath || '/';
        }
        
        // 如果输入路径不包含基础路径，直接返回（假设它已经是相对路径）
        return remotePath;
    }

    /**
     * 规范化从 WebDAV 响应中获取的路径
     * 移除 WebDAV 基础路径前缀，返回相对路径
     * @private
     */
    _normalizeResponsePath(responsePath) {
        if (!responsePath) return '';

        // 获取 WebDAV 基础路径（从 baseURL 中提取）
        const baseUrl = new URL(this.config.baseURL);
        let basePath = baseUrl.pathname;
        
        // 解码 basePath 以便正确比较
        try {
            basePath = decodeURIComponent(basePath);
        } catch (e) {
            logWarn('Failed to decode basePath:', basePath);
        }

        // 添加调试信息
        if (Number(process.env.WEBDAV_DEBUG)) {
            log('_normalizeResponsePath debug:');
            log('  Response path:', responsePath);
            log('  Base path:', basePath);
        }

        // 如果响应路径以基础路径开头，移除它
        if (responsePath.startsWith(basePath)) {
            let normalizedPath = responsePath.substring(basePath.length);

            // 确保路径以 / 开头
            if (!normalizedPath.startsWith('/')) {
                normalizedPath = '/' + normalizedPath;
            }

            // 如果结果只是 /，表示这是基础路径本身，返回空字符串
            if (normalizedPath === '/') {
                normalizedPath = '';
            }

            if (Number(process.env.WEBDAV_DEBUG)) {
                log('  Normalized path:', normalizedPath);
            }

            return normalizedPath;
        }

        // 如果不以基础路径开头，直接返回原路径
        if (Number(process.env.WEBDAV_DEBUG)) {
            log('  No normalization needed, returning:', responsePath);
        }

        return responsePath;
    }

    /**
     * 获取绝对 URL
     * @private
     */
    _getAbsoluteUrl(remotePath) {
        const normalizedPath = this._normalizePath(remotePath);

        // 确保 baseURL 以斜杠结尾
        let baseURL = this.config.baseURL;
        if (!baseURL.endsWith('/')) {
            baseURL += '/';
        }

        // 移除 normalizedPath 开头的斜杠，避免双斜杠
        const cleanPath = normalizedPath.startsWith('/') ? normalizedPath.substring(1) : normalizedPath;

        const absoluteUrl = new URL(cleanPath, baseURL).href;

        // 添加调试信息
        if (Number(process.env.WEBDAV_DEBUG)) {
            log('_getAbsoluteUrl debug:');
            log('  Input remotePath:', remotePath);
            log('  Normalized path:', normalizedPath);
            log('  Base URL:', baseURL);
            log('  Clean path:', cleanPath);
            log('  Final absolute URL:', absoluteUrl);
        }

        return absoluteUrl;
    }

    /**
     * 根据文件扩展名获取内容类型
     * @private
     */
    _getContentType(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
            '.txt': 'text/plain',
            '.html': 'text/html',
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.json': 'application/json',
            '.xml': 'application/xml',
            '.pdf': 'application/pdf',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.mp4': 'video/mp4',
            '.mp3': 'audio/mpeg',
            '.zip': 'application/zip'
        };
        return mimeTypes[ext] || 'application/octet-stream';
    }

    /**
     * 解析 WebDAV PROPFIND 响应
     * @private
     */
    _parseMultiStatus(xmlData, requestPath = null) {
        const items = [];

        try {
            // 使用 cheerio 解析 XML，设置 XML 模式
            const $ = cheerio.load(xmlData, {
                xmlMode: true,
                decodeEntities: true,
                lowerCaseAttributeNames: false
            });

            // 查找所有 response 元素（支持不同的命名空间）
            const responseElements = $('response, d\\:response, D\\:response').toArray();

            if (responseElements.length === 0) {
                logWarn('No response elements found in WebDAV XML');
                return this._parseMultiStatusFallback(xmlData);
            }

            responseElements.forEach((element) => {
                const $response = $(element);

                // 提取 href（支持不同的命名空间）
                let href = $response.find('href, d\\:href, D\\:href').first().text().trim();
                if (!href) {
                    logWarn('No href found in response element');
                    return;
                }

                // 解码 URL 编码的路径
                try {
                    href = decodeURIComponent(href);
                } catch (e) {
                    logWarn('Failed to decode href:', href);
                }

                // 规范化路径 - 移除 WebDAV 基础路径前缀
                let normalizedPath = this._normalizeResponsePath(href);

                // 如果规范化后的路径为空或者是根路径本身，跳过这个项目
                if (!normalizedPath || normalizedPath === '/' || normalizedPath === '') {
                    return;
                }

                // 如果有请求路径，排除与请求路径相同的项目（即目录本身）
                if (requestPath) {
                    // 将请求路径也进行相同的规范化处理，以便正确比较
                    const normalizedRequestPath = this._normalizePath(requestPath);
                    if (normalizedPath === normalizedRequestPath) {
                        return;
                    }
                }

                // 提取文件/目录名称
                let name = path.basename(normalizedPath);
                if (!name || name === '/') {
                    // 对于根目录或空名称，使用路径的最后部分
                    const pathParts = normalizedPath.split('/').filter(part => part.length > 0);
                    name = pathParts.length > 0 ? pathParts[pathParts.length - 1] : '/';
                }

                // 创建基本项目对象
                const item = {
                    name,
                    path: normalizedPath,
                    isDirectory: false,
                    size: 0,
                    lastModified: null,
                    contentType: null,
                    etag: null,
                    creationDate: null
                };

                // 查找 propstat 元素（支持不同的命名空间）
                const $propstat = $response.find('propstat, d\\:propstat, D\\:propstat').first();
                if ($propstat.length === 0) {
                    logWarn('No propstat found for', href);
                    return;
                }

                // 检查状态码
                const status = $propstat.find('status, d\\:status, D\\:status').text().trim();
                if (status && !status.includes('200')) {
                    logWarn('Non-200 status for', href, ':', status);
                    return;
                }

                const $prop = $propstat.find('prop, d\\:prop, D\\:prop').first();
                if ($prop.length === 0) {
                    logWarn('No prop found for', href);
                    return;
                }

                // 检查是否为目录（支持不同的命名空间）
                const $resourcetype = $prop.find('resourcetype, d\\:resourcetype, D\\:resourcetype').first();
                if ($resourcetype.find('collection, d\\:collection, D\\:collection').length > 0) {
                    item.isDirectory = true;
                }

                // 提取文件大小
                const contentLength = $prop.find('getcontentlength, d\\:getcontentlength, D\\:getcontentlength').text().trim();
                if (contentLength) {
                    const size = parseInt(contentLength, 10);
                    if (!isNaN(size)) {
                        item.size = size;
                    }
                }

                // 提取最后修改时间
                const lastModified = $prop.find('getlastmodified, d\\:getlastmodified, D\\:getlastmodified').text().trim();
                if (lastModified) {
                    const date = new Date(lastModified);
                    if (!isNaN(date.getTime())) {
                        item.lastModified = date;
                    }
                }

                // 提取创建时间
                const creationDate = $prop.find('creationdate, d\\:creationdate, D\\:creationdate').text().trim();
                if (creationDate) {
                    const date = new Date(creationDate);
                    if (!isNaN(date.getTime())) {
                        item.creationDate = date;
                    }
                }

                // 提取内容类型
                const contentType = $prop.find('getcontenttype, d\\:getcontenttype, D\\:getcontenttype').text().trim();
                if (contentType) {
                    item.contentType = contentType;
                }

                // 提取 ETag
                const etag = $prop.find('getetag, d\\:getetag, D\\:getetag').text().trim();
                if (etag) {
                    item.etag = etag.replace(/"/g, ''); // 移除引号
                }

                items.push(item);
            });

        } catch (error) {
            logWarn('Failed to parse WebDAV XML response with cheerio, falling back to regex:', error.message);

            // 回退到正则表达式解析
            return this._parseMultiStatusFallback(xmlData);
        }

        return items;
    }

    /**
     * 回退的 XML 解析方法（使用正则表达式）
     * @private
     */
    _parseMultiStatusFallback(xmlData) {
        const items = [];
        const responseRegex = /<(?:D:)?response[^>]*>([\s\S]*?)<\/(?:D:)?response>/gi;
        let match;

        while ((match = responseRegex.exec(xmlData)) !== null) {
            const responseXml = match[1];

            // 提取 href
            const hrefMatch = /<(?:D:)?href[^>]*>(.*?)<\/(?:D:)?href>/i.exec(responseXml);
            if (!hrefMatch) continue;

            const href = decodeURIComponent(hrefMatch[1]);
            const name = path.basename(href) || '/';

            // 提取属性
            const item = {
                name,
                path: href,
                isDirectory: false,
                size: 0,
                lastModified: null,
                contentType: null,
                etag: null,
                creationDate: null
            };

            // 检查是否为目录
            if (/<(?:D:)?resourcetype[^>]*>[\s\S]*?<(?:D:)?collection[^>]*\/?>[\s\S]*?<\/(?:D:)?resourcetype>/i.test(responseXml)) {
                item.isDirectory = true;
            }

            // 提取文件大小
            const sizeMatch = /<(?:D:)?getcontentlength[^>]*>(\d+)<\/(?:D:)?getcontentlength>/i.exec(responseXml);
            if (sizeMatch) {
                item.size = parseInt(sizeMatch[1], 10);
            }

            // 提取最后修改时间
            const lastModifiedMatch = /<(?:D:)?getlastmodified[^>]*>(.*?)<\/(?:D:)?getlastmodified>/i.exec(responseXml);
            if (lastModifiedMatch) {
                const date = new Date(lastModifiedMatch[1]);
                if (!isNaN(date.getTime())) {
                    item.lastModified = date;
                }
            }

            // 提取创建时间
            const creationDateMatch = /<(?:D:)?creationdate[^>]*>(.*?)<\/(?:D:)?creationdate>/i.exec(responseXml);
            if (creationDateMatch) {
                const date = new Date(creationDateMatch[1]);
                if (!isNaN(date.getTime())) {
                    item.creationDate = date;
                }
            }

            // 提取内容类型
            const contentTypeMatch = /<(?:D:)?getcontenttype[^>]*>(.*?)<\/(?:D:)?getcontenttype>/i.exec(responseXml);
            if (contentTypeMatch) {
                item.contentType = contentTypeMatch[1];
            }

            // 提取 ETag
            const etagMatch = /<(?:D:)?getetag[^>]*>(.*?)<\/(?:D:)?getetag>/i.exec(responseXml);
            if (etagMatch) {
                item.etag = etagMatch[1].replace(/"/g, '');
            }

            items.push(item);
        }

        return items;
    }
}

/**
 * 创建 WebDAV 客户端实例
 * @param {Object} config - 配置对象
 * @returns {WebDAVClient} WebDAV 客户端实例
 */
export function createWebDAVClient(config) {
    return new WebDAVClient(config);
}

// 默认导出
export default WebDAVClient;