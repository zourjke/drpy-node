/*
@header({
  searchable: 1,
  filterable: 1,
  quickSearch: 1,
  title: '泥视频',
  author: 'eylinsir',
  '类型': '影视',
  logo: 'https://www.nivod.vip/upload/mxprocms/20240814-1/bec50537ef62b8399a45d39fd7529f5c.png',
  lang: 'ds'
})
*/

var rule = {
    author: 'eylinsir',
    title: '泥视频',
    类型: '影视',
    desc: '泥视频资源站',
    host: 'https://www.nivod.vip/',
    logo: 'https://www.nivod.vip/upload/mxprocms/20240814-1/bec50537ef62b8399a45d39fd7529f5c.png',
    headers: { 'User-Agent': 'Mozilla/5.0' },
    编码: 'utf-8',
    timeout: 5000,
    url: 'https://www.nivod.vip/k/fyfilter/',
    filter_url: '{{fl.cateId}}-{{fl.area}}-------fypage---{{fl.year}}',
    detailUrl: 'https://www.nivod.vip/nivod/fyid/',
    searchUrl: '/index.php/ajax/suggest?mid=1&wd=**&page=fypage&limit=30',
    searchable: 1,
    quickSearch: 1,
    filterable: 1,
    limit: 10,
    double: false,
    class_name: '电影&电视剧&综艺&动漫',
    class_url: '1&2&3&4',
    play_parse: true,
    sniffer: 0,
    isVideo: 'http((?!http).){26,}\.(m3u8|mp4|flv|avi|mkv|wmv|mpg|mpeg|mov|ts|3gp|rm|rmvb|asf|m4a|mp3|wma)',
    filter_def: {
        1: { cateId: '1' },
        2: { cateId: '2' },
        3: { cateId: '3' },
        4: { cateId: '4' }
    },
    filter: 'H4sIAAAAAAAAE+2W324SQRTG32WvuWBml399A5/BcLHRvVJ70ahJ0zSxJVCgjYpRlBarJrYLFVOIxgjb5WmYXfYtHLqzc85MzIYIFzbh8ny/nZ05w/edZc8gxtb9PeORs2tsGQ/sp869h0bG2LafOLwORx47P+b1c/vxM+f2wW0us2ovqvQWMi+IsZ8RcrM387th40iQPJB2lzVcIAVJwvooqFSBFIG4LTb2gJTgbRdHCiFZiYKD18GLNkLodA1X2YlQWFX/MJs0AFF4YTi5Yv47hJR2w7foGBT6DQ4HYbuFEOzFam+iTh8hE/ZqXof+FUIWvLDSDA5PAVk5QN9P5vVzhOAY4cE0Op0ihO7db4Ue+q0sfvHlBYyNYO84NtiAdYfsZJJuA2jwqxt1akIVRcKiy07w+1owUch1r4bBeJqsiwt52ulLduYLJgrZ/8DlimCikOz9RdAdJCwu5Fk+9eGdopDrfgyBiUKes/pr5rWTc8YFvrpdx95BVzf+OfP8Ja+OZmlOWpDmsG6BbmHdBN3EOgWdYp2ATrCeBT2LdFKSOilhvQh6EesF0AtYz4Oexzr0S3C/BPoluF8C/RLcL4F+F7ku75czBl1xsKHMnvmzicsHSDI6YGvuYO5VhCxsPqTnFONJ3TQ1I6MlecWPsARt0R5G/QFCOc2mgBZ2WlPAa1X+fBKAuFgmVP8a/rQQpw6GlBDPj0fARIEulTU/s49fkqWy3oyAOzYCzBVHgKmZPvRu5o1Jsk9BmwIqLWoGVmlJi4xCzbw2FFSa1fLPva0+UNCcqtL1felTBkF8I0mC4gLdB28aAr0oUr/mm2j9f9GyVowW7Cu+rs1ecPMt8SjRwqNSqoVHpSXNhAq1/hIe9QGieVGlVIuWSs21Rev2TpJoxcUy38O0P8Obr9adiNb+H+y4L6eTDwAA',

    预处理: async () => [],

    推荐: async function (tid, pg, filter, extend) {
        let { input, pdfa, pdfh, pd } = this;
        let html = await request(input);
        let d = [];
        let data = pdfa(html, 'a:has(.lazyload)');
        data.forEach(it => {
            let title = pdfh(it, 'a&&title');
            let pic_url = pd(it, '.lazyload&&data-original');
            if (pic_url && !pic_url.startsWith('http')) pic_url = this.host + pic_url;
            let desc = pdfh(it, '.module-item-note&&Text');
            let url = pd(it, 'a&&href');
            let id = url.match(/\/(\d+)\.html/)?.[1] || '';
            d.push({ title, pic_url, desc, url, id });
        });
        return setResult(d);
    },

    一级: async function (tid, pg, filter, extend) {
        return await this.推荐(tid, pg, filter, extend);
    },

    二级: async function (ids) {
        let { input, pdfa, pdfh, pd } = this;
        let html = await request(input);
        let VOD = {};
        VOD.vod_id = input;
        VOD.vod_name = pdfh(html, 'h1&&Text');
        VOD.type_name = pdfh(html, '.module-info-tag-link:eq(2)&&Text');
        VOD.vod_pic = pd(html, '.lazyload&&data-original', input);
        VOD.vod_remarks = pdfh(html, '.module-info-item:contains(集数)&&Text').replace('集数：', '');
        VOD.vod_year = pdfh(html, '.module-info-tag-link:eq(0)&&Text');
        VOD.vod_area = pdfh(html, '.module-info-tag-link:eq(1)&&Text');
        VOD.vod_director = pdfh(html, '.module-info-item:contains(导演)&&Text').replace('导演：', '');
        VOD.vod_actor = pdfh(html, '.module-info-item:contains(主演)&&Text').replace('主演：', '');
        VOD.vod_content = pdfh(html, '.module-info-introduction-content&&Text');
        let r_ktabs = pdfa(html, '#y-playList&&span');
        let ktabs = r_ktabs.map(it => pdfh(it, 'Text'));
        VOD.vod_play_from = ktabs.join('$$$');
        let klists = [];
        let r_plists = pdfa(html, '.module-play-list');
        r_plists.forEach(rp => {
            let klist = pdfa(rp, 'body&&a:not([rel])')
                .map(it => pdfh(it, 'a&&Text') + '$' + pd(it, 'a&&href', input))
                .join('#');
            klists.push(klist);
        });
        VOD.vod_play_url = klists.join('$$$');
        return VOD;
    },

    搜索: async function (wd, quick, pg) {
        let { input } = this;
        let html = await request(input);
        let d = [];
        try {
            let jsonData = JSON.parse(html);
            (jsonData.list || []).forEach(item => {
                d.push({
                    title: item.name || '',
                    pic_url: item.pic || '',
                    desc: item.en || '',
                    url: `/nivod/${item.id}.html`,
                    id: item.id || ''
                });
            });
        } catch (e) {}
        return setResult(d);
    },

    lazy: async function (flag, id, flags) {
        let { input } = this;
        let html = await request(input);
        let match = html.match(/var player_.*?=(.*?)<\/script>/);
        if (match?.[1]) {
            let kcode = JSON.parse(match[1]);
            let kurl = kcode.url;
            if (kcode.encrypt == '1') {
                kurl = unescape(kurl);
            } else if (kcode.encrypt == '2') {
                kurl = unescape(base64Decode(kurl));
            }
            if (/\.(m3u8|mp4)/.test(kurl)) {
                return { parse: 0, url: kurl };
            }
        }
        return { parse: 1, url: input };
    }
};
