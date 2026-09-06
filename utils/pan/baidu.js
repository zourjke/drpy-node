/**
 * 百度网盘API处理模块
 * 提供百度网盘分享链接解析、文件下载、保存等功能
 * 支持分享链接验证、文件列表获取、下载地址生成等操作
 */
import {log} from '../log.js';
import req from '../req.js';
import {ENV} from '../env.js';
import COOKIE from '../cookieManager.js';
import CryptoJS from "crypto-js";
import {join} from 'path';
import fs from 'fs';
import {PassThrough} from 'stream';

/**
 * 百度网盘处理类
 * 负责处理百度网盘分享链接的解析、验证、文件操作等功能
 */
// 所有 BaiduHandler 实例共享的清理目标集合（WeakRef 不阻止实例被 GC 回收）
const baiduCleanupTargets = new Set();
let baiduCleanupTimer = null;

function ensureBaiduCleanupTimer() {
    if (baiduCleanupTimer) return;
    baiduCleanupTimer = setInterval(() => {
        for (const ref of [...baiduCleanupTargets]) {
            const inst = ref.deref();
            if (!inst) {
                baiduCleanupTargets.delete(ref); // 实例已被 GC，顺手清掉登记项
                continue;
            }
            try {
                Promise.resolve(inst.clearSaveDir()).catch(() => {});
            } catch {}
        }
    }, 2 * 60 * 60 * 1000);
    baiduCleanupTimer.unref?.();
}

class BaiduHandler {
    /**
     * 构造函数 - 初始化百度网盘处理器
     */
    constructor() {
        // 初始化百度云盘处理类
        this._cookie = ENV.get('baidu_cookie') || ''; // 百度网盘Cookie
        this.regex = /https:\/\/pan\.baidu\.com\/s\/([^\\|#/]+)/; // 分享链接正则表达式
        // 默认请求头配置
        this.baseHeader = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Accept-Encoding': 'gzip',
            'Referer': 'https://pan.baidu.com',
            'Content-Type': 'application/x-www-form-urlencoded'
        };
        this.apiUrl = 'https://pan.baidu.com/'; // API基础URL
        this.shareTokenCache = {}; // 分享Token缓存
        this.saveDirName = 'drpy'; // 保存目录名称
        this.saveDirId = null; // 保存目录ID
        // 支持的字幕文件扩展名
        this.subtitleExts = ['.srt', '.ass', '.scc', '.stl', '.ttml'];
        // 支持的视频文件扩展名
        this.subvideoExts = ['.mp4', '.mkv', '.avi', '.rmvb', '.mov', '.flv', '.wmv', '.webm', '.3gp', '.mpeg', '.mpg', '.ts', '.mts', '.m2ts', '.vob', '.divx', '.xvid', '.m4v', '.ogv', '.f4v', '.rm', '.asf', '.dat', '.dv', '.m2v'];
        // 2小时自动清理保存目录：改为所有实例共享的全局单例定时器 (L5)。
        // 历史上每个实例自起一个 interval 且从不 clear，规则缓存驱逐重建后旧定时器永驻。
        // 用 WeakRef 集合登记实例：不钉住 GC、进程内始终只有 1 个常驻清理循环。
        baiduCleanupTargets.add(new WeakRef(this));
        ensureBaiduCleanupTimer();
    }

    /**
     * 释放本实例参与的清理登记（供缓存层 dispose 钩子调用）
     */
    destroy() {
        for (const ref of baiduCleanupTargets) {
            if (ref.deref() === this) {
                baiduCleanupTargets.delete(ref);
                break;
            }
        }
    }

    /**
     * 获取完整的Cookie
     * @returns {string} Cookie字符串
     */
    get cookie() {
        return (this._cookie || '').trim();
    }

    /**
     * 设置新的Cookie
     * @param {string} newCookie - 新的Cookie值
     */
    set cookie(newCookie) {
        log('更新cookie');
        this._cookie = newCookie;
    }

    /**
     * 解析分享链接获取分享数据
     * @param {string} url - 百度网盘分享链接
     * @returns {Object|null} 分享数据对象，包含shareId和sharePwd
     */
    getShareData(url) {
        this.clearSaveDir(); // 清理保存目录
        // 解析分享链接获取分享ID和密码
        try {
            url = decodeURIComponent(url).replace(/\s+/g, ''); // 解码并移除空白字符

            let shareId = '';
            let sharePwd = '';
            // 匹配分享链接格式
            const match = url.match(/pan\.baidu\.com\/(s\/|wap\/init\?surl=)([^?&#]+)/);
            if (!match) {
                return null;
            }
            shareId = match[2].replace(/^1+/, '').split('?')[0].split('#')[0];
            if (!shareId) {
                return null;
            }
            const pwdMatch = url.match(/(提取码|密码|pwd)=([^&\s]{4})/i);
            sharePwd = pwdMatch ? pwdMatch[2] : '';
            return {shareId, sharePwd};
        } catch (error) {
            return null;
        }
    }

    /**
     * 初始化百度网盘处理器
     * @param {Object} db - 数据库实例
     * @param {Object} cfg - 配置对象
     */
    async initBaidu(db, cfg) {
        // 初始化百度云盘
        if (this.cookie) {
            await this.createSaveDir();
        }
    }

    /**
     * 创建保存目录
     * @returns {string|null} 保存目录ID，失败时返回null
     */
    async createSaveDir() {
        // 创建保存目录
        if (!this.cookie) {
            return null;
        }
        try {
            const listResp = await this.api('api/list', {
                dir: '/',
                order: 'name',
                desc: 0,
                showempty: 0,
                web: 1,
                app_id: 250528
            }, {Cookie: this.cookie}, 'get');

            if (listResp.errno !== 0) {
                return null;
            }

            const drpyDir = listResp.list.find(item =>
                item.isdir === 1 && item.server_filename === this.saveDirName
            );

            if (drpyDir) {
                this.saveDirId = drpyDir.fs_id;
                return this.saveDirId;
            }

            const createResp = await this.api('api/create', {
                path: `/${this.saveDirName}`,
                isdir: 1,
                block_list: '[]',
                web: 1,
                app_id: 250528
            }, {Cookie: this.cookie}, 'post');

            if (createResp.errno !== 0) {
                return null;
            }

            this.saveDirId = createResp.fs_id;
            return this.saveDirId;
        } catch (error) {
            return null;
        }
    }

    /**
     * 发送API请求
     * @param {string} url - API端点URL
     * @param {Object} data - 请求数据
     * @param {Object} headers - 请求头
     * @param {string} method - 请求方法 (get/post)
     * @param {number} retry - 重试次数
     * @returns {Promise<Object>} API响应数据
     */
    async api(url, data = {}, headers = {}, method = 'post', retry = 3) {
        // 发送API请求
        const objectToQuery = (obj) => {
            return Object.entries(obj)
                .filter(([_, value]) => value !== undefined && value !== null)
                .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
                .join('&');
        };

        const fullUrl = `${this.apiUrl}${url}`;
        headers = {...this.baseHeader, ...headers, Cookie: this.cookie || ''};
        let resp;

        try {
            if (method === 'get') {
                const query = objectToQuery(data);
                const finalUrl = query ? `${fullUrl}?${query}` : fullUrl;
                resp = await req.get(finalUrl, {headers});
            } else {
                resp = await req.post(fullUrl, data, {headers});
            }
        } catch (err) {
            resp = err.response || {status: 500, data: {error: '请求失败'}};
        }

        if ([429, 503].includes(resp.status) && retry > 0) {
            const waitTime = (3 - retry + 1) * 1000;
            await this.delay(waitTime);
            return this.api(url, data, headers, method, retry - 1);
        }

        return resp.data !== undefined ? resp.data : resp;
    }

    /**
     * 验证分享链接
     * @param {Object} shareData - 分享数据对象
     * @param {string} shareData.shareId - 分享ID
     * @param {string} shareData.sharePwd - 分享密码
     * @returns {Promise<Object>} 验证结果
     */
    async verifyShare(shareData) {
        try {
            const shareVerify = await this.api(`share/verify?t=${Date.now()}&surl=${shareData.shareId}`, {
                pwd: shareData.sharePwd || '',
            }, {Cookie: this.cookie}, 'post');

            if (shareVerify.errno !== 0) {
                if (shareVerify.errno === -62 || shareVerify.errno === -9) {
                    log('提取码错误');
                }
                log('验证提取码失败');
            }

            // 更新cookie中的BDCLND
            if (shareVerify.randsk) {
                let cookie = this.cookie.replace(/BDCLND=[^;]*;?\s*/g, '');
                if (cookie.length > 0 && !cookie.endsWith(';')) cookie += '; ';
                cookie += `BDCLND=${shareVerify.randsk}`;
                this.cookie = cookie;
                log('已更新randsk到cookie中的BDCLND');
            }

            return shareVerify;
        } catch (error) {
            log('验证分享链接失败:', error.message);
            throw error;
        }
    }

    /**
     * 获取分享Token
     * @param {Object} shareData - 分享数据对象
     * @param {string} shareData.shareId - 分享ID
     * @param {string} shareData.sharePwd - 分享密码
     * @returns {Promise<Object>} 分享Token数据
     */
    async getShareToken(shareData) {
        // 先检查缓存，存在则直接返回
        if (this.shareTokenCache[shareData.shareId]) {
            return this.shareTokenCache[shareData.shareId];
        }

        // 缓存不存在时，执行获取令牌的逻辑
        try {
            // 等待验证完成
            const shareVerify = await this.verifyShare(shareData);

            // 验证完成后，执行获取文件列表的逻辑
            const headers = {...this.baseHeader, Cookie: this.cookie || ''};

            const listData = await this.api(`share/list`, {
                shorturl: shareData.shareId,
                root: 1,
                page: 1,
                num: 100
            }, {headers}, 'get');

            if (listData.errno !== 0) {
                if (listData.errno === -9) {
                    log('提取码错误');
                }
                log('获取文件列表失败');
            }

            // 设置缓存
            this.shareTokenCache[shareData.shareId] = {
                ...shareVerify,
                list: listData.list,
                uk: listData.uk || listData.share_uk,
                shareid: listData.share_id || shareVerify.share_id,
                randsk: shareVerify.randsk,
                sign: listData.sign || this.generateSign(shareData.shareId, shareData.sharePwd),
                timestamp: listData.timestamp || Date.now()
            };

            return this.shareTokenCache[shareData.shareId];
        } catch (error) {
            log('获取分享token失败:', error.message);
            throw error;
        }
    }


    /**
     * 生成签名
     * @param {string} shareId - 分享ID
     * @param {string} sharePwd - 分享密码
     * @returns {string} MD5签名字符串
     */
    generateSign(shareId, sharePwd) {
        // 生成签名
        const timestamp = Date.now();
        const str = `${shareId}${sharePwd}${timestamp}${this.cookie || ''}`;
        return CryptoJS.MD5(str).toString();
    }

    /**
     * 获取分享链接中的文件列表
     * @param {string|Object} shareInfo - 分享链接或分享数据对象
     * @returns {Promise<Object>} 包含视频文件和字幕文件的对象
     */
    async getFilesByShareUrl(shareInfo) {
        // 获取分享链接中的文件列表
        const shareData = typeof shareInfo === 'string' ? this.getShareData(shareInfo) : shareInfo;
        if (!shareData) return {videos: []};

        // 确保验证和获取令牌完成后再继续
        await this.getShareToken(shareData);
        if (!this.shareTokenCache[shareData.shareId]) return {videos: []};

        const cachedData = await this.shareTokenCache[shareData.shareId];
        const videos = [];
        const subtitles = [];

        const processDirectory = async (dirPath, dirFsId, parentDrpyPath = '') => {
            const shareDir = `/sharelink${cachedData.shareid}-${dirFsId}${dirPath}`;
            const headers = {...this.baseHeader, Cookie: this.cookie || ''};

            const dirListData = await this.api(`share/list`, {
                sekey: cachedData.randsk,
                uk: cachedData.uk,
                shareid: cachedData.shareid,
                page: 1,
                num: 100,
                dir: shareDir
            }, headers, 'get');
            if (dirListData.errno !== 0 || !dirListData.list) {
                return;
            }

            for (const item of dirListData.list) {
                if (item.isdir === 1 || item.isdir === '1') {
                    const subDirPath = `${dirPath}/${item.server_filename}`;
                    const subDrpyPath = `${parentDrpyPath}/${item.server_filename}`;
                    await processDirectory(subDirPath, item.fs_id, subDrpyPath);
                } else {
                    const ext = item.server_filename.substring(item.server_filename.lastIndexOf('.') || 0).toLowerCase();
                    const fileInfo = {
                        fid: item.fs_id,
                        file_name: item.server_filename,
                        size: item.size,
                        path: parentDrpyPath,
                        full_path: `/${this.saveDirName}${parentDrpyPath}/${item.server_filename}`,
                        file: true
                    };

                    if (this.subvideoExts.includes(ext)) {
                        videos.push(fileInfo);
                    } else if (this.subtitleExts.includes(ext)) {
                        subtitles.push(fileInfo);
                    }
                }
            }
        };

        if (cachedData.list) {
            for (const item of cachedData.list) {
                if (item.isdir === 1 || item.isdir === '1') {
                    const dirPath = `/${item.server_filename}`;
                    const drpyPath = `/${item.server_filename}`;
                    await processDirectory(dirPath, item.fs_id, drpyPath);
                } else {
                    const ext = item.server_filename.substring(item.server_filename.lastIndexOf('.') || 0).toLowerCase();
                    const fileInfo = {
                        fid: item.fs_id,
                        file_name: item.server_filename,
                        size: item.size,
                        path: '',
                        full_path: `/${this.saveDirName}/${item.server_filename}`,
                        file: true
                    };

                    if (this.subvideoExts.includes(ext)) {
                        videos.push(fileInfo);
                    } else if (this.subtitleExts.includes(ext)) {
                        subtitles.push(fileInfo);
                    }
                }
            }
        }

        const getBaseName = (fileName) => {
            const lastDotIndex = fileName.lastIndexOf('.');
            return lastDotIndex === -1 ? fileName : fileName.slice(0, lastDotIndex);
        };

        const subtitleMap = new Map();
        subtitles.forEach(sub => {
            const baseName = getBaseName(sub.file_name);
            if (!subtitleMap.has(baseName)) {
                subtitleMap.set(baseName, []);
            }
            subtitleMap.get(baseName).push(sub);
        });

        const videosWithSubtitles = videos.map(video => ({
            ...video,
            subtitles: subtitleMap.get(getBaseName(video.file_name)) || []
        }));
        return {videos: videosWithSubtitles};
    }

    /**
     * 获取文件下载链接
     * @param {string} shareId - 分享ID
     * @param {string} fileId - 文件ID
     * @param {string} filename - 文件名
     * @returns {Promise<Object|null>} 下载信息对象，失败时返回null
     */
    async getDownload(shareId, fileId, filename) {
        // 获取文件下载链接
        if (!this.shareTokenCache[shareId]) {
            return null;
        }

        if (!fileId || !filename) {
            return null;
        }

        if (!this.cookie) {
            return null;
        }

        const shareData = {shareId, sharePwd: this.shareTokenCache[shareId].sharePwd || ''};
        const isSaved = await this.save(shareData, fileId);
        if (!isSaved) {
            return null;
        }

        const headers = {...this.baseHeader, Cookie: this.cookie || ''};
        let retryCount = 1;
        const fullPath = `/${this.saveDirName}/${filename}`;

        while (retryCount >= 0) {
            try {
                const mediaInfo = await this.api(`api/mediainfo`, {
                    type: 'M3U8_FLV_264_480', path: fullPath, clienttype: 80, origin: 'dlna'
                }, headers, 'get');
                if (mediaInfo.info?.dlink) {
                    return {
                        dlink: mediaInfo.info.dlink,
                        headers,
                        full_path: fullPath
                    };
                }

                const downloadInfo = await this.api(`api/download`, {
                    type: 'download', path: fullPath, app_id: 250528
                }, headers, 'get');
                if (downloadInfo.info?.dlink) {
                    return {
                        dlink: downloadInfo.info.dlink,
                        headers,
                        is_direct: true,
                        full_path: fullPath
                    };
                }

                retryCount--;
                if (retryCount >= 0) {
                    await this.delay(1000);
                }
            } catch (error) {
                retryCount--;
                if (retryCount >= 0) await this.delay(1000);
            }
        }

        return null;
    }

    /**
     * 保存文件到指定目录
     * @param {Object} shareData - 分享数据对象
     * @param {string} fileFsId - 文件系统ID
     * @returns {Promise<boolean>} 保存是否成功
     */
    async save(shareData, fileFsId) {
        // 保存文件到指定目录
        if (!this.cookie) {
            return false;
        }

        if (!this.saveDirId) {
            this.saveDirId = await this.createSaveDir();
            if (!this.saveDirId) {
                return false;
            }
        }

        if (!this.shareTokenCache[shareData.shareId]) {
            await this.getShareToken(shareData);
            if (!this.shareTokenCache[shareData.shareId]) {
                return false;
            }
        }

        const headers = {
            ...this.baseHeader,
            Cookie: this.cookie || ''
        };

        const tokenData = await this.shareTokenCache[shareData.shareId];

        try {
            const transferResp = await this.api(`share/transfer?shareid=${tokenData.shareid}&from=${tokenData.uk}&sekey=${tokenData.randsk}&ondup=newcopy&async=1&channel=chunlei&web=1&app_id=250528`, {
                path: `/${this.saveDirName}`,
                fsidlist: JSON.stringify([fileFsId]),
            }, {
                headers
            }, 'post');
            if (transferResp.errno === 0) {
                return true;
            } else if (transferResp.errno === 113) {
                return true;
            } else if (transferResp.errno === -62 || transferResp.errno === -9) {
                delete this.shareTokenCache[shareData.shareId];
                return false;
            } else {
                return false;
            }
        } catch (error) {
            return false;
        }
    }

    /**
     * 延迟函数
     * @param {number} ms - 延迟毫秒数
     * @returns {Promise<void>} Promise对象
     */
    delay(ms) {
        // 延迟函数
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * 清理保存目录
     * 删除保存目录中的所有文件，释放存储空间
     * @returns {Promise<void>} Promise对象
     */
    async clearSaveDir() {
        // 清理保存目录
        if (!this.cookie) {
            return;
        }

        if (!this.saveDirId) {
            this.saveDirId = await this.createSaveDir();
            if (!this.saveDirId) {
                return;
            }
        }

        const getBdstoken = () => {
            // 从完整的 cookie 字符串中获取 bdstoken
            const fullCookie = this.cookie;
            if (!fullCookie) return null;

            const cookieParts = fullCookie.split(';');
            for (const part of cookieParts) {
                const trimmed = part.trim();
                if (trimmed.startsWith('bdstoken=')) {
                    return trimmed.substring('bdstoken='.length);
                }
            }
            return null;
        };

        let bdstoken = getBdstoken();
        if (!bdstoken) {
            try {
                const userInfo = await this.api('api/gettemplatevariable?clienttype=0&app_id=250528&web=1&fields=["bdstoken","token","uk","isdocuser","servertime"]', {}, {Cookie: this.cookie}, 'get');
                if (userInfo && userInfo.result && userInfo.result.bdstoken) {
                    bdstoken = userInfo.result.bdstoken;
                }
            } catch (error) {
                return;
            }
        }

        if (!bdstoken) {
            return;
        }

        try {
            const listResp = await this.api('api/list', {
                dir: `/${this.saveDirName}`,
                order: 'time',
                desc: 1,
                showempty: 0,
                web: 1,
                app_id: 250528,
                channel: 'chunlei'
            }, {Cookie: this.cookie}, 'get');

            if (listResp.errno !== 0) {
                return;
            }

            if (!listResp.list || listResp.list.length === 0) {
                return;
            }

            const headers = {
                'User-Agent': 'netdisk;1.4.2;22021211RC;android-android;12;JSbridge4.4.0;jointBridge;1.1.0;',
                Cookie: this.cookie || ''
            };

            const filePaths = listResp.list.map(item => `/${this.saveDirName}/${item.server_filename}`);
            const deleteResp = await this.api('api/filemanager?opera=delete', {
                filelist: JSON.stringify(filePaths),
                bdstoken: bdstoken
            }, headers, 'post');

            if (deleteResp.errno === 0) {
                log('清理保存目录成功');
            }
        } catch (error) {
            log('清理保存目录失败:', error.message);
            return;
        }
    }
}

export const Baidu = new BaiduHandler();