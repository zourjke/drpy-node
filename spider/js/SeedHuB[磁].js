/*
@header({
  searchable: 2,
  filterable: 1,
  quickSearch: 0,
  title: 'SeedHub',
  author: 'EylinSir',
  '类型': '影视',
  logo: 'https://www.seedhub.cc/static/img/favicon.png',
  lang: 'ds'
})
*/

var rule = {
    类型: '影视',
    title: 'SeedHub',
    author: 'EylinSir',
    host: 'https://down.nigx.cn',
    logo: 'https://www.seedhub.cc/static/img/favicon.png',
    homeUrl: '/seedhub.cc',
    url: '/seedhub.cc/categories/fyfilter',
    filter_url: '{{fyclass}}/types/{{fl.type}}/movies/?order={{fl.order}}&page=fypage',
    searchUrl: '/seedhub.cc/s/**/?page=fypage',
    searchable: 2,
    quickSearch: 0,
    filterable: 1,
    timeout: 10000,
    headers: { 'User-Agent': 'UC_UA', },
    class_name: '电影&动漫&剧集',
    class_url: '1&2&3',
    filter_def: {
        1: { type: '7' },
        2: { type: '25' },
        3: { type: '33' }
    },

    filter: {
        "1":[{"key":"type","name":"类型","value":[{"n":"全部","v":"7"},{"n":"喜剧","v":"8"},{"n":"惊悚","v":"4"},{"n":"动作","v":"1"},{"n":"爱情","v":"10"},{"n":"犯罪","v":"12"},{"n":"恐怖","v":"3"},{"n":"悬疑","v":"13"},{"n":"冒险","v":"6"},{"n":"科幻","v":"2"},{"n":"奇幻","v":"5"},{"n":"纪录片","v":"43"},{"n":"传记","v":"14"},{"n":"家庭","v":"9"},{"n":"战争","v":"16"},{"n":"历史","v":"15"},{"n":"音乐","v":"19"},{"n":"运动","v":"23"},{"n":"同性","v":"11"},{"n":"歌舞","v":"28"},{"n":"古装","v":"22"},{"n":"西部","v":"24"},{"n":"短片","v":"35"},{"n":"武侠","v":"21"},{"n":"灾难","v":"17"}]},{"key":"order","name":"排序","value":[{"n": "最近更新", "v": "updete"}, {"n": "近期热门", "v": "view"}, {"n": "上映时间", "v": "date"}, {"n": "豆瓣评分", "v": "score"}]}],
        "2": [{"key":"type","name":"类型","value":[{"n":"全部","v":"25"},{"n":"喜剧","v":"29"},{"n":"奇幻","v":"26"},{"n":"剧情","v":"30"},{"n":"冒险","v":"27"},{"n":"动作","v":"50"},{"n":"科幻","v":"53"},{"n":"爱情","v":"48"},{"n":"家庭","v":"31"},{"n":"悬疑","v":"54"},{"n":"短片","v":"51"},{"n":"运动","v":"62"},{"n":"惊悚","v":"59"},{"n":"音乐","v":"47"},{"n":"儿童","v":"32"},{"n":"犯罪","v":"69"},{"n":"古装","v":"94"},{"n":"恐怖","v":"67"},{"n":"歌舞","v":"49"},{"n":"武侠","v":"71"},{"n":"战争","v":"70"},{"n":"同性","v":"90"},{"n":"历史","v":"68"},{"n":"灾难","v":"105"},{"n":"纪录片","v":"100"}]},{"key":"order","name":"排序","value":[{"n": "最近更新", "v": "updete"}, {"n": "近期热门", "v": "view"}, {"n": "上映时间", "v": "date"}, {"n": "豆瓣评分", "v": "score"}]}],
        "3": [{"key":"type","name":"类型","value":[{"n":"全部","v":"33"},{"n":"喜剧","v":"39"},{"n":"爱情","v":"58"},{"n":"犯罪","v":"34"},{"n":"悬疑","v":"38"},{"n":"惊悚","v":"37"},{"n":"动作","v":"36"},{"n":"奇幻","v":"41"},{"n":"科幻","v":"55"},{"n":"古装","v":"88"},{"n":"纪录片","v":"63"},{"n":"冒险","v":"42"},{"n":"恐怖","v":"56"},{"n":"历史","v":"60"},{"n":"同性","v":"75"},{"n":"家庭","v":"57"},{"n":"真人秀","v":"66"},{"n":"战争","v":"61"},{"n":"传记","v":"40"},{"n":"运动","v":"87"},{"n":"音乐","v":"65"},{"n":"武侠","v":"99"},{"n":"短片","v":"64"},{"n":"西部","v":"76"},{"n":"歌舞","v":"79"}]},{"key":"order","name":"排序","value":[{"n": "最近更新", "v": "updete"}, {"n": "近期热门", "v": "view"}, {"n": "上映时间", "v": "date"}, {"n": "豆瓣评分", "v": "score"}]}]
    },

    fixUrl: (u) => u.startsWith('http') ? u : rule.host + '/seedhub.cc' + (u.startsWith('/') ? u : '/' + u),
    
    推荐: async function () {
        return this.一级();
    },

    一级: async function () {
        let html = await fetch(this.input);
        return pdfa(html, 'body&&.cover').map(it => ({
            vod_name: (pdfh(it, 'h2&&Text') || pdfh(it, 'a&&title')).replace(/^#\s*/, '').trim(),
            vod_pic: pd(it, 'img&&src'),
            vod_remarks: pdfh(it, 'ul&&li:eq(1)&&Text').trim(),
            vod_id: rule.fixUrl(pd(it, 'a&&href'))
        }));
    },

    二级: async function () {
        let html = await fetch(this.input);
        let vod = {
            vod_id: this.input,
            vod_name: pdfh(html, '.sidebar-group-items .active&&Text').trim(),
            vod_pic: pd(html, '.cover-container img&&src'),
            vod_content: pdfh(html, '#description+p&&Text').replace(/^简介[:：]?\s*/, ''),
        };

        let metaMap = { '导演': 'vod_director', '主演': 'vod_actor', '类型': 'type_name', '地区': 'vod_area', '语言': 'vod_lang' };
        pdfa(html, '.cover-container ul li').forEach(it => {
            let txt = pdfh(it, 'li&&Text');
            if (txt.includes('评分')) {
                vod.vod_remarks = '豆瓣评分: ' + pdfh(it, 'a&&Text').trim() + '分';
            } else {
                let [k, v] = txt.split(/[:：]/).map(s => s.trim());
                Object.keys(metaMap).forEach(key => { if (k && k.includes(key)) vod[metaMap[key]] = v; });
            }
        });

        const resolve = async (url, isMag) => {
            let h = await request(url);
            let m = h.match(isMag ? /const\s+data\s*=\s*['"](.*?)['"]/ : /class=['"]direct-pan['"][^>]*?href=['"](.*?)['"]/);
            if (!m) return null;
            let res = isMag ? (typeof atob === 'function' ? atob(m[1]) : Buffer.from(m[1], 'base64').toString('utf-8')) : m[1];
            return (!isMag && res && !res.startsWith('push')) ? 'push://' + res : res;
        };

        let tabs = [], urls = [];

        let seeds = pdfa(html, '.seeds&&li').slice(0, 5);
        if (seeds.length) {
            let res = (await Promise.all(seeds.map(async it => {
                let link = await resolve(rule.fixUrl(pd(it, 'a&&href')), true);
                return link ? pdfh(it, 'a&&title') + ' [' + pdfh(it, '.size&&Text') + ']$' + link : null;
            }))).filter(Boolean);
            if (res.length) { tabs.push('磁力'); urls.push(res.join('#')); }
        }

        let pans = {'quark': '夸克', 'baidu': '百度', 'ali': '阿里', 'uc': 'UC'};
        let panList = pdfa(html, '.pan-links&&li');
        for (let key in pans) {
            let items = panList.filter(it => pdfh(it, 'a&&data-link').includes(key)).slice(0, 5);
            if (items.length) {
                let res = (await Promise.all(items.map(async it => {
                    let link = await resolve(rule.fixUrl(pd(it, 'a&&href')), false);
                    return link ? pdfh(it, 'a&&title') + '$' + link : null;
                }))).filter(Boolean);
                if (res.length) { tabs.push(pans[key]); urls.push(res.join('#')); }
            }
        }

        vod.vod_play_from = tabs.join('$$$');
        vod.vod_play_url = urls.join('$$$');
        return vod;
    },

    搜索: async function () {
        return this.一级();
    },

    lazy: async function () {
        return { parse: 0, url: this.input };
    }
};