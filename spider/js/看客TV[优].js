/*
@header({
  searchable: 2,
  filterable: 1,
  quickSearch: 0,
  title: '看客TV',
  author: 'EylinSir',
  类型: '影视',
  logo: 'http://pic.7273.com/upload/2026-4/20264192138208178.png',
  lang: 'ds',
})
*/

var rule = {
    类型: '影视',
    author: 'EylinSir',
    title: '看客TV',
    logo:'http://pic.7273.com/upload/2026-4/20264192138208178.png',
    host: '',
    searchUrl: '**',
    pg_url: '',
    yry_url: '',
    base_path: '',
    pg_key: '',
    yry_key: '',
    token: '',
    app_id: '10000',
    client: '',
    login_mode: 4,
    client_mode: 0,
    max_client: 2,
    class_name: '',
    class_url: '',
    filter: {},
    headers: {
        'User-Agent': 'Dalvik/2.1.0',
        'Connection': 'Keep-Alive',
        'Accept-Encoding': 'gzip'
    },
    headers2: {},
    timeout: 15000,
    searchable: 2,
    filterable: 1,
    play_parse: true,

    // ==================== 工具函数 ====================
    rc4_crypt(data, key) {
        const keyBytes = new TextEncoder().encode(key);
        const dataBytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
        const S = new Uint8Array(256);
        for (let i = 0; i < 256; i++) S[i] = i;
        let j = 0;
        for (let i = 0; i < 256; i++) {
            j = (j + S[i] + keyBytes[i % keyBytes.length]) % 256;
            [S[i], S[j]] = [S[j], S[i]];
        }
        let i = 0, k = 0;
        const out = new Uint8Array(dataBytes.length);
        for (let n = 0; n < dataBytes.length; n++) {
            i = (i + 1) % 256;
            k = (k + S[i]) % 256;
            [S[i], S[k]] = [S[k], S[i]];
            out[n] = dataBytes[n] ^ S[(S[i] + S[k]) % 256];
        }
        return out;
    },

    rc4_encrypt(plaintext, key = this.yry_key) {
        return Array.from(this.rc4_crypt(plaintext, key))
            .map(b => b.toString(16).padStart(2, '0')).join('');
    },

    rc4_decrypt(cipherHex, key = this.pg_key) {
        const bytes = new Uint8Array(cipherHex.match(/../g).map(h => parseInt(h, 16)));
        return new TextDecoder().decode(this.rc4_crypt(bytes, key));
    },

    encodeFormData(obj) {
        return Object.keys(obj).map(k => `${k}=${obj[k]}`).join('&');
    },

    aes_decrypt(data, key, iv) {
        return CryptoJS.AES.decrypt(data, CryptoJS.enc.Utf8.parse(key), {
            iv: CryptoJS.enc.Utf8.parse(iv),
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        }).toString(CryptoJS.enc.Utf8);
    },

    md5(data) {
        return CryptoJS.MD5(data).toString(CryptoJS.enc.Hex).toLowerCase();
    },

    base64_encode(data) {
        return CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(data));
    },

    base64_decode(data) {
        return CryptoJS.enc.Utf8.stringify(CryptoJS.enc.Base64.parse(data));
    },

    decode(data) {
        return this.base64_decode(this.base64_decode(data.substring(16)));
    },

    sign() {
        const ts = String(Math.floor(Date.now() / 1000));
        return `key=${this.rc4_encrypt(ts, ts)}&tt=${ts}`;
    },

    randomStr(len, charset) {
        return Array.from({ length: len }, () =>
            charset.charAt(Math.floor(Math.random() * charset.length))
        ).join('');
    },

    uuid_number() { return this.randomStr(9, '0123456789'); },
    mac() { return this.randomStr(12, '0123456789abcdef').toUpperCase(); },
    android_id() { return this.randomStr(16, '0123456789abcdef'); },

    // 通用请求 + JSON 解析（优先 RC4 解密，失败则直接解析）
    async fetchJson(url, options = {}, useRc4 = false) {
        try {
            var res = await req(url, options);
        } catch (e) { return null; }
        if (!res || !res.content) return null;
        if (useRc4) {
            try { return JSON.parse(this.rc4_decrypt(res.content)); } catch (e) {}
            try { return JSON.parse(res.content); } catch (e) { return null; }
        }
        try { return JSON.parse(res.content); } catch (e) { return null; }
    },

    // 获取分类
    async fetchCategories() {
        if (!this.pg_url) return [];
        const data = await this.fetchJson(
            `${this.pg_url}/api.php/${this.base_path}/Category?${this.sign()}`,
            { method: 'get', headers: this.headers2 }, true
        );
        if (!data) return [];
        const items = Array.isArray(data) ? data : (data.data || []);
        return items.filter(i => i && i.type_status === 1)
            .map(i => ({ type_id: i.type_en, type_name: i.type_name }));
    },

    arr2vods(arr) {
        if (!Array.isArray(arr)) return [];
        return arr.map(i => ({
            vod_id: i.tjurl || i.nextlink || i.id || '',
            vod_name: i.tjinfo || i.title || i.name || '',
            vod_pic: i.tjpicurl || i.pic || i.poster || '',
            vod_remarks: i.state || '',
            vod_year: i.year || ''
        })).filter(v => v.vod_name);
    },

    // 自动登录（注册+登录）
    async ensureLogin() {
        if (this.token) return;
        const mode = this.login_mode;
        let account = mode === 2 ? this.android_id() :
                      mode === 3 ? this.mac() :
                      this.uuid_number();
        try {
            const ipRes = await req(`${this.yry_url}/ip.json`, { headers: this.headers });
            if (ipRes && ipRes.content) {
                const host = ipRes.content.trim();
                const regData = `user=${account}&password=${account}&markcode=${account}&t=${Math.floor(Date.now()/1000)}&name=xiaomi&phone=xiaomi`;
                await req(`http://${host}/api.php?app=${this.app_id}&act=user_reg`, {
                    method: 'post',
                    headers: { ...this.headers2, 'Content-Type': 'application/x-www-form-urlencoded' },
                    data: this.encodeFormData({ data: this.rc4_encrypt(regData), sign: this.md5(`${regData}&${this.pg_key}`) })
                });
            }
            const loginData = `account=${account}&password=${account}&markcode=${account}&t=${Math.floor(Date.now()/1000)}`;
            const loginRes = await req(`${this.yry_url}/api.php?app=${this.app_id}&act=user_logon`, {
                method: 'post',
                headers: { ...this.headers2, 'Content-Type': 'application/x-www-form-urlencoded' },
                data: this.encodeFormData({ data: this.rc4_encrypt(loginData), sign: this.md5(`${loginData}&${this.pg_key}`) })
            });
            if (loginRes && loginRes.content) {
                const r = JSON.parse(loginRes.content);
                if (r.code === 200) {
                    try { this.token = JSON.parse(this.rc4_decrypt(r.msg, this.yry_key)).token; }
                    catch (e) { this.token = JSON.parse(r.msg).token; }
                }
            }
        } catch (e) {}
    },

    // ==================== 初始化 ====================
    预处理: async function() {
        try {
            const cosUrl = 'http://2025-1329689796.cos.ap-guangzhou.myqcloud.com/kanke/app1.json';
            const number1 = 'No00000';
            const number = this.md5(number1);
            const number_key = this.md5(`${number1}SmtEk1`);
            const ts = String(Math.floor(Date.now() / 1000));
            const payload = { t: ts, key: this.rc4_encrypt(number, number_key) };
            let res = await req(cosUrl, { headers: this.headers, timeout: 10000 });
            if (!res || !res.content) throw new Error('配置获取失败');
            const config = JSON.parse(res.content);
            const notice = config.msg.notice;
            const main_host = this.decode(notice.content);
            this.headers2 = { ...this.headers, 'Authorization': this.decode(notice.type) };
            res = await req(`${main_host}?app=${this.app_id}`, {
                method: 'post',
                headers: { ...this.headers2, 'Content-Type': 'application/x-www-form-urlencoded' },
                data: this.encodeFormData(payload),
                timeout: 10000
            });
            if (!res || !res.content) throw new Error('密钥获取失败');
            const resp = JSON.parse(res.content).data;
            const maink = this.rc4_decrypt(resp.Maink, number_key);
            this.pg_key = this.rc4_decrypt(resp.pg, maink);
            this.yry_key = this.rc4_decrypt(resp.yry, maink);
            const key_time = this.rc4_decrypt(resp.MT, maink);
            const pg_raw = resp.pgUrl, yry_raw = resp.yryUrl;
            const aes_key = this.base64_encode(`${key_time}${pg_raw.substring(0, 14)}`);
            const aes_iv = this.base64_encode(`${key_time}${yry_raw.substring(0, 2)}`).padEnd(16, ' ');
            this.pg_url = this.aes_decrypt(this.base64_decode(pg_raw.substring(32)), aes_key, aes_iv);
            this.yry_url = this.aes_decrypt(this.base64_decode(yry_raw.substring(16)), aes_key, aes_iv);
            this.base_path = this.rc4_decrypt(resp.HOST);
            this.client = this.rc4_decrypt(resp.newClient);
            this.login_mode = resp.Login || 4;
            await this.ensureLogin();
            const classes = await this.fetchCategories();
            if (classes.length > 0) {
                rule.class_name = classes.map(c => c.type_name).join('&');
                rule.class_url = classes.map(c => c.type_id).join('&');
            }
        } catch (e) {}
    },

    // ==================== 首页 / 一级 / 搜索 ====================
    homeContent: async function() {
        const classes = await this.fetchCategories();
        return classes.length ? { class: classes } : null;
    },

    推荐: async function() {
        if (!this.pg_url) return null;
        const data = await this.fetchJson(
            `${this.pg_url}/api.php/${this.base_path}/top?${this.sign()}`,
            { method: 'get', headers: this.headers2 }, true
        );
        return data ? this.arr2vods(data.data) : null;
    },

    一级: async function(tid, pg) {
        if (!this.pg_url) return null;
        const data = await this.fetchJson(
            `${this.pg_url}/api.php/${this.base_path}/vod/?ac=list&class=${tid}&page=${pg}&${this.sign()}`,
            { method: 'get', headers: this.headers2 }, true
        );
        return data ? this.arr2vods(data.data) : null;
    },

    搜索: async function(key, quick, pg) {
        if (!this.pg_url) return null;
        const data = await this.fetchJson(
            `${this.pg_url}/api.php/${this.base_path}/So/?ac=list&zm=${encodeURIComponent(key)}&page=${pg || 1}&${this.sign()}`,
            { method: 'get', headers: this.headers2 }, true
        );
        return data ? this.arr2vods(data.data) : null;
    },

    // ==================== 二级 ====================
    二级: async function(ids) {
        if (!this.pg_url) return null;
        this.client_mode = 0;
        await this.ensureLogin();

        const reqData = `token=${this.token}&t=${Math.floor(Date.now() / 1000)}`;
        const payload = {
            data: this.rc4_encrypt(reqData),
            sign: this.md5(`${reqData}&${this.pg_key}`)
        };
        const motionRes = await req(`${this.yry_url}/api.php?app=${this.app_id}&act=motion`, {
            method: 'post',
            headers: { ...this.headers2, 'Content-Type': 'application/x-www-form-urlencoded' },
            data: this.encodeFormData(payload)
        });
        if (motionRes && motionRes.content) {
            const motion = JSON.parse(motionRes.content);
            this.client_mode = parseInt(motion.msg.Clientmode) || 0;
            if (!this.client_mode && motion.msg.Try !== 1) return null;
        }

        const data = await this.fetchJson(
            `${this.pg_url}/api.php/${this.base_path}/vod/${ids[0]}&${this.sign()}`,
            { method: 'get', headers: this.headers2 }, true
        );
        if (!data) return null;

        let player;
        try { player = JSON.parse(this.rc4_decrypt(data.player)); }
        catch (e) { player = JSON.parse(data.player); }

        const shows = [], urls = [];
        for (const [show, list] of Object.entries(data.videolist)) {
            let display = show;
            for (const p of player) {
                if (p.from === show && p.from !== p.show) {
                    display = `${p.show}(${show})`; break;
                }
            }
            shows.push(display);
            urls.push(
                list.map(j => `${j.title}$${encodeURIComponent(data.title + '-' + j.title)}@${j.url}`).join('#')
            );
        }

        return {
            vod_id: ids[0],
            vod_name: data.title,
            vod_pic: data.img_url,
            vod_remarks: data.trunk,
            vod_year: data.pubtime,
            vod_area: (data.area || []).join(','),
            vod_actor: (data.actor || []).join(','),
            vod_director: (data.director || []).join(','),
            vod_content: data.intro,
            vod_play_from: shows.join('$$$'),
            vod_play_url: urls.join('$$$'),
            type_name: (data.type || []).join(',')
        };
    },

    // ==================== 播放 ====================
    lazy: async function(flag, id) {
        const parts = id.split('@');
        const series = parts[0], rawUrl = parts[1] || '';
        this.client_mode = 1;
        const baseParams = `&account=&password=&series=${series}&edition=1.0`;
        let playUrl = '', jx = 0, cont = 0;

        for (let i = 1; i <= 3; i++) {
            if (cont >= this.max_client) break;
            try {
                let path;
                if (this.client.startsWith('http')) {
                    path = i === 1 ? `${this.client}/?url=${rawUrl}` : `${this.client}${i}/?url=${rawUrl}`;
                } else { cont++; continue; }

                let res;
                if (this.client_mode === 1) {
                    res = await req(path, {
                        method: 'post',
                        headers: { ...this.headers2, 'Content-Type': 'application/x-www-form-urlencoded' },
                        data: this.encodeFormData({ app: this.app_id, key: this.rc4_encrypt(baseParams), '': '' })
                    });
                } else {
                    res = await req(`${path}&app=${this.app_id}${baseParams}`, {
                        method: 'post',
                        headers: { ...this.headers2, 'Content-Type': 'application/x-www-form-urlencoded' }
                    });
                }
                cont++;
                if (res && res.content) {
                    let resp;
                    try { resp = JSON.parse(this.rc4_decrypt(res.content)); }
                    catch (e) { resp = JSON.parse(res.content); }
                    this.max_client = parseInt(resp.maxClient) || 2;
                    if (resp.url && resp.url.startsWith('http')) { playUrl = resp.url; break; }
                }
            } catch (e) { cont++; }
        }

        // 客户端未获取到播放地址时，直接解密 rawUrl 并判断平台
        if (!playUrl) {
            try {
                const decrypted = this.rc4_decrypt(rawUrl);
                if (/iqiyi|v\.qq|v\.youku|mgtv|bilibili/.test(decrypted)) {
                    jx = 1;
                    playUrl = decrypted;
                }
            } catch (e) {}
        }

        return { jx, parse: 0, url: playUrl, header: { 'User-Agent': 'Windows' } };
    }
};