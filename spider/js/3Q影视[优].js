/*
@header({
  searchable: 1,
  filterable: 1,
  quickSearch: 0,
  title: '3Q影视',
  author: 'EylinSir',
  类型: '影视',
  lang: 'ds',
})
*/

var rule = {
    类型: '影视',
    author: 'EylinSir',
    title: '3Q影视',
    desc: '3Q影视源',
    host: 'https://asd123sx23xdacsx.top',
    homeUrl: 'https://asd123sx23xdacsx.top',
    url: '/api.php/web/filter/vod?type_id=fyclass&page=fypage&sort=hits',
    searchUrl: '/api.php/web/search/index?wd=**&page=fypage&limit=15',
    searchable: 1,
    quickSearch: 0,
    filterable: 1,
    timeout: 10000,
    play_parse: true,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
        'accept': 'application/json',
        'accept-language': 'zh-CN,zh;q=0.9',
        'cache-control': 'no-cache',
        'pragma': 'no-cache',
        'priority': 'u=1, i',
        'sec-ch-ua': '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'X-Client': '8f3d2a1c7b6e5d4c9a0b1f2e3d4c5b6a',
        'web-sign': 'f65f3a83d6d9ad6f'
    },

    json2list: function (arr) {
        let d = [];
        for (const i of (arr || [])) {
            d.push({
                title: i.vod_name || '',
                url: String(i.vod_id || ''),
                pic_url: i.vod_pic || '',
                desc: i.vod_remarks || ''
            });
        }
        return d;
    },

    apiRequest: async function (path, params) {
        let query = params ? '?' + buildQueryString(params) : '';
        let url = path.startsWith('http') ? path : urljoin(this.host, path + query);
        let html = await request(url, { headers: this.headers });
        return JSON.parse(html || '{}');
    },

    buildEpisodes: function (from, urls, parseFlag) {
        let out = [];
        let items = String(urls || '').split('#');
        for (const item of items) {
            if (!item.includes('$')) continue;
            let parts = item.split('$');
            let name = parts[0];
            let link = parts.slice(1).join('$');
            if (name && link) {
                out.push(`${name}$${from}@${parseFlag}@${link}`);
            }
        }
        return out;
    },

    预处理: async function () {},

    class_parse: async function () {
        let json = await this.apiRequest('/api.php/web/index/home');
        let categories = (json.data && json.data.categories) || [];
        let classes = categories.map(it => ({
            type_id: String(it.type_id || it.type_name),
            type_name: it.type_name
        }));
        return { class: classes, filters: {} };
    },

    推荐: async function () {
        let json = await this.apiRequest('/api.php/web/index/home');
        let categories = (json.data && json.data.categories) || [];
        let videos = [];
        for (const cate of categories) {
            videos.push(...(cate.videos || []));
        }
        return setResult(this.json2list(videos));
    },

    一级: async function (tid, pg) {
        let json = await this.apiRequest('/api.php/web/filter/vod', {
            type_id: tid,
            page: pg || 1,
            sort: 'hits'
        });
        return setResult(this.json2list(json.data || []));
    },

    二级: async function (ids) {
        let rawId = ids || this.input;
        let match = String(rawId || '').match(/(\d+)(?!.*\d)/);
        let vodId = match ? match[1] : String(rawId || '').trim();
        let json = await this.apiRequest('/api.php/web/vod/get_detail', { vod_id: vodId });
        let data = (json.data || [])[0] || {};
        let vodplayer = json.vodplayer || [];
        let tabs = [];
        let playUrls = [];

        let raw_shows = String(data.vod_play_from || '').split('$$$');
        let raw_urls_list = String(data.vod_play_url || '').split('$$$');
        for (let i = 0; i < raw_shows.length; i++) {
            let show_code = raw_shows[i];
            let urls_str = raw_urls_list[i];
            if (!show_code || !urls_str) continue;
            let need_parse = 0;
            let name = show_code;
            let matched = false;
            for (const player of vodplayer) {
                if (player.from === show_code) {
                    matched = true;
                    need_parse = player.decode_status;
                    if (player.show && show_code.toLowerCase() !== player.show.toLowerCase()) {
                        name = `${player.show} (${show_code})`;
                    }
                    break;
                }
            }
            if (!matched && vodplayer.length === 0) matched = true;
            if (!matched) continue;
            let urls = this.buildEpisodes(show_code, urls_str, need_parse);
            if (urls.length) {
                tabs.push(name);
                playUrls.push(urls.join('#'));
            }
        }

        try {
            let ext = await this.apiRequest('/api.php/web/internal/search_aggregate', { vod_id: vodId });
            let exts = ext.data || [];
            for (const item of exts) {
                let from = String(item.vod_play_from || item.site_key || 'ext');
                let name = String(item.site_name || from);
                let parseFlag = String(item.decode_status === undefined ? 1 : item.decode_status);
                let urls = this.buildEpisodes(from, item.vod_play_url || '', parseFlag);
                if (urls.length) {
                    tabs.push(name + ' [站外]');
                    playUrls.push(urls.join('#'));
                }
            }
        } catch (e) {
            log('3Q external aggregate error:' + (e.message || e));
        }

        return {
            vod_id: String(data.vod_id || vodId),
            vod_name: data.vod_name || '',
            vod_pic: data.vod_pic || '',
            vod_remarks: data.vod_remarks || '',
            vod_year: data.vod_year || '',
            vod_area: data.vod_area || '',
            vod_actor: data.vod_actor || '',
            vod_director: data.vod_director || '',
            vod_content: data.vod_content || '',
            vod_play_from: tabs.join('$$$'),
            vod_play_url: playUrls.join('$$$'),
            type_name: data.vod_class || ''
        };
    },

    搜索: async function () {
        let json = await this.apiRequest('/api.php/web/search/index', {
            wd: this.KEY,
            page: this.MY_PAGE,
            limit: 15
        });
        return setResult(this.json2list(json.data || []));
    },

    lazy: async function (flag, id) {
        let source = id || this.input || '';
        let [play_from, need_parse, raw_url] = String(source).split('@');
        let final_url = raw_url || source;
        let jx = 0;
        let ua = this.headers['User-Agent'];

        let isPlayPage = /\/play\/\d+-\d+-\d+\.html$/i.test(final_url);
        let isDirect = /^https?:\/\/.*\.(m3u8|mp4|flv|m4s)(\?.*)?$/i.test(final_url);
        let isMainstream = /(?:www\.iqiyi|v\.qq|v\.youku|www\.mgtv|www\.bilibili)\.com/.test(final_url);

        if (isDirect) {
            return {
                parse: 0,
                url: final_url,
                header: { 'User-Agent': ua }
            };
        }

        if (isMainstream) {
            return {
                parse: 1,
                url: final_url,
                header: { 'User-Agent': ua }
            };
        }

        if (isPlayPage) {
            try {
                let html = await request(final_url, {
                    headers: {
                        'User-Agent': ua,
                        'Referer': getHome(final_url) + '/'
                    }
                });
                let m = String(html).match(/player_aaaa\s*=\s*(\{[\s\S]*?\})\s*<\/script>/);
                if (!m) {
                    m = String(html).match(/player_aaaa\s*=\s*(\{[\s\S]*?\})\s*;/);
                }
                if (m) {
                    let player = JSON5.parse(m[1]);
                    let purl = unescape(player.url || '');
                    if (/^https?:\/\/.*\.(m3u8|mp4|flv|m4s)(\?.*)?$/i.test(purl)) {
                        return {
                            parse: 0,
                            url: purl,
                            header: {
                                'User-Agent': ua,
                                'Referer': final_url
                            }
                        };
                    }
                    if (/^https?:\/\//i.test(purl)) {
                        return {
                            parse: 1,
                            url: purl,
                            header: {
                                'User-Agent': ua,
                                'Referer': final_url
                            }
                        };
                    }
                }
            } catch (e) {
                log('3Q play page parse fail:' + (e.message || e));
            }
            return {
                parse: 1,
                url: final_url,
                header: { 'User-Agent': ua }
            };
        }

        if (need_parse === '1') {
            return {
                parse: 1,
                url: final_url,
                header: { 'User-Agent': ua }
            };
        }

        if (need_parse === '2') {
            return {
                parse: 0,
                url: final_url,
                header: { 'User-Agent': ua }
            };
        }

        return {
            parse: 0,
            url: final_url,
            header: { 'User-Agent': ua }
        };
    }
};