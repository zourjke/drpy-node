/**
 * FTP 工具类
 *
 * 该模块提供了完整的 FTP 客户端功能，支持文件和目录的各种操作。
 * 基于 basic-ftp 实现，支持身份验证、SSL/TLS 配置等高级功能。
 *
 * 主要功能：
 * - FTP 服务器连接和身份验证
 * - 目录浏览和创建
 * - 文件上传、下载、删除
 * - 文件和目录信息获取
 * - 移动和重命名操作
 * - 支持被动模式和主动模式
 * - 支持 FTPS (FTP over SSL/TLS)
 *
 * @author drpy-node
 * @version 1.0.0
 */

import {logError, logWarn} from './log.js';
import { Client } from 'basic-ftp';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import path from 'path';
import { Readable, Writable } from 'stream';

/**
 * FTP 客户端类
 */
export class FTPClient {
    /**
     * 构造函数
     * @param {Object} config - 配置对象
     * @param {string} config.host - FTP 服务器主机名或 IP
     * @param {number} [config.port=21] - FTP 服务器端口
     * @param {string} [config.username] - 用户名
     * @param {string} [config.password] - 密码
     * @param {string} [config.basePath='/'] - FTP 服务器基础路径
     * @param {boolean} [config.secure=false] - 是否使用 FTPS (FTP over SSL/TLS)
     * @param {string} [config.secureOptions] - SSL/TLS 选项 ('explicit' 或 'implicit')
     * @param {boolean} [config.pasv=true] - 是否使用被动模式
     * @param {number} [config.timeout=30000] - 连接超时时间（毫秒）
     * @param {boolean} [config.verbose=false] - 是否启用详细日志
     */
    constructor(config) {
        this.config = {
            port: 21,
            basePath: '/',
            secure: false,
            secureOptions: 'explicit',
            pasv: true,
            timeout: 30000,
            verbose: false,
            ...config
        };

        this.client = null;
        this.isConnected = false;
        this.connectionPromise = null;
        
        // 添加请求队列来处理并发问题
        this.requestQueue = [];
        this.isProcessingQueue = false;
    }

    /**
     * 连接到 FTP 服务器
     * @returns {Promise<boolean>} 连接是否成功
     */
    async connect() {
        if (this.isConnected && this.client) {
            return true;
        }

        // 如果正在连接中，等待连接完成
        if (this.connectionPromise) {
            return await this.connectionPromise;
        }

        this.connectionPromise = this._doConnect();
        return await this.connectionPromise;
    }

    /**
     * 执行实际连接操作
     * @private
     */
    async _doConnect() {
        try {
            this.client = new Client(this.config.timeout);
            
            if (this.config.verbose) {
                this.client.ftp.verbose = true;
            }

            // 连接到服务器
            await this.client.access({
                host: this.config.host,
                port: this.config.port,
                user: this.config.username || 'anonymous',
                password: this.config.password || 'anonymous@',
                secure: this.config.secure,
                secureOptions: this.config.secureOptions
            });

            // 设置传输模式
            if (this.config.pasv) {
                this.client.ftp.ipFamily = 4; // 强制使用 IPv4
            }

            this.isConnected = true;
            this.connectionPromise = null;
            return true;
        } catch (error) {
            this.isConnected = false;
            this.connectionPromise = null;
            logError('FTP connection failed:', error.message);
            throw new Error(`Failed to connect to FTP server: ${error.message}`);
        }
    }

    /**
     * 断开连接
     * @returns {Promise<void>}
     */
    async disconnect() {
        if (this.client) {
            try {
                this.client.close();
            } catch (error) {
                logWarn('Error closing FTP connection:', error.message);
            }
            this.client = null;
        }
        this.isConnected = false;
        this.connectionPromise = null;
    }

    /**
     * 测试连接
     * @returns {Promise<boolean>} 连接是否成功
     */
    async testConnection() {
        try {
            const connected = await this.connect();
            if (connected) {
                // 尝试获取当前目录来验证连接
                await this.client.pwd();
                return true;
            }
            return false;
        } catch (error) {
            logError('FTP connection test failed:', error.message);
            return false;
        }
    }

    /**
     * 确保已连接
     * @private
     */
    async _ensureConnected() {
        if (!this.isConnected) {
            await this.connect();
        }
    }

    /**
     * 将操作添加到队列中执行，确保同一时间只有一个操作
     * @param {Function} operation - 要执行的操作函数
     * @returns {Promise} 操作结果
     */
    async _queueOperation(operation) {
        return new Promise((resolve, reject) => {
            this.requestQueue.push({
                operation,
                resolve,
                reject
            });
            this._processQueue();
        });
    }

    /**
     * 处理请求队列
     */
    async _processQueue() {
        if (this.isProcessingQueue || this.requestQueue.length === 0) {
            return;
        }

        this.isProcessingQueue = true;

        while (this.requestQueue.length > 0) {
            const { operation, resolve, reject } = this.requestQueue.shift();
            
            try {
                const result = await operation();
                resolve(result);
            } catch (error) {
                reject(error);
            }
        }

        this.isProcessingQueue = false;
    }

    /**
     * 获取目录内容
     * @param {string} [remotePath='/'] - 远程目录路径
     * @returns {Promise<Array>} 目录内容列表
     */
    async listDirectory(remotePath = '/') {
        return this._queueOperation(async () => {
            try {
                await this._ensureConnected();
                
                const fullPath = this._getFullPath(remotePath);
                const fileList = await this.client.list(fullPath);

                return fileList.map(item => ({
                    name: item.name,
                    path: this._joinPath(remotePath, item.name),
                    isDirectory: item.isDirectory,
                    isFile: item.isFile,
                    size: item.size || 0,
                    lastModified: item.modifiedAt ? new Date(item.modifiedAt).toISOString() : null,
                    permissions: item.permissions || null,
                    owner: item.user || null,
                    group: item.group || null,
                    contentType: item.isFile ? this._getContentType(item.name) : null,
                    etag: null, // FTP 不支持 ETag
                    creationDate: null // FTP 通常不提供创建日期
                }));
            } catch (error) {
                throw new Error(`Failed to list directory ${remotePath}: ${error.message}`);
            }
        });
    }

    /**
     * 获取文件或目录信息
     * @param {string} remotePath - 远程路径
     * @returns {Promise<Object>} 文件/目录信息
     */
    async getInfo(remotePath) {
        return this._queueOperation(async () => {
            try {
                await this._ensureConnected();
                
                const fullPath = this._getFullPath(remotePath);
                
                // 尝试获取父目录的文件列表来找到目标文件/目录
                const parentPath = path.dirname(fullPath);
                const fileName = path.basename(fullPath);
                
                const fileList = await this.client.list(parentPath === '.' ? '/' : parentPath);
                const item = fileList.find(file => file.name === fileName);
                
                if (!item) {
                    throw new Error(`Resource not found: ${remotePath}`);
                }

                return {
                    name: item.name,
                    path: remotePath,
                    isDirectory: item.isDirectory,
                    isFile: item.isFile,
                    size: item.size || 0,
                    lastModified: item.modifiedAt ? new Date(item.modifiedAt).toISOString() : null,
                    permissions: item.permissions || null,
                    owner: item.user || null,
                    group: item.group || null,
                    contentType: item.isFile ? this._getContentType(item.name) : null,
                    etag: null,
                    creationDate: null
                };
            } catch (error) {
                if (error.message.includes('Resource not found')) {
                    throw error;
                }
                throw new Error(`Failed to get info for ${remotePath}: ${error.message}`);
            }
        });
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
            await this._ensureConnected();
            
            const fullPath = this._getFullPath(remotePath);

            if (recursive) {
                await this.client.ensureDir(fullPath);
            } else {
                await this.client.send(`MKD ${fullPath}`);
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
     * @param {Function} [options.onProgress] - 进度回调函数
     * @returns {Promise<boolean>} 上传是否成功
     */
    async uploadFile(source, remotePath, options = {}) {
        const { overwrite = true, onProgress } = options;

        try {
            await this._ensureConnected();
            
            const fullPath = this._getFullPath(remotePath);

            // 检查文件是否存在
            if (!overwrite && await this.exists(remotePath)) {
                throw new Error(`File ${remotePath} already exists and overwrite is disabled`);
            }

            let sourceStream;

            if (typeof source === 'string') {
                // 本地文件路径
                sourceStream = createReadStream(source);
            } else if (Buffer.isBuffer(source)) {
                // Buffer
                sourceStream = Readable.from(source);
            } else {
                // 可读流
                sourceStream = source;
            }

            // 设置进度跟踪
            if (onProgress) {
                this.client.trackProgress(info => {
                    onProgress({
                        loaded: info.bytes,
                        total: info.bytesOverall || 0
                    });
                });
            }

            await this.client.uploadFrom(sourceStream, fullPath);

            // 清除进度跟踪
            if (onProgress) {
                this.client.trackProgress();
            }

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
        const { onProgress } = options;

        try {
            await this._ensureConnected();
            
            const fullPath = this._getFullPath(remotePath);

            // 设置进度跟踪
            if (onProgress) {
                this.client.trackProgress(info => {
                    onProgress({
                        loaded: info.bytes,
                        total: info.bytesOverall || 0
                    });
                });
            }

            if (localPath) {
                // 保存到本地文件
                const writeStream = createWriteStream(localPath);
                await this.client.downloadTo(writeStream, fullPath);
                
                // 清除进度跟踪
                if (onProgress) {
                    this.client.trackProgress();
                }
                
                return true;
            } else {
                // 返回 Buffer
                const chunks = [];
                const writeStream = new Writable({
                    write(chunk, encoding, callback) {
                        chunks.push(chunk);
                        callback();
                    }
                });

                await this.client.downloadTo(writeStream, fullPath);
                
                // 清除进度跟踪
                if (onProgress) {
                    this.client.trackProgress();
                }
                
                return Buffer.concat(chunks);
            }
        } catch (error) {
            throw new Error(`Failed to download file ${remotePath}: ${error.message}`);
        }
    }

    /**
     * 获取文件流（用于直链服务）
     * @param {string} remotePath - 远程文件路径
     * @param {Object} [options] - 选项
     * @param {Object} [options.headers] - 额外的请求头（如 Range）- FTP 不支持，但保持接口一致性
     * @returns {Promise<{stream: ReadableStream, headers: Object, size: number}>} 文件流和相关信息
     */
    async getFileStream(remotePath, options = {}) {
            try {
                await this._ensureConnected();
                
                const fullPath = this._getFullPath(remotePath);
                
                // 首先获取文件信息（直接调用，避免队列嵌套）
                const parentPath = path.dirname(fullPath);
                const fileName = path.basename(fullPath);
                
                const fileList = await this.client.list(parentPath === '.' ? '/' : parentPath);
                const item = fileList.find(file => file.name === fileName);
                
                if (!item) {
                    throw new Error(`Resource not found: ${remotePath}`);
                }
                
                if (item.isDirectory) {
                    throw new Error(`File not found or is a directory: ${remotePath}`);
                }
                
                const fileInfo = {
                    name: item.name,
                    path: remotePath,
                    isDirectory: item.isDirectory,
                    isFile: item.isFile,
                    size: item.size || 0,
                    lastModified: item.modifiedAt ? new Date(item.modifiedAt).toISOString() : null,
                    contentType: item.isFile ? this._getContentType(item.name) : null
                };

                // 检查是否有范围请求
                const rangeHeader = options.headers && options.headers.Range;
                let start = 0;
                let end = fileInfo.size - 1;
                let isRangeRequest = false;

                if (rangeHeader) {
                    const rangeMatch = rangeHeader.match(/bytes=(\d+)-(\d*)/);
                    if (rangeMatch) {
                        start = parseInt(rangeMatch[1], 10);
                        end = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : fileInfo.size - 1;
                        isRangeRequest = true;
                    }
                }

                // 创建一个可读流
                const stream = new Readable({
                    read() {}
                });

                // 创建一个可写流来接收数据并转发到可读流
                let bytesReceived = 0;
                let bytesToSkip = start;
                let bytesToRead = end - start + 1;

                const writeStream = new Writable({
                    write(chunk, encoding, callback) {
                        if (isRangeRequest) {
                            // 跳过开始字节
                            if (bytesToSkip > 0) {
                                if (chunk.length <= bytesToSkip) {
                                    bytesToSkip -= chunk.length;
                                    callback();
                                    return;
                                } else {
                                    chunk = chunk.slice(bytesToSkip);
                                    bytesToSkip = 0;
                                }
                            }

                            // 限制读取字节数
                            if (bytesToRead <= 0) {
                                callback();
                                return;
                            }

                            if (chunk.length > bytesToRead) {
                                chunk = chunk.slice(0, bytesToRead);
                            }

                            bytesToRead -= chunk.length;
                        }

                        stream.push(chunk);
                        bytesReceived += chunk.length;
                        callback();

                        // 如果是范围请求且已读取完所需字节，结束流
                        if (isRangeRequest && bytesToRead <= 0) {
                            stream.push(null);
                        }
                    }
                });

                // 当写入完成时结束可读流
                writeStream.on('finish', () => {
                    if (!isRangeRequest || bytesToRead > 0) {
                        stream.push(null);
                    }
                });

                writeStream.on('error', (error) => {
                    stream.destroy(error);
                });

                // 使用 FTP 客户端下载文件到写入流
                this.client.downloadTo(writeStream, fullPath).catch(error => {
                    stream.destroy(error);
                });

                const contentLength = isRangeRequest ? (end - start + 1) : fileInfo.size;

                return {
                    stream,
                    headers: {
                        'content-type': fileInfo.contentType || 'application/octet-stream',
                        'content-length': contentLength.toString(),
                        'last-modified': fileInfo.lastModified || new Date().toISOString(),
                        'cache-control': 'public, max-age=3600',
                        ...(isRangeRequest && {
                            'content-range': `bytes ${start}-${end}/${fileInfo.size}`,
                            'accept-ranges': 'bytes'
                        })
                    },
                    size: contentLength,
                    contentType: fileInfo.contentType || 'application/octet-stream',
                    lastModified: fileInfo.lastModified,
                    etag: null, // FTP 不支持 ETag
                    isRangeRequest,
                    start,
                    end,
                    totalSize: fileInfo.size,
                    fileInfo
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
            await this._ensureConnected();
            
            const fullPath = this._getFullPath(remotePath);
            
            // 检查是文件还是目录
            const info = await this.getInfo(remotePath);
            
            if (info.isDirectory) {
                await this.client.removeDir(fullPath);
            } else {
                await this.client.remove(fullPath);
            }
            
            return true;
        } catch (error) {
            throw new Error(`Failed to delete ${remotePath}: ${error.message}`);
        }
    }

    /**
     * 移动/重命名文件或目录
     * @param {string} sourcePath - 源路径
     * @param {string} destinationPath - 目标路径
     * @param {boolean} [overwrite=false] - 是否覆盖目标（FTP 通常不支持此选项）
     * @returns {Promise<boolean>} 移动是否成功
     */
    async move(sourcePath, destinationPath, overwrite = false) {
        try {
            await this._ensureConnected();
            
            const fullSourcePath = this._getFullPath(sourcePath);
            const fullDestinationPath = this._getFullPath(destinationPath);

            // 检查目标是否存在
            if (!overwrite && await this.exists(destinationPath)) {
                throw new Error(`Destination ${destinationPath} already exists and overwrite is disabled`);
            }

            await this.client.rename(fullSourcePath, fullDestinationPath);
            return true;
        } catch (error) {
            throw new Error(`Failed to move ${sourcePath} to ${destinationPath}: ${error.message}`);
        }
    }

    /**
     * 复制文件或目录（FTP 不直接支持复制，通过下载再上传实现）
     * @param {string} sourcePath - 源路径
     * @param {string} destinationPath - 目标路径
     * @param {boolean} [overwrite=false] - 是否覆盖目标
     * @returns {Promise<boolean>} 复制是否成功
     */
    async copy(sourcePath, destinationPath, overwrite = false) {
        try {
            await this._ensureConnected();

            // 检查源文件是否存在
            const sourceInfo = await this.getInfo(sourcePath);
            if (!sourceInfo) {
                throw new Error(`Source file does not exist: ${sourcePath}`);
            }

            // 检查目标是否存在
            if (!overwrite && await this.exists(destinationPath)) {
                throw new Error(`Destination ${destinationPath} already exists and overwrite is disabled`);
            }

            if (sourceInfo.isDirectory) {
                // 复制目录（递归）
                await this.createDirectory(destinationPath, true);
                const files = await this.listDirectory(sourcePath);
                
                for (const file of files) {
                    const srcPath = this._joinPath(sourcePath, file.name);
                    const destPath = this._joinPath(destinationPath, file.name);
                    await this.copy(srcPath, destPath, overwrite);
                }
            } else {
                // 复制文件
                const buffer = await this.downloadFile(sourcePath);
                await this.uploadFile(buffer, destinationPath, { overwrite });
            }

            return true;
        } catch (error) {
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
            return await this.uploadFile(buffer, remotePath, { overwrite });
        } catch (error) {
            throw new Error(`Failed to put file content ${remotePath}: ${error.message}`);
        }
    }

    // 私有方法

    /**
     * 标准化路径
     * 将输入路径转换为相对于 FTP 基础路径的路径
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
        
        // 获取 FTP 基础路径
        let basePath = this.config.basePath || '/';
        
        // 确保基础路径以 / 开头和结尾
        if (!basePath.startsWith('/')) {
            basePath = '/' + basePath;
        }
        if (!basePath.endsWith('/')) {
            basePath = basePath + '/';
        }
        
        // 如果输入路径包含基础路径，则移除基础路径前缀
        if (remotePath.startsWith(basePath)) {
            let relativePath = remotePath.substring(basePath.length);
            
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
     * 获取完整的 FTP 路径
     * 将相对路径转换为包含 basePath 的完整路径
     * @private
     */
    _getFullPath(remotePath) {
        const normalizedPath = this._normalizePath(remotePath);
        
        // 获取 FTP 基础路径
        let basePath = this.config.basePath || '/';
        
        // 确保基础路径以 / 开头但不以 / 结尾（除非是根路径）
        if (!basePath.startsWith('/')) {
            basePath = '/' + basePath;
        }
        if (basePath !== '/' && basePath.endsWith('/')) {
            basePath = basePath.slice(0, -1);
        }
        
        // 如果基础路径是根路径，直接返回规范化的路径
        if (basePath === '/') {
            return normalizedPath;
        }
        
        // 移除 normalizedPath 开头的斜杠，避免双斜杠
        const cleanPath = normalizedPath.startsWith('/') ? normalizedPath.substring(1) : normalizedPath;
        
        // 如果 cleanPath 为空，返回基础路径
        if (!cleanPath || cleanPath === '/') {
            return basePath;
        }
        
        return basePath + '/' + cleanPath;
    }

    /**
     * 规范化从 FTP 响应中获取的路径
     * 移除 FTP 基础路径前缀，返回相对路径
     * @private
     */
    _normalizeResponsePath(responsePath) {
        if (!responsePath) return '';

        // 获取 FTP 基础路径
        let basePath = this.config.basePath || '/';
        
        // 确保基础路径以 / 开头但不以 / 结尾（除非是根路径）
        if (!basePath.startsWith('/')) {
            basePath = '/' + basePath;
        }
        if (basePath !== '/' && basePath.endsWith('/')) {
            basePath = basePath.slice(0, -1);
        }

        // 如果响应路径以基础路径开头，移除它
        if (responsePath.startsWith(basePath)) {
            let normalizedPath = responsePath.substring(basePath.length);

            // 确保路径以 / 开头
            if (!normalizedPath.startsWith('/')) {
                normalizedPath = '/' + normalizedPath;
            }

            return normalizedPath;
        }

        // 如果不以基础路径开头，直接返回原路径
        return responsePath;
    }

    /**
     * 连接路径
     * @private
     */
    _joinPath(basePath, fileName) {
        const normalized = this._normalizePath(basePath);
        if (normalized === '/') {
            return '/' + fileName;
        }
        // 确保不会产生双斜杠
        const separator = normalized.endsWith('/') ? '' : '/';
        return normalized + separator + fileName;
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
            '.htm': 'text/html',
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
            '.ico': 'image/x-icon',
            '.bmp': 'image/bmp',
            '.webp': 'image/webp',
            '.mp3': 'audio/mpeg',
            '.wav': 'audio/wav',
            '.ogg': 'audio/ogg',
            '.mp4': 'video/mp4',
            '.avi': 'video/x-msvideo',
            '.mov': 'video/quicktime',
            '.wmv': 'video/x-ms-wmv',
            '.flv': 'video/x-flv',
            '.webm': 'video/webm',
            '.zip': 'application/zip',
            '.rar': 'application/x-rar-compressed',
            '.7z': 'application/x-7z-compressed',
            '.tar': 'application/x-tar',
            '.gz': 'application/gzip',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.xls': 'application/vnd.ms-excel',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            '.ppt': 'application/vnd.ms-powerpoint',
            '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        };

        return mimeTypes[ext] || 'application/octet-stream';
    }
}

/**
 * 创建 FTP 客户端实例的工厂函数
 * @param {Object} config - 配置对象
 * @returns {FTPClient} FTP 客户端实例
 */
export function createFTPClient(config) {
    return new FTPClient(config);
}

export default FTPClient;