/*
@header({
  searchable: 1,
  filterable: 1,
  quickSearch: 1,
  title: '聚合短剧[短]',
  author: 'EylinSir',
  '类型': '短剧',
  logo: 'https://cattleduanju.oss-cn-beijing.aliyuncs.com/png/20241024003958_01_800.png',
  lang: 'ds'
})
*/

//本资源来源于互联网公开渠道，仅可用于个人学习爬虫技术。
//严禁将其用于任何商业用途，下载后请于 24 小时内删除，搜索结果均来自源站，本人不承担任何责任。

// ==================== 51短剧 专属配置与变量 ====================
let HOST_51 = 'https://51hub.com';
let OAUTH_ID_51 = '';
let TOKEN_51 = '';
let proxyImgUrl_51 = '';
//try { proxyImgUrl_51 = getProxy(true) + '&type=img&url='; } catch(e) {}

function getProxyUrl_51(url) {
    return proxyImgUrl_51 ? proxyImgUrl_51 + encodeURIComponent(url) : url;
}
const HEADER_51 = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "zh-CN,zh;q=0.9",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "Connection": "keep-alive",
    "X-Requested-With": "XMLHttpRequest"
};
const AES_CONFIG_51 = {
    video: { key: '2acf7e91e9864673', iv: '1c29882d3ddfcfd6' },
    img: { key: 'f5d965df75336270', iv: '97b60394abc2fbe1' }
};

globalThis.aggConfig = {
  keys: 'd3dGiJc651gSQ8w1',
  charMap: {
    '+': 'P', '/': 'X', '0': 'M', '1': 'U', '2': 'l', '3': 'E', '4': 'r', '5': 'Y', '6': 'W', '7': 'b', '8': 'd', '9': 'J',
    'A': '9', 'B': 's', 'C': 'a', 'D': 'I', 'E': '0', 'F': 'o', 'G': 'y', 'H': '_', 'I': 'H', 'J': 'G', 'K': 'i', 'L': 't',
    'M': 'g', 'N': 'N', 'O': 'A', 'P': '8', 'Q': 'F', 'R': 'k', 'S': '3', 'T': 'h', 'U': 'f', 'V': 'R', 'W': 'q', 'X': 'C',
    'Y': '4', 'Z': 'p', 'a': 'm', 'b': 'B', 'c': 'O', 'd': 'u', 'e': 'c', 'f': '6', 'g': 'K', 'h': 'x', 'i': '5', 'j': 'T',
    'k': '-', 'l': '2', 'm': 'z', 'n': 'S', 'o': 'Z', 'p': '1', 'q': 'V', 'r': 'v', 's': 'j', 't': 'Q', 'u': '7', 'v': 'D',
    'w': 'w', 'x': 'n', 'y': 'L', 'z': 'e'
  },
  headers: {
    default: { 'User-Agent': 'okhttp/4.10.0', 'Content-Type': 'application/json' },
    form: { 'User-Agent': 'okhttp/3.12.11', 'Content-Type': 'application/x-www-form-urlencoded' },
    // 百度 Web 接口专用 UA
    browser: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Mobile Safari/537.36', 'Content-Type': 'application/x-www-form-urlencoded' },
    qimao: { 'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/50.0.2661.87 Safari/537.36' },
    // 百度 APP 接口专用 UA (带 Cookie)
    baidu_app: { 
        "User-Agent": "Dalvik/2.1.0 (Linux; U; Android 9; 22081212C Build/PQ3B.190801.002) Talos/1.8.13 SP-engine/3.47.0 bd_dvt/1 baiduboxapp/15.21.0.10 (Baidu; P1 9)", 
        "Content-Type": "application/x-www-form-urlencoded",
        "Cookie": "BAIDUCUID=0Ovgu0uAvu0_828wj8Hma_8i28joaSuIlOvOigiAH88ikS8f0k35aD6mA"
    },
    xingxing: { 'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/50.0.2661.87 Safari/537.36' }
  },
  platform: {
    51: { host: 'https://51hub.com', list: '/new-theater-category', detail: '/video/videolist', search: '/search' },
    星星: { host: 'http://read.api.duodutek.com', list: '/novel-api/app/pageModel/getResourceById', detail: '/novel-api/basedata/book/getChapterList' },
    河马: { host: 'https://freevideo.zqqds.cn', url1: '/free-video-portal/portal' },
    七猫: { host: 'https://api-store.qmplaylet.com', url1: '/api/v1/playlet/index', url2: 'https://api-read.qmplaylet.com/player/api/v1/playlet/info', search: '/api/v1/playlet/search' },
    星芽: { host: 'https://app.whjzjx.cn', url1: '/cloud/v2/theater/home_page?theater_class_id', url2: '/v2/theater_parent/detail', search: '/v3/search', loginUrl: 'https://u.shytkjgs.com/user/v1/account/login' },
    围观: { host: 'https://api.drama.9ddm.com', url1: '/drama/home/shortVideoTags?version_code=1500&os_type=1', url2: '/drama/home/shortVideoDetail?version_code=1000&os_type=1', search: '/drama/home/search?version_code=1500&os_type=1' },
    百度: { host: 'https://mbd.baidu.com' },
    牛牛: { host: 'https://new.tianjinzhitongdaohe.com', url1: 'https://csj-sp.csjdeveloper.com' },
    山海: { host: 'https://api.app.gxshxy.com', url1: 'https://u.app.gxshxy.com/user/v3/account/login' },
    好看: { host: 'https://sv.baidu.com' },
    西饭: { host: 'https://xifan-api-cn.youlishipin.com', url1: '/xifan/drama/portalPage', url2: '/xifan/drama/getDuanjuInfo', search: '/xifan/search/getSearchList' },
    薏米: { host: 'https://yimi-api.zhangyue.com', list: '/bookstore/local/visual/channel/list', detail: '/video/client/short_play/episode_list', search: '/bookstore/search/recommend_data' }
  },
  platformList: [
    { name: '河马', id: '河马' }, { name: '七猫', id: '七猫' }, { name: '星芽', id: '星芽' }, 
    { name: '围观', id: '围观' }, { name: '百度', id: '百度' }, { name: '薏米', id: '薏米' },
    { name: '牛牛', id: '牛牛' }, { name: '山海', id: '山海' }, { name: '好看', id: '好看' }, 
    { name: '西饭', id: '西饭' }, { name: '星星', id: '星星' }, { name: '五一', id: '51' }
  ],
  search: { limit: 30, timeout: 6000 }
};

const getPlatformConfig = id => globalThis.aggConfig.platform[id];

function buildUrlQuery(params) { 
    return Object.keys(params).map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k])).join('&'); 
}

// === 通用 Post 简化封装 ===
const post = async (url, data, headers) => {
    try {
        const res = await request(url, {
            method: 'POST',
            headers: headers || globalThis.aggConfig.headers.default,
            body: typeof data === 'object' ? JSON.stringify(data) : data
        });
        return JSON.parse(res);
    } catch (e) {
        return {};
    }
};

// === 河马服务 ===
const HM_Service = {
    key: CryptoJS.enc.Hex.parse("647a6b6a67667978677368796c677a6d"),
    iv: CryptoJS.enc.Hex.parse("6170697570646f776e65646372797074"),
    staticDatas: 'e5f22c6e2c82fe001738cb9ce4696eab0556d064a55aef402e0fbe6b29a083f6538e4567de38e67de2071a49d9751526bfba45314e1fd4702b11c76ab9a3b5f873262854ba66e6715ed51364dbc6ee62c7180e047fcbcdbfd49874fc8f28674b16d90ca71a02de76c70598e0b75e647c37c2c19287e49be5f2a259d727dfc4df3d28802388bf3c356576b342e17e30a2ab74859263dba4d1c8eba79990d22d60d60927fdacb2addf2f0eaadd8887585ca2eb87f603faf0c207dda18cf67dc25b2199d303baff9e6605b3314a7d2631f62864f48619daceb9452f2b7b0667773553741856df030cca68af3c57810f983d452bb428ef5fc32206aef4865ae06c629bee7f5135547304acc7ef4e7c6df887308f2e79c493fd2ee03488722861b5bb51b09cb8911dfc92c288d94e601c066d2f9d612ad2c8d4eeb4920b1d44aff3e13fd75229b857f64925df1cf12f75a00d438c422ec1726462b915903f1dd1f4bb7cdf82cc15a6d507f80c789903e710f39a62aef073f3f93a6c681e75d295428aa290d7e98f82e7e9ad6e2b23d9086dfe8c63c5d8550b13fd61a77291473a8bdd43c7c2639f264be69d9d07f0585de4342a399275a64e7d1d4400b8ed4421a2f289f622e40cdd1cfc916a0b9ce747c924ac33e32d24b91ed5d64772d6ad6896412f52724006eabf12aaecfd6e81dad432c7b3800bbf793a1c375e3e7b4fb3b097724b5fc88a8c9bcf3dbc10cbdb252965',

    hmEncrypt: function(plaintext) {
        var encrypted = CryptoJS.AES.encrypt(plaintext, this.key, {
            iv: this.iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7
        });
        return encrypted.ciphertext.toString(CryptoJS.enc.Hex).toUpperCase();
    },
    
    hmDecrypt: function(word) {
        let encryptedHexStr = CryptoJS.enc.Hex.parse(word);
        let srcs = CryptoJS.enc.Base64.stringify(encryptedHexStr);
        let decrypt = CryptoJS.AES.decrypt(srcs, this.key, {
            iv: this.iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7,
        });
        return decrypt.toString(CryptoJS.enc.Utf8);
    },

    api: async function(code, bodyData) {
        const plat = getPlatformConfig('河马');
        const url = `${plat.host}${plat.url1}/${code}`;
        const encryptedBody = this.hmEncrypt(JSON.stringify(bodyData));
        try {
            const rawRes = await request(url, {
                method: 'POST', 
                headers: { 'datas': this.staticDatas, 'content-type': 'text/plain', 'user-agent': 'okhttp/4.10.0', 'Referer': 'https://freevideo.zqqds.cn' }, 
                body: encryptedBody
            });
            let res;
            try { res = JSON.parse(rawRes); } catch(e) {}
            if (res && res.data) {
                const decrypted = this.hmDecrypt(res.data);
                return JSON.parse(decrypted);
            }
        } catch (e) { }
        return {};
    }
};

// === 51短剧服务 ===
async function fetchOauthId_51() {
    if (OAUTH_ID_51) return OAUTH_ID_51;
    OAUTH_ID_51 = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        let r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
    return OAUTH_ID_51;
}
function toUrlEncoded_51(obj) {
    let params = [];
    for (let key in obj) {
        if (obj.hasOwnProperty(key)) {
            let value = obj[key];
            if (value !== undefined && value !== null) params.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
        }
    }
    return params.join('&');
}
async function request_51(url, options = {}) {
    const headers = Object.assign({}, HEADER_51, options.headers || {});
    if (options.method === 'POST') {
        headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8';
    }
    const defaultOptions = { method: 'GET', headers };
    const finalOptions = Object.assign(defaultOptions, options);
    if (finalOptions.method === 'POST' && finalOptions.data) {
        finalOptions.body = typeof finalOptions.data === 'object' ? toUrlEncoded_51(finalOptions.data) : finalOptions.data;
    }
    const res = await request(url, finalOptions);
    return { content: res };
}
function aesDecrypt_51(encryptedData, type = 'video') {
    try {
        if (!encryptedData) return null;
        const config = AES_CONFIG_51[type];
        const key = CryptoJS.enc.Utf8.parse(config.key);
        const iv = CryptoJS.enc.Utf8.parse(config.iv);
        let wordArray;
        if (typeof encryptedData === 'string') wordArray = CryptoJS.enc.Base64.parse(encryptedData);
        else if (encryptedData instanceof Uint8Array) wordArray = CryptoJS.lib.WordArray.create(encryptedData);
        else return null;
        const decrypted = CryptoJS.AES.decrypt({ ciphertext: wordArray }, key, { iv: iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 });
        let decryptedBytes = new Uint8Array(decrypted.sigBytes);
        for (let i = 0; i < decrypted.sigBytes; i++) decryptedBytes[i] = (decrypted.words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xFF;
        if (type === 'video') {
            const decoder = new TextDecoder('utf-8', { fatal: false });
            const plaintext = decoder.decode(decryptedBytes);
            const firstBrace = plaintext.indexOf('{');
            const lastBrace = plaintext.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1) {
                const jsonStr = plaintext.substring(firstBrace, lastBrace + 1);
                return JSON.parse(jsonStr);
            }
            return JSON.parse(plaintext);
        }
        return decryptedBytes;
    } catch(e) { 
        console.log(`【aesDecrypt】异常: ${e.message}`);
        return null; 
    }
}
function parseHomeVideos_51(html) {
    let videos = [];
    if (!html) return videos;
    let regex = /<a[^>]*href="\/(?:video|play)(?:\?id=|\/)(\d+)"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>/gi;
    let match;
    while ((match = regex.exec(html)) !== null) {
        let id = match[1], pic = match[2], name = match[3].replace(/<[^>]+>/g, '').trim();
        if (pic && pic.startsWith('blob:')) {
            let dataSrcMatch = html.substring(match.index, match.index + 500).match(/data-src="([^"]+)"/);
            if (dataSrcMatch) pic = dataSrcMatch[1]; else continue;
        }
        if (name) videos.push({ vod_id: '51@' + id, vod_name: name, vod_pic: getProxyUrl_51(pic), vod_remarks: '五一' });
    }
    if (videos.length === 0) {
        let simplerRegex = /<a[^>]*href="\/video\/(\d+)"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"[^>]*>[\s\S]*?<(?:h[1-6]|div|span)[^>]*>([\s\S]*?)<\/(?:h[1-6]|div|span)>/gi;
        while ((match = simplerRegex.exec(html)) !== null) {
            let id = match[1], pic = match[2], name = match[3].replace(/<[^>]+>/g, '').trim();
            if (pic && pic.startsWith('blob:')) {
                let dataSrcMatch = html.substring(match.index, match.index + 500).match(/data-src="([^"]+)"/);
                if (dataSrcMatch) pic = dataSrcMatch[1]; else continue;
            }
            if (name && !videos.some(v => v.vod_id === '51@' + id)) videos.push({ vod_id: '51@' + id, vod_name: name, vod_pic: getProxyUrl_51(pic), vod_remarks: '五一' });
        }
    }
    return videos;
}
function parseSearchVideos_51(html) {
    let videos = [];
    if (!html) return videos;
    let cards = html.match(/<div class="video-card[\s\S]*?<\/div>\s*<\/div>\s*(?=<div class="video-card|$)/gi);
    if (!cards) return videos;
    for (let card of cards) {
        let linkMatch = card.match(/href="\/video\/(\d+)"/);
        if (!linkMatch) continue;
        let vod_name = card.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i) ? card.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)[1].trim() : '未知标题';
        let pic = card.match(/<img[^>]*src="([^"]+)"/) && !card.match(/<img[^>]*src="([^"]+)"/)[1].startsWith('blob:') ? card.match(/<img[^>]*src="([^"]+)"/)[1] : (card.match(/data-src="([^"]+)"/) ? card.match(/data-src="([^"]+)"/)[1] : '');
        let hotMatch = card.match(/<span class="text-white[^"]*">([\d.]+万?热度)<\/span>/);
        let vod_remarks = hotMatch ? '五一 | ' + hotMatch[1] : (card.match(/收藏(\d+)/) ? `五一 | 收藏${card.match(/收藏(\d+)/)[1]}` : '五一');
        if (vod_name) videos.push({ vod_id: '51@' + linkMatch[1], vod_name, vod_pic: getProxyUrl_51(pic), vod_remarks });
    }
    return videos;
}

// === 牛牛服务 ===
const NN_Service = {
    crypto: {
        aesDecryptECB: (encryptedData, key) => {
            let keyCrypto = CryptoJS.enc.Utf8.parse(key);
            let encryptedCrypto = CryptoJS.enc.Base64.parse(encryptedData);
            let decrypted = CryptoJS.AES.decrypt({ ciphertext: encryptedCrypto }, keyCrypto, { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 });
            return decrypted.toString(CryptoJS.enc.Utf8);
        },
        aesEncryptECB: (data, key) => {
            let keyCrypto = CryptoJS.enc.Utf8.parse(key);
            let dataCrypto = CryptoJS.enc.Utf8.parse(data);
            let encrypted = CryptoJS.AES.encrypt(dataCrypto, keyCrypto, { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 });
            return encrypted.toString();
        },
        hmacSHA256: (msg, key) => CryptoJS.HmacSHA256(msg, key).toString(CryptoJS.enc.Hex)
    },
    
    async ensureAuth() {
        if (globalThis.aggConfig.nn_token) return;
        try {
            const tkhtml = await request("https://new.tianjinzhitongdaohe.com/api/v1/app/user/visitorInfo", { headers: { "deviceid": "aa11fc54-ba9c-3980-add5-447d3fa5b939", "User-Agent": "okhttp/4.12.0" } });
            globalThis.aggConfig.nn_token = JSON.parse(tkhtml).data.token;
        } catch (e) { }
    },
    
    async ensureCsjAuth() {
        if (globalThis.aggConfig.nn_csj_token) return;
        try {
            let t = String(Math.floor(Date.now() / 1000));
            let body = `ac=wifi&os=Android&vod_version=1.10.21.6-tob&os_version=9&type=1&clientVersion=v5.2.5&uuid=Y4WNZ3SAWK7MAJMH7CXCDHJ4VMPVFRZQTBSIA4XTYO4AWEUHIK6Q01&resolution=1280*2618&openudid=889edced38f1069b&dt=Pixel%204&sha1=46121F77CE2FCAD3DBC3B9EC8A24908C1A8AD6D9&os_api=28&install_id=1549688030634536&device_brand=google&sdk_version=1.1.3.0&package_name=com.niuniu.ztdh.app&siteid=5627189&dev_log_aid=667431&oaid=&timestamp=${t}`;
            let nonce = "VX1KKGtoBDCi1fB1";
            let signature = this.crypto.hmacSHA256(t + nonce + body, 'aceaa47f96b4875d446b2e1d97e03bbb');
            let encBody = this.crypto.aesEncryptECB(body, 'dafdb3d2a5c343d6');
            
            let res = await request(`${getPlatformConfig('牛牛').url1}/csj_sp/api/v1/user/login?siteid=5627189`, {
                headers: { 'X-Salt': '786774955F', 'X-Nonce': nonce, 'X-Timestamp': t, 'X-Signature': signature, 'Content-Type': 'application/x-www-form-urlencoded' },
                body: encBody, method: "POST"
            });
            let decrypted = this.crypto.aesDecryptECB(res, 'dafdb3d2a5c343d6');
            globalThis.aggConfig.nn_csj_token = JSON.parse(decrypted).data.access_token;
        } catch(e) {}
    },

    async api(url, body) {
        await this.ensureAuth();
        return JSON.parse(await request(url, {
            method: 'POST', headers: { "token": globalThis.aggConfig.nn_token, "deviceid": "aa11fc54-ba9c-3980-add5-447d3fa5b939", "content-type": "application/json;charset=UTF-8", "User-Agent": "okhttp/4.12.0" }, body: JSON.stringify(body)
        }));
    },
    
    post1: async function(url1, data1, index) {
        await this.ensureCsjAuth();
        let t10 = String(Math.floor(Date.now() / 1000));
        let X_Nonce = "X9UknYKtLa3DmtjC";
        let body1 = data1.replace(/&lock_free=\d+/, "&lock_free=1")
                          .replace(/&timestamp=\d+/, "&timestamp="+t10)
                          .replace(/&count=\d+/, "&count=1")
                          .replace(/&index=\d+/, "&index=" + (index || "1"))
                          .replace(/&lock_ad=\d+/, "&lock_ad=1")
                          .replace(/&lock_index=\d+/, "&lock_index=" + (index || "1"));
        
        let body2 = this.crypto.aesEncryptECB(body1, 'ce49b18dd4e0a4d8');
        let body3 = t10 + X_Nonce + body1;
        let signature = this.crypto.hmacSHA256(body3, 'aceaa47f96b4875d446b2e1d97e03bbb');
        
        try {
            let html1 = await request(url1, {
                headers: {
                    'X-Salt': 'FD8188A8D5',
                    'X-Nonce': X_Nonce,
                    'X-Timestamp': t10,
                    'X-Access-Token': globalThis.aggConfig.nn_csj_token || '',
                    'X-Signature': signature,
                    "User-Agent": "okhttp/3.12.11", 
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: body2,
                method: "POST"
            });
            let decryptedHtml = this.crypto.aesDecryptECB(html1, 'ce49b18dd4e0a4d8');
            return JSON.parse(decryptedHtml);
        } catch(e) { return {}; }
    }
};

// === 七猫核心 ===
async function getQmParamsAndSign() {
    let sessionId = Math.floor(Date.now()).toString();
    let data = {
        "static_score": "0.8", "uuid": "00000000-7fc7-08dc-0000-000000000000",
        "device-id": "20250220125449b9b8cac84c2dd3d035c9052a2572f7dd0122edde3cc42a70",
        "mac": "", "sourceuid": "aa7de295aad621a6", "refresh-type": "0", "model": "22021211RC",
        "wlb-imei": "", "client-id": "aa7de295aad621a6", "brand": "Redmi", "oaid": "",
        "oaid-no-cache": "", "sys-ver": "12", "trusted-id": "", "phone-level": "H",
        "imei": "", "wlb-uid": "aa7de295aad621a6", "session-id": sessionId
    };
    let jsonStr = JSON.stringify(data, null, 0);
    let utf8Encoded = encodeURIComponent(jsonStr);
    let base64Str = btoa(unescape(utf8Encoded));
    let qmParams = '';
    for (let c of base64Str) qmParams += globalThis.aggConfig.charMap[c] || c;
    let paramsStr = `AUTHORIZATION=app-version=10001application-id=com.duoduo.readchannel=unknownis-white=net-env=5platform=androidqm-params=${qmParams}reg=${globalThis.aggConfig.keys}`;
    let sign = await md5(paramsStr);
    return { qmParams, sign };
}
async function getHeaderX() {
    let { qmParams, sign } = await getQmParamsAndSign();
    return {
        'net-env': '5', 'reg': '', 'channel': 'unknown', 'is-white': '', 'platform': 'android',
        'application-id': 'com.duoduo.read', 'authorization': '', 'app-version': '10001',
        'user-agent': 'webviewversion/0', 'qm-params': qmParams,
        'sign': sign
    };
}

const SH_Service = {
  key: "xxxxxxwhwqedqder",
  aesGcmDecrypt: function(cipherHex, ivHex) {
    try {
        var key = forge.util.createBuffer(this.key, 'utf8');
        var iv = forge.util.createBuffer(forge.util.hexToBytes(ivHex));
        var encryptedBytes = forge.util.hexToBytes(cipherHex);
        var tagLength = 16;
        var tag = forge.util.createBuffer(encryptedBytes.slice(-tagLength));
        var data = forge.util.createBuffer(encryptedBytes.slice(0, -tagLength));
        var decipher = forge.cipher.createDecipher('AES-GCM', key);
        decipher.start({iv: iv, tag: tag});
        decipher.update(data);
        if (decipher.finish()) return decipher.output.toString('utf8');
        return "{}";
    } catch (e) { return "{}"; }
  },
  encryptECB: function(plainText) {
      const key = CryptoJS.enc.Utf8.parse("B@ecf920Od8A4df7");
      return CryptoJS.AES.encrypt(plainText, key, { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 }).toString();
  },
  ensureAuth: async function() {
      if (globalThis.aggConfig.sh_token) return;
      try {
          const body = JSON.stringify({ "device": "22ebfeec0a5ad3c0397bae448b8658cc3", "install_first_open": true, "first_install_time": 1751687627754, "last_update_time": 1751687627754, "report_link_url": "", "android_id": "8f7db6f23d745890", "package_name": "com.shanhai.duanju", "authorization": "", "timestamp": Date.now() });
          const res = JSON.parse(await request(getPlatformConfig('山海').url1, { method: "POST", headers: { "content-type": "application/json; charset=utf-8" }, body: this.encryptECB(body) }));
          globalThis.aggConfig.sh_token = res.data.token;
      } catch(e) {}
  },
  request: async function(url, options = {}) {
      await this.ensureAuth();
      const headers = { "authorization": globalThis.aggConfig.sh_token, ...options.headers };
      const rawRes = JSON.parse(await request(url, { ...options, headers }));
      return JSON.parse(this.aesGcmDecrypt(rawRes.data.data, rawRes.data.nonce));
  }
};

// === 薏米短剧服务 ===
const yimi_privateKey = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDwCPsMptVn80Im4VVfJ2uAkjs7NpJzzsyGxleK1uN9ux/KTiY2o8kiXcRIcAYVChfdX4ywUs0jrjh8iTcC91r6qgeBaDS8wWsL5bZrn7O/8sqq2hbizV4AvvsqhxVJzRUJZjbNOcMZOPJoeL5K4U4YsiOyV8a9lt5C6zEC4Qy0xjscvOTGyVTqtWeJedEedXtiKLQxAiy6OKJxyHQqdwMHUfAgAbLzAHcVpg1RSXwud+5vtTJNXOXT98FHoFDcRIEcHiiqfU9dskzAhG2nPbFujO+YFq9tZBrWmrhPaXcHfXZqtEYePM4vuvMYjhmANdG4Ehl6pN9nuEaLZ+L35/3nAgMBAAECggEBAOe+M+s2E2ll8WMqQEs6+s5J4Ee9201Vxh8E1TYlW8Ni60FdjAVKwgCc+Mla5nRfp0TCYElH1+hv5vdNXsBNYhgKGm701Z27O4dkA2gK6vcSCFtFbb0Qu4YK3OFlQ8dZ6cqGVbhz4Qmz8k2s7UPMHKM5Mb+YgTc/tlxzR4FZF/RaY8MDpv6iMcXPY27xJzZAV1jROCXjZTZNYbgjsKDAbthRDkjMyuKCIdq7rAHrEyFSx3n7/uxnZYh42bXzWyyWudbkAJoq1ZYx+NyYj5TsN/WNoYbCPcX0Ko+CNnpkC/6qtQbHrBiMprnld67qdLCVhWpmOBYukXVPwFMJjOFlYKkCgYEA+WDh3LpitYSO6hn7mhnbqEQba13cutbJW9RQa0BjGf1OGXdqXpimcWK7viZYAKhLlyGWQmoWduDq4bjSRx7ZxY8pMtpIUWoVkKItD7D2yvmYN1guHNRpHlUIAsSH3HGwQIeXy36hJcB5gC+3XgRVPz/juTMWJDC0usECNFz17bsCgYEA9miWi6JPnZ1ffQzAyE+P6vGC/Vrl7Uyr9gqxI/OkZa8bUqfZtGo5UDGSaGRUsoTsYiEJ8m5blPY0X4xr5x1kO6rfk0gHxn1OXlCP42yT2+CqQvjNO2DHOnWNryKjmAqaAITbmC2lgj0PiiPO32ZT3aXTOgwxTKbFP3LBDmwA18UCgYAQuEgsbmqz1OFoHLnbySQLEhXsiuyDsmbpu0BxEG4UjgEwf+sn0IBIVeBUjWmVEbOPvHbAmTBMZCQbYjLnBdCACGswt6Xln4E2o0j2Jl1Fmpp0C3t7/1nU6MqStO6O/yhcCztIL4NKbq82wvw+V3gHt5bjEePIJWPYqZwmOp1ahQKBgCqfHKs6gBr7RbETq6T6XiJ9c/Lu7iaFxJjicJGPazhLeaZqcjXKye8dI/36nMvkQh8XJ+lPPXgeviBo4aEwbE4F2HZZVz72HcAin0DvXwQBcHH1J0rGCrAJ9V/91d5OtySv1mwUOTS16yIx3260/HyyWj8ILN7dWfEHoG0mMV8hAoGBAI0KBzR9WfzxNKI4ZqRD9/sN+SH4oxymo2oJ+FnOW7hk1E0EyrsGzIDCrS/f7MPzLJI7F4DULsrU5RIQyouIybZra29Vqe4L8kdIae5O0R4Y2r7gt/yWo4cWnW53Q0f5o7mzV10Dc8ewuT1DyJrt25dMWsGsP8rQ/0pVUBLEf93b
-----END PRIVATE KEY-----`;

function yimiRsaSign(privateKeyPem, data) {
    var privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
    var md = forge.md.sha256.create();
    md.update(data, 'utf8');
    return forge.util.encode64(privateKey.sign(md));
}

async function yimiGetHeaders(path, params, sec) {
    const x_sig_timestamp = String(Math.floor(new Date().getTime()));
    const str3 = "&" + params + "&" + path + "&" + x_sig_timestamp + "&" + sec;
    const sign = await yimiRsaSign(yimi_privateKey, str3);
    
    return {
        "x-appid": "zy9351ae",
        "x-sig-timestamp": x_sig_timestamp,
        "x-sig-alg": "RSA-SHA256",
        "x-sig-sign": sign,
        "x-sig-ver": "v1.1",
        "x-sig-sec": sec,
        "User-Agent": "Dalvik/2.1.0 (Linux; U; Android 15; 22081212C Build/AQ3A.241006.001)"
    };
}

var rule = {
  类型: '短剧',
  title: '聚合短剧[短]',
  author: 'EylinSir',
  host: '',
  url: '',
  searchUrl: '*',
  logo: 'https://cattleduanju.oss-cn-beijing.aliyuncs.com/png/20241024003958_01_800.png',
  searchable: 1,
  quickSearch: 1,
  filterable: 1,
  timeout: 5000,
  play_parse: true,
  search_match: true,
  headers: globalThis.aggConfig.headers.default,
  filter_def: {
    51: { area: '0-0-0-0-0-0' },
    星星: { area: '1287' },
    河马: { area: '53@精选' },
    星芽: { area: '1' }, 西饭: { area: '68@都市' }, 七猫: { area: '0' },
    围观: { area: '' }, 牛牛: { area: '全部' },
    山海: { area: '1' }, 好看: { area: '1' },
    百度: { class: '新剧', area: '全部' },
    薏米: { area: 'channel_c6f50cd9' }
  },
  filter: {
    "51": [{"key": "area", "name": "分类", "value": [{"n": "全部短剧", "v": "0-0-0-0-0-0"}, {"n": "男频", "v": "0-0-0-1-0-0"}, {"n": "女频", "v": "0-0-0-2-0-0"}]}],
    "星星": [{"key": "area", "name": "分类", "value": [{"n": "精选", "v": "1287"}, {"n": "热门", "v": "1288"}, {"n": "新剧", "v": "1289"}]}],
    "河马": [{"key": "area", "name": "分类", "value": [{"n": "精选", "v": "53@精选"}, {"n": "古装", "v": "54@古装"}, {"n": "重生", "v": "55@重生"}, {"n": "家庭", "v": "56@家庭"}, {"n": "恋爱", "v": "57@恋爱"}]}],
    "百度": [
        {"key": "class", "name": "综合", "value": [{"n": "新剧", "v": "新剧"}, {"n": "限时免费", "v": "限时免费"}, {"n": "精选", "v": "精选"}, {"n": "独播", "v": "独播"}]},
        {"key": "area", "name": "题材", "value": [{"n": "全部", "v": "全部"}, {"n": "神医", "v": "神医"}, {"n": "都市", "v": "都市"}, {"n": "现代言情", "v": "现代言情"}, {"n": "异能", "v": "异能"}, {"n": "逆袭", "v": "逆袭"}, {"n": "甜宠", "v": "甜宠"}, {"n": "总裁", "v": "总裁"}, {"n": "萌宝", "v": "萌宝"}, {"n": "战神", "v": "战神"}, {"n": "宫斗宅斗", "v": "宫斗宅斗"}, {"n": "神豪", "v": "神豪"}, {"n": "虐恋", "v": "虐恋"}, {"n": "闪婚", "v": "闪婚"}, {"n": "玄幻", "v": "玄幻"}, {"n": "穿越重生", "v": "穿越重生"}, {"n": "年代", "v": "年代"}, {"n": "家庭伦理", "v": "家庭伦理"}, {"n": "古代言情", "v": "古代言情"}, {"n": "武侠武打", "v": "武侠武打"}, {"n": "赘婿", "v": "赘婿"}, {"n": "青春校园", "v": "青春校园"}]}
    ],
    "星芽": [{"key": "area", "name": "分类", "value": [{"n": "剧场", "v": "1"}, {"n": "热播剧", "v": "2"}, {"n": "会员专享", "v": "8"}, {"n": "星选好剧", "v": "7"}, {"n": "新剧", "v": "3"}, {"n": "阳光剧场", "v": "5"}]}],
    "西饭": [{"key": "area", "name": "分类", "value": [{"n": "全部", "v": ""}, {"n": "都市", "v": "68@都市"}, {"n": "青春", "v": "68@青春"}, {"n": "现代言情", "v": "81@现代言情"}, {"n": "豪门", "v": "81@豪门"}, {"n": "大女主", "v": "80@大女主"}, {"n": "逆袭", "v": "79@逆袭"}, {"n": "打脸虐渣", "v": "79@打脸虐渣"}, {"n": "穿越", "v": "81@穿越"}]}],
    "七猫": [{"key": "area", "name": "分类", "value": [{"n": "全部", "v": ""}, {"n": "推荐", "v": "0"}, {"n": "新剧", "v": "-1"}, {"n": "都市情感", "v": "1273"}, {"n": "古装", "v": "1272"}, {"n": "都市", "v": "571"}, {"n": "玄幻仙侠", "v": "1286"}, {"n": "奇幻", "v": "570"}, {"n": "乡村", "v": "590"}, {"n": "民国", "v": "573"}, {"n": "年代", "v": "572"}, {"n": "青春校园", "v": "1288"}, {"n": "武侠", "v": "371"}, {"n": "科幻", "v": "594"}, {"n": "末世", "v": "556"}, {"n": "二次元", "v": "1289"}, {"n": "逆袭", "v": "400"}, {"n": "穿越", "v": "373"}, {"n": "复仇", "v": "795"}, {"n": "系统", "v": "787"}, {"n": "权谋", "v": "790"}, {"n": "重生", "v": "784"}, {"n": "女性成长", "v": "1294"}, {"n": "打脸虐渣", "v": "716"}, {"n": "闪婚", "v": "480"}, {"n": "强者回归", "v": "402"}, {"n": "追妻火葬场", "v": "715"}, {"n": "家庭", "v": "670"}, {"n": "马甲", "v": "558"}, {"n": "职场", "v": "724"}, {"n": "宫斗", "v": "343"}, {"n": "高手下山", "v": "1299"}, {"n": "娱乐明星", "v": "1295"}, {"n": "异能", "v": "727"}, {"n": "宅斗", "v": "342"}, {"n": "替身", "v": "712"}, {"n": "穿书", "v": "338"}, {"n": "商战", "v": "723"}, {"n": "种田经商", "v": "1291"}, {"n": "伦理", "v": "1293"}, {"n": "社会话题", "v": "1290"}, {"n": "致富", "v": "492"}, {"n": "偷听心声", "v": "1258"}, {"n": "脑洞", "v": "526"}, {"n": "豪门总裁", "v": "624"}, {"n": "萌宝", "v": "356"}, {"n": "战神", "v": "527"}, {"n": "真假千金", "v": "812"}, {"n": "赘婿", "v": "36"}, {"n": "神医", "v": "1269"}, {"n": "神豪", "v": "37"}, {"n": "小人物", "v": "1296"}, {"n": "团宠", "v": "545"}, {"n": "欢喜冤家", "v": "464"}, {"n": "女帝", "v": "617"}, {"n": "银发", "v": "1297"}, {"n": "兵王", "v": "28"}, {"n": "虐恋", "v": "16"}, {"n": "甜宠", "v": "21"}, {"n": "悬疑", "v": "27"}, {"n": "搞笑", "v": "793"}, {"n": "灵异", "v": "1287"}]}],
    "牛牛": [{"key": "area", "name": "分类", "value": [{"n": "全部", "v": ""}, {"n": "现言", "v": "现言"}, {"n": "古言", "v": "古言"}, {"n": "历史", "v": "历史"}, {"n": "都市", "v": "都市"}, {"n": "亲情", "v": "亲情"}, {"n": "玄幻", "v": "玄幻"}, {"n": "热血", "v": "热血"}, {"n": "喜剧", "v": "喜剧"}, {"n": "悬疑", "v": "悬疑"}, {"n": "军事", "v": "军事"}, {"n": "其他剧情", "v": "其他剧情"}]}],
    "山海": [{"key": "area", "name": "分类", "value": [{"n": "精选", "v": "0"}, {"n": "人气", "v": "1"}, {"n": "新剧", "v": "51"}, {"n": "甜宠", "v": "46"}, {"n": "逆袭", "v": "6"}, {"n": "强者回归", "v": "50"}, {"n": "奇幻", "v": "44"}, {"n": "复仇", "v": "49"}, {"n": "中国梦", "v": "41"}, {"n": "家庭", "v": "9"}]}],
    "好看": [{"key": "area", "name": "分类", "value": [{"n": "热播剧", "v": "1"}, {"n": "新剧", "v": "2"}, {"n": "战神", "v": "1001"}, {"n": "神豪", "v": "2001"}, {"n": "神医", "v": "1002"}, {"n": "甜宠", "v": "1007"}, {"n": "赘婿", "v": "1003"}, {"n": "穿越重生", "v": "2004"}, {"n": "异能", "v": "2005"}, {"n": "虐恋", "v": "1006"}, {"n": "宫斗宅斗", "v": "2006"}, {"n": "玄幻", "v": "2009"}]}],
    "围观": [{"key": "area", "name": "分类", "value": [{"n": "全部", "v": ""}]}],
    "薏米": [{"key": "area", "name": "分类", "value": [{"n": "精选", "v": "channel_c6f50cd9"}, {"n": "逆袭", "v": "channel_a8e10abc"}, {"n": "复仇", "v": "channel_d26dd434"}, {"n": "恋爱", "v": "channel_75afe84a"}, {"n": "重生", "v": "channel_2272aac5"}, {"n": "古风", "v": "channel_73190d4f"}, {"n": "神医", "v": "channel_2d7eae6b"}, {"n": "言情", "v": "channel_614820bd"}, {"n": "都市", "v": "channel_13dfce8b"}, {"n": "悬疑", "v": "channel_861b9642"}, {"n": "历史", "v": "channel_18157927"}]}]
  },

  预处理: async function () {
    const cfg = globalThis.aggConfig;
    this.platforms = cfg.platformList.map(item => ({ ...item, url: cfg.platform[item.id].url1 ? `${cfg.platform[item.id].host}${cfg.platform[item.id].url1}` : '' }));
    await NN_Service.ensureAuth();
    await SH_Service.ensureAuth();
    await fetchOauthId_51();
    if (!globalThis.aggConfig.xingya_headers) {
        try {
          const headers = {
            'User-Agent': 'okhttp/4.10.0',
            'Accept-Encoding': 'gzip',
            'Content-Type': 'application/x-www-form-urlencoded',
            'x-app-id': '7', 'platform': '1', 'manufacturer': 'realme', 'version_name': '3.3.1',
            'user_agent': 'Mozilla/5.0 (Linux; Android 9; RMX1931 Build/PQ3A.190605.05081124; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/91.0.4472.114 Mobile Safari/537.36',
            'app_version': '3.3.1', 'device_platform': 'android', 'personalized_recommend_status': '1',
            'device_type': 'RMX1931', 'device_brand': 'realme', 'os_version': '9', 'channel': 'default',
            'raw_channel': 'default', 'oaid': '', 'msa_oaid': '', 'uuid': 'randomUUID_914e7a9b-deac-4f80-9247-db56669187df',
            'device_id': '24250683a3bdb3f118dff25ba4b1cba1a', 'ab_id': '', 'support_h265': '1'
          };
          const body = 'device=24250683a3bdb3f118dff25ba4b1cba1a&install_first_open=false&first_install_time=1723214205125&last_update_time=1723214205125&report_link_url=';
          const res = JSON.parse(await request(cfg.platform.星芽.loginUrl, { method: 'POST', headers: headers, body: body }));
          const token = res.data?.token;
          
          if (token) {
              globalThis.aggConfig.xingya_headers = { 
                ...rule.headers.default, 
                authorization: token, 
                'dev_token': 'Bnf9uRPIcKTIOZasAUgUJAUDXhIOlB4lpDKsyLD4yvKm708G4J8PN1Z-gMaFgPwkRvqJrEje81VRxh41IaSj0lNWuoRLUg1r08Z1f0IqSv2q1lvfxrYckKavmnAPYLdkT9P1fPFNRt0RuN3DLLFZqApRDdPD3mM2jB6d79CF2LtM*',
                'User-Agent': 'okhttp/4.10.0',
                'user_agent': 'Mozilla/5.0 (Linux; Android 9; RMX1931 Build/PQ3A.190605.05081124; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/91.0.4472.114 Mobile Safari/537.36',
                'app_version': '3.0.0.1', 'version_name': '3.0.0.1', 'support_h265': '1'
              };
          }
        } catch (e) { }
    }
  },

  class_parse: () => ({ class: globalThis.aggConfig.platformList.map(item => ({ type_id: item.id, type_name: item.name })) }),

推荐: async function () {
    const cfg = globalThis.aggConfig;
    const randomPlat = cfg.platformList[Math.floor(Math.random() * cfg.platformList.length)];
    const fakeContext = { ...this, MY_CATE: randomPlat.id, MY_FL: this.filter_def?.[randomPlat.id] || {}, MY_PAGE: 1 };
    return await this.一级.call(fakeContext);
  },

  一级: async function () {
    const { MY_CATE, MY_FL, MY_PAGE } = this;
    const area = MY_FL?.area || '';
    const plat = getPlatformConfig(MY_CATE);
    const cfg = globalThis.aggConfig;
    let d = [];
    const fetch = async (url, opt = {}) => JSON.parse(await request(url, { headers: cfg.headers.default, ...opt }));

    try {
      if (MY_CATE === '河马') {
          const [cid, cname] = (area || '53@精选').split('@');
          const body = {
             "recSwitch": true, "storePageId": 10002, "channelGroupId": "10",
             "channelId": parseInt(cid), "channelName": cname, "lastColumnStyle": 3,
             "fromColumnId": "1", "pageFlag": String(MY_PAGE), "theaterSubscriptSwitch": true
          };
          const res = await HM_Service.api("1125", body);
          if (res && res.columnData && res.columnData[0]) {
              res.columnData[0].videoData.forEach(vod => {
                  d.push({ title: vod.bookName, img: vod.coverWap, desc: `河马 | 更新${vod.updateNum}集`, url: `河马@${vod.bookId}`, extra: { bookId: vod.bookId, chapterMin: vod.updateNum, chapterMax: vod.chapterIndex } });
              });
          }
          return setResult(d);
      }
      if (MY_CATE === '百度') {
        const t = Math.floor(Date.now() / 1000);
        const version = await md5(t + "v2");
        const body = JSON.stringify({
            "data": {
                "refreshIndex": parseInt(MY_PAGE),
                "timestamp": t,
                "version": version,
                "themes": [
                   { "kind": "综合", "names": [MY_FL.class || "新剧"] },
                   { "kind": "题材", "names": [area === '全部' ? '' : area] }
                ],
                "extRequest": { "flow_tabid": "13" },
                "from": "feed", "page": "channel_video_landing", "pd": "feed", "theme": ""
            }
        });
        const res = await post("https://mbd.baidu.com/feedapi/v1/videoserver/playlets/list?service=bdbox", "data=" + body, cfg.headers.baidu_app);
        res.data?.items?.forEach(it => {
            d.push({
                title: it.title, 
                img: it.img, 
                desc: `百度 | ${it.updateStatus || '全集'}`,
                url: `百度@${it.collId}`
            });
        });
        return setResult(d);
      }
      if (MY_CATE === '牛牛') {
        const res = await NN_Service.api(`${plat.host}/api/v1/app/screen/screenMovie`, { "condition": { "classify": area === '全部' ? '' : area, "typeId": "S1" }, "pageNum": MY_PAGE, "pageSize": 40 });
        res.data?.records?.forEach(item => d.push({ title: item.name, url: `${MY_CATE}@${item.id}`, desc: `牛牛 | 共${item.totalEpisode}集`, img: item.cover, extra: { vid: item.id } }));
        return setResult(d);
      }
      if (MY_CATE === '山海') {
        const url = `${plat.host}/shanhai-theater/v2/theater_parent/cloud/v2/theater/home_page?theater_class_id=1&type=1&class2_ids=${area}&page_num=${MY_PAGE}&page_size=24`;
        const res = await SH_Service.request(url);
        res.items?.forEach(item => d.push({ title: item.theater.title, desc: `山海 | 共${item.theater.total}集`, img: item.theater.cover_url, url: `山海@${item.theater.id}` }));
        return setResult(d);
      }
      if (MY_CATE === '好看') {
        const bodyStr = `tag_id=${area}&pn=${MY_PAGE}&rn=12`;
        const rawRes = await post(`${plat.host}/haokan/ui-feed/playletTagsFeed?log=vhk&tn=1020970b&ctn=1008350n&blur=1`, bodyStr, { "Content-Type": "application/x-www-form-urlencoded" });
        rawRes.data?.list?.forEach(item => d.push({ title: item.playlet_title, desc: `好看 | 更新${item.episodes_num}集`, img: item.playlet_poster, url: `好看@${item.playlet_id}@${item.progress_vid}` }));
        return setResult(d);
      }
      switch (MY_CATE) {
        case '星芽': { 
            if (!globalThis.aggConfig.xingya_headers) {
                try { await this.预处理(); } catch (e) {}
            }
            const headers = globalThis.aggConfig.xingya_headers || cfg.headers.default;
            const r = await fetch(`${plat.host}${plat.url1.replace('theater_class_id', 'theater_class_id='+area)}&type=1&class2_ids=0&page_num=${MY_PAGE}&page_size=24`, { headers: headers });
            if (r && r.data && r.data.list) {
                r.data.list.forEach(it => d.push({ title: it.theater.title, img: it.theater.cover_url, desc: `星芽 | ${it.theater.total}集`, url: `星芽@${plat.host}${plat.url2}?theater_parent_id=${it.theater.id}` })); 
            }
            break; 
        }
        case '西饭': {
          const parts = area ? area.split('@') : ['68', '都市'];
          const typeId = parts[0] || '68';
          const typeName = parts[1] || '都市';
          const url = `${plat.host}${plat.url1}?reqType=aggregationPage&offset=${(MY_PAGE - 1) * 30}&categoryId=${typeId}&categoryNames=${encodeURIComponent(typeName)}&pageID=page_theater&appId=drama`;
          (await fetch(url))?.result?.elements?.forEach(soup => soup.contents.forEach(vod => { const dj = vod.duanjuVo; d.push({ title: dj.title, img: dj.coverImageUrl, desc: `西饭 | ${dj.total}集`, url: `西饭@${dj.duanjuId}#${dj.source}` }); }));
          break;
        }
        case '七猫': {
          let signStr = `operation=1playlet_privacy=1tag_id=${area}${cfg.keys}`;
          const sign = await md5(signStr);
          const url = `${plat.host}${plat.url1}?tag_id=${area}&playlet_privacy=1&operation=1&sign=${sign}`;
          const hx = await getHeaderX();
          const headers = { ...hx, ...cfg.headers.qimao };
          const res = JSON.parse(await request(url, { headers: headers }));
          res.data?.list?.forEach(item => d.push({ title: item.title, img: item.image_link, desc: `七猫 | ${item.total_episode_num}集`, url: `七猫@${encodeURIComponent(item.playlet_id)}` }));
          break;
        }
        case '51': {
            let url = `${plat.host}${plat.list}/${area}`;
            if (MY_PAGE > 1) url += `/page/${MY_PAGE}`;
            try {
                const response = await request(url, { method: 'GET', headers: HEADER_51, timeout: 15000 });
                let list51 = parseHomeVideos_51(response);
                list51.forEach(v => d.push({ title: v.vod_name, img: v.vod_pic, desc: v.vod_remarks, url: v.vod_id }));
            } catch(e) {
                console.log(`【51短剧】请求失败: ${e.message}`);
            }
            break;
        }
        case '星星': {
            const url = `${plat.host}${plat.list}`;
            const params = { productId: "2a8c14d1-72e7-498b-af23-381028eb47c0", vestId: "2be070e0-c824-4d0e-a67a-8f688890cadb", channel: "oppo19", osType: "android", version: "20", token: "202509271001001446030204698626", resourceId: area, pageNum: String(MY_PAGE), pageSize: "20" };
            const response = await request(`${url}?${buildUrlQuery(params)}`, { headers: cfg.headers.xingxing });
            try {
                const res = JSON.parse(response || '{}');
                (res.data?.datalist || []).forEach(vod => {
                    d.push({ title: vod.name || '', img: vod.icon || '', desc: `星星 | ${vod.heat || 0}万播放`, url: `星星@${vod.id}@${encodeURIComponent(vod.name || '')}@${encodeURIComponent(vod.introduction || '')}` });
                });
            } catch(e) {}
            break;
        }
        case '围观': {
            const res = await request(`${plat.host}${plat.search}`, { 
                method: 'POST', 
                headers: { 'content-type': 'application/json; charset=utf-8' }, 
                body: JSON.stringify({ "audience": "全部受众", "page": MY_PAGE, "pageSize": 30, "searchWord": "", "subject": "全部主题" }) 
            });
            const jsonRes = JSON.parse(res || '{}');
            jsonRes.data?.forEach(it => d.push({ title: it.title, img: it.vertPoster, desc: `围观 | ${it.episodeCount}集`, url: `围观@${it.oneId}` }));
            break; 
        }
        case '薏米': {
            const path = "/bookstore/local/visual/channel/list";
            const baseParams = `key=${area}&p1=1750574688516674369&p16=22081212C&p2=341201&p21=10&p22=15&p24=0&p25=21200&p28=cca83346da195d11&p29=zy9351ae&p3=102120009&p31=29d1af74b128f29f&p33=com.zhangyue.app.shortplay&p34=force_fsg_nav_bar&p35=BUZGFVakskazFWG2XwZ/LNs4fOnQczc4iivy1qLFvZqmerp2Abe2hv5Tu1jOHQJO5PGANizg3JbzgaTOon0qkmQ==&p4=501609&p5=16&p7=cca83346da195d11&p9=3&page=${MY_PAGE}&pc=10&usr=tj1290623468&zyeid=4fc4c6737a87b603e1b8ce9210032bae`;
            const headers = await yimiGetHeaders(path, baseParams, "AAF4IWZnITkqeX4hJCB5eio4IWc4IH4=");
            const url = plat.host + path + "?" + baseParams;
            const response = await request(url, { headers: headers, method: 'GET' });
            try {
                const json = JSON.parse(response || '{}');
                const list = json.body?.list?.[0]?.short_plays || [];
                list.forEach(item => d.push({ title: item.short_play_name, img: item.cover_url, desc: `薏米 | 热度值:${item.favor_count_format || 0}`, url: `薏米@${item.id}` }));
            } catch(e) {}
            break;
        }
      }
    } catch (e) { }
    return setResult(d);
  },

  二级: async function () {
    const { orId } = this;
    const [platform, ...rest] = orId.split('@');
    const id = rest.join('@');
    const cfg = globalThis.aggConfig;
    const plat = getPlatformConfig(platform);
    const fetch = async (url, opt = {}) => JSON.parse(await request(url, { headers: cfg.headers.default, ...opt }));
    let VOD = {};

    if (platform === '河马') {
        const bookId = id;
        const res = await HM_Service.api("1131", { "bookId": bookId });
        let eps = [];
        if (res.videoInfo) {
            const v = res.videoInfo;
            const listRes = await HM_Service.api("1132", {
                "bookId": bookId,
                "chapterMin": 1,
                "chapterMax": 10000 
            });
            const chapters = listRes.chapterList || [];
            eps = chapters.map(c => `${c.chapterName}$${c.chapterId}++${c.chapterIndex}++${bookId}`);
            return {
                vod_name: v.bookName, vod_pic: v.coverWap, 
                vod_id: id, 
                vod_remarks: v.finishStatusCn, 
                vod_content: v.introduction || "", 
                vod_play_from: '河马', vod_play_url: eps.join('#')
            };
        }
    }
    
    if (platform === '百度') {
        const res = (await post("https://sv.baidu.com/haokan/ui-video/playlet/rec/detail?log=vhk&tn=1020970b&ctn=1008350n&blur=1", `playlet_id=${id}&vid=undefined`, cfg.headers.browser)).data;
        const eps = (res.vid_list || []).map((v, i) => `第${i+1}集$${v}`);
        return { 
            vod_name: res.playlet_title, vod_pic: res.playlet_poster, 
            vod_remarks: `热度:${res.hot_value}`, vod_content: res.description, 
            vod_play_from: '百度', vod_play_url: eps.join('#') 
        };
    }

    if (platform === '牛牛') {
      const descRes = (await NN_Service.api(`${plat.host}/api/v1/app/play/movieDesc`, { "id": id, "typeId": "S1" })).data;
      const listRes = (await NN_Service.api(`${plat.host}/api/v1/app/play/movieDetails`, { "id": id, "source": 0, "typeId": "S1", "userId": "546932" })).data;
      let eps = [];
      if (listRes.episodeList && listRes.episodeList.length > 0) eps = listRes.episodeList.map(item => `${item.episode}$${item.id}+${id}+free`);
      
      if (eps.length === 0 && listRes.thirdPlayId) {
        let data1 = "not_include=0&lock_free=1&type=1&clientVersion=v5.2.5&uuid=6IDYUSASPQY5BBVACWQW3LLTPV4V7DE26UOCX5TZTVUGX4VUJNXQ01&resolution=1080*2320&openudid=82f4175d577a2939&dt=22021211RC&os_api=31&install_id=1496879012031075&sdk_version=1.1.3.0&siteid=5627189&dev_log_aid=667431&oaid=&timestamp=${t}&direction=0&ac=mobile&os=Android&vod_version=1.10.21.6-tob&os_version=12&count=1&index=1&shortplay_id=" + listRes.thirdPlayId + "&sha1=46121F77CE2FCAD3DBC3B9EC8A24908C1A8AD6D9&device_brand=Redmi&package_name=com.niuniu.ztdh.app";
        const html1 = await NN_Service.post1(`${plat.url1}/csj_sp/api/v1/shortplay/detail?siteid=5627189`, data1);
        if (html1 && html1.data && html1.data.episode_right_list) {
            eps = html1.data.episode_right_list.map(it => `第${it.index}集$${it.index}+${it.lock_type}+${listRes.thirdPlayId}`);
        }
      }
      return { vod_name: descRes.name, vod_pic: descRes.cover, vod_remarks: `评分:${descRes.score}`, vod_content: descRes.introduce, vod_play_from: platform, vod_play_url: eps.join('#') };
    }
    
    if (platform === '山海') {
        const detail = await SH_Service.request(`${plat.host}/shanhai-theater/v2/theater_parent/detail?theater_parent_id=${id}`);
        const eps = detail.theaters.map(item => `${item.son_title}$${item.son_video_url}`);
        return { vod_name: detail.title, vod_pic: detail.cover_url, vod_remarks: `标签:${detail.desc_tags.join(" ")}`, vod_content: detail.introduction, vod_play_from: '山海', vod_play_url: eps.join('#') };
    }
    
    if (platform === '好看') {
        const [pid, vid] = id.split('@');
        const res = (await post(`${plat.host}/haokan/ui-video/playlet/rec/detail?log=vhk&tn=1020970b&ctn=1008350n&blur=1`, `playlet_id=${pid}&vid=${vid}`, { "Content-Type": "application/x-www-form-urlencoded" })).data;
        const eps = res.vid_list.map((v, i) => `第${i+1}集$${v}`);
        return { vod_name: res.playlet_title, vod_pic: res.playlet_poster, vod_remarks: `更新:${res.episodes_num}`, vod_content: res.description, vod_play_from: '好看', vod_play_url: eps.join('#') };
    }
    
    switch (platform) {
      case '星芽': { 
          if (!globalThis.aggConfig.xingya_headers) { try { await this.预处理(); } catch (e) {} }
          const headers = globalThis.aggConfig.xingya_headers || cfg.headers.default;
          const res = JSON.parse(await request(id, { headers: headers }));
          const d = res.data;
          if (d) {
              VOD = { 
                  vod_name: d.title, 
                  vod_pic: d.cover_url, 
                  vod_content: d.introduction, 
                  vod_play_from: '星芽', 
                  vod_play_url: (d.theaters || []).map(i => `第${i.num}集$${i.son_video_url}`).join('#') 
              }; 
          }
          break; 
      }
      case '西饭': { const [did, src] = id.split('#'); const r = (await fetch(`${plat.host}${plat.url2}?duanjuId=${did}&source=${src}&appId=drama`)).result; VOD = { vod_name: r.title, vod_pic: r.coverImageUrl, vod_content: r.desc, vod_play_from: '西饭', vod_play_url: r.episodeList.map(i => `${i.index}$${i.playUrl}`).join('#') }; break; }
      case '七猫': { const d = decodeURIComponent(id); const sign = await md5(`playlet_id=${d}${cfg.keys}`); const r = await fetch(`${plat.url2}?playlet_id=${d}&sign=${sign}`, { method: 'GET', headers: { ...await getHeaderX(), ...cfg.headers.qimao, "Content-Type": "" } }); VOD = { vod_name: r.data.title, vod_pic: r.data.image_link, vod_content: r.data.intro, vod_play_from: '七猫', vod_play_url: r.data.play_list.map(i => `${i.sort}$${i.video_url}`).join('#') }; break; }
      case '围观': { 
    const response = await request(`${plat.host}${plat.url2}&oneId=${id}&page=1&pageSize=1000`, { headers: cfg.headers.default });
    try {
        const r = JSON.parse(response || '{}');
        if (r.data) {
            const data = r.data || [];
            const firstEpisode = data[0] || {};
            const playUrls = [];
            data.forEach(ep => {
                let ps = ep.playSetting || ep.videoClarityList || [];
                if (typeof ps === 'string') {
                    try { ps = JSON.parse(ps); } catch(e) { ps = {}; }
                }
                let url = '';
                if (typeof ps === 'object' && !Array.isArray(ps)) {
                    url = ps.super || ps.high || ps.normal || ps.url || ps.playUrl || '';
                } else if (Array.isArray(ps) && ps.length > 0) {
                    const best = ps.find(item => item.clarity === '1080P' || item.clarity === '1080p' || item.clarity === 'super' || item.clarity === '超清') || ps[0];
                    url = best.url || best.playUrl || '';
                }
                const title = `第${ep.playOrder || ep.episode || playUrls.length + 1}集`;
                playUrls.push(`${title}$${url || ep.playUrl || ''}`);
            });
            VOD = { 
                vod_id: orId,
                vod_name: firstEpisode.title || '', 
                vod_pic: firstEpisode.vertPoster || firstEpisode.horizonPoster || '', 
                vod_remarks: `共${data.length || 0}集`,
                vod_content: `播放量:${firstEpisode.viewCount || 0} 收藏:${firstEpisode.collectionCount || 0} 评论:${firstEpisode.commentCount || 0}`, 
                vod_play_from: '围观专线', 
                vod_play_url: playUrls.join('#') 
            }; 
        }
    } catch(e) {
        console.log(`【围观detail】解析失败: ${e.message}`);
    }
    break; 
}
      case '51': { 
        const postData = { id: parseInt(id), page: 0, oauth_id: OAUTH_ID_51, token: '' };
        const response = await request(`${plat.host}${plat.detail}`, {
            method: 'POST',
            headers: HEADER_51,
            data: postData
        });
        console.log(`【51detail】响应内容: ${response?.substring(0, 2000)}`);
        try {
            let resJson = JSON.parse(response || '{}');
            console.log(`【51detail】JSON解析后: code=${resJson.code}, data存在=${!!resJson.data}`);
            if (resJson.data) {
                let decrypted = aesDecrypt_51(resJson.data, 'video');
                console.log(`【51detail】解密后: ${typeof decrypted}, keys=${decrypted ? Object.keys(decrypted).join(',') : 'null'}`);
                if (decrypted) {
                    let videoInfo = decrypted.data?.list?.[0] || decrypted.list?.[0];
                    console.log(`【51detail】videoInfo: ${typeof videoInfo}, keys=${videoInfo ? Object.keys(videoInfo).join(',') : 'null'}`);
                    if (videoInfo) {
                        console.log(`【51detail】episodeAll长度: ${(videoInfo.episodeAll || []).length}`);
                        let playUrls = (videoInfo.episodeAll || []).map(ep => {
                            let title = ep.episode_title || ('第' + ep.sort + '集');
                            let url = ep.video_url || '';
                            return title + '$' + url;
                        }).filter(Boolean);
                        console.log(`【51detail】playUrls数量: ${playUrls.length}`);

                        VOD = { 
                            vod_id: orId,
                            vod_name: videoInfo.drama_name || videoInfo.video_title || '未知短剧',
                            vod_pic: (videoInfo.cover_img || videoInfo.first_img || '').replace(/^/, u => proxyImgUrl_51 ? proxyImgUrl_51 + encodeURIComponent(u) : u),
                            vod_content: videoInfo.description || '暂无简介',
                            vod_play_from: '五一',
                            vod_play_url: playUrls.join('#') || '暂无播放地址$0'
                        }; 
                    }
                }
            }
        } catch(e) {
            console.log(`【51短剧detail】解析失败: ${e.message}`);
        }
        break; 
    }
      case '星星': {
        const partsArr = id.split('@');
        const bookId = partsArr[0];
        const vodName = decodeURIComponent(partsArr[1] || '');
        const contentDesc = decodeURIComponent(partsArr[2] || '');
        const url = `${plat.host}${plat.detail}`;
        const params = { bookId: bookId, productId: "2a8c14d1-72e7-498b-af23-381028eb47c0", vestId: "2be070e0-c824-4d0e-a67a-8f688890cadb", channel: "oppo19", osType: "android", version: "20", token: "202509271001001446030204698626" };
        const response = await request(`${url}?${buildUrlQuery(params)}`, { headers: cfg.headers.xingxing });
        try {
            const res = JSON.parse(response || '{}');
            const data = res.data || [];
            const playUrls = data.map((vodItem, index) => {
                const playUrl = vodItem.shortPlayList?.[0]?.chapterShortPlayVoList?.[0]?.shortPlayUrl || '';
                return playUrl ? `第${index + 1}集$${playUrl}` : null;
            }).filter(Boolean).join('#');
            VOD = { vod_id: orId, vod_name: vodName || '未知短剧', vod_content: contentDesc, vod_play_from: '星星', vod_play_url: playUrls || '暂无播放地址$0' };
        } catch(e) {}
        break;
      }
      case '薏米': {
        const play_id = id;
        const path = "/video/client/short_play/episode_list";
        const pageSize = 30;
        let start_id = 1;
        let total = 999999;
        let episodes = [];
        try {
            const originalStr1 = `end_id=30&p1=1750574688516674369&p16=22081212C&p2=341201&p21=10&p22=15&p24=0&p25=21200&p28=cca83346da195d11&p29=zy9351ae&p3=102120009&p31=29d1af74b128f29f&p33=com.zhangyue.app.shortplay&p34=force_fsg_nav_bar&p35=BUZGFVakskazFWG2XwZ/LNs4fOnQczc4iivy1qLFvZqmerp2Abe2hv5Tu1jOHQJO5PGANizg3JbzgaTOon0qkmQ==&p4=501609&p5=16&p7=cca83346da195d11&p9=3&pc=10&play_id=${play_id}&start_id=1&usr=tj1290623468&zyeid=4fc4c6737a87b603e1b8ce9210032bae`;
            
            function replaceParam(str, key, value) {
                var re = new RegExp("(" + key + "=)[^&]*");
                return str.replace(re, "$1" + value);
            }
            
            let body = {};
            
            while (start_id <= total) {
                let end_id = start_id + pageSize - 1;
                let str1 = replaceParam(originalStr1, "start_id", start_id);
                str1 = replaceParam(str1, "end_id", end_id);
                
                const headers = await yimiGetHeaders(path, str1, "AAFzKmZkKjIqenUqJCNycSo7Kmw4I3U=");
                const url = plat.host + path + "?" + str1;
                
                const response = await request(url, { headers: headers, method: 'GET' });
                const json = JSON.parse(response || '{}');
                body = json.body || {};
                let list = body.episode_list || [];
                
                if (list.length === 0) break;
                
                if (start_id === 1) {
                    total = body.target_count || total;
                }
                
                list.forEach(ep => {
                    let playUrl = ep.play_url;
                    if (/zhangyuecdn/.test(playUrl)) {
                        playUrl = "https://mother-t.d.ireader.com" + playUrl.split("com")[1];
                    }
                    episodes.push("第" + ep.order + "集$" + playUrl);
                });
                
                start_id += pageSize;
            }
            
            VOD = {
                vod_name: body.name || "未知剧名",
                vod_pic: "",
                vod_content: body.introduce || "",
                vod_play_from: '薏米',
                vod_play_url: episodes.join('#')
            };
        } catch(e) {}
        break;
      }
    }
    return VOD;
  },

  搜索: async function (wd, quick, pg) {
    const { KEY, MY_PAGE } = this;
    const cfg = globalThis.aggConfig;
    const tasks = cfg.platformList.map(async (p) => {
      try {
        const plat = cfg.platform[p.id];
        if (p.id === '七猫') {
            try {
                const trackId = 'ec1280db127955061754851657967';
                const encWd = encodeURIComponent(KEY);
                const signStr = `extend=page=${MY_PAGE}read_preference=0track_id=${trackId}wd=${encWd}${cfg.keys}`;
                const sign = await md5(signStr);
                const url = `${plat.host}${plat.search}?extend=&page=${MY_PAGE}&wd=${encWd}&read_preference=0&track_id=${trackId}&sign=${sign}`;
                const hx = await getHeaderX();
                const headers = { ...hx, ...cfg.headers.qimao };
                delete headers['Content-Type']; 
                delete headers['content-type'];
                if (headers['user-agent']) delete headers['User-Agent'];
                
                const res = JSON.parse(await request(url, { headers: headers })); 
                return (res.data?.list || []).map(item => {
                      const cleanTitle = (item.title || '').replace(/<[^>]+>/g, '').trim();
                      const eps = (item.total_num || '0').replace(/集/g, ''); 
                      return { title: cleanTitle, img: item.image_link, desc: `七猫 | ${eps}集`, url: `七猫@${encodeURIComponent(item.id)}` };
                });
            } catch(e) { return []; } 
        }

        // === 牛牛 ===
        if (p.id === '牛牛') {
             if (!globalThis.aggConfig.nn_token) await NN_Service.ensureAuth();
             if (!globalThis.aggConfig.nn_token) return []; // 没 Token 坚决不发请求
             const res = await NN_Service.api(`${plat.host}/api/v1/app/search/searchMovie`, { "condition": { "typeId": "S1", "value": KEY }, "pageNum": MY_PAGE, "pageSize": 40 });
             return (res.data?.records || []).map(i => ({ title: i.name, url: `${p.id}@${i.id}`, desc: `${p.name} | ${i.type}`, img: i.cover }));
        }
        
        // === 河马 ===
        if (p.id === '河马') {
            const body = { "keyword": KEY, "page": parseInt(MY_PAGE), "size": 15, "searchSource": "搜索按钮", "hotWordType": 2, "tagIds": "", "reservationSwitch": true };
            const res = await HM_Service.api("1803", body);
            if (res.searchVos) {
                return res.searchVos.map(vod => ({ title: vod.bookName, img: vod.coverWap, desc: `河马 | 更新${vod.updateNum}集`, url: `河马@${vod.bookId}`, extra: { bookId: vod.bookId, chapterMin: vod.updateNum, chapterMax: vod.chapterIndex } }));
            }
            return [];
        }
        
        // === 百度 ===
        if (p.id === '百度') {
            const body = JSON.stringify({
                "query": KEY, "page": MY_PAGE, "attribute": ["title"], "fe_page_type": "search",
                "extra": { "tab_id": "216", "flow_tabid": "13", "shortplay_source": "feed", "from": "feed", "tab_type": "搜索", "sub_template": "playlet_search_result" }
            });
            const res = await post("https://mbd.baidu.com/feedapi/v1/videoserver/playlets/search?service=bdbox", "data=" + body, cfg.headers.baidu_app);
            return (res.data?.itemList || []).map(it => ({ title: it.title, img: it.img, url: `百度@${it.nid.split("_")[1]}`, desc: `百度 | ${it.collNum || ''}集` }));
        }
        
        // === 山海 ===
        if (p.id === '山海') {
          const res = await post(`${plat.host}/v3/search`, { text: KEY }, { "authorization": globalThis.aggConfig.sh_token, "Content-Type": "application/json" });
          return (res.data?.theater?.search_data || []).map(i => ({ title: i.title, url: `山海@${i.id}`, desc: `山海 | ${i.total}集`, img: i.cover_url }));
        }
        
        // === 好看 ===
        if (p.id === '好看') {
          const bodyStr = `method=get&pn=1&rn=10&v=2&word=${encodeURIComponent(KEY)}`;
          const res = await post(`${plat.host}/haokan/api?cmd=search/sug&log=vhk&tn=1020970b&ctn=1008350n&blur=1&word=${encodeURIComponent(KEY)}`, bodyStr, { "Content-Type": "application/x-www-form-urlencoded" });
          return (res["search/sug"]?.data?.list || []).filter(i => i.tplName === "sug_playlet").map(i => ({ title: i.title, img: i.cover_url, desc: `好看 | 热度:${i.hot_value}`, url: `好看@${i.id}@` })); 
        }
        
        // === Switch 逻辑 ===
        switch (p.id) {
            case '星芽': { 
                if (!globalThis.aggConfig.xingya_headers) { try { await this.预处理(); } catch (e) {} }
                const headers = globalThis.aggConfig.xingya_headers || cfg.headers.default;
                const res = await post(plat.host + plat.search, { text: KEY }, { ...headers, "Content-Type": "application/json" });
                if (res.data?.theater?.search_data) {
                    return res.data.theater.search_data.map(it => ({ title: it.title, desc: `星芽 | ${it.total || 0}集`, img: it.cover_url, url: `星芽@${plat.host}${plat.url2}?theater_parent_id=${it.id}` }));
                }
                return [];
            }
            
            case '西饭': { const ts = Math.floor(Date.now() / 1000); const url = `${plat.host}${plat.search}?reqType=search&offset=${(MY_PAGE - 1) * 30}&keyword=${encodeURIComponent(KEY)}&requestId=${ts}aa498144140ef297&appId=drama`; return (JSON.parse(await request(url)))?.result?.elements?.map(vod => ({ title: vod.duanjuVo.title, img: vod.duanjuVo.coverImageUrl, desc: `西饭 | ${vod.duanjuVo.total}集`, url: `西饭@${vod.duanjuVo.duanjuId}#${vod.duanjuVo.source}` })) || []; }
            
            case '51': { 
                let searchUrl = `${plat.host}${plat.search}/${encodeURIComponent(KEY)}`;
                if (MY_PAGE > 1) searchUrl += `/page/${MY_PAGE}`;
                const response = await request(searchUrl, { method: 'GET', headers: HEADER_51 });
                let results = parseSearchVideos_51(response);
                return results.map(v => ({ title: v.vod_name, img: v.vod_pic, desc: v.vod_remarks, url: v.vod_id })) || [];
            }
            
            case '围观': {
                const res = await request(`${plat.host}${plat.search}`, { 
                    method: 'POST', 
                    headers: { 'content-type': 'application/json; charset=utf-8' }, 
                    body: JSON.stringify({ "audience": "全部受众", "page": MY_PAGE, "pageSize": 30, "searchWord": KEY, "subject": "全部主题" }) 
                });
                const jsonRes = JSON.parse(res || '{}');
                return jsonRes.data?.map(it => ({ title: it.title, img: it.vertPoster, desc: `围观 | ${it.episodeCount}集`, url: `围观@${it.oneId}` })) || [];
            }
            
            case '薏米': {
                const path = "/bookstore/search/recommend_data";
                const params = `keyword=${encodeURIComponent(KEY)}&p1=1750574688516674369&p16=22081212C&p2=341201&p21=3&p22=15&p24=0&p25=21200&p28=cca83346da195d11&p29=zy9351ae&p3=102120009&p31=29d1af74b128f29f&p33=com.zhangyue.app.shortplay&p34=force_fsg_nav_bar&p35=BUZGFVakskazFWG2XwZ/LNs4fOnQczc4iivy1qLFvZqmerp2Abe2hv5Tu1jOHQJO5PGANizg3JbzgaTOon0qkmQ==&p4=501609&p5=16&p7=cca83346da195d11&p9=3&page=${MY_PAGE}&pc=10&resource_type=short_play&size=10&sort=1&source_type=0,1&type=0&usr=tj1290623468&zyeid=4fc4c6737a87b603e1b8ce9210032bae`;
                const headers = await yimiGetHeaders(path, params, "AAF4IWZnITkqeX4hJCB5eio4IWc4IH4=");
                const url = plat.host + path + "?" + params;
                const response = await request(url, { method: 'GET', headers: headers });
                try {
                    const json = JSON.parse(response || '{}');
                    const shortPlay = json.body?.short_play;
                    const list = shortPlay?.list || [];
                    let results = list.map(data => ({
                        title: data.name,
                        img: data.pic,
                        desc: `薏米 | 播放量:${data.popularity}`,
                        url: `薏米@${data.id}`
                    }));
                    if (results.length > 0 && KEY) {
                        results = results.filter(it => it.title && it.title.includes(KEY));
                    }
                    return results;
                } catch(e) { return []; }
            }
        }
        return [];
      } catch (e) { 
        return []; 
      }
    });
    const results = await Promise.allSettled(tasks);
    return setResult(results.filter(r => r.status === 'fulfilled').flatMap(r => r.value));
  },

  lazy: async function (flag, id, flags) {
    const { input } = this;
    const cfg = globalThis.aggConfig;
    if (flag.indexOf('河马') > -1) {
            const arr = input.split("++");
            const chapterId = arr[0];
            const chapterIndex = arr[1];
            const bookId = arr[2];
            const body = {
                "bookId": bookId,
                "chapterId": chapterId,
                "unClockType": "pay",
                "confirmPay": 2,
                "autoPayFlag": true,
                "omap": {
                    "channelName": "精选",
                    "logId": "17a6500357709bb2547e1e122b438cfc",
                    "originName": "书城",
                    "recId": "bigdata_rec",
                    "scene": "nsc_727",
                    "sceneId": "dzmf_video_sc_reco",
                    "strategyId": "g6y6b5sq"
                }
            };
            const res = await HM_Service.api("1133", body);
            if (res.chaptersPayType === '免费') {
                 if (res.chapterInfo && res.chapterInfo[0] && res.chapterInfo[0].content) {
                     const content = res.chapterInfo[0].content;
                     const playUrl = content.m3u8720p || (content.mp4SwitchUrl ? content.mp4SwitchUrl[0] : "");
                     return { parse: 0, url: playUrl, header: { "User-Agent": "okhttp/4.10.0" } };
                 }
            } else if (res.chaptersPayType === '按章付费') {
                const playUrl = `https://api.cenguigui.cn/api/duanju/hema.php?book_id=${bookId}&video_id=${chapterIndex}&type=mp4`;
                return { parse: 0, url: playUrl };
            }
            return { parse: 0, url: "toast://解析失败" };
    }

    if (flag.indexOf('百度') > -1) {
            const html = await post("https://sv.baidu.com/appui/api?cmd=video/relate&log=vhk&tn=1020970b&ctn=1008350n&blur=1", "method=post&vid=" + input, cfg.headers.baidu_app);
            const json = html["video/relate"]?.data?.cur_video;
            if (json && json.clarityUrl && json.clarityUrl.length > 0) {
                 const urls = json.clarityUrl.filter(i => i.url).sort((a,b) => b.video_quality - a.video_quality);
                 return { parse: 0, url: urls[0].url };
            }
            return { parse: 0, url: input };
    }

    if (flag.indexOf('牛牛') > -1) {
      const p = input.split('+');
      if (p.length === 3 && p[2] === 'free') {
        const r = await NN_Service.api("https://new.tianjinzhitongdaohe.com/api/v1/app/play/movieDetails", { id: p[1], source: 0, typeId: "S1", userId: "546932", episodeId: p[0] });
        return { parse: 0, url: r.data?.url || "toast://无法播放" };
      } else if (p.length === 3) {
        if (p[1] !== 'free') {
            let unlockData = "ac=mobile&os=Android&vod_version=1.10.21.6-tob&os_version=12&lock_ad=3&lock_free=3&type=1&clientVersion=v5.2.5&uuid=6IDYUSASPQY5BBVACWQW3LLTPV4V7DE26UOCX5TZTVUGX4VUJNXQ01&resolution=1080*2320&openudid=82f4175d577a2939&dt=22021211RC&os_api=31&install_id=1496879012031075&device_brand=Redmi&sdk_version=1.1.3.0&package_name=com.niuniu.ztdh.app&siteid=5627189&dev_log_aid=667431&oaid=abec0dfff623201b&timestamp=1752498493";
            await NN_Service.post1("https://csj-sp.csjdeveloper.com/csj_sp/api/v1/pay/ad_unlock?siteid=5627189", unlockData, p[0]);
        }
        let data1 = "not_include=0&lock_free=1&type=1&clientVersion=v5.2.5&uuid=6IDYUSASPQY5BBVACWQW3LLTPV4V7DE26UOCX5TZTVUGX4VUJNXQ01&resolution=1080*2320&openudid=82f4175d577a2939&dt=22021211RC&os_api=31&install_id=1496879012031075&sdk_version=1.1.3.0&siteid=5627189&dev_log_aid=667431&oaid=abec0dfff623201b&timestamp=1752498494&direction=0&ac=mobile&os=Android&vod_version=1.10.21.6-tob&os_version=12&count=1&index=1&shortplay_id="+p[2]+"&sha1=46121F77CE2FCAD3DBC3B9EC8A24908C1A8AD6D9&device_brand=Redmi&package_name=com.niuniu.ztdh.app";
        const r = await NN_Service.post1("https://csj-sp.csjdeveloper.com/csj_sp/api/v1/shortplay/detail?siteid=5627189", data1, p[0]);
        const u = r.data?.list?.[0]?.video_model?.video_list?.video_1?.main_url;
        const playUrl = u ? atob(u) : "toast://解析失败";
        return { parse: 0, url: playUrl };
      }
    }
    
    if (flag.indexOf('好看') > -1) {
        const res = await post("https://sv.baidu.com/appui/api?cmd=video/relate&log=vhk&tn=1020970b&ctn=1008350n&blur=1", `method=post&vid=${input}`, cfg.headers.browser);
        const list = res["video/relate"].data.cur_video.clarityUrl;
        const urls = [];
        list.forEach(i => { urls.push(i.title); urls.push(i.url); });
        return { parse: 0, url: urls };
    }

    if (flag.indexOf('围观') > -1) { try { const s = JSON.parse(input); let u = []; if (s.super) u.push("超清", s.super); if (s.high) u.push("高清", s.high); if (s.normal) u.push("流畅", s.normal); return { parse: 0, url: u }; } catch (e) { return { parse: 0, url: input }; } }
    
    return { parse: 0, url: input };
  }
};
