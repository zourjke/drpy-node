/*
@header({
  searchable: 2,
  filterable: 0,
  quickSearch: 0,
  title: '茶杯狐',
  '类型': '影视',
  logo: 'https://citapa.com/favicon.ico',
  lang: 'ds'
})
*/

var rule = {
    title: '茶杯狐',
    logo: 'https://citapa.com/favicon.ico',
    host: 'https://citapa.com',
    url: '/',
    searchUrl: '/search.php?searchword=**&page=fypage',
    searchable: 2,
    quickSearch: 0,
    filterable: 0,
    play_parse: true,
    class_name: '电影&电视剧&综艺&动漫',
    class_url: '1&2&3&4',
    headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 11; SAMSUNG SM-G973U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.141 Mobile Safari/537.36',
        'Referer': 'https://citapa.com/',
        'Origin': 'https://citapa.com'
    },

    fix: function(u) {
        if (!u) return '';
        if (u.startsWith('//')) return 'https:' + u;
        if (u.startsWith('/')) return this.host + u;
        return u;
    },

    getContent: function(res) {
        if (!res) return '';
        if (typeof res === 'string') return res;
        return res.content || res.text || res.body || '';
    },

    cleanText: function(s) {
        return String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    },

    parseList: function(html) {
        let videos = [], seen = new Set();
        let items = pdfa(html, '.module-search-item') || [];
        if (!items.length) items = pdfa(html, '.module-item') || [];
        items.forEach(item => {
            let href = pdfh(item, 'a&&href');
            if (!href) return;
            let m = href.match(/\/movie\/index(\d+)\.html/);
            if (!m) return;
            let vodId = m[1];
            if (seen.has(vodId)) return;
            seen.add(vodId);

            let vodName = this.cleanText(
                pdfh(item, 'h3 a&&Text') || pdfh(item, 'h3 a&&title') || 
                pdfh(item, 'img&&alt') || pdfh(item, 'a&&title') || 
                pdfh(item, '.module-item-title&&Text') || ''
            );
            let vodPic = this.fix(
                pdfh(item, 'img&&data-src') || pdfh(item, 'img&&data-original') || 
                pdfh(item, 'img&&src') || ''
            );
            let vodRemarks = this.cleanText(
                pdfh(item, '.module-item-text&&Text') || pdfh(item, '.video-serial&&Text') || 
                pdfh(item, '.video-serial&&title') || ''
            );

            if (vodName) {
                videos.push({
                    vod_id: vodId,
                    vod_name: vodName,
                    vod_pic: vodPic,
                    vod_remarks: vodRemarks
                });
            }
        });
        return videos;
    },

    一级: async function(tid, pg, filter, extend) {
        let res = await req(this.host + '/search.php?searchtype=5&tid=' + tid + '&page=' + pg, { headers: this.headers });
        return this.parseList(this.getContent(res));
    },

    二级: async function(ids) {
        let vid = ids[0].split(',')[0].trim();
        let res = await req(this.host + '/movie/index' + vid + '.html', { headers: this.headers });
        let html = this.getContent(res);
        if (!html) return {};

        let vodName = this.cleanText(pdfh(html, 'h1&&Text') || pdfh(html, 'meta[property=og:title]&&content'));
        let vodPic = this.fix(pdfh(html, 'meta[property=og:image]&&content') || pdfh(html, 'img&&data-src') || pdfh(html, 'img&&data-original') || pdfh(html, 'img&&src'));
        let vodContent = this.cleanText(pdfh(html, 'meta[property=og:description]&&content'));
        let vodDirector = this.cleanText(pdfh(html, 'meta[property=og:video:director]&&content'));
        let vodActor = this.cleanText(pdfh(html, 'meta[property=og:video:actor]&&content'));
        let vodArea = this.cleanText(pdfh(html, 'meta[property=og:video:area]&&content'));

        let tabs = pdfa(html, '[data-dropdown-value]').map(el => pdfh(el, '&&data-dropdown-value')).filter(Boolean);

        let playFrom = [], playUrl = [];
        pdfa(html, '.module-list.module-player-list').forEach((panel, i) => {
            let eps = pdfa(panel, 'a[href*="/play/"]').map(a => {
                let t = this.cleanText(pdfh(a, 'a&&title') || pdfh(a, 'a&&Text'));
                let u = this.fix(pdfh(a, 'a&&href'));
                return t && u ? t + '$' + u : null;
            }).filter(Boolean);

            if (eps.length) {
                let key = tabs[i] || '线路' + (i + 1);
                if (!playFrom.includes(key)) {
                    playFrom.push(key);
                    playUrl.push(eps.join('#'));
                }
            }
        });

        if (!playFrom.length) {
            let eps = pdfa(html, 'a[href*="/play/' + vid + '-"]').map(a => {
                let t = this.cleanText(pdfh(a, 'a&&Text')) || '播放';
                let u = this.fix(pdfh(a, 'a&&href'));
                return t && u ? t + '$' + u : null;
            }).filter(Boolean);
            if (eps.length) {
                playFrom.push('默认');
                playUrl.push(eps.join('#'));
            }
        }

        if (!playFrom.length) return {};

        return {
            vod_id: vid,
            vod_name: vodName,
            vod_pic: vodPic,
            vod_director: vodDirector,
            vod_actor: vodActor,
            vod_area: vodArea,
            vod_content: vodContent,
            vod_play_from: playFrom.join('$$$'),
            vod_play_url: playUrl.join('$$$')
        };
    },

    搜索: async function(key, quick, pg) {
        key = String(key || '').trim();
        if (!key) return setResult([]);

        pg = Number(pg || 1);
        let searchGet = this.host + '/search.php?searchword=' + encodeURIComponent(key) + '&page=' + pg;

        let html = '';
        try {
            let res = await req(searchGet, { headers: this.headers, timeout: 15000 });
            html = this.getContent(res);
        } catch (e) {}

        if (!/(module-search-item|module-item|movie\/index\d+\.html)/i.test(html)) {
            try {
                let res = await req(this.host + '/search.php', {
                    method: 'post',
                    headers: { ...this.headers, 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
                    body: 'searchword=' + encodeURIComponent(key) + '&page=' + pg,
                    timeout: 15000
                });
                let postHtml = this.getContent(res);
                if (postHtml) html = postHtml;
            } catch (e) {}
        }

        return this.parseList(html);
    },

    lazy: async function(flag, id, vipFlags) {
        let playPageUrl = id.startsWith('http') ? id : this.host + id;
        let res = await req(playPageUrl, { headers: this.headers });
        let html = this.getContent(res);
        if (!html) return { parse: 1, url: playPageUrl };

        let m3u8Matches = html.match(/["']([^"']+\.m3u8[^"']*)["']/gi);
        if (!m3u8Matches || !m3u8Matches.length) return { parse: 1, url: playPageUrl, header: this.headers };

        let playUrls = m3u8Matches.map(url => url.replace(/^["']|["']$/g, ''));
        let playUrl = playUrls[0];

        let urlMatch = playPageUrl.match(/\/play\/(\d+)-(\d+)-(\d+)\.html/);
        if (urlMatch && playUrls.length > 1) {
            let lineIndex = parseInt(urlMatch[2]) || 0;
            if (lineIndex >= 0 && lineIndex < playUrls.length) {
                playUrl = playUrls[lineIndex];
            }
        }

        if (playUrl.startsWith('//')) playUrl = 'https:' + playUrl;
        else if (playUrl.startsWith('/')) playUrl = this.host + playUrl;

        return { parse: 0, url: playUrl, header: this.headers };
    },

    推荐: async function() {
        let res = await req(this.host + '/', { headers: this.headers });
        return this.parseList(this.getContent(res));
    },

    class_parse: async function() {
        return {
            class: [
                { type_id: '1', type_name: '电影' },
                { type_id: '2', type_name: '电视剧' },
                { type_id: '3', type_name: '综艺' },
                { type_id: '4', type_name: '动漫' }
            ],
            filters: {}
        };
    }
};
