/*
@header({
  searchable: 2,
  filterable: 0,
  quickSearch: 0,
  title: '爱看资源网',
  '类型': '影视',
  logo: 'https://aikanzy.com/favicon.ico',
  lang: 'ds'
})
*/

var rule = {
    类型: '影视',
    title: '爱看资源网',
    host: 'https://aikanzy.com',
    logo: 'https://aikanzy.com/favicon.ico',
    url: '/fyclass.html',
    searchUrl: '/search?word=**&molds=article',
    searchable: 2,
    quickSearch: 0,
    filterable: 0,
    class_name: '电影&电视剧&动漫/动画&综艺&短剧&其他&双男主',
    class_url: 'dy-fypage&dsj-fypage&dmdh-fypage&zy-fypage&dj-fypage&qt-fypage&tags/index/tagname/双男主/page/fypage',
    headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Mobile Safari/537.36',
        'Referer': 'https://aikanzy.com'
    },
    play_parse: true,
    limit: 20,
    double: false,
    推荐: '*',

    _pic: (img) => img ? img + '@Referer=https://aikanzy.com@User-Agent=Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Mobile Safari/537.36' : '',

    _parseList: function (html) {
        const { pdfa, pdfh, pd } = this;
        return (pdfa(html, '#content .post-list') || []).map(it => {
            let title = pdfh(it, '.entry-title a&&Text') || '';
            const m = title.match(/《([^》]+)》/);
            return {
                title: m ? m[1] : title,
                img: this._pic(pd(it, '.lazyload&&data-src') || ''),
                desc: pdfh(it, '.entry-meta&&Text') || '',
                url: (pd(it, 'a&&href') || '').replace(/^`|`$/g, '')
            };
        });
    },

    // 滑动验证绕过：从验证页 JS 提取 key/value，md5(stringtoHex(value)) 请求验证接口拿 cookie
    _bypassSlide: async function (html) {
        const jsMatch = html.match(/\/huadong_[a-f0-9_]+\.js\?id=\d+/);
        if (!jsMatch) return '';
        const jsHtml = await request(this.host + jsMatch[0], { headers: this.headers, timeout: 5000 });
        const keyM = jsHtml.match(/key="([a-f0-9]+)"/);
        const valM = jsHtml.match(/value="([a-f0-9]+)"/);
        const phpM = jsHtml.match(/"\/[a-f0-9_]+_yanzheng_huadong\.php\?type=([a-f0-9]+)&key="/);
        if (!keyM || !valM || !phpM) return '';
        // stringtoHex: 每个 char 的 charCode+1 拼接；value = md5(stringtoHex(rawValue))
        const hex = valM[1].replace(/./g, c => c.charCodeAt(0) + 1);
        const hashed = typeof md5 === 'function' ? md5(hex) : (typeof CryptoJS !== 'undefined' ? CryptoJS.MD5(hex).toString() : '');
        if (!hashed) return '';
        const verifyUrl = `${this.host}/a20be899_96a6_40b2_88ba_32f1f75f1552_yanzheng_huadong.php?type=${phpM[1]}&key=${keyM[1]}&value=${hashed}`;
        const { cookie } = await reqCookie(verifyUrl, { headers: this.headers, timeout: 5000 }, true);
        return cookie || '';
    },

    一级: async function () {
        return setResult(this._parseList(await request(this.input)));
    },

    二级: async function () {
        const { input, pdfa, pdfh, pd } = this;
        const html = await request(input);
        const title1 = pdfh(html, 'h1&&Text') || '';
        const title2 = pdfh(html, '#content&&li:eq(2)&&Text') || '';
        const fullTitle = (title1 + ' ' + title2).trim();
        const m = fullTitle.match(/《([^》]+)》/);
        const VOD = {
            vod_name: m ? m[1] : fullTitle,
            vod_pic: this._pic(pd(html, '.shadimg img&&src') || ''),
            vod_content: fullTitle,
            vod_remarks: fullTitle.substring(0, 100) + '...'
        };

        const pans = (pdfa(html, '.con_ad-top&&p:eq(-1) a') || [])
            .map(it => ({ title: pdfh(it, '.icon&&Text') || pdfh(it, 'a&&Text') || '', url: pd(it, 'a&&href') || '' }))
            .filter(p => p.title && p.url);

        if (pans.length) {
            VOD.vod_play_from = pans.map(p => p.title).join('$$$');
            VOD.vod_play_url = pans.map(p => `${p.title}$push://${p.url}`).join('$$$');
        } else {
            VOD.vod_play_from = '网盘';
            VOD.vod_play_url = '暂无可用资源';
        }
        return VOD;
    },

    搜索: async function () {
        const { input, headers } = this;
        let html = await request(input);
        if (html.includes('滑动验证')) {
            const cookie = await this._bypassSlide(html);
            if (cookie) html = await request(input, { headers: Object.assign({}, headers, { Cookie: cookie }) });
        }
        return setResult(html.includes('滑动验证') ? [] : this._parseList(html));
    },

    lazy: async function (_, id) {
        return { parse: 1, url: id };
    }
};
