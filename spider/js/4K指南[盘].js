/*
@header({
  searchable: 2,
  filterable: 0,
  quickSearch: 0,
  title: '4K指南',
  author: 'EylinSir',
  '类型': '影视',
  logo: 'https://4kzn.cc//favicon.ico',
  lang: 'ds'
})
*/

var rule = {
    类型: '影视',
    author: 'EylinSir',
    title: '4K指南',
    host: 'https://4kzn.cc',
    logo: 'https://4kzn.cc/favicon.ico',
    url: '/books/fyclass',
    searchUrl: '/?post_type=book&s=**',
    searchable: 2,
    quickSearch: 0,
    headers: { 'User-Agent': 'PC_UA' },
    timeout: 5000,
    class_name: '最新&TOP250&电影&剧集',
    class_url: 'zuixin&top250&dianying&juji',
    play_parse: true,
    filter: {
        "dianying": [{key: "type", name: "类型", value: [{"n":"电影","v":"dianying"},{"n":"喜剧","v":"xiju"},{"n":"爱情","v":"aiqing"},{"n":"剧情","v":"juqing"},{"n":"悬疑","v":"xuanyi"},{"n":"传记","v":"zhuanji"},{"n":"动作","v":"dongzuo"},{"n":"科幻","v":"kehuan"},{"n":"犯罪","v":"fanzui"},{"n":"奇幻","v":"qihuan"},{"n":"冒险","v":"maoxian"},{"n":"家庭","v":"jiating"},{"n":"运动","v":"yundong"},{"n":"歌舞","v":"gewu"},{"n":"战争","v":"zhanzheng"},{"n":"惊悚","v":"jingsong"},{"n":"西部","v":"xibu"},{"n":"动画","v":"donghua"},{"n":"灾难","v":"zainan"},{"n":"恐怖","v":"kongbu"},{"n":"历史","v":"lishi"},{"n":"音乐","v":"yinyue"},{"n":"同性","v":"tongxing"},{"n":"纪录片","v":"jilupian"},{"n":"古装","v":"guzhuang"},{"n":"儿童","v":"ertong"},{"n":"武侠","v":"武侠"}]}],
        "juji": [{key: "type", name: "类型", value: [{"n":"剧集","v":"juji"},{"n":"剧情","v":"juq"},{"n":"惊悚","v":"jings"},{"n":"犯罪","v":"fanzuii"},{"n":"动作","v":"jjdongzuo"},{"n":"历史","v":"jjlishi"},{"n":"战争","v":"jjzhanzheng"},{"n":"冒险","v":"jjmaoxian"},{"n":"古装","v":"古装"},{"n":"爱情","v":"爱情"},{"n":"喜剧","v":"喜剧"},{"n":"最新","v":"zuixin-juji"},{"n":"科幻","v":"科幻"},{"n":"悬疑","v":"悬疑"},{"n":"奇幻","v":"奇幻"},{"n":"家庭","v":"家庭"},{"n":"恐怖","v":"恐怖"},{"n":"西部","v":"西部"},{"n":"动画","v":"动画"}]}]
    },

    lazy: async function () {
        return { url: this.input, parse: 0 };
    },

    推荐: async function(tid, pg, filter, extend) {
        return await this.一级('zuixin', 1, filter, {});
    },

    一级: async function(tid, pg, filter, extend) {
        let url = `${this.host}/books/${extend.type || tid}/page/${pg}`;
        let html = await request(url);
        let list = pdfa(html, '.posts-row .posts-item').map(it => ({
            title: pdfh(it, '.item-title&&Text'),
            pic_url: pdfh(it, '.lazy&&data-src'),
            desc: pdfh(it, '.text-muted&&Text'),
            url: pdfh(it, 'a.item-image&&href'),
            content: ''
        }));
        return setResult(list);
    },

    二级: async function(ids) {
        let url = ids[0].startsWith('http') ? ids[0] : this.host + ids[0];
        let html = await request(url);
        let txt = pdfh(html, '.panel-body p&&Text');
        let get = (k) => (txt.match(new RegExp(`${k}:\\s*(.*?)(?=\\s*(导演|主演|类型|制片|语言|上映|片长|又名|IMDb|$))`)) || ['',''])[1].replace(/\//g, ',');
        let list = pdfa(html, '.site-go a').map(a => 
            pdfh(a, 'a&&Text') + '$push://' + pdfh(a, 'a&&href')
        );

        return {
            vod_name: pdfh(html, '.site-name&&Text'),
            vod_pic: pdfh(html, '.lazy&&data-src'),
            vod_director: get('导演'),
            vod_actor: get('主演'),
            vod_type: get('类型'),
            vod_area: get('制片国家/地区'),
            vod_year: (get('上映日期').match(/\d{4}/) || [''])[0],
            vod_content: txt.split('IMDb:').pop().trim(),
            vod_play_from: list.length ? list.map(u => u.split('$')[0]).join('$$$') : '无资源',
            vod_play_url: list.length ? list.join('$$$') : ''
        };
    },

    搜索: async function () {
        let {input, pdfa, pdfh} = this;
        let html = await request(input);
        let list = pdfa(html, '.posts-row .posts-item').map(it => ({
            title: pdfh(it, '.item-title&&Text'),
            img: pdfh(it, '.lazy&&data-src'),
            desc: pdfh(it, '.text-muted&&Text'),
            url: pdfh(it, 'a.item-image&&href')
        }));
        return setResult(list);
    }
};