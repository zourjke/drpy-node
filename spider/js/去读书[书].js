/*
@header({
  searchable: 1,
  filterable: 0,
  quickSearch: 1,
  title: '去读书[书]',
  author: 'EylinSir',
  '类型': '小说',
  logo: 'https://bkimg.cdn.bcebos.com/pic/3c6d55fbb2fb4316cb45c17123a4462309f7d367',
  lang: 'ds'
})
*/

var rule = {
    类型: '小说',
    author: 'EylinSir',
    title: '去读书[书]',
    host: 'http://www.qudushu.la',
    url: '/book/fyclass/0/fypage.html',
    logo: 'https://bkimg.cdn.bcebos.com/pic/3c6d55fbb2fb4316cb45c17123a4462309f7d367',
    class_name: '玄幻魔法&武侠修真&都市言情&历史军事&穿越架空&游戏竞技',
    class_url: 'sort1&sort2&sort3&sort4&sort5&sort6',
    searchUrl: '/modules/article/search.php?q=**',
    searchable: 1,
    quickSearch: 1,
    filterable: 0,
    timeout: 10000,
    play_parse: true,
    headers: { 'User-Agent': 'MOBILE_UA' },

    一级: async function () {
        let {input, pdfa, pdfh, pd} = this;
        let url = input.startsWith('http') ? input : `${this.host}/book/${input}/0/1.html`;
        let html = await request(url);
        let items = pdfa(html, '.blockcontent .c_row') || pdfa(html, '.c_row') || [];
        return setResult(items.map(item => {
            let title = pdfh(item, '.c_subject a:eq(1)&&Text') || pdfh(item, 'img&&alt');
            let link = pd(item, '.c_subject a:eq(1)&&href');
            if (!title || !link) return null;
            return {
                title,
                url: link,
                desc: pdfh(item, '.c_tag span:eq(1)&&Text') || '',
                pic_url: pd(item, 'img&&src') || '',
                content: pdfh(item, '.c_description&&Text') || ''
            };
        }).filter(Boolean));
    },

    二级: async function () {
        let {input, pdfa, pdfh, pd} = this;
        let html = await request(input);
        let vod = {
            vod_name: '',
            vod_pic: '',
            vod_content: '',
            vod_remarks: '',
            vod_actor: '',
            vod_play_from: '去读书'
        };
        let isToc = input.includes('/html/');
        let tocHtml = isToc ? html : '';
        
        if (!isToc) {
            vod.vod_name = pdfh(html, '[property="og:novel:book_name"]&&content') || '';
            vod.vod_pic = pd(html, '.divbox.cf img&&src') || '';
            vod.vod_content = pdfh(html, '.tabcontent .tabvalue:eq(0)&&Text') || '';
            vod.vod_remarks = pdfh(html, 'h3 a&&Text') || '';
            vod.vod_actor = pdfh(html, '[property="og:novel:author"]&&content') || '';
            vod.vod_director = vod.vod_actor;
            
            let tocUrl = pd(html, 'a:contains(点击阅读)&&href') || '';
            if (!tocUrl) {
                let m = input.match(/\/book\/info\/(\d+)\/(\d+)\.html/);
                if (m) tocUrl = `${this.host}/html/${m[1]}/${m[2]}/`;
            }
            if (tocUrl) {
                tocUrl = tocUrl.startsWith('http') ? tocUrl : `${this.host}${tocUrl}`;
                tocHtml = await request(tocUrl);
            }
        }
        
        let chapters = [];
        let chs = pdfa(tocHtml, '.index .chapter') || [];
        for (let ch of chs) {
            let title = pdfh(ch, 'a&&Text');
            let chUrl = pd(ch, 'a&&href');
            if (!title || !chUrl) continue;
            chUrl = chUrl.startsWith('http') ? chUrl : `${this.host}${chUrl}`;
            chapters.push(`${title}$${chUrl}`);
        }
        vod.vod_play_url = chapters.join('#');
        
        if (!vod.vod_name) {
            vod.vod_name = (pdfh(tocHtml, 'h1&&Text') || '').replace(/《|》/g, '').replace(/作者：.*$/, '').trim();
        }
        if (!vod.vod_actor) {
            vod.vod_actor = (pdfh(tocHtml, 'h1 span&&Text') || '').replace(/作者：/, '').trim();
            vod.vod_director = vod.vod_actor;
        }
        if (!vod.vod_content) {
            vod.vod_content = (pdfh(tocHtml, '#tuijian&&Text') || '').replace(/小说.*简介：/, '').trim();
        }
        return vod;
    },

    搜索: async function () {
        let {input, pdfa, pdfh, pd} = this;
        let html = await request(input);
        return setResult(pdfa(html, '#jieqi_page_contents .c_row').map(item => {
            let title = pdfh(item, '.c_subject a&&Text');
            let link = pd(item, '.c_subject a&&href');
            if (!title || !link) return null;
            link = link.startsWith('http') ? link : `${this.host}${link}`;
            let pic = pd(item, 'img&&src') || '';
            pic = pic.startsWith('http') ? pic : `${this.host}${pic}`;
            return {
                title,
                url: link,
                desc: pdfh(item, '.c_tag span:eq(1)&&Text') || '',
                pic_url: pic,
                content: ''
            };
        }).filter(Boolean));
    },

    lazy: async function () {
        let {input, pdfh} = this;
        let html = await request(input);
        let title = pdfh(html, 'h1&&Text') || '';
        let content = pdfh(html, '#acontent&&Html') || '';
        if (content) {
            content = content
                .replace(/<script[^>]*?>[\s\S]*?<\/script>/gi, '')
                .replace(/<\/p>|<br\s*\/?>/g, '\n')
                .replace(/<[^>]*?>/g, '')
                .replace(/去读书推荐各位书友阅读：.*|去读书 www\.qudushu\.la|如果您中途有事离开，请按.*以便以后接着观看！/g, '')
                .replace(/&nbsp;|[ \t]+/g, ' ')
                .replace(/\n[ \t]*\n+/g, '\n')
                .trim();
            if (content.startsWith(title)) content = content.replace(title, '').trim();
        }
        return {
            parse: 0,
            url: `novel://${JSON.stringify({title, content})}`,
            js: ''
        };
    }
};
