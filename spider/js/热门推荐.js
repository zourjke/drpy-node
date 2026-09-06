/*
@header({
  searchable: 0,
  filterable: 1,
  quickSearch: 0,
  title: '豆瓣',
  author: 'EylinSir',
  类型: '影视',
  logo: 'https://pic.962.net/up/2016-8/20168101133106777.png',
  lang: 'ds',
})
*/
    // 依赖豆瓣 frodo API（微信小程序接口），提供分类浏览、搜索、详情
    // 豆瓣本身无播放源，点击播放返回 parse:1 触发搜索聚合（由其他源提供播放）

const API_KEY = '0ac44ae016490db2204ce0a042db2916';
const BASE_URL = 'https://frodo.douban.com/api/v2';
const HEADERS = {
    'Host': 'frodo.douban.com',
    'Connection': 'Keep-Alive',
    'Referer': 'https://servicewechat.com/wx2f9b06c1de1ccfca/84/page-frame.html',
    'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/53.0.2785.143 Safari/537.36 MicroMessenger/7.0.9.501 NetType/WIFI MiniProgramEnv/Windows WindowsWechat'
};
const PIC_SUFFIX = '@Referer=https://api.douban.com/@User-Agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36';

const CATEGORY_CONFIG = {
    hot_gaia:       { path: '/movie/hot_gaia', sort: 'recommend', area: '全部' },
    tv_hot:         { collection: 'type', default: 'tv_hot' },
    show_hot:       { collection: 'type', default: 'show_hot' },
    rank_list_movie:{ collection: '榜单', default: 'movie_real_time_hotest' },
    rank_list_tv:   { collection: '榜单', default: 'tv_real_time_hotest' },
    anime_hot:      { recommend: 'tv', tags: 'anime', noPicFilter: true },
    tv:             { recommend: 'tv', tags: 'tv' },
    movie:          { recommend: 'movie', tags: 'movie' },
};

var rule = {
    title: '豆瓣',
    author: 'EylinSir',
    类型: '影视',
    host: BASE_URL,
    searchUrl: '',
    headers: HEADERS,
    searchable: 0,
    quickSearch: 0,
    filterable: 1,
    play_parse: true,
    timeout: 10000,

    class_name: '热门电影&热播剧集&热门动漫&热播综艺&电影筛选&电视筛选&电影榜单&电视剧榜单',
    class_url: 'hot_gaia&tv_hot&anime_hot&show_hot&movie&tv&rank_list_movie&rank_list_tv',

    filter: {
        'hot_gaia': [
            { 'key': 'sort', 'name': '排序', 'value': [{'n':'热度','v':'recommend'},{'n':'最新','v':'time'},{'n':'评分','v':'rank'}] },
            { 'key': 'area', 'name': '地区', 'value': [{'n':'全部','v':'全部'},{'n':'华语','v':'华语'},{'n':'欧美','v':'欧美'},{'n':'韩国','v':'韩国'},{'n':'日本','v':'日本'}] }
        ],
        'tv_hot': [
            { 'key': 'type', 'name': '分类', 'value': [{'n':'综合','v':'tv_hot'},{'n':'国产剧','v':'tv_domestic'},{'n':'欧美剧','v':'tv_american'},{'n':'日剧','v':'tv_japanese'},{'n':'韩剧','v':'tv_korean'},{'n':'动画','v':'tv_animation'}] }
        ],
        'anime_hot': [
            { 'key': '类型', 'name': '类型', 'value': [{'n':'全部','v':''},{'n':'热血','v':'热血'},{'n':'搞笑','v':'搞笑'},{'n':'恋爱','v':'恋爱'},{'n':'校园','v':'校园'},{'n':'科幻','v':'科幻'},{'n':'奇幻','v':'奇幻'},{'n':'悬疑','v':'悬疑'},{'n':'治愈','v':'治愈'},{'n':'运动','v':'运动'},{'n':'机甲','v':'机甲'},{'n':'少女','v':'少女'},{'n':'少年','v':'少年'}] },
            { 'key': '地区', 'name': '地区', 'value': [{'n':'全部','v':''},{'n':'日本','v':'日本'},{'n':'中国大陆','v':'中国大陆'},{'n':'美国','v':'美国'},{'n':'韩国','v':'韩国'},{'n':'英国','v':'英国'},{'n':'法国','v':'法国'}] },
            { 'key': 'sort', 'name': '排序', 'value': [{'n':'近期热度','v':'T'},{'n':'首播时间','v':'R'},{'n':'高分优先','v':'S'}] },
            { 'key': '年代', 'name': '年代', 'value': [{'n':'全部','v':''},{'n':'2026','v':'2026'},{'n':'2025','v':'2025'},{'n':'2024','v':'2024'},{'n':'2023','v':'2023'},{'n':'2022','v':'2022'},{'n':'2021','v':'2021'},{'n':'2020','v':'2020'},{'n':'2019','v':'2019'},{'n':'2010年代','v':'2010年代'},{'n':'2000年代','v':'2000年代'},{'n':'90年代','v':'90年代'},{'n':'更早','v':'更早'}] }
        ],
        'show_hot': [
            { 'key': 'type', 'name': '分类', 'value': [{'n':'综合','v':'show_hot'},{'n':'国内','v':'show_domestic'},{'n':'国外','v':'show_foreign'}] }
        ],
        'movie': [
            { 'key': '类型', 'name': '类型', 'value': [{'n':'全部类型','v':''},{'n':'喜剧','v':'喜剧'},{'n':'爱情','v':'爱情'},{'n':'动作','v':'动作'},{'n':'科幻','v':'科幻'},{'n':'动画','v':'动画'},{'n':'悬疑','v':'悬疑'},{'n':'犯罪','v':'犯罪'},{'n':'惊悚','v':'惊悚'},{'n':'冒险','v':'冒险'},{'n':'音乐','v':'音乐'},{'n':'历史','v':'历史'},{'n':'奇幻','v':'奇幻'},{'n':'恐怖','v':'恐怖'},{'n':'战争','v':'战争'},{'n':'传记','v':'传记'},{'n':'歌舞','v':'歌舞'},{'n':'武侠','v':'武侠'},{'n':'情色','v':'情色'},{'n':'灾难','v':'灾难'},{'n':'西部','v':'西部'},{'n':'纪录片','v':'纪录片'},{'n':'短片','v':'短片'}] },
            { 'key': '地区', 'name': '地区', 'value': [{'n':'全部地区','v':''},{'n':'华语','v':'华语'},{'n':'欧美','v':'欧美'},{'n':'中国','v':'中国'},{'n':'美国','v':'美国'},{'n':'中国香港','v':'中国香港'},{'n':'中国台湾','v':'中国台湾'},{'n':'韩国','v':'韩国'},{'n':'日本','v':'日本'},{'n':'英国','v':'英国'},{'n':'法国','v':'法国'},{'n':'菲律宾','v':'菲律宾'},{'n':'德国','v':'德国'},{'n':'意大利','v':'意大利'},{'n':'西班牙','v':'西班牙'},{'n':'印度','v':'印度'},{'n':'泰国','v':'泰国'},{'n':'俄罗斯','v':'俄罗斯'},{'n':'加拿大','v':'加拿大'},{'n':'澳大利亚','v':'澳大利亚'},{'n':'爱尔兰','v':'爱尔兰'},{'n':'瑞典','v':'瑞典'},{'n':'巴西','v':'巴西'},{'n':'丹麦','v':'丹麦'}] },
            { 'key': 'sort', 'name': '排序', 'value': [{'n':'近期热度','v':'T'},{'n':'首映时间','v':'R'},{'n':'高分优先','v':'S'}] },
            { 'key': '年代', 'name': '年代', 'value': [{'n':'全部年代','v':''},{'n':'2026','v':'2026'},{'n':'2025','v':'2025'},{'n':'2024','v':'2024'},{'n':'2023','v':'2023'},{'n':'2022','v':'2022'},{'n':'2021','v':'2021'},{'n':'2020','v':'2020'},{'n':'2019','v':'2019'},{'n':'2010年代','v':'2010年代'},{'n':'2000年代','v':'2000年代'},{'n':'90年代','v':'90年代'},{'n':'80年代','v':'80年代'},{'n':'70年代','v':'70年代'},{'n':'60年代','v':'60年代'},{'n':'更早','v':'更早'}] }
        ],
        'tv': [
            { 'key': '类型', 'name': '类型', 'value': [{'n':'不限','v':''},{'n':'电视剧','v':'电视剧'},{'n':'综艺','v':'综艺'}] },
            { 'key': '电视剧形式', 'name': '电视剧形式', 'value': [{'n':'不限','v':''},{'n':'喜剧','v':'喜剧'},{'n':'爱情','v':'爱情'},{'n':'悬疑','v':'悬疑'},{'n':'动画','v':'动画'},{'n':'武侠','v':'武侠'},{'n':'古装','v':'古装'},{'n':'家庭','v':'家庭'},{'n':'犯罪','v':'犯罪'},{'n':'科幻','v':'科幻'},{'n':'恐怖','v':'恐怖'},{'n':'历史','v':'历史'},{'n':'战争','v':'战争'},{'n':'动作','v':'动作'},{'n':'冒险','v':'冒险'},{'n':'传记','v':'传记'},{'n':'剧情','v':'剧情'},{'n':'奇幻','v':'奇幻'},{'n':'惊悚','v':'惊悚'},{'n':'灾难','v':'灾难'},{'n':'歌舞','v':'歌舞'},{'n':'音乐','v':'音乐'}] },
            { 'key': '综艺形式', 'name': '综艺形式', 'value': [{'n':'不限','v':''},{'n':'真人秀','v':'真人秀'},{'n':'脱口秀','v':'脱口秀'},{'n':'音乐','v':'音乐'},{'n':'歌舞','v':'歌舞'}] },
            { 'key': '地区', 'name': '地区', 'value': [{'n':'全部地区','v':''},{'n':'华语','v':'华语'},{'n':'欧美','v':'欧美'},{'n':'中国','v':'中国'},{'n':'美国','v':'美国'},{'n':'中国香港','v':'中国香港'},{'n':'韩国','v':'韩国'},{'n':'日本','v':'日本'},{'n':'英国','v':'英国'},{'n':'泰国','v':'泰国'},{'n':'中国台湾','v':'中国台湾'},{'n':'意大利','v':'意大利'},{'n':'法国','v':'法国'},{'n':'德国','v':'德国'},{'n':'西班牙','v':'西班牙'},{'n':'俄罗斯','v':'俄罗斯'},{'n':'瑞典','v':'瑞典'},{'n':'巴西','v':'巴西'},{'n':'丹麦','v':'丹麦'},{'n':'印度','v':'印度'},{'n':'加拿大','v':'加拿大'},{'n':'爱尔兰','v':'爱尔兰'},{'n':'澳大利亚','v':'澳大利亚'}] },
            { 'key': 'sort', 'name': '排序', 'value': [{'n':'近期热度','v':'T'},{'n':'首播时间','v':'R'},{'n':'高分优先','v':'S'}] },
            { 'key': '年代', 'name': '年代', 'value': [{'n':'全部','v':''},{'n':'2026','v':'2026'},{'n':'2025','v':'2025'},{'n':'2024','v':'2024'},{'n':'2023','v':'2023'},{'n':'2022','v':'2022'},{'n':'2021','v':'2021'},{'n':'2020','v':'2020'},{'n':'2019','v':'2019'},{'n':'2010年代','v':'2010年代'},{'n':'2000年代','v':'2000年代'},{'n':'90年代','v':'90年代'},{'n':'80年代','v':'80年代'},{'n':'70年代','v':'70年代'},{'n':'60年代','v':'60年代'},{'n':'更早','v':'更早'}] },
            { 'key': '平台', 'name': '平台', 'value': [{'n':'全部','v':''},{'n':'腾讯视频','v':'腾讯视频'},{'n':'爱奇艺','v':'爱奇艺'},{'n':'优酷','v':'优酷'},{'n':'湖南卫视','v':'湖南卫视'},{'n':'Netflix','v':'Netflix'},{'n':'HBO','v':'HBO'},{'n':'BBC','v':'BBC'},{'n':'NHK','v':'NHK'},{'n':'CBS','v':'CBS'},{'n':'NBC','v':'NBC'},{'n':'tvN','v':'tvN'}] }
        ],
        'rank_list_movie': [
            { 'key': '榜单', 'name': '榜单', 'value': [{'n':'实时热门电影','v':'movie_real_time_hotest'},{'n':'一周口碑电影榜','v':'movie_weekly_best'},{'n':'豆瓣电影Top250','v':'movie_top250'}] }
        ],
        'rank_list_tv': [
            { 'key': '榜单', 'name': '榜单', 'value': [{'n':'实时热门电视','v':'tv_real_time_hotest'},{'n':'华语口碑剧集榜','v':'tv_chinese_best_weekly'},{'n':'全球口碑剧集榜','v':'tv_global_best_weekly'},{'n':'国内口碑综艺榜','v':'show_chinese_best_weekly'},{'n':'国外口碑综艺榜','v':'show_global_best_weekly'}] }
        ]
    },

    getJson: async function(path) {
        try {
            const headers = Object.assign({}, HEADERS);
            if (this.cookie) headers['Cookie'] = this.cookie;
            const res = await req(BASE_URL + path, { method: 'get', headers, timeout: 10000 });
            if (!res || !res.content) return null;
            if (res.headers && res.headers['set-cookie']) {
                this.cookie = Array.isArray(res.headers['set-cookie']) ? res.headers['set-cookie'][0] : res.headers['set-cookie'];
            }
            return JSON.parse(res.content);
        } catch (e) { return null; }
    },

    parseItems: function(items) {
        return (items || []).map(item => ({
            vod_id: 'msearch:' + item.id,
            vod_name: item.title || '',
            vod_pic: (item.pic && item.pic.normal) ? item.pic.normal + PIC_SUFFIX : '',
            vod_remarks: (item.rating && item.rating.value != null) ? '评分：' + item.rating.value : '评分：0'
        }));
    },

    buildTags: function(mode, ext) {
        ext = ext || {};
        const tags = mode === 'anime' ? ['动画'] : [];
        if (ext['类型']) tags.push(ext['类型']);
        if (mode === 'tv') {
            if (ext['电视剧形式']) tags.push(ext['电视剧形式']);
            if (ext['综艺形式']) tags.push(ext['综艺形式']);
        }
        if (ext['地区']) tags.push(ext['地区']);
        if (mode === 'tv' && ext['平台']) tags.push(ext['平台']);
        if (ext['年代']) tags.push(ext['年代']);
        return tags.join(',');
    },

    推荐: async function() {
        const data = await this.getJson('/subject_collection/subject_real_time_hotest/items?apikey=' + API_KEY + '&start=0&count=50');
        if (!data) return [];
        const list = this.parseItems(data.subject_collection_items || []).filter(v => v.vod_pic);
        for (let i = list.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [list[i], list[j]] = [list[j], list[i]];
        }
        return list.slice(0, 20);
    },

    一级: async function(tid, pg, filter, extend) {
        const start = ((parseInt(pg) || 1) - 1) * 20;
        const ext = extend || {};
        const cfg = CATEGORY_CONFIG[tid] || CATEGORY_CONFIG.movie;
        let path, itemsKey = 'items';

        if (cfg.collection) {
            const cid = ext[cfg.collection] || cfg.default;
            path = '/subject_collection/' + cid + '/items?apikey=' + API_KEY + '&start=' + start + '&count=20';
            itemsKey = 'subject_collection_items';
        } else if (cfg.recommend) {
            const tags = this.buildTags(cfg.tags, ext);
            path = '/' + cfg.recommend + '/recommend?apikey=' + API_KEY + '&sort=' + (ext.sort || 'T') + '&tags=' + encodeURIComponent(tags) + '&start=' + start + '&count=20';
        } else {
            path = cfg.path + '?apikey=' + API_KEY + '&sort=' + encodeURIComponent(ext.sort || cfg.sort) + '&area=' + encodeURIComponent(ext.area || cfg.area) + '&start=' + start + '&count=20';
        }

        const data = await this.getJson(path);
        if (!data) return [];
        const list = this.parseItems(data[itemsKey] || []);
        return cfg.noPicFilter ? list : list.filter(v => v.vod_pic);
    },

    二级: async function(ids) {
        const id = String(ids[0] || '').replace(/^msearch:/, '');
        const data = await this.getJson('/subject/' + id + '?apikey=' + API_KEY);
        if (!data) return {};
        const join = arr => (arr && arr.map(x => x.name).join(' / ')) || '';
        return {
            vod_id: ids[0],
            vod_name: data.title || '',
            vod_pic: (data.pic && (data.pic.normal || data.pic.large)) || '',
            vod_remarks: (data.rating && data.rating.value) ? '评分：' + data.rating.value : '评分：0',
            vod_actor: join(data.actors),
            vod_director: join(data.directors),
            vod_content: data.intro || '',
            vod_year: data.year ? String(data.year) : '',
            vod_area: (data.countries && data.countries.join(' / ')) || '',
            vod_play_from: '豆瓣详情',
            vod_play_url: '暂无播放源$#'
        };
    },

    lazy: async function(flag, id) {
        return { parse: 1, url: '' };
    },
};

