/*
@header({
  searchable: 1,
  filterable: 1,
  quickSearch: 0,
  title: '田园音乐',
  author: 'EylinSir',
  类型: '音乐',
  mergeList: true,
  more: {
    mergeList: 1,
  },
  logo: 'http://www.tyqyyw.com/down/logo1.ico',
  lang: 'ds',
})
*/

var rule = {
    title: '田园音乐',
    author: 'EylinSir',
    类型: '音乐',
    host: 'http://www.tyqyyw.com',
    logo:'http://www.tyqyyw.com/down/logo1.ico',
    searchUrl: 'http://www.tyqyyw.com/page/fypage/?s=**',
    headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 12; NOH-AN01) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Mobile Safari/537.36'
    },
    searchable: 1,
    quickSearch: 0,
    filterable: 1,
    play_parse: true,
    timeout: 10000,

    class_name: '轻音乐&有声音乐&有声电台&音乐心情&专辑曲目&MTV&3D音乐&伤感音乐&佛乐&八音盒&古风音乐&优美纯音乐&周杰伦&大自然音乐&小清新&庄重大气&异域风情&怀旧声音&悠扬的音乐&放松减压&新世纪&欢快愉悦&民谣&治愈系音乐&激情轻音&班得瑞&睡眠音乐&网络电台节目&胎教音乐&节奏&轻音乐MV&阳光音乐&静心音乐&魅惑电音',
    class_url: 'qingyinyue&yuansheng&diantai&shenghuo&wusun&mtv&tag/3d&tag/shanggan&tag/%e4%bd%9b%e4%b9%90&tag/bayinhe&tag/gufeng&tag/youmei&tag/%e5%91%a8%e6%9d%b0%e4%bc%a6&tag/daziran&tag/qingxin&tag/daqi&tag/yiyufengqing&tag/huaijiu&tag/youyang&tag/fangsong&tag/newage&tag/huankuai&tag/minyao&tag/zhiyu&tag/jiqing&tag/%e7%8f%ad%e5%be%97%e7%91%9e&tag/shuimian&tag/diantai&tag/taijiao&tag/%e8%8a%82%e5%a5%8f&tag/%e8%bd%bb%e9%9f%b3%e4%b9%90mv&tag/yangguang&tag/jingxin&tag/dianyin/',

    // 从 HTML 提取列表
    parseList: function(html) {
        const list = [];
        if (!html) return list;
        const startIdx = html.indexOf('id="post_container"');
        if (startIdx < 0) return list;
        const segment = html.substring(startIdx, startIdx + 50000);
        const parts = segment.split('<li class="post');
        for (let i = 1; i < parts.length; i++) {
            const li = parts[i];
            const endIdx = li.indexOf('<li class="post');
            const content = endIdx > 0 ? li.substring(0, endIdx) : li;
            const title = content.match(/title="([^"]*)"/);
            const href = content.match(/href="([^"]*)"/);
            const img = content.match(/src="([^"]*)"/);
            const desc = content.match(/entry_post[^>]*>([\s\S]*?)<\/p>/);
            if (href && title) {
                const fullTitle = title[1] || '';
                const bookMatch = fullTitle.match(/《([^》]*)》/);
                list.push({
                    vod_name: bookMatch ? bookMatch[1] : fullTitle,
                    vod_pic: img ? img[1] : '',
                    vod_remarks: desc ? desc[1].replace(/<[^>]+>/g, '').trim().substring(0, 40) : '',
                    vod_id: href[1] + '@' + (img ? img[1] : '')
                });
            }
        }
        return list;
    },

    // 推荐 (首页最新音乐)
    推荐: async function() {
        const html = await request(this.host + '/', { headers: this.headers });
        return this.parseList(html);
    },

    // 一级 - 分类列表
    一级: async function(tid, pg) {
        let url;
        if (!tid) {
            if (pg > 1) return [];
            url = this.host + '/';
        } else {
            const cleanTid = tid.replace(/\/+$/, '');
            url = this.host + '/' + cleanTid + '/page/' + pg + '/';
        }
        const html = await request(url, { headers: this.headers });
        return this.parseList(html);
    },

    二级: '*',

    // 搜索
    搜索: async function() {
        const html = await request(this.input, { headers: this.headers });
        return this.parseList(html);
    },

    // lazy - 从详情页解析播放地址
    lazy: async function(flag, id) {
        const [detailUrl, cover = ''] = String(id || this.input || '').split('@');
        if (!detailUrl) return { parse: 0, url: '' };

        const html = await request(detailUrl, { headers: this.headers });
        const source = html.match(/<source[^>]*src="([^"]*)"/);
        const context = html.match(/class="context"[^>]*>([\s\S]*?)<\/div>/);

        return {
            parse: 0,
            playUrl: '',
            url: source ? ['标准音质', source[1]] : ['标准音质', ''],
            header: this.headers,
            lrc: context ? context[1].replace(/<[^>]+>/g, '').trim() : '',
            cover: cover,
            pic: cover,
            height: 720
        };
    }
};