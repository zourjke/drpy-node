/**
 * 移动云盘（139邮箱云盘）API工具模块
 * 
 * 该模块提供与移动云盘（139邮箱云盘）交互的功能，包括：
 * - 分享链接解析
 * - 文件列表获取
 * - 文件下载链接获取
 * - 数据加密解密
 * 
 * @author drpy
 * @version 1.0.0
 */

import {log, logError} from '../log.js';
import axios from "axios";
import CryptoJS from "crypto-js";
import {ENV} from "../env.js";
import {boundedCache} from "../bounded-cache.js";

/**
 * 移动云盘驱动类
 * 
 * 提供移动云盘的完整API接口，支持分享链接解析、文件获取、下载等功能
 */
class YunDrive {
    /**
     * 构造函数 - 初始化移动云盘驱动
     * 
     * 设置必要的配置参数，包括正则表达式、加密密钥、API基础URL等
     */
    constructor() {
        // 移动云盘分享链接的正则表达式，支持更多格式
        this.regex = /https:\/\/(yun|caiyun)\.139\.com\/(shareweb\/#\/w\/i\/|sharewap\/#\/w\/i\/|w\/i\/)([^&\?]+)/;
        // AES加密密钥
        this.x = CryptoJS.enc.Utf8.parse("PVGDwmcvfs1uV3d1");
        // API基础URL
        this.baseUrl = 'https://share-kd-njs.yun.139.com/yun-share/richlifeApp/devapp/IOutLink/';
        // 默认请求头
        this.baseHeader = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json',
            'hcy-cool-flag': '1',
            'x-deviceinfo': '||3|12.27.0|chrome|131.0.0.0|5c7c68368f048245e1ce47f1c0f8f2d0||windows 10|1536X695|zh-CN|||'
        };
        // 分享链接ID
        this.linkID = '';
        // 缓存对象，用于存储API响应结果 (L11: 有界化——缓存值是整份目录 JSON，原先只增不减)
        this.cache = boundedCache({max: 100});
        // 授权token
        this.authorization = ''
    }

    /**
     * 初始化移动云盘驱动
     * 
     * 从环境变量中获取cookie和账号信息，并解析authorization token
     * 
     * @async
     * @returns {Promise<void>}
     */
    async init() {
        if (this.cookie) {
            log('移动cookie获取成功' + this.cookie)
            const cookie = this.cookie.split(';');
            if (this.authorization === '') {
                // 从cookie中提取authorization token
                cookie.forEach((item) => {
                    if (item.indexOf('authorization') !== -1) {
                        this.authorization = item.replace('authorization=', '');
                        log('authorization获取成功:' + this.authorization)
                    }
                })
            }
        } else {
            logError("请先获取移动cookie")
        }
        if (this.account) {
            log("移动账号获取成功")
        }
    }

    /**
     * 获取移动云盘cookie
     * 
     * @returns {string} 从环境变量中获取的cookie字符串
     */
    get cookie() {
        return ENV.get('yun_cookie')
    }

    /**
     * 获取移动云盘账号
     * 
     * @returns {string} 从环境变量中获取的账号字符串
     */
    get account() {
        return ENV.get('yun_account')
    }

    /**
     * 数据加密方法
     * 
     * 使用AES-CBC模式对数据进行加密，支持字符串和对象类型
     * 
     * @param {string|object} data - 需要加密的数据
     * @returns {string} Base64编码的加密结果
     */
    encrypt(data) {
        // 生成随机初始化向量
        let t = CryptoJS.lib.WordArray.random(16), n = "";
        if ("string" == typeof data) {
            // 字符串类型加密
            const o = CryptoJS.enc.Utf8.parse(data);
            n = CryptoJS.AES.encrypt(o, this.x, {iv: t, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7});
        } else if (typeof data === 'object' && data !== null) {
            // 对象类型先转JSON再加密
            const a = JSON.stringify(data), s = CryptoJS.enc.Utf8.parse(a);
            n = CryptoJS.AES.encrypt(s, this.x, {iv: t, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7});
        }
        // 返回IV和密文的Base64编码
        return CryptoJS.enc.Base64.stringify(t.concat(n.ciphertext));
    }

    /**
     * 数据解密方法
     * 
     * 解密使用AES-CBC模式加密的数据
     * 
     * @param {string} data - Base64编码的加密数据
     * @returns {string} 解密后的原始数据
     */
    decrypt(data) {
        // 解析Base64数据
        const t = CryptoJS.enc.Base64.parse(data), n = t.clone(), i = n.words.splice(4);
        // 分离IV和密文
        n.init(n.words), t.init(i);
        const o = CryptoJS.enc.Base64.stringify(t),
            // 执行AES解密
            a = CryptoJS.AES.decrypt(o, this.x, {iv: n, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7}),
            s = a.toString(CryptoJS.enc.Utf8);
        return s.toString();
    }

    /**
     * 从分享URL中提取分享ID
     * 
     * 支持多种格式的移动云盘分享链接
     * 
     * @async
     * @param {string} url - 移动云盘分享链接
     * @returns {Promise<void>}
     */
    async getShareID(url) {
        // 匹配多种格式的分享链接
        let matches = this.regex.exec(url);
        if (!matches) {
            // 处理yun.139.com和caiyun.139.com的/m/i格式
        matches = /https:\/\/(yun|caiyun)\.139\.com\/(sharewap\/)?#?\/?m\/i\?([^&]+)/.exec(url);
            if (matches && matches[3]) {
                this.linkID = matches[3];
                return;
            }
        }
        if (matches && matches[3]) {
            this.linkID = matches[3];
        }
    }

    /**
     * 获取分享信息
     * 
     * 通过API获取指定目录的分享信息，包含文件和文件夹列表
     * 
     * @async
     * @param {string} pCaID - 父目录ID，'root'表示根目录
     * @returns {Promise<object|null>} 分享信息对象，失败时返回null
     */
    async getShareInfo(pCaID) {
        if (!this.linkID) {
            logError('linkID is not set. Please call getShareID first.');
            return null;
        }
        // 检查缓存
        const cacheKey = `${this.linkID}-${pCaID}`;
        if (this.cache[cacheKey]) {
            return this.cache[cacheKey];
        }
        // 构造请求数据
        let data = JSON.stringify(this.encrypt(JSON.stringify({
            "getOutLinkInfoReq": {
                "account": "",
                "linkID": this.linkID,
                "passwd": "",
                "caSrt": 1,
                "coSrt": 1,
                "srtDr": 0,
                "bNum": 1,
                "pCaID": pCaID,
                "eNum": 200
            },
            "commonAccountInfo": {"account": "", "accountType": 1}
        })));

        try {
            // 发送API请求
            const resp = await axios.post(this.baseUrl + 'getOutLinkInfoV6', data, {headers: this.baseHeader});
            if (resp.status !== 200) {
                return null;
            }
            // 解密响应数据
            const json = JSON.parse(this.decrypt(resp.data)).data;
            // 缓存结果
            this.cache[cacheKey] = json;
            return json;
        } catch (error) {
            logError('Error processing share info:', error);
            return null;
        }
    }

    /**
     * 获取分享数据
     * 
     * 解析分享链接或目录ID，获取完整的文件结构
     * 
     * @async
     * @param {string} url - 分享链接或目录ID
     * @returns {Promise<object>} 文件结构对象，按目录名分组
     */
    async getShareData(url) {
        if (!url) {
            return {};
        }
        // 判断是URL还是目录ID
        const isValidUrl = url.startsWith('http');
        let pCaID = isValidUrl ? 'root' : url;
        if (isValidUrl) {
            await this.getShareID(url);
        }
        let file = {};
        // 获取文件信息
        let fileInfo = await this.getShareFile(pCaID);
        if (fileInfo && Array.isArray(fileInfo)) {
            // 并发获取所有文件的下载链接
            await Promise.all(fileInfo.map(async (item) => {
                if (!(item.name in file)) {
                    file[item.name] = [];
                }
                let filelist = await this.getShareUrl(item.path);
                if (filelist && filelist.length > 0) {
                    file[item.name].push(...filelist);
                }
            }));
        }
        // 清理空的文件夹
        for (let key in file) {
            if (file[key].length === 0) {
                delete file[key];
            }
        }
        // 如果没有找到文件，尝试获取根目录文件
        if (Object.keys(file).length === 0) {
            file['root'] = await this.getShareFile(url);
            if (file['root'] && Array.isArray(file['root'])) {
                file['root'] = file['root'].filter(item => item && Object.keys(item).length > 0);
            }
        }
        return file;
    }

    /**
     * 获取分享文件列表
     * 
     * 递归获取指定目录下的所有文件和子目录
     * 
     * @async
     * @param {string} pCaID - 目录ID或分享链接
     * @returns {Promise<Array|null>} 文件列表数组，失败时返回null
     */
    async getShareFile(pCaID) {
        if (!pCaID) {
            return null;
        }
        try {
            // 处理URL格式
            const isValidUrl = pCaID.startsWith('http');
            pCaID = isValidUrl ? 'root' : pCaID;
            // 获取目录信息
            const json = await this.getShareInfo(pCaID);
            if (!json || !json.caLst) {
                return null;
            }
            const caLst = json?.caLst;
            const names = caLst.map(it => it.caName);
            const rootPaths = caLst.map(it => it.path);
            // 过滤不需要的目录
            const filterRegex = /App|活动中心|免费|1T空间|免流/;
            const videos = [];
            if (caLst && caLst.length > 0) {
                // 添加符合条件的目录
                names.forEach((name, index) => {
                    if (!filterRegex.test(name)) {
                        videos.push({name: name, path: rootPaths[index]});
                    }
                });
                // 递归获取子目录内容
                let result = await Promise.all(rootPaths.map(async (path) => this.getShareFile(path)));
                result = result.filter(item => item !== undefined && item !== null);
                return [...videos, ...result.flat()];
            }
        } catch (error) {
            logError('Error processing share data:', error);
            return null;
        }
    }

    /**
     * 获取分享文件的下载链接
     * 
     * 获取指定目录下所有视频文件的下载信息
     * 
     * @async
     * @param {string} pCaID - 目录ID
     * @returns {Promise<Array|null>} 文件下载信息数组，失败时返回null
     */
    async getShareUrl(pCaID) {
        try {
            const json = await this.getShareInfo(pCaID);
            if (!json || !('coLst' in json)) {
                return null;
            }
            const coLst = json.coLst;
            if (coLst !== null) {
                // 过滤出视频文件（coType === 3）
                const filteredItems = coLst.filter(it => it && it.coType === 3);
                return filteredItems.map(it => ({
                    name: it.coName,
                    contentId: it.path,
                    linkID: this.linkID
                }));
            } else if (json.caLst !== null) {
                // 递归处理子目录
                const rootPaths = json.caLst.map(it => it.path);
                let result = await Promise.all(rootPaths.map(path => this.getShareUrl(path)));
                result = result.filter(item => item && item.length > 0);
                return result.flat();
            }
        } catch (error) {
            logError('Error processing share URL:', error);
            return null;
        }
    }

    /**
     * 获取文件播放链接
     * 
     * 通过contentId和linkID获取文件的直接播放链接
     * 
     * @async
     * @param {string} contentId - 文件内容ID
     * @param {string} linkID - 分享链接ID
     * @returns {Promise<string|undefined>} 播放链接，失败时返回undefined
     */
    async getSharePlay(contentId, linkID) {
        // 构造请求数据
        let data = {
            "getContentInfoFromOutLinkReq": {
                "contentId": contentId.split('/')[1],
                "linkID": linkID,
                "account": ""
            },
            "commonAccountInfo": {
                "account": "",
                "accountType": 1
            }
        };
        // 发送API请求
        let resp = await axios.post(this.baseUrl + 'getContentInfoFromOutLink', data, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Encoding': 'gzip, deflate, br, zstd',
                'Content-Type': 'application/json'
            }
        })
        if (resp.status === 200 && resp.data.data !== null) {
            let data = resp.data
            return data.data.contentInfo.presentURL
        }
    }

    /**
     * 获取文件下载链接
     * 
     * 通过contentId和linkID获取文件的直接下载链接（需要登录）
     * 
     * @async
     * @param {string} contentId - 文件内容ID
     * @param {string} linkID - 分享链接ID
     * @returns {Promise<string|undefined>} 下载链接，失败时返回undefined
     */
    async getDownload(contentId, linkID) {
        // 初始化认证信息
        await this.init()
        // 构造加密请求数据
        let data = this.encrypt(JSON.stringify({
            "dlFromOutLinkReqV3": {
                "linkID": linkID,
                "account": this.account,
                "coIDLst": {
                    "item": [contentId]
                }
            },
            "commonAccountInfo": {
                "account": this.account,
                "accountType": 1
            }
        }));
        // 发送API请求（需要authorization）
        let resp = await axios.post(this.baseUrl + 'dlFromOutLinkV3', data, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
                "Connection": "keep-alive",
                "Accept": "application/json, text/plain, */*",
                "Accept-Encoding": "gzip, deflate, br",
                "Content-Type": "application/json",
                "accept-language": "zh,en-GB;q=0.9,en-US;q=0.8,en;q=0.7,zh-CN;q=0.6",
                "authorization": this.authorization,
                "content-type": "application/json;charset=UTF-8",
                'hcy-cool-flag': '1',
                'x-deviceinfo': '||3|12.27.0|chrome|136.0.0.0|189f4426ca008b9cbe9bf9bd79723d77||windows 10|1536X695|zh|||'
            }
        })
        if (resp.status === 200) {
            // 解密响应获取下载链接
            let json = JSON.parse(this.decrypt(resp.data))
            return json.data.redrUrl
        }

    }
}

// 导出移动云盘实例
export const Yun = new YunDrive();
