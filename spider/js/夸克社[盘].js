/*
@header({
  searchable: 2,
  filterable: 0,
  quickSearch: 0,
  title: '夸克网盘社',
  '类型': '影视',
  logo: 'https://kuakes.com/favicon.ico',
  lang: 'ds'
})
*/

const rule = {
    type: '影视',
    title: '夸克网盘社',
    author: 'EylinSir',
    logo: 'https://kuakes.com/favicon.ico',
    host: 'https://kuakes.com',
    url: '/fyclass/page/fypage',
    searchUrl: '/?s=**',
    searchable: 2,
    quickSearch: 0,
    filterable: 0,
//    class_parse: '.nav-top a;Text;href;.*?kuakes.com/(.*)',
    class_name: '电视剧&电影&综艺&动漫&纪录片',
    class_url: 'dramas&films&variety&cartoon&documentary',
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer':'https://kuakes.com',
    },
    timeout: 10000,
    
    // 预处理函数
    预处理: async function() {
        return [];
    },
    
    // 首页推荐
    推荐: async function(tid, pg, filter, extend) {
        let html;
        try {
            html = await request(this.host, {
                headers: this.headers,
                timeout: this.timeout
            });
        } catch (e) {
            log('请求失败：' + e);
            return setResult([]);
        }
        
        let d = [];
        let data = pdfa(html, 'div.articles-list article.post');
        
        data.forEach((it) => {
            let title = pdfh(it, 'a.post-title&&Text');
            let pic = pd(it, 'img&&data-lazy-src');
            if (pic && !pic.startsWith('http')) {
                pic = this.host + pic;
            }
            let desc = pdfh(it, 'span.db_score&&Text') || '';
            let url = pd(it, 'a.post-title&&href');
            
            d.push({
                title: title,
                pic_url: pic,
                desc: desc,
                url: url
            });
        });
        
        return setResult(d);
    },
    
    // 一级分类页
    一级: async function(tid, pg, filter, extend) {
        let { input, pdfa, pdfh, pd } = this;
        let url = pg && pg > 1 ? `${input}/page/${pg}` : input;
        let html;
        try {
            html = await request(url, {
                headers: this.headers,
                timeout: this.timeout
            });
        } catch (e) {
            log('请求失败：' + e);
            return setResult([]);
        }
        
        let d = [];
        let data = pdfa(html, 'div.articles-list article.post');
        
        data.forEach((it) => {
            let title = pdfh(it, 'a.post-title&&Text');
            let pic = pd(it, 'img&&data-lazy-src');
            if (pic && !pic.startsWith('http')) {
                pic = this.host + pic;
            }
            let desc = pdfh(it, 'span.db_score&&Text') || '';
            let url = pd(it, 'a.post-title&&href');
            
            d.push({
                title: title,
                pic_url: pic,
                desc: desc,
                url: url
            });
        });
        
        return setResult(d);
    },
    
    // 二级详情页
    二级: async function(ids) {
        let { input, pdfa, pdfh, pd } = this;
        let html;
        try {
            html = await request(input, {
                headers: this.headers,
                timeout: this.timeout
            });
        } catch (e) {
            log('请求失败：' + e);
            return {};
        }
        
        let VOD = {};
        
        // 标题
        let titleMatch = html.match(/<h1[^>]*class="[^\"]*title-detail[^\"]*"[^>]*>(.*?)<\/h1>/s);
        VOD.vod_name = titleMatch ? titleMatch[1].trim() : "未知标题";
        
        // 封面
        let picMatch = html.match(/<div[^>]*class="[^\"]*media-pic[^\"]*"[^>]*>.*?<img[^>]*data-lazy-src="([^"]*)"/s);
        VOD.vod_pic = picMatch ? picMatch[1].trim() : "";
        if (VOD.vod_pic && !VOD.vod_pic.startsWith("http")) {
            VOD.vod_pic = this.host + VOD.vod_pic;
        }
        
        // 解析详情信息
        let infoTextMatch = html.match(/<div[^>]*class="[^\"]*wp-block-media-text__content[^\"]*"[^>]*>.*?<p>(.*?)<\/p>/s);
        let detailHtml = infoTextMatch ? infoTextMatch[1].trim() : "";
        
        VOD.vod_director = this.extractByRegex(detailHtml, /导演:(.*?)编剧:/) || '';
        VOD.vod_area = this.extractByRegex(detailHtml, /地区:(.*?)语言:/) || '';
        VOD.vod_actor = this.extractByRegex(detailHtml, /主演:(.*?)类型:/) || '';
        VOD.vod_year = this.extractByRegex(detailHtml, /上映日期:(.*?)\(/) || '';
        VOD.type_name = this.extractByRegex(detailHtml, /类型:(.*?)制片/) || '';
        
        // 简介
        let descMatch = html.match(/<div[^>]*class="[^\"]*article-detail[^\"]*"[^>]*>.*?<p>(.*?)<\/p>/s);
        VOD.vod_content = descMatch ? descMatch[1].trim() : "";
        
        // 解析夸克网盘链接
        let shareLinks = [];
        
        // 从整个页面中提取data-rid和data-pid
        let ridMatch = html.match(/data-rid="([^"]*)"/);
        let pidMatch = html.match(/data-pid="([^"]*)"/);
        
        if (ridMatch && pidMatch) {
            let rid = ridMatch[1];
            let pid = pidMatch[1];
            // 获取真实的夸克网盘链接
            let realUrl = await this.getQuarkUrl(rid, pid);
            if (realUrl) {
                shareLinks.push(realUrl);
            }
        }
        
        // 构建播放列表
        let playFrom = [];
        let playUrl = [];
        
        if (shareLinks.length > 0) {
            playFrom.push('夸克社');
            const episodes = shareLinks.map((link, index) => `点我播放$${'push://' + encodeURIComponent(link)}`);
            playUrl.push(episodes.join('#'));
        } else {
            playFrom.push('无资源');
            playUrl.push('暂无资源$#');
        }
        
        VOD.vod_play_from = playFrom.join('$$$');
        VOD.vod_play_url = playUrl.join('$$$');
        
        return VOD;
    },
    
    // 搜索
    搜索: async function(key, quick, pg) {
        let searchUrl = `${this.host}/?s=${encodeURIComponent(key)}`;
        // 添加搜索必要的 Cookie
        let searchHeaders = {
            ...this.headers,
            'Cookie': 'esc_search_captcha=1; result=43'
        };
        
        let html;
        try {
            html = await request(searchUrl, {
                headers: searchHeaders,
                timeout: this.timeout
            });
        } catch (e) {
            log('搜索请求失败：' + e);
            return setResult([]);
        }
        
        let d = [];
        let data = pdfa(html, 'div.articles-list article.post');
        
        data.forEach((it) => {
            let title = pdfh(it, 'a.post-title&&Text');
            let pic = pd(it, 'img&&data-lazy-src');
            if (pic && !pic.startsWith('http')) {
                pic = this.host + pic;
            }
            let desc = pdfh(it, 'span.db_score&&Text') || '';
            let url = pd(it, 'a.post-title&&href');
            
            d.push({
                title: title,
                pic_url: pic,
                desc: desc,
                url: url
            });
        });
        
        return setResult(d);
    },
    
    lazy: async function (flag, id, flags) {
        let url = id;
        if (id.includes('$')) {
            url = id.split('$')[1];
        }
        return {
            url: url,
            header: JSON.stringify(this.headers)
        };
    },
    
    // 辅助函数：从文本中提取正则匹配
    extractByRegex: function(text, regex) {
        if (!text) return '';
        let match = text.match(regex);
        return match ? match[1].trim() : '';
    },
    
    // 获取夸克网盘真实链接
    getQuarkUrl: async function(rid, pid) {
        try {
            let form = {
                action: 'wb_mpdl_front',
                rid: rid,
                pid: pid
            };
            
            let response = await request(`${this.host}/wp-admin/admin-ajax.php`, {
                method: 'POST',
                headers: {
                    ...this.headers,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                data: form
            });
            
            let data;
            try {
                data = JSON.parse(response);
            } catch (e) {
                return null;
            }
            
            if (data && data.data && data.data.url) {
                return data.data.url;
            }
        } catch (e) {
            log('获取夸克链接失败：' + e);
        }
        
        return null;
    },
    

};
