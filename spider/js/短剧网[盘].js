/*
@header({
  searchable: 1,
  filterable: 0,
  quickSearch: 0,
  title: '短剧网',
  author: 'EylinSir',
  '类型': '影视',
  logo: 'https://sm3.cc/zb_users/upload/2025/01/20250114180829173684930951201.png',
  lang: 'ds'
})
*/

var rule = {
    类型: '影视',
    author: 'EylinSir',
    logo: 'https://sm3.cc/zb_users/upload/2025/01/20250114180829173684930951201.png',
    title: '短剧网',
    host: 'https://sm3.cc',
    url: '/?cate=fyclass&page=fypage',
    searchUrl: '/search.php?q={wd}&page={pg}',
    searchable: 1,
    quickSearch: 0,
    timeout: 5000,
    play_parse: true,
    class_name: '短剧大全&更新短剧',
    class_url: '1&2',
    headers: { 'User-Agent': 'MOBILE_UA' },

    lazy: async function () {
        return { url: this.input, parse: 0 };
    },

    推荐: async function() {
        return await this.一级();
    },

    一级: async function(tid, pg, filter, extend) {
        let url = this.input;
        let html = await request(url);
        let list = pdfa(html, 'li.col-6').map(it => ({
            title: pdfh(it, 'h3.f-14 a&&Text'),
            pic_url: pdfh(it, 'img.lazy&&data-original'),
            desc: pdfh(it, 'h3.f-14 a&&title').replace(/^[^（]*（/, '').replace(/）$/, ''),
            url: pdfh(it, 'h3.f-14 a&&href'),
            content: ''
        }));
        return setResult(list);
    },

    二级: async function(ids) {
        let url = this.input;
        let html = await request(url);
        let list = pdfa(html, '.content').map(content => {
            let playList = pdfh(content, 'p');
            return '点我播放$push://' + pdfh(playList, 'a&&href');
        });
        return {
            vod_name: pdfh(html, '[title]&&（'),
            vod_pic: pdfh(html, '[data-original]&&"'),
            vod_content: '此为推送网盘规则',
            vod_play_from: '短剧网',
            vod_play_url: list.join('$$$')
        };
    },

    搜索: async function () {
        return await this.一级();
    }
};
