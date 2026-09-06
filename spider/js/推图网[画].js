/*
@header({
  searchable: 1,
  filterable: 0,
  quickSearch: 0,
  author: 'EylinSir',
  '类型': '图片',
  logo: 'https://m.tuiimg.com/favicon.ico',
  lang: 'ds'
})
*/

var rule = {
    类型: '图片',
    author: 'EylinSir',
    host: 'https://m.tuiimg.com',
    url: '/fyclass/list_fypage.html',
    logo: 'https://m.tuiimg.com/favicon.ico',
    searchUrl: '/search/**',
    searchable: 1,
    quickSearch: 0,
    play_parse: true,
    class_name: '美女&性感&清纯&妹子&写真&风景&动物&建筑',
    class_url: 'meinv&xingganmeinv&qingchunmeinv&meizitu&meinvxiezhen&fengjing&dongwu&jianzhu',
    headers: { 'User-Agent': 'PC_UA' },

    推荐: async function() {
        return this.一级();
    },
    
    一级: async function() {
        let html = await request(this.input);
        let list = pdfa(html, '.main&&li');
        let d = list.map(it => ({
            title: pdfh(it, 'h2&&Text'),
            desc: pdfh(it, '.mb-time&&Text'),
            img: pd(it, 'img&&realsrc'),
            url: pd(it, 'h2&&a&&href'),
            col_type: 'movie_3'
        }));
        return setResult(d);
    },

    搜索: async function() {
        let keyword = this.input.split('/').pop();
        let html = await post(this.host + '/search/', { 
            body: { skey: decodeURIComponent(keyword) },
            headers: {
                ...this.headers,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        let list = pdfa(html, '.main&&li');
        let d = list.map(it => ({
            title: pdfh(it, 'h2&&Text'),
            desc: pdfh(it, '.mb-time&&Text'),
            img: pd(it, 'img&&realsrc'),
            url: pd(it, 'h2&&a&&href'),
            col_type: 'movie_3'
        }));
        return setResult(d);
    },

    二级: async function(ids) {
        let html = await request(this.input);
        return {
            vod_id: ids[0],
            vod_name: pdfh(html, 'h1&&Text'),
            vod_pic: pd(html, 'img&&realsrc'),
            type_name: "图片",
            vod_play_from: "推图网",
            vod_play_url: `点击浏览$${this.input}`
        };
    },

    lazy: async function(flag, id) {
        let html = await request(id);
        let pageText = pdfh(html, '.page .all&&Text') || "";
        let firstImg = pd(html, '.content img&&src') || pd(html, '.pic img&&src');
        let pics = [firstImg];
        let matchCount = pageText.match(/\d+\/(\d+)/);
        let matchPath = firstImg ? firstImg.match(/(.*\/)(\d+)(\.[a-z]+)/i) : null;
        if (matchCount && matchPath) {
            let [, prefix, , ext] = matchPath;
            let total = parseInt(matchCount[1]);
            pics = Array.from({ length: total }, (_, i) => `${prefix}${i + 1}${ext}`);
        }
        return {
            parse: 0,
            url: "pics://" + pics.join("&&")
        };
    }
};