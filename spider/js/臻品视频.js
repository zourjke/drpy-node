/*
@header({
  searchable: 1,
  filterable: 1,
  quickSearch: 0,
  title: '臻品视频',
  author: 'EylinSir',
  类型: '影视',
  logo: 'https://www.zpcxb.com/statics/img/favicon.ico',
  lang: 'ds',
})
*/

var rule = {
    title: '臻品视频',
    author: 'EylinSir',
    类型: '影视',
    host: 'https://www.zpcxb.com',
    logo: 'https://www.zpcxb.com/statics/img/favicon.ico',
    searchUrl: 'https://www.zpcxb.com/sosou/page/fypage.html?wd=**',
    headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 12; NOH-AN01) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Mobile Safari/537.36'
    },
    searchable: 1,
    quickSearch: 0,
    filterable: 1,
    play_parse: true,
    timeout: 10000,

    class_name: '电影&电视剧&综艺&动漫&记录片',
    class_url: 'dianying&gcj&zongyi&dongmna&jilupian',

    filter: {
        dianying: [{
            key: 'area',
            name: '分类',
            value: [
                { n: '全部', v: '' }, { n: '动作片', v: 'dzp' },
                { n: '喜剧片', v: 'xjp' }, { n: '爱情片', v: 'aqp' },
                { n: '科幻片', v: 'khp' }, { n: '恐怖片', v: 'kbp' },
                { n: '剧情片', v: 'jqp' }, { n: '战争片', v: 'zzp' }
            ]
        }],
        gcj: [{
            key: 'area',
            name: '分类',
            value: [
                { n: '全部', v: '' }, { n: '国产剧', v: 'gcj' }, { n: '热门短剧', v: 'dianshiju' },
                { n: '港台剧', v: 'gtj' }, { n: '日韩剧', v: 'rhj' },
                { n: '海外剧', v: 'hwj' }
            ]
        }]
    },

    parseList(html) {
        const list = [];
        if (!html) return list;
        const startIdx = html.indexOf('stui-vodlist clearfix');
        if (startIdx < 0) return list;
        const segment = html.slice(startIdx, startIdx + 200000);
        const parts = segment.split('stui-vodlist__box');

        for (let i = 1; i < parts.length; i++) {
            const part = parts[i];
            const content = part.slice(0, part.indexOf('stui-vodlist__box') > 0 ? part.indexOf('stui-vodlist__box') : part.length);
            const href = content.match(/href="([^"]*)"/);
            const title = content.match(/title="([^"]*)"/);
            const img = content.match(/data-original="([^"]*)"/);
            const remarks = content.match(/<span[^>]*class="pic-text[^"]*"[^>]*>([^<]*)<\/span>/) || content.match(/<span[^>]*>([^<]*)<\/span>/);

            if (href && title) {
                list.push({
                    vod_name: title[1],
                    vod_pic: img?.[1] || '',
                    vod_remarks: remarks?.[1].trim() || '',
                    vod_id: href[1]
                });
            }
        }
        return list;
    },

    async 推荐() {
        const html = await request(this.host + '/zptop/dianying/page/1.html', { headers: this.headers }).catch(() => '');
        return this.parseList(html);
    },

    async 一级(tid, pg, filter, extend) {
        const area = extend?.area || '';
        const path = area || tid;
        const url = `${this.host}/zptop/${path}/page/${pg}.html`;
        const html = await request(url, { headers: this.headers }).catch(() => '');
        return this.parseList(html);
    },

    async 二级(ids) {
        const { input, pdfa, pdfh, pd } = this;
        const html = await request(input, { headers: this.headers }).catch(() => '');
        const VOD = {};

        VOD.vod_name = pdfh(html, '.stui-content__detail h2&&Text') || '';
        VOD.vod_pic = pd(html, '.lazyload&&data-original') || '';
        if (VOD.vod_pic && !VOD.vod_pic.startsWith('http')) VOD.vod_pic = this.host + VOD.vod_pic;
        VOD.vod_content = pdfh(html, '.stui-content__detail p:eq(4)&&Text') || '';

        const detailPs = pdfa(html, '.stui-content__detail p') || [];
        detailPs.forEach(p => {
            const text = pdfh(p, 'Text') || '';
            if (text.includes('导演：')) VOD.vod_director = text.replace('导演：', '').trim();
            else if (text.includes('主演：')) VOD.vod_actor = text.replace('主演：', '').trim();
            else if (text.includes('年份：')) VOD.vod_year = text.replace('年份：', '').trim();
            else if (text.includes('地区：')) VOD.vod_area = text.replace('地区：', '').trim();
            else if (text.includes('类型：')) VOD.vod_class = text.replace('类型：', '').trim();
        });

        const arts = pdfa(html, '.stui-pannel__head') || [];
        const conts = pdfa(html, '.stui-content__playlist') || [];
        const playmap = {};

        conts.forEach((cont, i) => {
            const form = arts[i] ? (pdfh(arts[i], 'h3&&Text') || `线路${i + 1}`) : `线路${i + 1}`;
            const items = pdfa(cont, 'ul&&li') || [];
            const playItems = [];
            items.forEach(item => {
                const title = pdfh(item, 'a&&Text');
                const url = pd(item, 'a&&href', input);
                title && url && playItems.push(`${title}$${url}`);
            });
            playItems.length && (playmap[form] = playItems);
        });

        VOD.vod_play_from = Object.keys(playmap).join('$$$');
        VOD.vod_play_url = Object.values(playmap).map(list => list.join('#')).join('$$$');
        return VOD;
    },

    async 搜索() {
        const { input, pdfa, pdfh, pd } = this;
        const html = await request(input, { headers: this.headers }).catch(() => '');
        const d = [];
        let data = pdfa(html, '.stui-vodlist__media li') || [];
        data.length === 0 && (data = pdfa(html, '.stui-vodlist li') || []);

        data.forEach(it => {
            const title = pdfh(it, 'h2&&title') || pdfh(it, 'a&&title') || pdfh(it, 'h2&&Text');
            const url = pd(it, '.detail a&&href', input) || pd(it, 'a&&href', input);
            const pic = pd(it, 'a&&data-original', input);
            const remarks = pdfh(it, '.pic-text&&Text') || pdfh(it, 'span&&Text') || '';
            title && url && d.push({ vod_name: title, vod_pic: pic, vod_remarks: remarks, vod_id: url });
        });
        return d;
    },

    async lazy(flag, id) {
        const detailUrl = String(id || this.input || '').split('@')[0];
        if (!detailUrl) return { parse: 0, url: '' };

        const html = await request(detailUrl, { headers: this.headers }).catch(() => '');
        let m = html.match(/player_\w+\s*=\s*(\{[\s\S]*?\})\s*<\/script>/) || html.match(/player_\w+\s*=\s*(\{[\s\S]*?\})\s*;/);
        if (!m) return { parse: 0, url: '' };

        let player = {};
        try {
            player = JSON.parse(m[1]);
        } catch {
            const u = m[1].match(/url\s*:\s*['"]([^'"]*)['"]/);
            const f = m[1].match(/from\s*:\s*['"]([^'"]*)['"]/);
            const e = m[1].match(/encrypt\s*:\s*['"]?(\d+)['"]?/);
            player = { url: u?.[1] || '', from: f?.[1] || '', encrypt: e?.[1] || '2' };
        }
        if (!player.url) return { parse: 0, url: '' };

        let url = player.url;
        const encrypt = String(player.encrypt || '2');
        if (encrypt === '1') url = unescape(url);
        else if (encrypt === '2') url = unescape(base64Decode(url));
        else if (encrypt === '3') url = base64Decode(url);
        const from = player.from || '';

        if (from === 'alizy') {
            const r = await request(`https://jx.anje.cn/?url=${url}`, { headers: this.headers }).catch(() => '');
            const m2 = r.match(/"url":"(.*?)"/);
            m2 && (url = m2[1]);
        } else if (['mgtv', 'qq', 'qiyi', 'sohu', 'youku'].includes(from)) {
            const ref = 'https://jhjx.anje.cn/api/?url=';
            const r1 = await request(ref + url, { headers: { Referer: this.host, 'User-Agent': this.headers['User-Agent'] } }).catch(() => '');
            const parse1 = (r1.match(/src="([^"]*)"/) || [])[1];
            if (parse1) {
                const r2 = await request(`https://jhjx.anje.cn/api/${parse1}`, { headers: { Referer: ref + url, 'User-Agent': this.headers['User-Agent'] } }).catch(() => '');
                const src = r2.match(/<source[^>]*src="([^"]*)"/);
                src && (url = src[1] + '#isVideo=true#');
            }
        } else if (from === 'leduo') {
            const r = await request(`https://api.leduotv.com/wp-api/glid.php?vid=${url}&isDp=1`).catch(() => '');
            const m2 = r.match(/url='(.*?)'/);
            m2 && (url = m2[1] + '#isVideo=true#');
        } else if (from === 'sohu') {
            const r = await request(`https://api.yueliangjx.com/?url=${url}`).catch(() => '');
            const m2 = r.match(/url = '(.*?)'/);
            m2 && (url = base64Decode(m2[1]) + '#isVideo=true#');
        }
        return { parse: 0, url };
    }
};
