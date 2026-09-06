/*
@header({
  searchable: 1,
  filterable: 1,
  quickSearch: 0,
  title: 'Pomo',
  author: 'EylinSir',
  类型: '影视',
  logo: 'https://pomo.mom/favicon.ico',
  lang: 'ds',
})
*/

var rule = {
    类型: '影视',
    author: 'EylinSir',
    title: 'Pomo',
    host: 'https://pomo.mom/',
    homeUrl: '/',
    url: '*',
    logo: 'https://pomo.mom/favicon.ico',
    searchUrl: '/?keyword=**',
    searchable: 1,
    quickSearch: 0,
    filterable: 1,
    timeout: 5000,
    limit: 20,
    play_parse: true,
    headers: {'User-Agent': MOBILE_UA},
    class_name: '华语热门&TOP250&剧集&家庭影院&动画大电影&冷门佳作&蓝光原盘',
    class_url: 'huayurm&paihangbang&dianshiju&jiating&donghuadadiany&lengmenjiapian&sort/12',

    filter: (() => {
        const opts = (arr) => arr.map(v => ({n: v, v: v}));
        const filters = [
            {key:'genre', name:'类型', value:[{n:'全部',v:''}, ...opts(['动作','喜剧','爱情','科幻','恐怖','剧情','战争','纪录片','动画','奇幻','冒险','犯罪','悬疑','惊悚','音乐','歌舞','传记','历史','运动','家庭','武侠','古装','西部','灾难'])]},
            {key:'area', name:'地区', value:[{n:'全部',v:''}, ...opts(['大陆','香港','台湾','美国','日本','韩国','英国','法国','德国','意大利','西班牙','印度','泰国','俄罗斯','欧洲','其他'])]},
            {key:'year', name:'年份', value:[{n:'全部',v:''}, ...['2026','2025','2024','2023','2022','2021','2020','2019','2018','2017','2016','2015','2014','2013','2012','2011','2010','2000-2009','1990-1999','更早'].map(y => ({n:y, v:y}))]},
            {key:'lang', name:'语言', value:[{n:'全部',v:''}, ...opts(['汉语普通话','粤语','英语','日语','韩语','法语','德语','其他'])]},
            {key:'order', name:'排序', value:[{n:'最新',v:'new'},{n:'最早',v:'old'},{n:'最热',v:'hot'},{n:'评分',v:'score'}]}
        ];
        const result = {};
        ['huayurm','jiating','donghuadadiany','lengmenjiapian','paihangbang','sort/12','dianshiju'].forEach(k => result[k] = filters);
        return result;
    })(),

    推荐: '*',

    一级: async function(tid, pg, filter, extend) {
        let url = tid && tid !== '*' ? (tid.startsWith('/') ? tid : '/' + tid) : '/';
        if (pg > 1) url += '/page/' + pg;
        const params = {...filter, ...extend};
        const qs = Object.keys(params).filter(k => params[k]).map(k => k + '=' + encodeURIComponent(params[k])).join('&');
        if (qs) url += (url.includes('?') ? '&' : '?') + qs;
        const html = await fetch(this.host + url);
        return this.getVodList(html);
    },

    二级: async function () {
        const [id, kname, kpic, kremarks] = this.input.split('@');
        const html = await fetch(id);

        const clean = s => s ? s.replace(/<br\s*\/?>/gi, '/').replace(/<[^>]+>/g, '').replace(/&middot;|middot;/g, '·').replace(/&amp;/g, '&').replace(/&nbsp;|　/g, ' ').replace(/\s+/g, ' ').trim() : '';

        const disks = [], mags = [];
        const collect = (list, prefix, url) => {
            if (!url) return;
            if (list === disks && !url.startsWith('push://')) url = 'push://' + url;
            if (!list.some(item => item.includes(url))) list.push(prefix + '$' + url);
        };

        (html.match(/https?:\/\/pan\.quark\.cn\/s\/[\w\-]+/g) || []).forEach(u => collect(disks, '夸克网盘', u));
        (html.match(/magnet:\?xt=urn:btih:[^"'<>]+/g) || []).forEach(u => collect(mags, '磁力', u));

        const tabs = [], urls = [];
        if (disks.length) { tabs.push('夸克网盘'); urls.push(disks.join('#')); }
        if (mags.length) { tabs.push('磁力'); urls.push(mags.join('#')); }

        const getMeta = (pattern) => {
            const m = html.match(pattern);
            return m ? clean(m[1]) : '';
        };
        let type_name = getMeta(/类型[：:]\s*([^\n]+)/);
        let vod_area = getMeta(/(?:国家|地区)[：:]\s*([^\n]+)/);
        let vod_director = getMeta(/导演[：:]\s*([^\n]+)/);
        let vod_year = (html.match(/(?:时间|年份|年代)[：:]\s*(\d{4})/) || [])[2] || (kname || html).match(/\((\d{4})\)/)?.[1] || '';
        let vod_actor = getMeta(/(?:演员阵容|主演|演员)[：:]\s*([^\n]+)/);
        pdfa(html, 'body&&.meta-row').forEach(row => {
            const txt = clean(pdfh(row, 'div&&Html'));
            if (txt.includes('类型')) type_name = txt.replace(/类型[：:]\s*/, '');
            else if (txt.includes('国家') || txt.includes('地区')) vod_area = txt.replace(/(?:国家|地区)[：:]\s*/, '');
            else if (txt.includes('导演')) vod_director = txt.replace(/导演[：:]\s*/, '');
            else if (txt.includes('年份') || txt.includes('时间')) {
                const y = txt.replace(/(?:年份|时间|年代)[：:]\s*/, '').match(/(\d{4})/);
                if (y) vod_year = y[1];
            } else if (txt.includes('演员')) vod_actor = txt.replace(/(?:演员阵容|主演|演员)[：:]\s*/, '');
        });

        const title = clean(pdfh(html, 'body&&h2.x-dbjs-title&&Text') || pdfh(html, 'title&&Text')).replace(/ - 4K原盘免费下载$/, '');
        const desc = clean(pdfa(html, 'body&&.x-dbjs-desc-block')?.[0] ? pdfh(pdfa(html, 'body&&.x-dbjs-desc-block')[0], 'div&&Html') : '');

        return {
            vod_id: id,
            vod_name: title || kname,
            vod_pic: kpic,
            type_name,
            vod_remarks: kremarks,
            vod_year,
            vod_area,
            vod_actor,
            vod_director,
            vod_content: desc,
            vod_play_from: tabs.join('$$$'),
            vod_play_url: urls.join('$$$')
        };
    },

    搜索: async function () {
        const html = await fetch(this.input);
        return this.getVodList(html);
    },

    lazy: async function () {
        const url = this.input;
        if (/(magnet:|ed2k:|ftp:|push:\/\/)/.test(url)) return {parse: 0, url};
        return {parse: 1, url};
    },

    getVodList: function (html) {
        const items = pdfa(html, 'body&&.bg-cardbg') || [];
        return items.map(it => {
            const name = pd(it, 'img&&alt') || '';
            if (!name) return null;
            let pic = pd(it, 'img&&src') || '';
            if (pic && !pic.startsWith('http')) pic = this.host + pic;
            const href = pd(it, 'a&&href');
            const vod_id = href && !href.startsWith('http') ? this.host + href : href;
            return {
                vod_name: name,
                vod_pic: pic,
                vod_remarks: pdfh(it, 'span&&Text') || '',
                vod_id: `${vod_id}@${name}@${pic}@${pdfh(it, 'span&&Text') || ''}`
            };
        }).filter(Boolean);
    }
};