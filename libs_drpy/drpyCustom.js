import fileHeaderManager from "../utils/fileHeaderManager.js";
import {base64Decode, base64Encode} from "./crypto-util.js";
import './pako.min.js';
import './jsencrypt.js';
import './jinja.js';
import './abba.js'
import './_dist/node-rsa.js';
import './_dist/gb18030.js';
import './_dist/json5.js';

// 导入RSA，这样文件内部也可以使用
import {RSA} from './drpyRsa.js';
// 重新导出RSA供其他模块使用
export {RSA};

// User Agent 常量
export const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Mobile Safari/537.36';
export const PC_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.54 Safari/537.36';
export const UA = 'Mozilla/5.0';
export const UC_UA = 'Mozilla/5.0 (Linux; U; Android 9; zh-CN; MI 9 Build/PKQ1.181121.001) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/57.0.2987.108 UCBrowser/12.5.5.1035 Mobile Safari/537.36';
export const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1';

// 配置常量
export const RULE_CK = 'cookie'; // 源cookie的key值
export const CATE_EXCLUDE = '首页|留言|APP|下载|资讯|新闻|动态';
export const TAB_EXCLUDE = '猜你|喜欢|下载|剧情|榜|评论';
export const OCR_RETRY = 3; // ocr验证重试次数
export const OCR_API = 'https://api.nn.ci/ocr/b64/text'; // ocr在线识别接口

// 默认数据
export const nodata = {
    list: [{
        vod_name: '无数据,防无限请求',
        vod_id: 'no_data',
        vod_remarks: '不要点,会崩的',
        vod_pic: 'https://ghproxy.net/https://raw.githubusercontent.com/hjdhnx/dr_py/main/404.jpg'
    }],
    total: 1,
    pagecount: 1,
    page: 1,
    limit: 1
};

export const SPECIAL_URL = /^(ftp|magnet|thunder|ws):/;

/**
 * 判断是否为正版视频网站
 * @param {string} vipUrl - 视频链接
 * @returns {boolean} 是否为正版
 */
export const 是否正版 = (vipUrl) => {
    const flag = /qq\.com|iqiyi\.com|youku\.com|mgtv\.com|bilibili\.com|sohu\.com|ixigua\.com|pptv\.com|miguvideo\.com|le\.com|1905\.com|fun\.tv/;
    return flag.test(vipUrl);
};

/**
 * 处理视频链接
 * @param {string} vipUrl - 视频链接
 * @returns {string} 处理后的链接
 */
export const urlDeal = (vipUrl) => {
    if (!vipUrl) return '';

    if (!是否正版(vipUrl)) return vipUrl;

    if (!/miguvideo/.test(vipUrl)) {
        vipUrl = vipUrl.split('#')[0]; // 去除hash
        if (vipUrl.includes('?') && !vipUrl.includes('video?vid=')) {
            vipUrl = vipUrl.split('?')[0];
        }
    }
    return vipUrl;
};

/**
 * 判断是否需要解析
 * @param {string} url - 视频链接
 * @returns {number} 0或1
 */
export const tellIsJx = (url) => {
    try {
        const is_vip = !/\.(m3u8|mp4|m4a)$/.test(url.split('?')[0]) && 是否正版(url);
        return is_vip ? 1 : 0;
    } catch (e) {
        return 1;
    }
};

/**
 * 设置结果数据格式
 * @param {Array} d - 原始数据数组
 * @returns {Array} 格式化后的数据
 */
export const setResult = (d) => {
    if (!Array.isArray(d)) return [];

    return d.map(it => {
        const obj = {
            vod_id: it.url || '',
            vod_name: it.title || '',
            vod_remarks: it.desc || '',
            vod_content: it.content || '',
            vod_pic: it.pic_url || it.img || '',
        };

        const keys = Object.keys(it);
        const mappings = {
            tname: 'type_name',
            tid: 'type_id',
            year: 'vod_year',
            actor: 'vod_actor',
            director: 'vod_director',
            area: 'vod_area'
        };

        Object.entries(mappings).forEach(([key, prop]) => {
            if (keys.includes(key)) {
                obj[prop] = it[key] || '';
            }
        });

        return obj;
    });
};

/**
 * 设置结果数据格式2
 * @param {Object} res - 响应对象
 * @returns {Array} 列表数据
 */
export const setResult2 = (res) => res?.list || [];

/**
 * 设置首页结果数据格式
 * @param {Object} res - 响应对象
 * @returns {Array} 格式化后的数据
 */
export const setHomeResult = (res) => {
    if (!res || typeof res !== 'object') return [];
    return setResult(res.list);
};

/**
 * 将字符串进行URL编码
 * @param {string} str - 待编码字符串
 * @returns {string} 编码后的字符串
 */
export const urlencode = (str) => {
    str = String(str);
    return encodeURIComponent(str)
        .replace(/!/g, '%21')
        .replace(/'/g, '%27')
        .replace(/\(/g, '%28')
        .replace(/\)/g, '%29')
        .replace(/\*/g, '%2A')
        .replace(/%20/g, '+');
};

/**
 * URL编码，同encodeURI
 * @param {string} str - 待编码字符串
 * @returns {string} 编码后的字符串
 */
export const encodeUrl = (str) => {
    if (typeof encodeURI === 'function') {
        return encodeURI(str);
    }

    str = String(str);
    return encodeURIComponent(str)
        .replace(/%2F/g, '/')
        .replace(/%3F/g, '?')
        .replace(/%3A/g, ':')
        .replace(/%40/g, '@')
        .replace(/%3D/g, '=')
        .replace(/%2C/g, ',')
        .replace(/%2B/g, '+')
        .replace(/%24/g, '$');
};

/**
 * 将Uint8Array转换为Base64
 * @param {Uint8Array} uint8Array - 字节数组
 * @returns {string} Base64字符串
 */
export const uint8ArrayToBase64 = (uint8Array) => {
    const binaryString = String.fromCharCode(...Array.from(uint8Array));
    return btoa(binaryString);
};

/**
 * 将UTF8字节数组转换为字符串
 * @param {Array} array - UTF8字节数组
 * @returns {string} 转换后的字符串
 */
export const Utf8ArrayToStr = (array) => {
    let out = '';
    let i = 0;
    const len = array.length;

    while (i < len) {
        const c = array[i++];
        switch (c >> 4) {
            case 0:
            case 1:
            case 2:
            case 3:
            case 4:
            case 5:
            case 6:
            case 7:
                out += String.fromCharCode(c);
                break;
            case 12:
            case 13:
                const char2 = array[i++];
                out += String.fromCharCode(((c & 0x1f) << 6) | (char2 & 0x3f));
                break;
            case 14:
                const char2_2 = array[i++];
                const char3 = array[i++];
                out += String.fromCharCode(
                    ((c & 0x0f) << 12) | ((char2_2 & 0x3f) << 6) | ((char3 & 0x3f) << 0)
                );
                break;
        }
    }
    return out;
};

/**
 * gzip压缩base64，压缩率80%+
 * @param {string} str - 待压缩字符串
 * @returns {string} 压缩后的Base64字符串
 */
export const gzip = (str) => {
    const arr = pako.gzip(str);
    return uint8ArrayToBase64(arr);
};

/**
 * gzip解压base64数据
 * @param {string} b64Data - Base64编码的压缩数据
 * @returns {string} 解压后的字符串
 */
export const ungzip = (b64Data) => {
    const strData = atob(b64Data);
    const charData = strData.split('').map(x => x.charCodeAt(0));
    const binData = new Uint8Array(charData);
    const data = pako.inflate(binData);
    return Utf8ArrayToStr(data);
};

/**
 * 字符串按指定编码
 * @param {string} input - 输入字符串
 * @param {string} encoding - 编码格式
 * @returns {string} 编码后的字符串
 */
export const encodeStr = (input, encoding = 'gbk') => {
    if (encoding.startsWith('gb')) {
        return gbkTool.encode(input);
    }
    return input;
};

/**
 * 字符串指定解码
 * @param {string} input - 输入字符串
 * @param {string} encoding - 编码格式
 * @returns {string} 解码后的字符串
 */
export const decodeStr = (input, encoding = 'gbk') => {
    if (encoding.startsWith('gb')) {
        return gbkTool.decode(input);
    }
    return input;
};

/**
 * 获取CryptoJS
 * @returns {string} 日志信息
 */
export const getCryptoJS = () => 'log("CryptoJS已装载");';

/*
// 封装的RSA加解密类
export const RSA = {
    decode(data, key, option = {}) {
        if (typeof JSEncrypt !== 'function') return false;

        const privateKey = this.getPrivateKey(key);
        const decryptor = new JSEncrypt();
        decryptor.setPrivateKey(privateKey);
        return decryptor.decryptUnicodeLong(data);
    },

    encode(data, key, option = {}) {
        if (typeof JSEncrypt !== 'function') return false;

        const publicKey = this.getPublicKey(key);
        const encryptor = new JSEncrypt();
        encryptor.setPublicKey(publicKey);
        return encryptor.encryptUnicodeLong(data);
    },

    fixKey(key, prefix, endfix) {
        if (!key.includes(prefix)) key = prefix + key;
        if (!key.includes(endfix)) key += endfix;
        return key;
    },

    getPrivateKey(key) {
        const prefix = '-----BEGIN RSA PRIVATE KEY-----';
        const endfix = '-----END RSA PRIVATE KEY-----';
        return this.fixKey(key, prefix, endfix);
    },

    getPublicKey(key) {
        const prefix = '-----BEGIN PUBLIC KEY-----';
        const endfix = '-----END PUBLIC KEY-----';
        return this.fixKey(key, prefix, endfix);
    }
};
*/

/**
 * 智能对比去除广告。支持嵌套m3u8。只需要传入播放地址
 * @param {string} m3u8_url - m3u8播放地址
 * @param {Object} headers - 自定义访问m3u8的请求头
 * @returns {Promise<string>} 处理后的m3u8内容
 */
export const fixAdM3u8Ai = async (m3u8_url, headers) => {
    const ts = Date.now();
    const option = headers ? {headers} : {};

    const compareStrings = (s1, s2) => {
        let i = 0;
        while (i < s1.length && s1[i] === s2[i]) i++;
        return i;
    };

    const reverseString = str => str.split('').reverse().join('');

    let m3u8 = (await req(m3u8_url, option)).content;
    m3u8 = m3u8.trim()
        .split('\n')
        .map(it => it.startsWith('#') ? it : urljoin(m3u8_url, it))
        .join('\n')
        .replace(/\n\n/gi, '\n');

    let last_url = m3u8.split('\n').slice(-1)[0];
    if (last_url.length < 5) {
        last_url = m3u8.split('\n').slice(-2)[0];
    }

    if (last_url.includes('.m3u8') && last_url !== m3u8_url) {
        m3u8_url = urljoin(m3u8_url, last_url);
        log(`[fixAdM3u8Ai]嵌套的m3u8_url: ${m3u8_url}`);
        m3u8 = (await req(m3u8_url, option)).content;
    }

    const s = m3u8.trim().split('\n').filter(it => it.trim()).join('\n');
    const ss = s.split('\n');
    let firststr = '';
    let maxl = 0;
    let kk = 0;
    let kkk1 = 1;
    let kkk2 = 0;
    let secondstr = '';

    for (let i = 0; i < ss.length && kk < 30; i++) {
        const line = ss[i];
        if (!line.startsWith('#')) {
            if (kk === 0) {
                firststr = line;
            } else {
                const comparison = compareStrings(firststr, line);
                if (maxl > comparison + 1) {
                    if (secondstr.length < 5) secondstr = line;
                    kkk2++;
                } else {
                    maxl = comparison;
                    kkk1++;
                }
            }
            kk++;
        }
    }

    if (kkk2 > kkk1) firststr = secondstr;

    const firststrlen = firststr.length;
    const ml = Math.round(ss.length / 2).toString().length;
    let maxc = 0;

    const laststr = ss.toReversed().find(x => {
        if (!x.startsWith('#')) {
            const k = compareStrings(reverseString(firststr), reverseString(x));
            maxl = compareStrings(firststr, x);
            maxc++;
            return firststrlen - maxl <= ml + k || maxc > 10;
        }
        return false;
    });

    log(`[fixAdM3u8Ai]最后一条切片：${laststr}`);

    const ad_urls = [];
    for (let i = 0; i < ss.length; i++) {
        const line = ss[i];
        if (!line.startsWith('#')) {
            if (compareStrings(firststr, line) < maxl) {
                ad_urls.push(line);
                ss.splice(i - 1, 2);
                i -= 2;
            } else {
                ss[i] = urljoin(m3u8_url, line);
            }
        } else {
            ss[i] = line.replace(/URI="(.*)"/g, `URI="${urljoin(m3u8_url, '$1')}"`);
        }
    }

    log(`[fixAdM3u8Ai]处理的m3u8地址: ${m3u8_url}`);
    log('[fixAdM3u8Ai]----广告地址----');
    log('[fixAdM3u8Ai]广告地址列表:', ad_urls);

    m3u8 = ss.join('\n');
    log(`[fixAdM3u8Ai]处理耗时：${Date.now() - ts}ms`);
    log(`[fixAdM3u8Ai]处理后的m3u8: ${m3u8}`);

    return m3u8;
};

/**
 * 强制正序算法
 * @param {Array} lists - 待正序列表
 * @param {string} key - 正序键
 * @param {Function} option - 单个元素处理函数
 * @returns {Array} 处理后的列表
 */
export const forceOrder = (lists, key, option) => {
    const start = Math.floor(lists.length / 2);
    const end = Math.min(lists.length - 1, start + 1);

    if (start >= end) return lists;

    let first = lists[start];
    let second = lists[end];

    if (key) {
        try {
            first = first[key];
            second = second[key];
        } catch (e) {
            // 忽略错误
        }
    }

    if (option && typeof option === 'function') {
        try {
            first = option(first);
            second = option(second);
        } catch (e) {
            // 忽略错误
        }
    }

    first = String(first);
    second = String(second);

    const firstMatch = first.match(/(\d+)/);
    const secondMatch = second.match(/(\d+)/);

    if (firstMatch && secondMatch) {
        const num1 = Number(firstMatch[1]);
        const num2 = Number(secondMatch[1]);
        if (num1 > num2) {
            lists.reverse();
        }
    }

    return lists;
};

/**
 * 获取链接的query请求转为js的object字典对象
 * @param {string} url - URL字符串
 * @returns {Object} 查询参数对象
 */
export const getQuery = (url) => {
    try {
        if (url.indexOf('?') > -1) {
            url = url.slice(url.indexOf('?') + 1);
        }

        const arr = url.split('#')[0].split('&');
        const resObj = {};

        arr.forEach(item => {
            const arr1 = item.split('=');
            const key = arr1[0];
            const value = arr1.slice(1).join('=');
            resObj[key] = value;
        });

        return resObj;
    } catch (err) {
        log(`[getQuery]getQuery发生错误: ${err.message}`);
        return {};
    }
};


/**
 * 处理返回的json数据
 * @param {string} html - HTML或JSON字符串
 * @returns {Object} 解析后的对象
 */
export const dealJson = (html) => {
    try {
        html = html.trim();
        if (!((html.startsWith('{') && html.endsWith('}')) ||
            (html.startsWith('[') && html.endsWith(']')))) {
            const match = html.match(/.*?\{(.*)\}/m);
            if (match) {
                html = '{' + match[1] + '}';
            }
        }
    } catch (e) {
        // 忽略错误
    }

    try {
        return JSON.parse(html);
    } catch (e) {
        return html;
    }
};

/**
 * 验证码识别API
 */
export const OcrApi = {
    api: OCR_API,

    async classification(img) {
        let code = '';
        try {
            log('[OcrApi.classification]通过drpy_ocr验证码接口过验证...');

            let html = '';
            if (this.api.endsWith('drpy/text')) {
                html = (await req(this.api, {
                    data: {img},
                    headers: {'User-Agent': PC_UA},
                    method: 'POST'
                })).content;
            } else {
                html = (await req(this.api, {
                    body: img,
                    headers: {'User-Agent': PC_UA},
                    method: 'POST'
                })).content;
            }

            code = html || '';
        } catch (e) {
            log(`[OcrApi.classification]OCR识别验证码发生错误: ${e.message}`);
        }

        return code;
    }
};

/**
 * 获取链接的host(带http协议的完整链接)
 * @param {string} url - 任意一个正常完整的URL
 * @returns {string} 根域名
 */
export const getHome = (url) => {
    if (!url) return '';

    const tmp = url.split('//');
    url = tmp[0] + '//' + tmp[1].split('/')[0];

    try {
        url = decodeURIComponent(url);
    } catch (e) {
        // 忽略错误
    }

    return url;
};

/**
 * GET参数编译链接，类似Python params字典自动拼接
 * @param {string} url - 访问链接
 * @param {Object} obj - 参数字典
 * @returns {string} 拼接后的URL
 */
export const buildUrl = (url, obj = {}) => {
    if (url.indexOf('?') < 0) {
        url += '?';
    }

    const paramList = Object.entries(obj).map(([key, value]) => `${key}=${value}`);
    const params = paramList.join('&');

    if (paramList.length > 0 && !url.endsWith('?')) {
        url += '&';
    }

    return url + params;
};

/**
 * 远程依赖执行函数
 * @param {string} url - 远程js地址
 */
function $require(url) {
    eval(request(url));
}

/**
 * 对象转查询字符串
 * @param {Object} params - 参数对象
 * @returns {string} 查询字符串
 */
export const buildQueryString = (params) => {
    const queryArray = [];

    for (const key in params) {
        if (params.hasOwnProperty(key)) {
            let value = params[key];
            if (value === null || value === undefined) {
                value = '';
            }
            queryArray.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
        }
    }

    return queryArray.join('&');
};

/**
 * 解析查询字符串
 * @param {string} query - 查询字符串
 * @returns {Object} 解析后的对象
 */
export const parseQueryString = (query) => {
    const result = {};

    if (!query) return result;

    const pairs = query.split('&');
    pairs.forEach(pair => {
        const [key, value] = pair.split('=');
        if (key) {
            result[decodeURIComponent(key)] = value ? decodeURIComponent(value) : '';
        }
    });

    return result;
};

/**
 * 如果包含特殊字符则编码
 * @param {string} value - 待检查的值
 * @returns {string} 处理后的值
 */
export const encodeIfContainsSpecialChars = (value) => {
    const specialChars = /[&=?#]/;
    return specialChars.test(value) ? encodeURIComponent(value) : value;
};

/**
 * 对象转查询字符串（智能编码）
 * @param {Object} obj - 对象
 * @returns {string} 查询字符串
 */
export const objectToQueryString = (obj) => {
    return Object.entries(obj)
        .map(([key, value]) => `${encodeIfContainsSpecialChars(key)}=${encodeIfContainsSpecialChars(String(value))}`)
        .join('&');
};

/**
 * 获取加密前的原始的js源文本
 * @param {string} js_code
 */
export async function getOriginalJs(js_code) {
    // let current_match = /var rule|[\u4E00-\u9FA5]+|function|let |var |const |\(|\)|"|'/;
    let current_match = /var rule|function|let |var |const|class Rule|async|this\./;
    let current_match1 = /["{}&]/;
    if (current_match.test(js_code)) {
        return js_code
    }
    log('[getOriginalJs] 密文源自动去除头信息...');
    js_code = await fileHeaderManager.removeHeader(js_code, {mode: 'top-comments', fileType: '.js'});
    let rsa_private_key = 'MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCqin/jUpqM6+fgYP/oMqj9zcdHMM0mEZXLeTyixIJWP53lzJV2N2E3OP6BBpUmq2O1a9aLnTIbADBaTulTNiOnVGoNG58umBnupnbmmF8iARbDp2mTzdMMeEgLdrfXS6Y3VvazKYALP8EhEQykQVarexR78vRq7ltY3quXx7cgI0ROfZz5Sw3UOLQJ+VoWmwIxu9AMEZLVzFDQN93hzuzs3tNyHK6xspBGB7zGbwCg+TKi0JeqPDrXxYUpAz1cQ/MO+Da0WgvkXnvrry8NQROHejdLVOAslgr6vYthH9bKbsGyNY3H+P12kcxo9RAcVveONnZbcMyxjtF5dWblaernAgMBAAECggEAGdEHlSEPFmAr5PKqKrtoi6tYDHXdyHKHC5tZy4YV+Pp+a6gxxAiUJejx1hRqBcWSPYeKne35BM9dgn5JofgjI5SKzVsuGL6bxl3ayAOu+xXRHWM9f0t8NHoM5fdd0zC3g88dX3fb01geY2QSVtcxSJpEOpNH3twgZe6naT2pgiq1S4okpkpldJPo5GYWGKMCHSLnKGyhwS76gF8bTPLoay9Jxk70uv6BDUMlA4ICENjmsYtd3oirWwLwYMEJbSFMlyJvB7hjOjR/4RpT4FPnlSsIpuRtkCYXD4jdhxGlvpXREw97UF2wwnEUnfgiZJ2FT/MWmvGGoaV/CfboLsLZuQKBgQDTNZdJrs8dbijynHZuuRwvXvwC03GDpEJO6c1tbZ1s9wjRyOZjBbQFRjDgFeWs9/T1aNBLUrgsQL9c9nzgUziXjr1Nmu52I0Mwxi13Km/q3mT+aQfdgNdu6ojsI5apQQHnN/9yMhF6sNHg63YOpH+b+1bGRCtr1XubuLlumKKscwKBgQDOtQ2lQjMtwsqJmyiyRLiUOChtvQ5XI7B2mhKCGi8kZ+WEAbNQcmThPesVzW+puER6D4Ar4hgsh9gCeuTaOzbRfZ+RLn3Aksu2WJEzfs6UrGvm6DU1INn0z/tPYRAwPX7sxoZZGxqML/z+/yQdf2DREoPdClcDa2Lmf1KpHdB+vQKBgBXFCVHz7a8n4pqXG/HvrIMJdEpKRwH9lUQS/zSPPtGzaLpOzchZFyQQBwuh1imM6Te+VPHeldMh3VeUpGxux39/m+160adlnRBS7O7CdgSsZZZ/dusS06HAFNraFDZf1/VgJTk9BeYygX+AZYu+0tReBKSs9BjKSVJUqPBIVUQXAoGBAJcZ7J6oVMcXxHxwqoAeEhtvLcaCU9BJK36XQ/5M67ceJ72mjJC6/plUbNukMAMNyyi62gO6I9exearecRpB/OGIhjNXm99Ar59dAM9228X8gGfryLFMkWcO/fNZzb6lxXmJ6b2LPY3KqpMwqRLTAU/zy+ax30eFoWdDHYa4X6e1AoGAfa8asVGOJ8GL9dlWufEeFkDEDKO9ww5GdnpN+wqLwePWqeJhWCHad7bge6SnlylJp5aZXl1+YaBTtOskC4Whq9TP2J+dNIgxsaF5EFZQJr8Xv+lY9lu0CruYOh9nTNF9x3nubxJgaSid/7yRPfAGnsJRiknB5bsrCvgsFQFjJVs=';
    let decode_content = '';

    function aes_decrypt(data) {
        // log(data);
        let key = CryptoJS.enc.Hex.parse("686A64686E780A0A0A0A0A0A0A0A0A0A");
        let iv = CryptoJS.enc.Hex.parse("647A797964730A0A0A0A0A0A0A0A0A0A");
        let ciphertext = CryptoJS.enc.Base64.parse(data);
        let decrypted = CryptoJS.AES.decrypt({ciphertext: ciphertext}, key, {
            iv: iv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        }).toString(CryptoJS.enc.Utf8);
        // log(decrypted);
        return decrypted;
    }

    let error_log = false;

    function logger(text) {
        // log('[logger]:', text);
        if (error_log) {
            log('[getOriginalJs]', text);
        }
    }

    let decode_funcs = [
        (text) => {
            try {
                return ungzip(text)
            } catch (e) {
                logger('非gzip加密');
                return ''
            }
        },
        (text) => {
            try {
                return base64Decode(text)
            } catch (e) {
                logger('非b64加密');
                return ''
            }
        },
        (text) => {
            try {
                return aes_decrypt(text)
            } catch (e) {
                logger('非aes加密');
                return ''
            }
        },
        (text) => {
            try {
                return RSA.decode(text, rsa_private_key, null)
            } catch (e) {
                logger('非rsa加密');
                return ''
            }
        },
        // (text) => {
        //     try {
        //         return NODERSA.decryptRSAWithPrivateKey(text, RSA.getPrivateKey(rsa_private_key).replace(/RSA /g, ''), {
        //             options: {
        //                 environment: "browser",
        //                 encryptionScheme: 'pkcs1',
        //                 b: '1024'
        //             }
        //         });
        //     } catch (e) {
        //         log(e.message);
        //         return ''
        //     }
        // },
    ]
    let func_index = 0
    while (!current_match.test(decode_content) && !current_match1.test(decode_content)) {
        decode_content = decode_funcs[func_index](js_code);
        func_index++;
        if (func_index >= decode_funcs.length) {
            break;
        }
    }
    return decode_content
}

export const jsEncoder = {
    base64Encode,
    gzip,
    aes_encrypt: function (data) {
        // 定义密钥和初始向量，必须与解密时一致
        let key = CryptoJS.enc.Hex.parse("686A64686E780A0A0A0A0A0A0A0A0A0A");
        let iv = CryptoJS.enc.Hex.parse("647A797964730A0A0A0A0A0A0A0A0A0A");

        // 使用AES加密
        let encrypted = CryptoJS.AES.encrypt(data, key, {
            iv: iv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        });

        // 返回Base64编码的加密结果
        return encrypted.ciphertext.toString(CryptoJS.enc.Base64);
        // 返回完整的加密结果（包括 IV 和其他元数据）
        // return encrypted.toString(); // Base64 格式
    },

    rsa_encode: function (text) {
        let rsa_private_key = 'MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCqin/jUpqM6+fgYP/oMqj9zcdHMM0mEZXLeTyixIJWP53lzJV2N2E3OP6BBpUmq2O1a9aLnTIbADBaTulTNiOnVGoNG58umBnupnbmmF8iARbDp2mTzdMMeEgLdrfXS6Y3VvazKYALP8EhEQykQVarexR78vRq7ltY3quXx7cgI0ROfZz5Sw3UOLQJ+VoWmwIxu9AMEZLVzFDQN93hzuzs3tNyHK6xspBGB7zGbwCg+TKi0JeqPDrXxYUpAz1cQ/MO+Da0WgvkXnvrry8NQROHejdLVOAslgr6vYthH9bKbsGyNY3H+P12kcxo9RAcVveONnZbcMyxjtF5dWblaernAgMBAAECggEAGdEHlSEPFmAr5PKqKrtoi6tYDHXdyHKHC5tZy4YV+Pp+a6gxxAiUJejx1hRqBcWSPYeKne35BM9dgn5JofgjI5SKzVsuGL6bxl3ayAOu+xXRHWM9f0t8NHoM5fdd0zC3g88dX3fb01geY2QSVtcxSJpEOpNH3twgZe6naT2pgiq1S4okpkpldJPo5GYWGKMCHSLnKGyhwS76gF8bTPLoay9Jxk70uv6BDUMlA4ICENjmsYtd3oirWwLwYMEJbSFMlyJvB7hjOjR/4RpT4FPnlSsIpuRtkCYXD4jdhxGlvpXREw97UF2wwnEUnfgiZJ2FT/MWmvGGoaV/CfboLsLZuQKBgQDTNZdJrs8dbijynHZuuRwvXvwC03GDpEJO6c1tbZ1s9wjRyOZjBbQFRjDgFeWs9/T1aNBLUrgsQL9c9nzgUziXjr1Nmu52I0Mwxi13Km/q3mT+aQfdgNdu6ojsI5apQQHnN/9yMhF6sNHg63YOpH+b+1bGRCtr1XubuLlumKKscwKBgQDOtQ2lQjMtwsqJmyiyRLiUOChtvQ5XI7B2mhKCGi8kZ+WEAbNQcmThPesVzW+puER6D4Ar4hgsh9gCeuTaOzbRfZ+RLn3Aksu2WJEzfs6UrGvm6DU1INn0z/tPYRAwPX7sxoZZGxqML/z+/yQdf2DREoPdClcDa2Lmf1KpHdB+vQKBgBXFCVHz7a8n4pqXG/HvrIMJdEpKRwH9lUQS/zSPPtGzaLpOzchZFyQQBwuh1imM6Te+VPHeldMh3VeUpGxux39/m+160adlnRBS7O7CdgSsZZZ/dusS06HAFNraFDZf1/VgJTk9BeYygX+AZYu+0tReBKSs9BjKSVJUqPBIVUQXAoGBAJcZ7J6oVMcXxHxwqoAeEhtvLcaCU9BJK36XQ/5M67ceJ72mjJC6/plUbNukMAMNyyi62gO6I9exearecRpB/OGIhjNXm99Ar59dAM9228X8gGfryLFMkWcO/fNZzb6lxXmJ6b2LPY3KqpMwqRLTAU/zy+ax30eFoWdDHYa4X6e1AoGAfa8asVGOJ8GL9dlWufEeFkDEDKO9ww5GdnpN+wqLwePWqeJhWCHad7bge6SnlylJp5aZXl1+YaBTtOskC4Whq9TP2J+dNIgxsaF5EFZQJr8Xv+lY9lu0CruYOh9nTNF9x3nubxJgaSid/7yRPfAGnsJRiknB5bsrCvgsFQFjJVs=';
        return RSA.encode(text, rsa_private_key, null);
    }
};

export const jsDecoder = {
    base64Decode,
    ungzip,
    aes_decrypt: function (data) {
        let key = CryptoJS.enc.Hex.parse("686A64686E780A0A0A0A0A0A0A0A0A0A");
        let iv = CryptoJS.enc.Hex.parse("647A797964730A0A0A0A0A0A0A0A0A0A");
        let ciphertext = CryptoJS.enc.Base64.parse(data);
        let decrypted = CryptoJS.AES.decrypt({ciphertext: ciphertext}, key, {
            iv: iv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        }).toString(CryptoJS.enc.Utf8);
        return decrypted;
    },
    rsa_decode: function (text) {
        let rsa_private_key = 'MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCqin/jUpqM6+fgYP/oMqj9zcdHMM0mEZXLeTyixIJWP53lzJV2N2E3OP6BBpUmq2O1a9aLnTIbADBaTulTNiOnVGoNG58umBnupnbmmF8iARbDp2mTzdMMeEgLdrfXS6Y3VvazKYALP8EhEQykQVarexR78vRq7ltY3quXx7cgI0ROfZz5Sw3UOLQJ+VoWmwIxu9AMEZLVzFDQN93hzuzs3tNyHK6xspBGB7zGbwCg+TKi0JeqPDrXxYUpAz1cQ/MO+Da0WgvkXnvrry8NQROHejdLVOAslgr6vYthH9bKbsGyNY3H+P12kcxo9RAcVveONnZbcMyxjtF5dWblaernAgMBAAECggEAGdEHlSEPFmAr5PKqKrtoi6tYDHXdyHKHC5tZy4YV+Pp+a6gxxAiUJejx1hRqBcWSPYeKne35BM9dgn5JofgjI5SKzVsuGL6bxl3ayAOu+xXRHWM9f0t8NHoM5fdd0zC3g88dX3fb01geY2QSVtcxSJpEOpNH3twgZe6naT2pgiq1S4okpkpldJPo5GYWGKMCHSLnKGyhwS76gF8bTPLoay9Jxk70uv6BDUMlA4ICENjmsYtd3oirWwLwYMEJbSFMlyJvB7hjOjR/4RpT4FPnlSsIpuRtkCYXD4jdhxGlvpXREw97UF2wwnEUnfgiZJ2FT/MWmvGGoaV/CfboLsLZuQKBgQDTNZdJrs8dbijynHZuuRwvXvwC03GDpEJO6c1tbZ1s9wjRyOZjBbQFRjDgFeWs9/T1aNBLUrgsQL9c9nzgUziXjr1Nmu52I0Mwxi13Km/q3mT+aQfdgNdu6ojsI5apQQHnN/9yMhF6sNHg63YOpH+b+1bGRCtr1XubuLlumKKscwKBgQDOtQ2lQjMtwsqJmyiyRLiUOChtvQ5XI7B2mhKCGi8kZ+WEAbNQcmThPesVzW+puER6D4Ar4hgsh9gCeuTaOzbRfZ+RLn3Aksu2WJEzfs6UrGvm6DU1INn0z/tPYRAwPX7sxoZZGxqML/z+/yQdf2DREoPdClcDa2Lmf1KpHdB+vQKBgBXFCVHz7a8n4pqXG/HvrIMJdEpKRwH9lUQS/zSPPtGzaLpOzchZFyQQBwuh1imM6Te+VPHeldMh3VeUpGxux39/m+160adlnRBS7O7CdgSsZZZ/dusS06HAFNraFDZf1/VgJTk9BeYygX+AZYu+0tReBKSs9BjKSVJUqPBIVUQXAoGBAJcZ7J6oVMcXxHxwqoAeEhtvLcaCU9BJK36XQ/5M67ceJ72mjJC6/plUbNukMAMNyyi62gO6I9exearecRpB/OGIhjNXm99Ar59dAM9228X8gGfryLFMkWcO/fNZzb6lxXmJ6b2LPY3KqpMwqRLTAU/zy+ax30eFoWdDHYa4X6e1AoGAfa8asVGOJ8GL9dlWufEeFkDEDKO9ww5GdnpN+wqLwePWqeJhWCHad7bge6SnlylJp5aZXl1+YaBTtOskC4Whq9TP2J+dNIgxsaF5EFZQJr8Xv+lY9lu0CruYOh9nTNF9x3nubxJgaSid/7yRPfAGnsJRiknB5bsrCvgsFQFjJVs=';
        return RSA.decode(text, rsa_private_key, null);
    }
};

/**
 * vodDeal函数 - 处理播放源排序和重命名
 * @param {Object} vod
 * @param {Object} rule
 * @returns {*}
 */
export function vodDeal(vod, rule) {
    if (!vod || !rule) return vod;

    try {
        // 线路排序
        if (rule.tab_order && rule.tab_order.length > 0 && vod.vod_play_from) {
            let froms = vod.vod_play_from.split('$$$');
            let urls = vod.vod_play_url ? vod.vod_play_url.split('$$$') : [];

            let orderedFroms = [];
            let orderedUrls = [];

            // 按照tab_order顺序排列
            rule.tab_order.forEach((orderItem) => {
                let index = froms.findIndex(from => from.includes(orderItem));
                if (index !== -1) {
                    orderedFroms.push(froms[index]);
                    if (urls[index]) {
                        orderedUrls.push(urls[index]);
                    }
                    froms.splice(index, 1);
                    urls.splice(index, 1);
                }
            });

            // 添加剩余的
            orderedFroms = orderedFroms.concat(froms);
            orderedUrls = orderedUrls.concat(urls);

            vod.vod_play_from = orderedFroms.join('$$$');
            vod.vod_play_url = orderedUrls.join('$$$');
        }

        // 线路重命名
        if (rule.tab_rename && Object.keys(rule.tab_rename).length > 0 && vod.vod_play_from) {
            let froms = vod.vod_play_from.split('$$$');
            const renameEntries = Object.entries(rule.tab_rename);
            froms = froms.map(from => {
                for (const [key, value] of renameEntries) {
                    if (from.includes(key)) {
                        return from.replace(key, value);
                    }
                }
                return from;
            });
            vod.vod_play_from = froms.join('$$$');
        }

        // 线路移除
        if (rule.tab_remove && rule.tab_remove.length > 0 && vod.vod_play_from) {
            let froms = vod.vod_play_from.split('$$$');
            let urls = vod.vod_play_url ? vod.vod_play_url.split('$$$') : [];

            let filteredFroms = [];
            let filteredUrls = [];

            froms.forEach((from, index) => {
                let shouldRemove = false;
                for (const removeItem of rule.tab_remove) {
                    if (from.includes(removeItem)) {
                        shouldRemove = true;
                        break;
                    }
                }
                if (!shouldRemove) {
                    filteredFroms.push(from);
                    if (urls[index]) {
                        filteredUrls.push(urls[index]);
                    }
                }
            });

            vod.vod_play_from = filteredFroms.join('$$$');
            vod.vod_play_url = filteredUrls.join('$$$');
        }

    } catch (e) {
        log(`[vodDeal] vodDeal处理失败: ${e.message}`);
    }

    return vod;
}

/**
 * 通用图片处理函数
 * 处理图片替换和图片来源逻辑
 * @param {string} vod_pic - 原始图片URL
 * @param {object} moduleObject - 模块对象，包含图片替换和图片来源配置
 * @param {object} injectVars - 注入变量，用于函数调用上下文
 * @returns {Promise<string>} - 处理后的图片URL
 */
export async function processImage(vod_pic, moduleObject, injectVars = null) {
    if (!vod_pic) {
        return vod_pic;
    }

    try {
        // 处理图片替换
        if (moduleObject['图片替换']) {
            if (typeof moduleObject['图片替换'] === 'function') {
                // 异步函数处理
                if (injectVars) {
                    vod_pic = await moduleObject['图片替换'].apply(injectVars, [vod_pic]);
                } else {
                    vod_pic = await moduleObject['图片替换'](vod_pic);
                }
            } else if (typeof moduleObject['图片替换'] === 'string' && moduleObject['图片替换'].includes('=>')) {
                // 字符串替换处理
                let replace_from = moduleObject['图片替换'].split('=>')[0];
                let replace_to = moduleObject['图片替换'].split('=>')[1];
                vod_pic = vod_pic.replace(replace_from, replace_to);
            }
        }

        // 处理图片来源
        if (moduleObject['图片来源'] && vod_pic && vod_pic.startsWith('http')) {
            vod_pic += moduleObject['图片来源'];
        }
    } catch (e) {
        log(`[processImage] 图片处理失败: ${e.message}`);
    }

    return vod_pic;
}

// 格式化时间为SRT格式 HH:MM:SS,mmm
function formatSrtTime(milliseconds) {
    const hours = Math.floor(milliseconds / 3600000);
    const minutes = Math.floor((milliseconds % 3600000) / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    const ms = milliseconds % 1000;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

// LRC格式歌词转SRT字幕格式
export function lrcToSrt(lrcContent) {
    if (!lrcContent || typeof lrcContent !== 'string') {
        return '';
    }

    // 解析LRC歌词行
    const lines = lrcContent.split('\n');
    const timeLines = [];

    for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        // 匹配时间标签格式 [mm:ss.xx] 或 [mm:ss]
        const timeMatch = trimmedLine.match(/^\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\](.*)$/);
        if (timeMatch) {
            const minutes = parseInt(timeMatch[1]);
            const seconds = parseInt(timeMatch[2]);
            const milliseconds = timeMatch[3] ? parseInt(timeMatch[3].padEnd(3, '0')) : 0;
            const text = timeMatch[4].trim();

            // 计算总毫秒数
            const totalMs = minutes * 60 * 1000 + seconds * 1000 + milliseconds;

            if (text) { // 只添加有文本内容的行
                timeLines.push({
                    time: totalMs,
                    text: text
                });
            }
        }
    }

    // 按时间排序
    timeLines.sort((a, b) => a.time - b.time);

    if (timeLines.length === 0) {
        return '';
    }

    // 转换为SRT格式
    let srtContent = '';
    for (let i = 0; i < timeLines.length; i++) {
        const currentLine = timeLines[i];
        const nextLine = timeLines[i + 1];

        // 计算结束时间（下一行的开始时间，或当前时间+3秒）
        const endTime = nextLine ? nextLine.time : currentLine.time + 3000;

        // 格式化时间为SRT格式 HH:MM:SS,mmm
        const startTimeStr = formatSrtTime(currentLine.time);
        const endTimeStr = formatSrtTime(endTime);

        // 添加SRT条目
        srtContent += `${i + 1}\n`;
        srtContent += `${startTimeStr} --> ${endTimeStr}\n`;
        srtContent += `${currentLine.text}\n\n`;
    }

    return srtContent.trim();
}

/**
 * 字符串正则表达式提取函数
 * @param {string} content - 要搜索的源字符串
 * @param {string} pattern - 正则表达式模式
 * @param {number} groupIndex - 捕获组索引，0表示整个匹配，1表示第一个捕获组，以此类推
 * @returns {string} 提取到的字符串，如果没有匹配则返回空字符串
 */
export function strExtract(content, pattern, groupIndex = 0) {
    try {
        const regex = new RegExp(pattern);
        const match = content.match(regex);

        if (match && match[groupIndex] !== undefined) {
            return match[groupIndex];
        }

        return '';
    } catch (error) {
        console.error('strExtract error:', error);
        return '';
    }
}

export const pako = globalThis.pako;
export const gbkTool = globalThis.gbkTool;
export const JSEncrypt = globalThis.JSEncrypt;
export const CryptoJS = globalThis.CryptoJS;
export const NODERSA = globalThis.NODERSA;
export const JSON5 = globalThis.JSON5;
export const jinja = globalThis.jinja;
export const atob = globalThis.atob;
export const btoa = globalThis.btoa;
export const stringify = JSON.stringify;

// 全局挂载出去，给cat源用，其他本身就是globalThis定义的如JSON5，cat源可以直接用
globalThis.base64Encode = base64Encode;
globalThis.base64Decode = base64Decode;
globalThis.gzip = gzip;
globalThis.ungzip = ungzip;
globalThis.parseQueryString = parseQueryString;
globalThis.lrcToSrt = lrcToSrt;
globalThis.strExtract = strExtract;