/*
@header({
  searchable: 1,
  filterable: 0,
  quickSearch: 0,
  title: '番茄漫画',
  '类型': '漫画',
  logo: 'https://www.18zf.net/d/file/p/2023/1107/3ty5orktxrc.jpg',
  lang: 'ds'
})
*/


var rule = {
    类型: '漫画',
    title: '番茄漫画',
    host: 'https://qkfqapi.vv9v.cn',
    // host: 'http://47.108.80.161:5005',
    homeUrl: '/api/discover/style?tab=漫画',
    url: 'fyclass',
    searchUrl: '/api/search?key=**&tab_type=8&offset=((fypage-1)*10)',
    detailUrl: '/api/detail?book_id=fyid',
    logo: 'https://www.18zf.net/d/file/p/2023/1107/3ty5orktxrc.jpg',
    headers: {'User-Agent': 'UC_UA'},
    searchable: 1,
    quickSearch: 0,
    filterable: 0,
    double: true,
    play_parse: true,
    limit: 10,
    class_parse: async function () {
        let {input} = this;
        // log('[class_parse] input:', input);
        let html = await request(input);
        let data = html.parseX.data;
        let d = data.filter(item => item.url.trim()).map((it) => {
            return {
                type_name: it.title,
                type_id: gzip(it.url),
            }
        });
        return {class: d}
    },
    lazy: async function () {
        let {input, pdfa, pdfh, HOST} = this;
        let title = input.split('@')[1];
        input = input.split('@')[0];
        let content_url = `${HOST}/api/content?tab=漫画&item_id=${input}&show_html=0`; // 正文获取接口
        let jsonStr = await request(content_url);
        let images = jsonStr.parseX.data.images;
        images = pdfa(images, 'img');
        let pics = []
        for (let img of images) {
            let pic = pdfh(img, 'img&&src');
            pics.push(pic);
        }
        return {parse: 0, url: 'pics://' + pics.join('&&')}
    },
    parseList(html) {
        let data = html.parseX.data;
        data = data.data || data;
        let d = [];
        data.forEach((item) => {
            if (item && item.book_name) {
                d.push({
                    vod_name: item.book_name,
                    vod_id: item.book_id || item.id,
                    vod_pic: item.thumb_url || item.cover,
                    vod_remarks: item.author || item.category || '',
                    vod_content: item.abstract || item.description || ''
                });
            }
        });
        return d
    },
    推荐: async function () {
        let {HOST} = this;
        let url = HOST + '/api/discover?tab=漫画&type=7&gender=2&genre_type=110&page=1';
        // log('[推荐]: url: ' + url);
        let html = await request(url);
        return this.parseList(html);
    },
    一级: async function (tid, pg, filter, extend) {
        // log('[一级]: tid:', tid);
        tid = ungzip(tid);
        input = jinja.render(tid, {page: pg});
        // log('[一级]: input: ' + input);
        let html = await request(input);
        return this.parseList(html);
    },
    二级: async function () {
        let {input, orId, HOST} = this;
        let html = await request(input);
        let data = html.parseX.data.data;
        let VOD = {};
        VOD.vod_name = data.book_name;
        VOD.type_name = data.category;
        VOD.vod_pic = data.thumb_url;
        VOD.vod_content = data.abstract;
        VOD.vod_remarks = data.sub_info;
        VOD.vod_year = '';
        VOD.vod_area = '';
        VOD.vod_actor = '';
        VOD.vod_director = data.author;
        VOD.vod_play_from = '番茄漫画';
        let jsonStr = await request(`${HOST}/api/book?book_id=${orId}`);
        let book_info = jsonStr.parseX.data.data;
        let list = book_info.chapterListWithVolume.flat();
        let urls = [];
        list.forEach((it, index) => {
            urls.push(it.title + '$' + it.itemId + '@' + it.title);
        });
        VOD.vod_play_url = urls.join('#');
        return VOD
    },
    搜索: async function () {
        let {input, MY_PAGE} = this;
        let html = await request(input);
        let json = JSON.parse(html);
        let data = json.data.search_tabs[3].data;
        let d = [];
        for (let it of data.filter(i => i.book_data)) {
            let book = it.book_data[0];
            // console.log(book)
            d.push({
                title: book.book_name,
                url: book.book_id,
                desc: book.author,
                content: book.book_abstract || book.abstract,
                pic_url: book.thumb_url
            });
        }
        return setResult(d)
    },
}