/**
 * 百度网盘解析模块 - 秋秋版本
 * 提供百度网盘分享链接的解析和文件获取功能
 * 支持获取分享文件列表、生成播放链接等操作
 */
import '../../libs_drpy/jsencrypt.js'
import {ENV} from "../env.js";
import axios from "axios";
import qs from "qs";

/**
 * 百度网盘驱动类
 * 用于解析百度网盘分享链接，获取文件信息和播放地址
 */
class BaiduDrive {
    /**
     * 构造函数 - 初始化百度网盘相关配置
     */
    constructor() {
        // 百度网盘分享链接正则表达式
        this.regex = /https:\/\/pan\.baidu\.com\/s\/(.*)\?.*?pwd=([^&]+)/;
        // 支持的视频质量类型
        this.type = ["M3U8_AUTO_4K", "M3U8_AUTO_2K", "M3U8_AUTO_1080", "M3U8_AUTO_720", "M3U8_AUTO_480"];
        // 请求头配置
        this.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
            "Connection": "keep-alive",
            "Accept": "application/json, text/plain, */*",
            "Accept-Encoding": "gzip, deflate, br",
            "Accept-Language": "zh,en-GB;q=0.9,en-US;q=0.8,en;q=0.7,zh-CN;q=0.6"
        };
        // 百度网盘API基础地址
        this.api = 'https://pan.baidu.com';
        // 分享链接
        this.link = ''
        // 提取码
        this.pwd = '';
        // 短链接标识
        this.surl = '';
        // 短链接（去掉首字符）
        this.shorturl = ''
        // 分享ID
        this.shareid = '';
        // 应用ID
        this.app_id = 250528;
        // 视图模式
        this.view_mode = 1;
        // 渠道标识
        this.channel = 'chunlei';
    }

    /**
     * 格式化文件大小
     * @param {number} bytes - 文件字节数
     * @returns {string} 格式化后的大小字符串
     */
    formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let i = 0;
        let size = bytes;
        while (size >= 1024 && i < units.length - 1) {
            size /= 1024;
            i++;
        }
        return size.toFixed(2) + ' ' + units[i];
    }

    /**
     * 初始化方法，加载本地配置
     * @returns {Promise<void>}
     */
    async init() {
        if (this.cookie) {
            console.log('百度网盘cookie获取成功' + this.cookie)
        }
    }

    /**
     * 获取百度网盘Cookie
     * @returns {string} 百度网盘Cookie
     */
    get cookie() {
        return ENV.get('baidu_cookie')
    }

    /**
     * 解析分享链接，提取surl和密码
     * @param {string} url - 百度网盘分享链接
     * @returns {Promise<void>}
     */
    async getSurl(url) {
        this.link = url
        const matches = this.regex.exec(url);
        if (matches && matches[1]) {
            this.surl = matches[1];
            // 去掉首字符的短链接
            this.shorturl = this.surl.split('').slice(1).join('')
            this.pwd = matches[2] || '';
        }
    }

    /**
     * 获取签名信息
     * @returns {Promise<string>} 签名字符串
     */
    async getSign() {
        let data = (await axios.get(`${this.api}/share/tplconfig?surl=${this.surl}&fields=Espace_info,card_info,sign,timestamp&view_mode=${this.view_mode}&channel=${this.channel}&web=1&app_id=${this.app_id}`, {
            headers: this.headers
        })).data
        return data.data.sign
    }

    /**
     * 获取分享数据的主入口方法
     * @param {string} link - 百度网盘分享链接
     * @returns {Promise<Object>} 分享文件数据
     */
    async getShareData(link) {
        await this.getSurl(link)
        return await this.getShareList()
    }

    /**
     * 获取随机密钥(randsk)并更新Cookie
     * @returns {Promise<string>} 随机密钥
     */
    async getRandsk() {
        // 构造验证请求数据
        let data = qs.stringify({
            'pwd': this.pwd,
            'vcode': '',
            'vcode_str': ''
        });
        // 发送验证请求获取randsk
        let randsk = (await axios.post(`${this.api}/share/verify?surl=${this.shorturl}&pwd=${this.pwd}`, data, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
                'Referer': this.link,
            }
        })).data.randsk
        let BDCLND = "BDCLND=" + randsk
        // 更新Cookie中的BDCLND值
        if (!this.cookie.includes('BDCLND')) {
            let cookie = this.cookie + BDCLND
            ENV.set('baidu_cookie', cookie)
            return randsk
        } else {
            let cookie = this.cookie.split(';').map(it => {
                if (/BDCLND/.test(it)) {
                    it = BDCLND
                }
                return it
            }).join(';')
            if (cookie !== this.cookie) {
                ENV.set('baidu_cookie', cookie);
            }
            return randsk
        }
    }

    /**
     * 获取分享文件列表
     * @returns {Promise<Object>} 文件列表对象
     */
    async getShareList() {
        await this.getRandsk()
        this.headers['cookie'] = this.cookie
        // 获取分享根目录文件列表
        let data = (await axios.get(`${this.api}/share/list?web=5&app_id=${this.app_id}&desc=1&showempty=0&page=1&num=20&order=time&shorturl=${this.shorturl}&root=1&view_mode=${this.view_mode}&channel=${this.channel}&web=1&clienttype=0`, {
            headers: this.headers
        })).data
        if (data.errno === 0 && data.list.length > 0) {
            let file = {}
            let dirs = [] // 目录列表
            let videos = [] // 视频文件列表
            this.uk = data.uk
            this.shareid = data.share_id
            // 遍历文件列表，分类处理
            data.list.map(item => {
                // 目录类型 (category: 6)
                if (item.category === '6' || item.category === 6) {
                    dirs.push(item.path)
                }
                // 视频类型 (category: 1)
                if (item.category === '1' || item.category === 1) {
                    // 确保所有情况下都提取文件名
                    const fileName = item.server_filename || item.path.split('/').pop();

                    // 提取缩略图
                    let thumbnail = '';
                    if (item.thumbs) {
                        thumbnail = item.thumbs.url || item.thumbs.icon || '';
                    } else if (item.icon) {
                        thumbnail = item.icon;
                    }

                    videos.push({
                        name: fileName,
                        path: item.path.replaceAll('#', '\0'),
                        uk: this.uk,
                        shareid: this.shareid,
                        fsid: item.fs_id || item.fsid,
                        size: item.size,
                        formatted_size: this.formatFileSize(item.size),
                        thumbnail: thumbnail
                    })
                }
            });
            // 初始化文件对象
            if (!(data.title in file) && data.title !== undefined) {
                file[data.title] = [];
            }
            if (videos.length >= 0 && data.title !== undefined) {
                file[data.title] = [...videos]
            }
            // 递归获取子目录中的文件
            let result = await Promise.all(dirs.map(async (path) => this.getSharepath(path)))
            result = result.filter(item => item !== undefined && item !== null).flat()
            if (result.length >= 0) {
                // 确保递归获取的文件也正确处理文件名
                const processedResult = result.map(item => {
                    if (item.name && item.name.includes('/')) {
                        item.name = item.name.split('/').pop();
                    }
                    return item;
                });
                file[data.title].push(...processedResult);
            }
            return file;
        }
    }

    /**
     * 获取指定路径下的文件列表（递归）
     * @param {string} path - 目录路径
     * @returns {Promise<Array>} 文件列表数组
     */
    async getSharepath(path) {
        await this.getRandsk()
        this.headers['cookie'] = this.cookie
        // 获取指定目录下的文件列表
        let data = (await axios.get(`${this.api}/share/list?is_from_web=true&uk=${this.uk}&shareid=${this.shareid}&order=name&desc=0&showempty=0&view_mode=${this.view_mode}&web=1&page=1&num=100&dir=${encodeURIComponent(path)}&channel=${this.channel}&web=1&app_id=${this.app_id}`, {
            headers: this.headers
        })).data
        if (data.errno === 0 && data.list.length > 0) {
            let dirs = [] // 子目录列表
            let videos = [] // 视频文件列表
            // 遍历当前目录文件
            data.list.map(item => {
                // 目录类型
                if (item.category === '6' || item.category === 6) {
                    dirs.push(item.path)
                }
                // 视频类型
                if (item.category === '1' || item.category === 1) {
                    // 确保所有情况下都提取文件名
                    const fileName = item.server_filename || item.path.split('/').pop();

                    // 提取缩略图
                    let thumbnail = '';
                    if (item.thumbs) {
                        thumbnail = item.thumbs.url || item.thumbs.icon || '';
                    } else if (item.icon) {
                        thumbnail = item.icon;
                    }

                    videos.push({
                        name: fileName,
                        path: item.path.replaceAll('#', '\0'),
                        uk: this.uk,
                        shareid: this.shareid,
                        fsid: item.fs_id || item.fsid,
                        size: item.size,
                        formatted_size: this.formatFileSize(item.size),
                        thumbnail: thumbnail
                    })
                }
            });
            // 递归处理子目录
            let result = await Promise.all(dirs.map(async (path) => this.getSharepath(path)))
            result = result.filter(item => item !== undefined && item !== null);

            // 确保递归获取的文件也正确处理文件名
            const processedResult = result.map(item => {
                if (item.name && item.name.includes('/')) {
                    item.name = item.name.split('/').pop();
                }
                return item;
            });

            return [...videos, ...processedResult.flat()];
        }
    }

    /**
     * 获取文件的播放链接（Web版）
     * @param {string} path - 文件路径
     * @param {string} uk - 用户标识
     * @param {string} shareid - 分享ID
     * @param {string} fsid - 文件ID
     * @returns {Promise<Array>} 不同清晰度的播放链接数组
     */
    async getShareUrl(path, uk, shareid, fsid) {
        path = path.replaceAll('\0', '#'); // 把真实路径还原
        log('[baidu2][getShareUrl] path:', path);
        let sign = await this.getSign()
        let urls = []
        let t = Math.floor(new Date() / 1000); // 当前时间戳
        // 生成不同清晰度的播放链接
        this.type.map(it => {
            urls.push({
                name: it.replace('M3U8_AUTO_', ''),
                url: `${this.api}/share/streaming?channel=${this.channel}&uk=${uk}&fid=${fsid}&sign=${sign}&timestamp=${t}&shareid=${shareid}&type=${it}&vip=0&jsToken&isplayer=1&check_blue=1&adToken`
            })
        })
        return urls
    }

    /**
     * 获取用户UID
     * @returns {Promise<string>} 用户UID
     */
    async getUid() {
        let data = (await axios.get('https://mbd.baidu.com/userx/v1/info/get?appname=baiduboxapp&fields=%20%20%20%20%20%20%20%20%5B%22bg_image%22,%22member%22,%22uid%22,%22avatar%22,%20%22avatar_member%22%5D&client&clientfrom&lang=zh-cn&tpl&ttt', {
            headers: this.headers
        })).data
        return data.data.fields.uid
    }

    /**
     * SHA1哈希计算
     * @param {string} message - 待哈希的消息
     * @returns {string} SHA1哈希值
     */
    sha1(message) {
        return CryptoJS.SHA1(message).toString(CryptoJS.enc.Hex);
    }

    /**
     * 获取文件的直链地址（App版）
     * @param {string} path - 文件路径
     * @param {string} uk - 用户标识
     * @param {string} shareid - 分享ID
     * @param {string} fsid - 文件ID
     * @returns {Promise<string>} 直链地址
     */
    async getAppShareUrl(path, uk, shareid, fsid) {
        path = path.replaceAll('\0', '#'); // 把真实路径还原
        log('[baidu2][getAppShareUrl] path:', path);
        let BDCLND = await this.getRandsk()
        let uid = await this.getUid()
        // 设置移动端请求头
        let header = Object.assign({}, this.headers, {
            "User-Agent": 'netdisk;P2SP;2.2.91.136;android-android;',
        });
        let devuid = "73CED981D0F186D12BC18CAE1684FFD5|VSRCQTF6W"; // 设备标识
        let time = String(new Date().getTime()); // 时间戳
        // 生成签名
        let rand = this.sha1(this.sha1(this.cookie.match(/BDUSS=(.+?);/)[1]) + uid + "ebrcUYiuxaZv2XGu7KIYKxUrqfnOfpDF" + time + devuid + "11.30.2ae5821440fab5e1a61a025f014bd8972");
        // 构造请求URL
        let url = this.api + "/share/list?shareid=" + shareid + "&uk=" + uk + "&fid=" + fsid + "&sekey=" + BDCLND + "&origin=dlna&devuid=" + devuid + "&clienttype=1&channel=android_12_zhao_bd-netdisk_1024266h&version=11.30.2&time=" + time + "&rand=" + rand;
        let data = (await axios.get(url, {
            headers: header
        })).data
        if (data.errno === 0 && data.list.length > 0) {
            return data.list[0].dlink // 返回直链地址
        }
    }
}

// 导出百度网盘实例
export const Baidu2 = new BaiduDrive();