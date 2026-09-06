/*
@header({
  searchable: 2,
  filterable: 0,
  quickSearch: 0,
  title: '夸克影视[优]',
  author: 'EylinSir',
  类型: '影视',
  logo: 'https://www.quarktv.com/favicon.ico',
  lang: 'ds',
})
*/

var rule = {
    类型: '影视',
    author: 'EylinSir',
    title: '夸克影视[优]',
    logo: 'https://www.quarktv.com/favicon.ico',
    host: 'https://www.quarktv.com',
    url: '/category/fyclass/page/fypage',
    searchUrl: '/?s=**',
    searchable: 2,
    quickSearch: 0,
    filterable: 0,
    class_parse: `.site-nav li:gt(0):lt(10);a&&Text;a&&href;.*/category/(.*/?)`,
    headers: { 'User-Agent': 'MOBILE_UA' },
    play_parse: true,

    // 直接复用一级列表，推荐和搜索共用
    推荐: function (tid, pg, filter, extend) {
        return this.一级(tid, pg, filter, extend);
    },
    搜索: function (wd) {
        // 框架会将 searchUrl 中的 ** 替换为 wd 并赋值给 this.input
        return this.一级();
    },

    一级: async function (tid, pg, filter, extend) {
        let { input, pdfa, pdfh, pd } = this;
        let html = await request(input);
        let list = [];
        let items = pdfa(html, 'article.excerpt');
        items.forEach(it => {
            let rawTitle = pdfh(it, 'h2 a&&Text');
            let title = rawTitle.match(/《(.*?)》/)?.[1] || rawTitle;
            list.push({
                title: title,
                pic_url: pd(it, 'img&&data-src'),
                desc: pdfh(it, '.meta&&Text'),
                url: pd(it, 'h2 a&&href'),
            });
        });
        return setResult(list);
    },

    二级: async function (ids) {
        let { input, pdfa, pdfh, pd } = this;
        let html = await request(input);
        let vod = {
            vod_name: pdfh(html, 'h1&&Text'),
            vod_pic: pd(html, '.cover img&&src'),
            vod_content: pdfh(html, '.intro&&Text'),
        };

        let playmap = {};
        let postId = pdfh(html, '.postkit&&data-postid');

        // 尝试通过 postkit API 获取资源
        if (postId) {
            let visitorId = 'pk_drpy_fixed_visitor_id';
            let apiUrl = `https://www.quarktv.com/wp-json/postkit/v1/pan_view?post_id=${postId}&visitor_id=${visitorId}`;
            let headers = { Referer: input, 'User-Agent': 'Mozilla/5.0' };
            try {
                let res = JSON.parse(await request(apiUrl, { headers }));
                (res.resources || []).forEach(r => {
                    let label = (r.pan_name || '资源') + (r.is_bt ? 'BT' : '网盘');
                    let url = r.url;
                    let key = /pan.quark.cn/.test(url) ? '夸克' : '下载';
                    let link = /pan.quark.cn/.test(url) ? `push://${url}` : url;
                    (playmap[key] = playmap[key] || []).push(`${label}$${link}`);
                });
            } catch (_) {}
        }

        // API 未取到时回退 HTML 解析
        if (!Object.keys(playmap).length) {
            let links = pdfa(html, '.ul-pans li .pan-title a');
            links.forEach(it => {
                let title = pdfh(it, 'a&&Text') || '资源';
                let url = pd(it, 'a&&href');
                let key = /pan.quark.cn/.test(url) ? '夸克' : '下载';
                let link = /pan.quark.cn/.test(url) ? `push://${url}` : url;
                (playmap[key] = playmap[key] || []).push(`${title}$${link}`);
            });
        }

        vod.vod_play_from = Object.keys(playmap).join('$$$');
        vod.vod_play_url = Object.values(playmap).map(arr => arr.join('#')).join('$$$');
        return vod;
    },

    lazy: async function(flag, id, flags) {
        return { parse: 0, url: id };
    }
};
