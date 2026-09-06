/*
@header({
  searchable: 1,
  filterable: 0,
  quickSearch: 0,
  title: '哔哩有声',
  '类型': '影视',
  logo: 'https://img01.sogoucdn.com/v2/thumb/retype_exclude_gif/ext/auto/q/79/crop/xy/ai/w/128/h/128/resize/w/128?url=http%3A%2F%2Fpp.myapp.com%2Fma_icon%2F0%2Ficon_73622_1691575154%2F256&appid=201003&sign=c1faea8b5ba7bc3357e154fd1c83df32',
  lang: 'ds'
})
*/

// --- Wbi签名工具 ---
const mixinKeyEncTab = [46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52];
const encWbi = (params, img_key, sub_key) => {
    let mixin_key = ((orig) => {
        let temp = "";
        mixinKeyEncTab.forEach((n) => (temp += orig[n]));
        return temp.slice(0, 32);
    })(img_key + sub_key);
    let curr_time = Math.round(Date.now() / 1000), chr_filter = /[!'\(\)*]/g;
    let query = [];
    Object.assign(params, { wts: curr_time });
    Object.keys(params).sort().forEach((key) => {
        query.push(encodeURIComponent(key) + "=" + encodeURIComponent(("" + params[key]).replace(chr_filter, "")));
    });
    let qs = query.join("&");
    return qs + "&w_rid=" + md5(qs + mixin_key);
};

const getWbiKeys = async (headers) => {
    try {
        let json = JSON.parse(await request("https://api.bilibili.com/x/web-interface/nav", { headers: headers })).data.wbi_img;
        return {
            img_key: json.img_url.slice(json.img_url.lastIndexOf("/") + 1, json.img_url.lastIndexOf(".")),
            sub_key: json.sub_url.slice(json.sub_url.lastIndexOf("/") + 1, json.sub_url.lastIndexOf("."))
        };
    } catch (e) { return { img_key: "7cd084941338484aae1ad9425b84077c", sub_key: "4932caff0ff746eab6f01bf08b70ac45" }; }
};

// 极简请求封装
const req = async (url, cookie) => {
    let h = Object.assign({}, rule.headers);
    if(cookie) h.Cookie = cookie;
    try { return JSON.parse(await request(url, { headers: h })); } catch (e) { return null; }
};

// --- 数据格式化 ---
const formatVod = (v) => ({
    vod_id: v.bvid || v.aid,
    vod_name: v.title.replace(/<[^>]+>/g, ""),
    vod_pic: (v.pic.startsWith("//") ? "https:" : "") + v.pic,
    // 恢复原来的 remarks 风格：播放量 + 点赞量
    vod_remarks: "▶️" + (v.play || v.stat?.view || 0) + "  ❤️" + (v.like || v.stat?.like || 0),
    vod_content: v.description || ""
});

var rule = {
    title: '哔哩有声',
    host: 'https://api.bilibili.com',
    logo: 'https://img01.sogoucdn.com/v2/thumb/retype_exclude_gif/ext/auto/q/79/crop/xy/ai/w/128/h/128/resize/w/128?url=http%3A%2F%2Fpp.myapp.com%2Fma_icon%2F0%2Ficon_73622_1691575154%2F256&appid=201003&sign=c1faea8b5ba7bc3357e154fd1c83df32',
    class_name: '有声小说&有声漫画&广播剧&经典老歌&音乐推荐',
    class_url: '有声小说&有声漫画&广播剧&经典老歌&音乐推荐',
    searchUrl: '/x/web-interface/search/type?search_type=video&keyword=**&page=fypage',
    searchable: 1,
    quickSearch: 0,
    headers: { 
        'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", 
        'Referer': 'https://www.bilibili.com/' 
    },
    timeout: 5000,
    play_parse: true,

    预处理: async function() {
        let c = ENV.get('bili_cookie');
        if (c) rule.headers.Cookie = c;
    },

    一级: async function(tid, pg) {
        let c = ENV.get('bili_cookie');
        let getUrl = async (cookie) => {
            let h = Object.assign({}, rule.headers);
            if(cookie) h.Cookie = cookie;
            let k = await getWbiKeys(h);
            let q = encWbi({ page: pg || 1, page_size: 40, keyword: tid, search_type: "video" }, k.img_key, k.sub_key);
            return `https://api.bilibili.com/x/web-interface/wbi/search/all/v2?${q}`;
        };

        let res = await req(await getUrl(c), c);
        if (!res || res.code !== 0) res = await req(await getUrl(""), "");

        let list = res?.data?.result?.find(i => i.result_type === 'video')?.data || 
                   res?.data?.result?.[res.data.result.length - 1]?.data || [];
        return list.map(formatVod);
    },

    二级: async function(ids) {
        let id = this.input || this.orId || ids;
        if (!id) return { vod_name: "ID获取失败" };
        
        let type = id.toString().startsWith('BV') ? 'bvid' : 'aid';
        let res = await req(`https://api.bilibili.com/x/web-interface/view/detail?${type}=${id}`, ENV.get('bili_cookie'));
        let view = res?.data?.View;
        
        if (!view) return { vod_name: "获取详情失败" };

        return {
            vod_id: id,
            vod_name: view.title,
            vod_pic: (view.pic.startsWith("//") ? "https:" : "") + view.pic,
            type_name: view.tname,
            vod_remarks: view.owner?.name || "",
            vod_content: view.desc,
            vod_director: view.owner?.name || "",
            vod_play_from: "Bilibili",
            vod_play_url: (view.pages || []).map(p => `${p.part.replace(/\$/g, "")}$${view.aid}+${p.cid}`).join('#')
        };
    },

    搜索: async function() {
        let res = await req(this.input, ENV.get('bili_cookie'));
        return (res?.data?.result || []).filter(v => v.type == 'video').map(formatVod);
    },

    lazy: async function() {
        let [avid, cid] = (this.input || "").split("+");
        let getUrl = (qn) => `https://api.bilibili.com/x/player/playurl?avid=${avid}&cid=${cid}&qn=${qn}&type=mp4&platform=html5`;
        
        let res = await req(getUrl(116), ENV.get('bili_cookie'));
        if (!res || res.code !== 0) res = await req(getUrl(64), "");

        let u = res?.data?.durl?.[0]?.url || "";
        let q = res?.data?.quality;
        let desc = res?.data?.accept_description?.[res?.data?.accept_quality?.indexOf(q)] || "默认";

        return {
            parse: 0,
            url: u,
            header: rule.headers,
            extra: { definitions: [{ format: "mp4", url: u, description: desc }] }
        };
    }
};