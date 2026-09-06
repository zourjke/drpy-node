/*
* @File     : spider/js/咕咕番.js
* @Author   : ChatGPT
* @Date     : 2026-04-19
* @Comments : 咕咕番 - 在线日漫 (API失效,改用HTML解析首页静态卡片)
@header({
  searchable: 2,
  filterable: 0,
  quickSearch: 0,
  title: '咕咕番',
  类型: '影视',
  lang: 'ds',
})
*/

var rule = {
    类型: '影视',
    title: '咕咕番',
    host: 'https://www.gugu3.com',
    homeUrl: '/',
    url: '/index.php/vod/show/id/fyclass/page/fypage.html',
    searchUrl: '/index.php/vod/search/page/fypage/wd/**.html',

    searchable: 2,
    quickSearch: 0,
    filterable: 0,
    headers: {
        'User-Agent': MOBILE_UA,
        'Referer': 'https://www.gugu3.com/'
    },
    timeout: 8000,
    class_name: '番剧&剧场版&特摄',
    class_url: '6&21&23',
    detailUrl: '/index.php/vod/detail/id/fyid.html',
    play_parse: true,
    lazy: '',
    limit: 6,
    double: false,
    推荐: async function () {
        let { HOST, pdfa, pdfh, pd } = this;
        let html = await request(HOST + '/');
        let d = [];
        let data = pdfa(html, '.public-list-box');
        data.slice(0, 12).forEach(it => {
            d.push({
                title: pdfh(it, '.public-list-exp&&title'),
                pic_url: pd(it, 'img&&data-src'),
                desc: pdfh(it, '.public-list-subtitle&&Text'),
                url: pd(it, '.public-list-exp&&href')
            });
        });
        return d;
    },
    一级: async function () {
        let { HOST, MY_CATE, MY_PAGE, pdfa, pdfh, pd } = this;
        let html = await request(HOST + '/');
        let d = [];
        // 分类与首页section标题映射
        let sectionMap = { '6': '番剧热度', '21': '剧场热度', '23': '特摄热度' };
        let sectionTitle = sectionMap[MY_CATE];
        let cards = [];
        if (sectionTitle) {
            // 定位section标题
            let titlePos = html.indexOf('>' + sectionTitle + '<');
            if (titlePos > 0) {
                // 向上找 box-width section 起始
                let sectionStart = html.lastIndexOf('<div class="box-width', titlePos);
                // 向下找下一个 box-width section
                let nextSection = html.indexOf('<div class="box-width', titlePos + sectionTitle.length);
                if (nextSection === -1) nextSection = html.length;
                let sectionHtml = html.substring(sectionStart, nextSection);
                cards = pdfa(sectionHtml, '.public-list-box');
            }
        }
        // 兜底:用所有卡片
        if (cards.length === 0) {
            cards = pdfa(html, '.public-list-box');
        }
        let page = parseInt(MY_PAGE) || 1;
        let start = (page - 1) * 20;
        cards.slice(start, start + 20).forEach(it => {
            d.push({
                title: pdfh(it, '.public-list-exp&&title'),
                pic_url: pd(it, 'img&&data-src'),
                desc: pdfh(it, '.public-list-subtitle&&Text'),
                url: pd(it, '.public-list-exp&&href')
            });
        });
        return d;
    },
    二级: {
        title: '.slide-info-title&&Text;.detail-info .partition:eq(2)&&Text',
        img: '.detail-pic img&&data-src',
        desc: '.slide-info-remarks:eq(0)&&Text;.slide-info-remarks:eq(1)&&Text;.slide-info-remarks:eq(2)&&Text;.detail-info .partition:eq(1)&&Text;.detail-info .partition:eq(0)&&Text',
        content: '#height_limit&&Text',
        tabs: '.anthology-tab .swiper-slide',
        tab_text: 'body&&Text',
        lists: '.anthology-list-box:eq(#id) .anthology-list-play li',
        list_text: 'a&&Text',
        list_url: 'a&&href'
    },
    搜索: '.search-list;.slide-info-title&&Text;.detail-pic img&&data-src;.slide-info-remarks:eq(0)&&Text;a&&href'
};