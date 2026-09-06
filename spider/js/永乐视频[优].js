/*
@header({
  searchable: 1,
  filterable: 1,
  quickSearch: 1,
  title: '永乐视频',
  author: 'EylinSir',
  类型: '影视',
  logo: 'https://www.59v.net/upload/mxprocms/20240814-1/aaffa0a72bcf154036bf15df4b1571f8.png',
  lang: 'ds',
})
*/

var rule = {
    author: 'EylinSir',
    title: '永乐视频',
    host: 'https://www.ylys.tv',
    url: '/',
    logo:'https://www.59v.net/upload/mxprocms/20240814-1/aaffa0a72bcf154036bf15df4b1571f8.png',
    searchUrl: '/vodsearch/**----------fypage---/',
    searchable: 1,
    quickSearch: 1,
    filterable: 1,
    timeout: 5000,
    play_parse: true,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.ylys.tv/'
    },
    class_name: '电影&剧集&综艺&动漫',
    class_url: '1&2&3&4',

    fixUrl: function (url) {
        if (!url) return '';
        if (url.startsWith('http')) return url;
        return this.host + (url.startsWith('/') ? url : '/' + url);
    },

    parseList: function (html) {
        const videos = [];
        const re = /<a href="\/voddetail\/(\d+)\/".*?title="([^"]+)".*?<div class="module-item-note">([^<]+)<\/div>.*?data-original="([^"]+)"/gs;
        let match;
        while ((match = re.exec(html)) !== null) {
            videos.push({
                title: match[2].trim(),
                pic_url: this.fixUrl(match[4]),
                desc: match[3].trim(),
                url: '/voddetail/' + match[1] + '/',
            });
        }
        return videos;
    },

    推荐: async function () {
        const html = await request(this.host);
        return setResult(this.parseList(html));
    },

    一级: async function (tid, pg, filter, extend) {
        const classId = extend?.class || tid;
        const year = extend?.year || '';
        const url = `${this.host}/vodshow/${classId}--------${pg}---${year}/`;
        const html = await request(url, { headers: this.headers });
        return setResult(this.parseList(html));
    },

    二级: async function (ids) {
        const html = await request(this.input, { headers: this.headers });
        if (!html) return { list: [] };
        const playFrom = pdfa(html, ".module-tab-item").map(it => (it.match(/<span>(.*?)<\/span>/) || ["","线路"])[1]).join('$$$');
        const playUrl = pdfa(html, ".module-play-list-content")
            .map(list => pdfa(list, "a")
                .map(a => {
                    const name = (a.match(/<span>(.*?)<\/span>/) || ["","播放"])[1];
                    const vid = (a.match(/href="\/play\/(.*?)\//) || ["", ""])[1];
                    return `${name}$${vid}`;
                })
                .join('#')
            )
            .join('$$$');

        if (!playFrom || !playUrl) return { list: [] };

        const vod_name = (html.match(/<h1>(.*?)<\/h1>/) || ["", ""])[1];
        const vod_pic = this.fixUrl((html.match(/data-original="(.*?)"/) || ["", ""])[1]);
        const vod_content = (html.match(/introduction-content">.*?<p>(.*?)<\/p>/s) || ["", ""])[1]?.replace(/<.*?>/g, "") || "暂无简介";
        const vod_year = (html.match(/href="\/vodshow\/\d+-----------(\d{4})\//) || ["", ""])[1] || "";
        const vod_director = (html.match(/导演：.*?<a[^>]*>([^<]+)<\/a>/) || ["", ""])[1] || "";
        const vod_actor = [...html.matchAll(/主演：.*?<a[^>]*>([^<]+)<\/a>/g)]
            .map(m => m[1])
            .filter(Boolean)
            .join(" / ");

        return {
            vod_name, vod_pic, vod_content, vod_year, vod_director, vod_actor,
            vod_play_from: playFrom,
            vod_play_url: playUrl
        };
    },

    搜索: async function (wd, quick, pg) {
        const html = await request(`${this.host}/vodsearch/${encodeURIComponent(wd)}----------${pg}---/`, { headers: this.headers });
        const items = pdfa(html, '.module-card-item.module-item');
        const videos = items.map(it => {
            const title = pdfh(it, '.module-card-item-title a&&Text');
            const href = pd(it, 'a&&href');
            const pic = this.fixUrl(pd(it, '.module-item-pic img&&data-original') || pd(it, '.module-item-pic img&&src'));
            const desc = pdfh(it, '.module-item-note&&Text') || '';
            return title && href ? { title: title.trim(), pic_url: pic, desc: desc.trim(), url: href } : null;
        }).filter(Boolean);
        return setResult(videos);
    },

    lazy: async function () {
        const id = this.input;
        const url = `${this.host}/play/${id}/`;
        const html = await request(url, { headers: this.headers });
        const m3u8 = html.match(/"url":"([^"]+\.m3u8)"/)?.[1];
        if (m3u8) {
            return { jx: 0, parse: 0, url: m3u8.replace(/\\/g, ""), header: this.headers };
        }
        return { jx: 0, parse: 1, url, header: this.headers };
    },

    filter: {
        "1": [
            { key: "class", name: "类型", value: [{ n: "全部", v: "" }, { n: "动作片", v: "6" }, { n: "喜剧片", v: "7" }, { n: "爱情片", v: "8" }, { n: "科幻片", v: "9" }, { n: "恐怖片", v: "11" }] },
            { key: "year", name: "年份", value: [{ n: "全部", v: "" }].concat(Array.from({ length: 15 }, (_, i) => ({ n: `${2025 - i}`, v: `${2025 - i}` }))) }
        ],
        "2": [
            { key: "class", name: "类型", value: [{ n: "全部", v: "" }, { n: "国产剧", v: "13" }, { n: "港台剧", v: "14" }, { n: "日剧", v: "15" }, { n: "韩剧", v: "33" }, { n: "欧美剧", v: "16" }] },
            { key: "year", name: "年份", value: [{ n: "全部", v: "" }].concat(Array.from({ length: 15 }, (_, i) => ({ n: `${2025 - i}`, v: `${2025 - i}` }))) }
        ],
        "3": [
            { key: "class", name: "类型", value: [{ n: "全部", v: "" }, { n: "内地综艺", v: "27" }, { n: "港台综艺", v: "28" }, { n: "日本综艺", v: "29" }, { n: "韩国综艺", v: "36" }] },
            { key: "year", name: "年份", value: [{ n: "全部", v: "" }].concat(Array.from({ length: 15 }, (_, i) => ({ n: `${2025 - i}`, v: `${2025 - i}` }))) }
        ],
        "4": [
            { key: "class", name: "类型", value: [{ n: "全部", v: "" }, { n: "国产动漫", v: "31" }, { n: "日本动漫", v: "32" }, { n: "欧美动漫", v: "42" }, { n: "其他动漫", v: "43" }] },
            { key: "year", name: "年份", value: [{ n: "全部", v: "" }].concat(Array.from({ length: 15 }, (_, i) => ({ n: `${2025 - i}`, v: `${2025 - i}` }))) }
        ]
    },

    filter_def: {
        "1": { cateId: "1" },
        "2": { cateId: "2" },
        "3": { cateId: "3" },
        "4": { cateId: "4" }
    }
};
