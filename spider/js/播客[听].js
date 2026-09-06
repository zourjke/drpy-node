/*
@header({
  searchable: 0,
  filterable: 0,
  quickSearch: 0,
  title: '播客[听]',
  '类型': '听书',
  lang: 'ds'
})
*/

var rule = {
    类型: '听书',
    title: '播客[听]',
    host: 'https://getpodcast.xyz',
    url: '/fyclass',
    searchUrl: '',
    searchable: 0,
    quickSearch: 0,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.54 Safari/537.36'
    },
    timeout: 10000,
    class_name: '播客&休闲&社会与文化&教育&商务&喜剧&犯罪纪实&故事与小说&语言学习',
    class_url: '播客&休闲&社会与文化&教育&商务&喜剧&犯罪纪实&故事与小说&语言学习',
    cate_exclude: '',
    play_parse: true,
    limit: 20,

    parseHomeData: function (html) {
        try {
            let marker = 'window.__INITIAL_DATA__ = ';
            let s = html.indexOf(marker);
            if (s < 0) return { rightNow: [], featured: [] };
            let jsonStart = s + marker.length;
            let jsonEnd = html.indexOf('</script>', jsonStart);
            if (jsonEnd < 0) return { rightNow: [], featured: [] };
            let jsonStr = html.substring(jsonStart, jsonEnd).trim();
            if (jsonStr.endsWith(';')) jsonStr = jsonStr.slice(0, -1);
            return JSON.parse(jsonStr);
        } catch (e) {
            return { rightNow: [], featured: [] };
        }
    },

    推荐: async function () {
        let { HOST, pdfa, pdfh, pd } = this;
        let d = [];
        try {
            let html = await request(HOST);
            let data = this.parseHomeData(html);
            let list = data.rightNow || [];
            list.forEach(p => {
                if (!p.rssUrl) return;
                d.push({
                    title: p.title || '',
                    pic_url: p.cover || '',
                    desc: p.author || '',
                    url: p.rssUrl
                });
            });
        } catch (e) { console.error('播客推荐异常:' + e.message); }
        return setResult(d);
    },

    一级: async function () {
        let { HOST, MY_CATE, MY_PAGE } = this;
        let page = MY_PAGE || 1;
        let tid = MY_CATE || '播客';
        let d = [];
        try {
            let html = await request(HOST);
            let data = this.parseHomeData(html);
            let all = data.featured || [];
            let list = (tid === '播客' || !tid) ? all : all.filter(p => (p.tags || []).indexOf(tid) >= 0);
            let start = (page - 1) * 20;
            let pageList = list.slice(start, start + 20);
            pageList.forEach(p => {
                if (!p.rssUrl) return;
                d.push({
                    title: p.title || '',
                    img: p.cover || '',
                    desc: p.author || '',
                    url: p.rssUrl
                });
            });
        } catch (e) { console.error('播客一级异常:' + e.message); }
        return setResult(d);
    },

    二级: async function () {
        let { input, pdfa, pdfh, pd } = this;
        let rssUrl = String(input).split(',')[0];
        let VOD = {
            vod_name: '',
            vod_pic: '',
            vod_play_from: '在线播放',
            vod_play_url: ''
        };
        try {
            let xml = await request(rssUrl, { headers: this.headers });
            VOD.vod_name = pdfh(xml, 'channel&&title&&Text') || '';
            let items = pdfa(xml, 'item');
            let urls = [];
            items.forEach(it => {
                let ititle = (pdfh(it, 'title&&Text') || '').replace(/<!\[CDATA\[|\]\]>/g, '').trim();
                let iurl = pdfh(it, 'enclosure&&url') || pd(it, 'enclosure&&url') || '';
                if (ititle && iurl) urls.push(ititle + '$' + iurl);
            });
            VOD.vod_play_url = urls.join('#');
        } catch (e) { console.error('播客二级异常:' + e.message); }
        return VOD;
    },

    lazy: async function () {
        let { input } = this;
        return { jx: 0, url: input, parse: 0 };
    },

    搜索: '',
};
