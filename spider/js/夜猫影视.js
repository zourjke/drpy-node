/*
@header({
  searchable: 2,
  filterable: 0,
  quickSearch: 0,
  title: '夜猫影视[官]',
  类型: '影视',
  lang: 'ds'
})
*/

var rule = {
    title: '夜猫影视[官]',
    类型: '影视',
    host: 'http://ym.yyrun.top:8090',
    homeUrl: '/api/v1/video/modules',
    url: '/api/v1/video/list?page=fypage&page_size=18&type_id=fyclass&order=time',
    searchUrl: '/api/v1/video/search?keyword=**&page=fypage&page_size=18',
    searchable: 2,
    quickSearch: 0,
    filterable: 0,
    timeout: 10000,
    play_parse: true,
    limit: 6,
    class_name: '电影&剧集&综艺&动漫&短剧&少儿&纪录片&bilibili',
    class_url: '1&2&3&4&5&20&21&23',
    headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 Chrome/122.0.0.0 Mobile Safari/537.36',
        'Referer': 'http://ym.yyrun.top:8090/',
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json'
    },
    推荐: async function () {
        let d = [];
        try {
            let url = this.host + '/api/v1/content/slides';
            let html = await request(url, { headers: this.headers });
            let json = JSON.parse(html);
            let slides = (json && json.data) || [];
            slides.forEach(s => {
                if (!s.vod_id) return;
                d.push({
                    title: s.title || '',
                    pic_url: s.image_url || '',
                    desc: '',
                    url: String(s.vod_id)
                });
            });
        } catch (e) { log('夜猫推荐异常:' + e.message); }
        return setResult(d);
    },
    一级: async function (tid, pg) {
        let page = pg || 1;
        let d = [];
        try {
            let url = this.host + '/api/v1/video/list?page=' + page + '&page_size=18&type_id=' + tid + '&order=time';
            let html = await request(url, { headers: this.headers });
            let json = JSON.parse(html);
            let data = (json && json.data) || {};
            let list = data.list || [];
            list.forEach(vod => {
                d.push({
                    title: vod.vod_name || '',
                    pic_url: vod.vod_pic || '',
                    desc: vod.vod_remarks || vod.vod_class || '',
                    url: String(vod.vod_id)
                });
            });
        } catch (e) { log('夜猫一级list异常:' + e.message); }
        if (d.length === 0) {
            try {
                let sUrl = this.host + '/api/v1/content/slides';
                let sHtml = await request(sUrl, { headers: this.headers });
                let sJson = JSON.parse(sHtml);
                let slides = (sJson && sJson.data) || [];
                slides.forEach(s => {
                    if (!s.vod_id) return;
                    d.push({
                        title: s.title || '',
                        pic_url: s.image_url || '',
                        desc: '',
                        url: String(s.vod_id)
                    });
                });
            } catch (e) { log('夜猫一级fallback异常:' + e.message); }
        }
        return setResult(d);
    },
    二级: async function (ids) {
        let id = String(ids).split(',')[0];
        let url = this.host + '/api/v1/video/detail/' + id;
        let html = await request(url, { headers: this.headers });
        let json = JSON.parse(html);
        let vod = (json && json.data) || {};
        return {
            vod_id: String(vod.vod_id || id),
            vod_name: vod.vod_name || '',
            vod_pic: vod.vod_pic || '',
            type_name: vod.type_name || vod.vod_class || '',
            vod_year: vod.vod_year || '',
            vod_area: vod.vod_area || '',
            vod_remarks: vod.vod_remarks || '',
            vod_actor: vod.vod_actor || '',
            vod_director: vod.vod_director || '',
            vod_content: stripHtml(vod.vod_content || vod.vod_blurb || ''),
            vod_play_from: vod.vod_play_from || '',
            vod_play_url: vod.vod_play_url || ''
        };
    },
    搜索: async function (wd, quick, pg) {
        let page = pg || 1;
        let url = this.host + '/api/v1/video/search?keyword=' + encodeURIComponent(wd) + '&page=' + page + '&page_size=18';
        let html = await request(url, { headers: this.headers });
        let json = JSON.parse(html);
        let list = (((json || {}).data || {}).list) || [];
        let d = [];
        list.forEach(vod => {
            d.push({
                title: vod.vod_name || '',
                pic_url: vod.vod_pic || '',
                desc: vod.vod_remarks || vod.vod_class || '',
                url: String(vod.vod_id)
            });
        });
        return setResult(d);
    },
    lazy: async function (flag, id) {
        try {
            let tokenObj = await ensureVipToken(this.host, this.headers);
            let headers = Object.assign({}, this.headers, { Authorization: 'Bearer ' + tokenObj.token });
            let purl = this.host + '/api/v1/content/parse?url=' + encodeURIComponent(id);
            let html = await request(purl, { headers: headers });
            let json = JSON.parse(html);
            let ret = (json && json.data) || {};
            if (ret.url) {
                let playUrl = ret.url;
                if (ret.encrypted) {
                    playUrl = aesDecryptBase64(playUrl, 'YeCat2026AesKey!');
                }
                return {
                    parse: 0,
                    url: playUrl,
                    jx: 0,
                    header: ret.header || {}
                };
            }
        } catch (e) {
            log('夜猫lazy error:' + e.message);
        }
        return { parse: 1, url: id, jx: 0 };
    }
};

function stripHtml(str) {
    return String(str || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
}
function randStr(len) {
    let seed = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let out = '';
    for (let i = 0; i < len; i++) out += seed[Math.floor(Math.random() * seed.length)];
    return out;
}
function parseDateTs(str) {
    let t = Date.parse(str || '');
    return isNaN(t) ? 0 : t;
}
function nowTs() {
    return Date.now();
}
function safeJsonParse(str, defVal) {
    try { return JSON.parse(str); } catch (e) { return defVal; }
}
async function ensureVipToken(host, baseHeaders) {
    let key = 'yemao_vip_account_cache_v1';
    let cache = safeJsonParse(getItem(key) || '{}', {});
    let now = nowTs();
    if (cache && cache.token) {
        let tokenExp = cache.token_expires_at || 0;
        let vipExp = cache.vip_expires_at || 0;
        if (tokenExp - now > 10 * 60 * 1000 && vipExp - now > 10 * 60 * 1000) return cache;
        if (tokenExp - now > 10 * 60 * 1000) {
            try {
                let profileHtml = await request(host + '/api/v1/auth/profile', {
                    headers: Object.assign({}, baseHeaders, { Authorization: 'Bearer ' + cache.token })
                });
                let profileJson = JSON.parse(profileHtml);
                let user = (profileJson && profileJson.data) || {};
                let realVipExp = parseDateTs(user.vip_expires_at);
                if (user.is_vip && realVipExp - now > 10 * 60 * 1000) {
                    cache.vip_expires_at = realVipExp;
                    setItem(key, JSON.stringify(cache));
                    return cache;
                }
            } catch (e) {}
        }
    }
    let uname = 'ym' + randStr(10) + String(Math.floor(now / 1000)).slice(-6);
    let pwd = randStr(8) + 'A1';
    let regHtml = await request(host + '/api/v1/auth/register', {
        method: 'POST',
        headers: baseHeaders,
        data: JSON.stringify({ username: uname, password: pwd })
    });
    let regJson = JSON.parse(regHtml);
    let data = (regJson && regJson.data) || {};
    let user = data.user || {};
    let fresh = {
        username: uname,
        password: pwd,
        token: data.token || '',
        token_expires_at: parseDateTs(data.expires_at),
        vip_expires_at: parseDateTs(user.vip_expires_at),
        created_at: now
    };
    setItem(key, JSON.stringify(fresh));
    return fresh;
}
function b64ToBytes(base64) {
    let chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let str = String(base64 || '').replace(/\s+/g, '');
    let output = [];
    for (let bc = 0, bs, buffer, idx = 0; (buffer = str.charAt(idx++)); ) {
        buffer = chars.indexOf(buffer);
        if (buffer === -1) continue;
        if (buffer === 64) break;
        bs = bc % 4 ? bs * 64 + buffer : buffer;
        if (bc++ % 4) output.push(255 & (bs >> ((-2 * bc) & 6)));
    }
    return output;
}
function bytesToWordArray(bytes) {
    let words = [];
    for (let i = 0; i < bytes.length; i++) words[(i / 4) | 0] |= bytes[i] << (24 - 8 * (i % 4));
    return CryptoJS.lib.WordArray.create(words, bytes.length);
}
function aesDecryptBase64(base64Str, keyStr) {
    let raw = b64ToBytes(base64Str);
    let iv = raw.slice(0, 16);
    let ciphertext = raw.slice(16);
    let key = CryptoJS.enc.Utf8.parse(keyStr);
    let ivWA = bytesToWordArray(iv);
    let ctWA = bytesToWordArray(ciphertext);
    let decrypted = CryptoJS.AES.decrypt({ ciphertext: ctWA }, key, {
        iv: ivWA,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
    });
    return decrypted.toString(CryptoJS.enc.Utf8);
}
