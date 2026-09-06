/*
@header({
  searchable: 2,
  filterable: 1,
  quickSearch: 0,
  title: '飞快TV',
  author: 'EylinSir',
  '类型': '影视',
  logo: 'https://feikuai.in/favicon.ico',
  lang: 'ds'
})
*/

var rule = {
    title: '飞快TV',
    author: 'EylinSir',
    host: 'https://feikuai.in',
    homeUrl: '/',
    logo: 'https://feikuai.in/favicon.ico',
    url: '/vodshow/fyclass--------fypage---.html',
    searchUrl: '/vodsearch/-------------.html?wd=**',
    searchable: 2,
    quickSearch: 0,
    filterable: 1,
    timeout: 15000, 
    play_parse: true,
    limit: 20,
    headers: {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'},

    class_name: '电影&剧集&综艺&动漫',
    class_url: '1&2&3&4',

    filter: {
        "1": [{"key":"type","name":"类型","value":[{"n":"全部","v":""},{"n":"喜剧片","v":"6"},{"n":"动作片","v":"7"},{"n":"科幻片","v":"8"},{"n":"爱情片","v":"9"},{"n":"战争片","v":"10"},{"n":"恐怖片","v":"11"},{"n":"剧情片","v":"12"},{"n":"其它","v":"30"}]},{"key":"area","name":"地区","value":[{"n":"全部","v":""},{"n":"大陆","v":"大陆"},{"n":"香港","v":"香港"},{"n":"台湾","v":"台湾"},{"n":"美国","v":"美国"},{"n":"日本","v":"日本"},{"n":"韩国","v":"韩国"},{"n":"泰国","v":"泰国"},{"n":"英国","v":"英国"},{"n":"法国","v":"法国"},{"n":"德国","v":"德国"},{"n":"印度","v":"印度"},{"n":"意大利","v":"意大利"},{"n":"西班牙","v":"西班牙"},{"n":"加拿大","v":"加拿大"},{"n":"其他","v":"其他"}]},{"key":"year","name":"年份","value":[{"n":"全部","v":""},{"n":"2025","v":"2025"},{"n":"2024","v":"2024"},{"n":"2023","v":"2023"},{"n":"2022","v":"2022"},{"n":"2021","v":"2021"},{"n":"2020","v":"2020"},{"n":"2019","v":"2019"},{"n":"2018","v":"2018"},{"n":"2017","v":"2017"},{"n":"2016","v":"2016"},{"n":"2015","v":"2015"},{"n":"2014","v":"2014"},{"n":"2013","v":"2013"},{"n":"2012","v":"2012"},{"n":"2011","v":"2011"},{"n":"2010","v":"2010"}]},{"key":"sort","name":"排序","value":[{"n":"更新时间","v":"time"},{"n":"豆瓣评分","v":"score"}]}],
        "2": [{"key":"type","name":"类型","value":[{"n":"全部","v":""},{"n":"内地剧","v":"13"},{"n":"港台剧","v":"14"},{"n":"日韩剧","v":"15"},{"n":"欧美剧","v":"16"},{"n":"短剧","v":"32"},{"n":"其它","v":"31"}]},{"key":"area","name":"地区","value":[{"n":"全部","v":""},{"n":"内地","v":"内地"},{"n":"香港","v":"香港"},{"n":"台湾","v":"台湾"},{"n":"美国","v":"美国"},{"n":"日本","v":"日本"},{"n":"韩国","v":"韩国"},{"n":"泰国","v":"泰国"},{"n":"英国","v":"英国"},{"n":"新加坡","v":"新加坡"},{"n":"其他","v":"其他"}]},{"key":"year","name":"年份","value":[{"n":"全部","v":""},{"n":"2025","v":"2025"},{"n":"2024","v":"2024"},{"n":"2023","v":"2023"},{"n":"2022","v":"2022"},{"n":"2021","v":"2021"},{"n":"2020","v":"2020"},{"n":"2019","v":"2019"},{"n":"2018","v":"2018"},{"n":"2017","v":"2017"},{"n":"2016","v":"2016"},{"n":"2015","v":"2015"},{"n":"2014","v":"2014"},{"n":"2013","v":"2013"},{"n":"2012","v":"2012"},{"n":"2011","v":"2011"},{"n":"2010","v":"2010"}]},{"key":"sort","name":"排序","value":[{"n":"更新时间","v":"time"},{"n":"豆瓣评分","v":"score"}]}],
        "3": [{"key":"type","name":"类型","value":[{"n":"全部","v":""},{"n":"大陆综艺","v":"20"},{"n":"港台综艺","v":"21"},{"n":"日韩综艺","v":"23"},{"n":"欧美综艺","v":"22"},{"n":"其它","v":"24"}]},{"key":"area","name":"地区","value":[{"n":"全部","v":""},{"n":"内地","v":"内地"},{"n":"港台","v":"港台"},{"n":"日韩","v":"日韩"},{"n":"欧美","v":"欧美"}]},{"key":"year","name":"年份","value":[{"n":"2025","v":"2025"},{"n":"2024","v":"2024"},{"n":"2023","v":"2023"},{"n":"2022","v":"2022"},{"n":"2021","v":"2021"},{"n":"2020","v":"2020"},{"n":"2019","v":"2019"},{"n":"2018","v":"2018"},{"n":"2017","v":"2017"},{"n":"2016","v":"2016"},{"n":"2015","v":"2015"},{"n":"2014","v":"2014"},{"n":"2013","v":"2013"},{"n":"2012","v":"2012"},{"n":"2011","v":"2011"},{"n":"2010","v":"2010"}]},{"key":"sort","name":"排序","value":[{"n":"更新时间","v":"time"},{"n":"豆瓣评分","v":"score"}]}],
        "4": [{"key":"type","name":"类型","value":[{"n":"全部","v":""},{"n":"大陆动漫","v":"25"},{"n":"港台动漫","v":"26"},{"n":"日韩动漫","v":"27"},{"n":"欧美动漫","v":"28"},{"n":"其它","v":"29"}]},{"key":"area","name":"地区","value":[{"n":"全部","v":""},{"n":"国产","v":"国产"},{"n":"日本","v":"日本"},{"n":"欧美","v":"欧美"},{"n":"其他","v":"其他"}]},{"key":"year","name":"年份","value":[{"n":"全部","v":""},{"n":"2025","v":"2025"},{"n":"2024","v":"2024"},{"n":"2023","v":"2023"},{"n":"2022","v":"2022"},{"n":"2021","v":"2021"},{"n":"2020","v":"2020"},{"n":"2019","v":"2019"},{"n":"2018","v":"2018"},{"n":"2017","v":"2017"},{"n":"2016","v":"2016"},{"n":"2015","v":"2015"},{"n":"2014","v":"2014"},{"n":"2013","v":"2013"},{"n":"2012","v":"2012"},{"n":"2011","v":"2011"},{"n":"2010","v":"2010"}]},{"key":"sort","name":"排序","value":[{"n":"更新时间","v":"time"},{"n":"豆瓣评分","v":"score"}]}]
    },

    cache: { category: {}, vod: {}, pan: {}, home: null, search: {} },
    CACHE_EXPIRATION: 600000,

    init: async function() {
        this.clearExpiredCache();
        return true;
    },

    预处理: async () => [],
    
    推荐: async function() {
        try {
            let html = await this.cachedRequest(this.homeUrl, 'home');
            let data = this.pdfa(html, '.module-poster-items-base .module-poster-item');
            return setResult(data.map(it => this.parsePosterItem(it)));
        } catch (e) {
            return setResult([]);
        }
    },

    get_category_url: function(tid, pg, extend) {
        let ext = typeof extend === 'string' ? (extend ? JSON.parse(extend) : {}) : extend || {};
        let area = ext.area || '', cls = ext.type || '', year = ext.year || '', sort = ext.sort || '';
        let show_tid = cls || tid;
        return `/vodshow/${show_tid}-${encodeURIComponent(area)}-${sort}------${pg || 1}---${year}.html`;
    },

    一级: async function(tid = '1', pg = '1', _, extend = {}) {
        try {
            let url = this.get_category_url(tid, pg, extend);
            let html = await this.cachedRequest(url, `cat_${tid}_${pg}_${JSON.stringify(extend)}`);
            let data = this.pdfa(html, '.module-poster-items-base .module-poster-item') || [];
            return setResult(data.map(it => this.parsePosterItem(it)).filter(it => it.title));
        } catch (e) {
            return setResult([]);
        }
    },

    二级: async function() {
        try {
            let videoId = (this.input.match(/\/(\d+)\.html/) || [])[1];
            if (!videoId) throw new Error('无效视频ID');
            const cached = this.checkCache('vod', `vod_${videoId}`);
            if (cached) return cached;

            let html = await request(this.input, {headers: this.headers, timeout: this.timeout});
            let VOD = this.parseVodDetail(html, videoId);
            let finalVOD = await this.parsePlayLines(html, videoId, VOD);
            this.setCache('vod', `vod_${videoId}`, finalVOD);
            return finalVOD;
        } catch (e) {
            return this.getErrorVod(e.message);
        }
    },

    搜索: async function() {
        try {
            let keyword = decodeURIComponent((this.input.match(/wd=([^&]+)/) || [,''])[1] || this.input);
            let cacheKey = `search_${this.hashCode(keyword)}`;
            const cached = this.checkCache('search', cacheKey);
            if (cached) return setResult(cached);

            let url = this.host + this.searchUrl.replace('**', encodeURIComponent(keyword));
            let html = await request(url, {headers: this.headers, timeout: this.timeout});
            let data = this.pdfa(html, '#resultList .module-card-item') || [];
            let results = data.map(item => this.parseSearchItem(item)).filter(item => item.title);
            this.setCache('search', cacheKey, results);
            return setResult(results);
        } catch (e) {
            return setResult([]);
        }
    },

    buildPlayUrls: function(originalUrl, transcoding = [], hasFastMode = true) {
        const urls = [];
        const baseFlag = "#isVideo=true" + (hasFastMode ? "##fastPlayMode##threads=10#" : "#");
        urls.push("原画", originalUrl + baseFlag);
        if (hasFastMode) urls.push("极速原画", originalUrl + "#fastPlayMode##threads=10#");

        if (transcoding.length > 0) {
            const sorted = [...transcoding].sort((a, b) => {
                const resA = this.parseResolution(a.resolution || a.template_id || '');
                const resB = this.parseResolution(b.resolution || b.template_id || '');
                return resB - resA;
            });
            for (const t of sorted) {
                if (t.url || t.video_info?.url) {
                    const name = (t.resolution || t.template_id || '未知').toUpperCase();
                    urls.push(name, (t.url || t.video_info.url) + baseFlag);
                }
            }
        }
        return urls;
    },

    lazy: async function(flag, id) {
        const ids = id.split('*');
        const headers = {...this.headers, Referer: this.host};

        if (flag.startsWith('百度')) {
            if (ids.length < 4) return { parse: 0, url: ["原画", this.input] };
            const url = await Baidu2.getAppShareUrl(ids[0], ids[1], ids[2], ids[3]);
            const headers = {'User-Agent': 'netdisk;P2SP;2.2.91.136;android-android;'};
            return {
                parse: 0,
                url: this.buildPlayUrls(url, [], true),
                header: headers
            };
        }
        if (flag.startsWith('移动')) {
            const url = await Yun.getSharePlay(ids[0], ids[1]);
            return { parse:0, url:this.buildPlayUrls(url, [], true), header:headers };
        }
        if (flag.startsWith('磁力')) {
            return { parse:0, url:id, header:headers };
        }
        if (flag.includes('夸克')) {
            const down = await Quark.getDownload(ids[0], ids[1], ids[2], ids[3], true);
            const cookie = ENV.get('quark_cookie');
            const urls = [];
            for (const t of down) if (t.url !== undefined) {
                urls.push("猫"+t.name, `http://127.0.0.1:5575/proxy?thread=${ENV.get('thread')||6}&chunkSize=1024&url=` + encodeURIComponent(t.url));
                urls.push(t.name, t.url + "#isVideo=true##fastPlayMode##threads=20#");
            }
            const transcoding = (await Quark.getLiveTranscoding(ids[0], ids[1], ids[2], ids[3])).filter(t => t.accessable);
            for (const t of transcoding) {
                const name = t.resolution === 'low' ? "流畅" : t.resolution === 'high' ? "高清" : t.resolution === 'super' ? "超清" : t.resolution;
                urls.push(name, t.video_info.url + "#isVideo=true##fastPlayMode##threads=20#");
            }
            return { parse:0, url:urls, header:{'Cookie': cookie} };
        }
        if (flag.includes('优汐')) {
            const down = await UC.getDownload(ids[0], ids[1], ids[2], ids[3], true);
            return await UC.getLazyResult(down, this.mediaProxyUrl);
        }
        if (flag.includes('天翼')) {
            const url = await Cloud.getShareUrl(ids[0], ids[1]);
            return { parse:0, url:this.buildPlayUrls(url, [], false), header:headers };
        }
        if (flag.includes('阿里')) {
            const aliHeaders = {...headers, Referer: 'https://www.aliyundrive.com/'};
            const down = await Ali.getDownload(ids[0], ids[1], false);
            const transcoding = (await Ali.getLiveTranscoding(ids[0], ids[1])).filter(t => t.url);
            return { parse:0, url:this.buildPlayUrls(down.url, transcoding, true), header:aliHeaders };
        }
        if (flag.includes('123')) {
            const url = await Pan.getDownload(ids[0], ids[1], ids[2], ids[3], ids[4]);
            const urls = this.buildPlayUrls(url, [], true);
            const live = await Pan.getLiveTranscoding(ids[0], ids[1], ids[2], ids[3], ids[4]);
            for (const item of live) urls.push(item.name, item.url);
            return { parse:0, url:urls };
        }
        if (/.(m3u8|mp4|flv)(\?|$)/.test(this.input)) {
            return { parse:0, url:this.input, header:headers };
        }

        const [videoId, lineIndex = 0, episodeIndex = 0] = (id || '').split('|');
        if (!videoId) return { parse:1, url:this.input, header:headers };
        const playUrl = `${this.host}/vodplay/${videoId}-${+lineIndex + 1}-${+episodeIndex + 1}.html`;
        return await this.extractVideoUrl(playUrl);
    },

    parsePosterItem(it) {
        return {
            title: this.pdfh(it, 'a&&title') || this.pdfh(it, '.module-poster-item-title&&Text'),
            img: this.pd(it, 'img&&data-original') || this.pd(it, 'img&&src') || '',
            desc: this.pdfh(it, '.module-item-note&&Text') || '',
            url: this.pd(it, 'a&&href') || ''
        };
    },

    parseSearchItem(item) {
        const title = (this.pdfh(item, '.module-card-item-title strong&&Text') || this.pdfh(item, '.module-card-item-title&&Text') || '').trim();
        const img = this.pd(item, '.module-card-item-poster img&&data-original') || '';
        const desc = this.pdfh(item, '.module-info-item-content&&Text') || '';
        const url = this.pd(item, '.module-card-item-poster&&href') || '';
        return title && url ? { title, img: this.normalizeUrl(img), desc, url: this.normalizeUrl(url) } : {};
    },

    parseVodDetail(html, videoId) {
        const typeLinks = this.pdfa(html, '.module-info-tag-link a') || [];
        const types = typeLinks.slice(2).map(link => this.pdfh(link, '&&Text')).filter(Boolean);
        const clean = text => text.replace(/[\/\s]+$/g, '').replace(/\s+/g, ' ');
        return {
            vod_name: this.pdfh(html, '.module-info-heading h1&&Text') || '',
            type_name: types.join('/') || '',
            vod_pic: this.pd(html, '.lazyload&&data-original') || '',
            vod_content: this.pdfh(html, '.module-info-introduction-content p&&Text') || '',
            vod_remarks: this.pdfh(html, '.module-info-item:contains("片长：") .module-info-item-content&&Text') || '',
            vod_year: this.pdfh(html, '.module-info-tag-link a:eq(0)&&Text') || '',
            vod_area: this.pdfh(html, '.module-info-tag-link a:eq(1)&&Text') || '',
            vod_actor: clean(this.pdfh(html, '.module-info-item:contains("主演：") .module-info-item-content&&Text') || ''),
            vod_director: clean(this.pdfh(html, '.module-info-item:contains("导演：") .module-info-item-content&&Text') || ''),
            vod_play_from: '',
            vod_play_url: ''
        };
    },

    parseResolution(res) {
        if (!res) return 0;
        const map = { '4K':3840,'2160P':3840,'UHD':3840,'2K':2560,'1440P':2560,'QHD':2560,
                      '1080P':1920,'FHD':1920,'720P':1280,'HD':1280,'540P':960,'SD':960,
                      '480P':854,'360P':640,'LD':640 };
        return map[res.toUpperCase()] || 0;
    },

    async parsePlayLines(html, videoId, VOD) {
        try {
            const panLines = await this.parsePanLines(html, videoId);
            const onlineLines = this.parseOnlineLines(html, videoId);
            const allLines = [...panLines, ...onlineLines];
            if (allLines.length === 0) return this.getBasicPlayLines(VOD, videoId);
            VOD.vod_play_from = allLines.map(l => l.name).join("$$$");
            VOD.vod_play_url = allLines.map(l => l.url).join("$$$");
            return VOD;
        } catch (e) {
            return this.getBasicPlayLines(VOD, videoId);
        }
    },

    async parsePanLines(html, videoId) {
        const links = Array.from(this.collectPanLinks(html));
        if (!links.length) return [];

        const byType = {};
        for (const link of links) {
            const type = this.getPanTypeFromUrl(link);
            (byType[type] = byType[type] || []).push(link);
        }

        const tasks = [];
        for (const [type, list] of Object.entries(byType)) {
            for (let i = 0; i < list.length; i++) {
                tasks.push(this.parseSinglePanLink(list[i], type, i + 1));
            }
        }
        const results = (await Promise.all(tasks)).flat().filter(Boolean);
        return results;
    },

    async parseSinglePanLink(link, panType, idx) {
        const key = `pan_${this.hashCode(link)}`;
        const cached = this.checkCache('pan', key);
        if (cached) return cached;

        try {
            const lines = [];
            const process = (videos, fn) => {
                if (videos.length) {
                    const url = videos.map(fn).join('#');
                    const name = idx > 1 ? `${panType}${idx}` : panType;
                    lines.push({name, url, type: panType});
                }
            };

            switch (panType) {
                case '百度':
                    const b = await Baidu2.getShareData(link);
                    if (b) process(Object.values(b).flat(), v => `${v.name}$${[v.path,v.uk,v.shareid,v.fsid].join('*')}`);
                    break;
                case '夸克':
                    const q = await Quark.getShareData(link);
                    if (q) {
                        const files = await Quark.getFilesByShareUrl(q);
                        process(files, v => `${v.file_name}$${[q.shareId,v.stoken,v.fid,v.share_fid_token].join('*')}`);
                    }
                    break;
                case '优汐':
                    const u = await UC.getShareData(link);
                    if (u) {
                        const files = await UC.getFilesByShareUrl(u);
                        process(files, v => `${v.file_name}$${[u.shareId,v.stoken,v.fid,v.share_fid_token].join('*')}`);
                    }
                    break;
                case '天翼':
                    const c = await Cloud.getShareData(link);
                    if (c) process(Object.values(c).flat(), v => `${v.name}$${[v.fileId,v.shareId].join('*')}`);
                    break;
                case '移动':
                    const y = await Yun.getShareData(link);
                    if (y) process(Object.values(y).flat(), v => `${v.name}$${[v.contentId,v.linkID].join('*')}`);
                    break;
                case '阿里':
                    const a = await Ali.getShareData(link);
                    if (a) {
                        const files = await Ali.getFilesByShareUrl(a);
                        process(files, v => `${v.name}$${[v.share_id,v.file_id].join('*')}`);
                    }
                    break;
                case '123':
                    const p = await Pan.getShareData(link);
                    if (p) {
                        const files = await Pan.getFilesByShareUrl(p);
                        process(Object.values(files).flat(), v => `${v.FileName}$${[p,v.FileId,v.S3KeyFlag,v.Size,v.Etag].join('*')}`);
                    }
                    break;
                case '磁力':
                    const name = this.extractFileNameFromMagnet(link);
                    lines.push({name: idx > 1 ? `磁力${idx}` : '磁力', url: `${name}$${link}`, type:'磁力'});
                    break;
            }

            if (lines.length) this.setCache('pan', key, lines);
            return lines;
        } catch (e) {
            return [];
        }
    },

    parseOnlineLines(html, videoId) {
        const tabs = this.pdfa(html, '#y-playList .module-tab-item.tab-item') || [];
        return tabs.map((tab, i) => {
            const name = (this.pdfh(tab, 'span&&Text') || `线路${i + 1}`).trim();
            const eps = this.pdfa(html, `.module-play-list:eq(${i}) a`) || [];
            const url = eps.length ? eps.map((ep, j) =>
                `${this.pdfh(ep, '&&Text') || `第${j + 1}集`}$${videoId}|${i}|${j}`
            ).join('#') : `正片$${videoId}|${i}|0`;
            return {name, url, type:'在线'};
        });
    },

    checkCache(type, key, exp = this.CACHE_EXPIRATION) {
        const cache = this.cache[type]?.[key];
        if (!cache || Date.now() - cache.timestamp >= exp) {
            delete this.cache[type]?.[key];
            return null;
        }
        return cache.data;
    },

    setCache(type, key, data) {
        if (!this.cache[type]) this.cache[type] = {};
        this.cache[type][key] = { data, timestamp: Date.now() };
    },

    clearExpiredCache() {
        const now = Date.now();
        for (const type in this.cache) {
            for (const key in this.cache[type]) {
                if (now - this.cache[type][key].timestamp >= this.CACHE_EXPIRATION) {
                    delete this.cache[type][key];
                }
            }
        }
    },

    async cachedRequest(url, key) {
        const full = this.normalizeUrl(url);
        const cached = this.checkCache('category', key);
        if (cached) return cached;
        const html = await request(full, {headers: this.headers, timeout: this.timeout});
        this.setCache('category', key, html);
        return html;
    },

    async extractVideoUrl(playUrl) {
        try {
            const html = await request(playUrl, {headers: this.headers, timeout: this.timeout});
            const match = html.match(/player_[a-z0-9_]+\s*=\s*(\{[\s\S]*?"url"\s*:\s*"([^"]*)"[^}]*\})/);
            let videoUrl = match ? this.decodeVideoUrl(match[2], 2) : null;
            if (!videoUrl || !this.isValidVideoUrl(videoUrl)) {
                const iframe = html.match(/<iframe[^>]*src=["']([^"']+)["']/);
                if (iframe && this.isValidVideoUrl(iframe[1])) {
                    videoUrl = this.normalizeUrl(iframe[1]);
                }
            }
            if (!videoUrl) return { parse:1, url:playUrl, header:this.headers };
            return { parse: this.getParseType(videoUrl), url:videoUrl, header:{...this.headers, Referer:playUrl} };
        } catch (e) {
            return { parse:1, url:this.input, header:this.headers };
        }
    },

    decodeVideoUrl(url, encryptType) {
        if (encryptType !== 2) return decodeURIComponent(url || '');
        try {
            let decoded = atob(decodeURIComponent(url));
            while (decoded.includes('%')) {
                const temp = decodeURIComponent(decoded);
                if (temp === decoded) break;
                decoded = temp;
            }
            return decoded;
        } catch (e) {
            return url;
        }
    },

    normalizeUrl(url) {
        if (!url) return url;
        if (url.startsWith('//')) return 'https:' + url;
        if (url.startsWith('/')) return this.host + url;
        return url;
    },

    getPanTypeFromUrl(url) {
        if (url.includes('pan.baidu.com')) return '百度';
        if (url.includes('pan.quark.cn')) return '夸克';
        if (url.includes('drive.uc.cn')) return '优汐';
        if (url.includes('cloud.189.cn')) return '天翼';
        if (url.includes('yun.139.com')) return '移动';
        if (url.includes('alipan.com')) return '阿里';
        if (/123(pan|684|865|912|592)\.(com|cn)/.test(url)) return '123';
        if (url.startsWith('magnet:')) return '磁力';
        return '其他';
    },

    collectPanLinks(html) {
        const sites = ['pan.baidu.com','pan.quark.cn','drive.uc.cn','cloud.189.cn','yun.139.com','alipan.com','123pan.','123684.','123865.','123912.','123592.','magnet:'];
        const badWords = ['主题歌','OST','soundtrack','音乐','歌曲','配乐','BGM','背景音乐','主题曲','片尾曲','插曲','音频','音轨','原声'];
        const urls = new Set();
        const matches = html.match(/https?:\/\/[^\s"'<>()]+|magnet:\?[^\s"'<>()]+/g) || [];
        for (const u of matches) {
            if (u.includes('</') || u.includes('/>')) continue;
            if (!sites.some(s => u.includes(s))) continue;
            if (badWords.some(w => u.includes(w))) continue;
            urls.add(this.normalizeUrl(u));
        }
        return urls;
    },

    extractFileNameFromMagnet(m) {
        const d = m.match(/dn=([^&]+)/i);
        return d ? decodeURIComponent(d[1]) : '磁力资源';
    },

    hashCode(str) {
        let h = 0;
        for (let i = 0; i < str.length; i++) h = ((h << 5) - h) + str.charCodeAt(i);
        return Math.abs(h).toString(36);
    },

    getBasicPlayLines(VOD, videoId) {
        VOD.vod_play_from = '默认线路';
        VOD.vod_play_url = `正片$${videoId}|0|0`;
        return VOD;
    },

    getErrorVod(msg) {
        return {
            vod_name: '加载失败',
            type_name: '',
            vod_pic: '',
            vod_content: `加载失败: ${msg}`,
            vod_remarks: '请检查网络或配置',
            vod_play_from: '默认线路',
            vod_play_url: '正片$$0|0|0'
        };
    },

    isValidVideoUrl(url) {
        return url && url.includes('://') && !/\/(vodplay|vod)\//.test(url) &&
               (url.includes('.m3u8') || url.includes('.mp4') || url.includes('.flv'));
    },

    getParseType(url) {
        return /\.(m3u8|mp4|flv)(\?|$)/.test(url) ? 0 : 1;
    }
};

try { rule.init(); } catch (e) {}
