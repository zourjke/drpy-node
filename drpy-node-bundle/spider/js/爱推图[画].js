/*
@header({
  searchable: 2,
  filterable: 0,
  quickSearch: 0,
  title: '爱推图[画]',
  '类型': '漫画',
  mergeList: true,
  more: {
    mergeList: 1
  },
  lang: 'ds'
})
*/


var rule = {
    title: '爱推图[画]',
    类型: '漫画',
    host: 'https://ww.aituitu.com/',
    url: '/fyclass/index_fypage.html',
    class_parse: '#menu-main-menu&&li:lt(15);a&&Text;a&&href;.*/(.*?)/',
    cate_exclude: '娱乐时尚',
    hikerListCol: "movie_2",
    hikerClassListCol: "movie_2",
    searchable: 2,
    quickSearch: 0,
    filterable: 0,
    headers: {
        'User-Agent': 'MOBILE_UA',
    },
    play_parse: true,
    lazy: async function () {
        let {input, pdfh} = this;
        // console.log('input:', input);
        input = input.split('@@')[0];
        let html = await request(input);
        let arr = pdfa(html, '.single-content&&img');
        let urls = [];
        arr.forEach((it) => {
            let src = pdfh(it, 'img&&data-src');
            src += '@Referer=' + rule.host;
            urls.push(src);
        });
        return {
            parse: 0,
            url: 'pics://' + urls.join('&&'),
            js: '',
            header: {
                referer: rule.host,
                'user-agent': MOBILE_UA
            }
        };
    },
    推荐: '*',
    searchUrl: '/sou-**-fypage.html',
    一级: '#content&&article;h2&&Text;img&&data-src;;a&&href',
    二级: '*',
    搜索: '*',
}