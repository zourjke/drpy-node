/*
@header({
  searchable: 1,
  filterable: 1,
  quickSearch: 0,
  title: '红果短剧[短]',
  '类型': '短剧',
  lang: 'ds'
})
*/

// 红果短剧：官网(hongguoduanju.com) SSR 数据做分类/搜索/详情，
// 播放走已安装的 hongguo-bridge 插件（签名+CENC解密+MP4缓存，302 到本地解密文件）。
// HG_BRIDGE 是【主服务→插件】的本机通信地址（默认 127.0.0.1:9877，即插件 params 端口）；插件跨机部署时改成插件机器可达地址。
// 壳子播放走的是主服务 /proxy 门面地址（lazy 用 requestHost 拼），与该常量无关。
const SITE = 'https://hongguoduanju.com';
const HG_BRIDGE = 'http://127.0.0.1:9877';
const EPISODE_PREFIX = 'hg-episode-v1:';
const UA = 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const CLASSES = [
    {type_id: 'all', type_name: '短剧'},
    {type_id: 'latest', type_name: '最新'},
    {type_id: 'hot', type_name: '最热'},
    {type_id: 'male', type_name: '男频'},
    {type_id: 'female', type_name: '女频'},
];

const FILTER_GROUPS = [
    {key: 'topic', name: '主题', value: [
        {n: '全部', v: ''}, {n: '现言', v: 'cate_1021'}, {n: '女性成长', v: 'cate_1048'},
        {n: '脑洞', v: 'cate_262'}, {n: '奇幻', v: 'cate_1020'}, {n: '玄幻', v: 'cate_1019'},
        {n: '古言', v: 'cate_439'}, {n: '战神', v: 'cate_1038'}, {n: '宫斗', v: 'cate_246'},
        {n: '仙侠', v: 'cate_1013'}, {n: '权谋', v: 'cate_1047'}, {n: '种田', v: 'cate_1180'},
        {n: '年代爱情', v: 'cate_1022'}, {n: '悬疑', v: 'cate_165'}, {n: '喜剧', v: 'cate_303'},
        {n: '青春', v: 'cate_297'}, {n: '志怪', v: 'cate_1027'}, {n: '民国爱情', v: 'cate_1025'},
        {n: '灵异', v: 'cate_751'}, {n: '家国情怀', v: 'cate_1235'}, {n: '法律', v: 'cate_1136'},
        {n: '刑侦', v: 'cate_1148'}, {n: '抗战', v: 'cate_504'}, {n: '武侠', v: 'cate_1172'},
        {n: '民国传奇', v: 'cate_1240'}, {n: '求生', v: 'cate_1168'}, {n: '动作', v: 'cate_302'},
        {n: '科幻', v: 'cate_1092'}, {n: '恐怖', v: 'cate_1219'}, {n: '商战', v: 'cate_1225'},
    ]},
    {key: 'background', name: '背景', value: [
        {n: '全部', v: ''}, {n: '现代', v: 'cate_757'}, {n: '都市', v: 'cate_1'},
        {n: '古代', v: 'cate_758'}, {n: '乡村', v: 'cate_11'}, {n: '年代', v: 'cate_79'},
        {n: '架空', v: 'cate_452'}, {n: '职场', v: 'cate_127'}, {n: '民国', v: 'cate_390'},
        {n: '校园', v: 'cate_4'}, {n: '宫廷', v: 'cate_1153'}, {n: '荒岛', v: 'cate_1162'},
    ]},
    {key: 'setting', name: '设定', value: [
        {n: '全部', v: ''}, {n: '打脸虐渣', v: 'cate_1051'}, {n: '大男主', v: 'cate_1207'},
        {n: '大女主', v: 'cate_760'}, {n: '马甲', v: 'cate_266'}, {n: '重生', v: 'cate_36'},
        {n: '穿越', v: 'cate_37'}, {n: '系统', v: 'cate_19'}, {n: '先婚后爱', v: 'cate_265'},
        {n: '家长里短', v: 'cate_862'}, {n: '小人物', v: 'cate_1010'}, {n: '破镜重圆', v: 'cate_475'},
        {n: '神豪', v: 'cate_20'}, {n: '豪门', v: 'cate_936'}, {n: '强者回归', v: 'cate_1045'},
        {n: '异能', v: 'cate_598'}, {n: '虐恋', v: 'cate_1008'}, {n: '传承觉醒', v: 'cate_1007'},
        {n: '医生', v: 'cate_487'}, {n: '强强联合', v: 'cate_1049'}, {n: '赘婿逆袭', v: 'cate_1044'},
        {n: '甜宠', v: 'cate_96'}, {n: '娱乐圈', v: 'cate_43'}, {n: '神医', v: 'cate_26'},
        {n: '青梅竹马', v: 'cate_387'}, {n: '姐弟恋', v: 'cate_762'}, {n: '玄学', v: 'cate_929'},
        {n: '追妻火葬场', v: 'cate_616'}, {n: '业界精英', v: 'cate_1293'}, {n: '一见钟情', v: 'cate_477'},
        {n: '福宝', v: 'cate_1291'}, {n: '捞偏门', v: 'cate_1287'}, {n: '反派主角', v: 'cate_1042'},
        {n: '萌宠', v: 'cate_428'}, {n: '双向救赎', v: 'cate_1200'}, {n: '方言', v: 'cate_1255'},
        {n: '白月光', v: 'cate_615'}, {n: '灵魂互换', v: 'cate_831'}, {n: '病娇', v: 'cate_380'},
        {n: '暴富', v: 'cate_1191'}, {n: '黑道', v: 'cate_826'}, {n: '丧尸', v: 'cate_582'},
        {n: '特种兵', v: 'cate_375'},
    ]},
    {key: 'time', name: '时间', value: [
        {n: '全部', v: ''}, {n: '7天内上新', v: '1'}, {n: '14天内上新', v: '2'},
        {n: '30天内上新', v: '3'}, {n: '90天内上新', v: '4'},
    ]},
];

// 提取 SSR 页面的 _ROUTER_DATA JSON：起点做括号平衡扫描（含字符串转义），逐字对应 py 的 raw_decode
function extractRouterData(html) {
    const m = (html || '').match(/(?:window\.)?_ROUTER_DATA\s*=\s*/);
    if (!m) return {};
    const start = m.index + m[0].length;
    let depth = 0, inStr = false, esc = false, end = -1;
    for (let i = start; i < html.length; i++) {
        const c = html[i];
        if (inStr) {
            if (esc) esc = false;
            else if (c === '\\') esc = true;
            else if (c === '"') inStr = false;
            continue;
        }
        if (c === '"') inStr = true;
        else if (c === '{' || c === '[') depth++;
        else if (c === '}' || c === ']') {
            depth--;
            if (depth === 0) {
                end = i + 1;
                break;
            }
        }
    }
    if (end < 0) return {};
    try {
        const v = JSON.parse(html.slice(start, end));
        return v && typeof v === 'object' ? v : {};
    } catch (e) {
        return {};
    }
}

async function fetchRouterData(path) {
    const html = await request(SITE + path, {headers: {'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9'}});
    return extractRouterData(html);
}

function mapItem(x) {
    x = x || {};
    const vd = (x.video_data && typeof x.video_data === 'object') ? x.video_data : x;
    const sid = String(vd.series_id || x.keyword || '');
    const name = String(vd.series_title || vd.series_name || x.name || '未命名');
    const count = vd.episode_cnt || 0;
    return {
        title: name,
        img: String(vd.series_cover || ''),
        desc: count ? ('全' + count + '集') : '',
        url: sid,
    };
}

function toInt(v, def) {
    const n = parseInt(v, 10);
    return isNaN(n) ? def : n;
}

var rule = {
    title: '红果短剧[短]',
    host: SITE,
    // 惯例占位：drpyS 前置 parse（searchParse/cateParse）在 searchUrl/url 缺失时直接放弃调用源方法（返回空对象）
    url: '/category',
    searchUrl: '/search/**',
    play_parse: true,
    searchable: 1,
    filterable: 1,
    quickSearch: 0,
    class_parse: async function () {
        const filters = {};
        CLASSES.forEach(c => {
            filters[c.type_id] = FILTER_GROUPS;
        });
        return {class: CLASSES, filters};
    },
    推荐: async function () {
        try {
            const router = await fetchRouterData('/category?tab=1&sort_type=2');
            const page = (router.loaderData || {}).category_page || {};
            const rows = page.recommendList || [];
            return setResult(rows.slice(0, 10).map(mapItem));
        } catch (e) {
            log('红果推荐出错: ' + e.message);
            return setResult([]);
        }
    },
    一级: async function (tid, pg, filter, extend) {
        const page = toInt(pg, 1);
        const q = {tab: '1', sort_type: '1'};
        if (tid === 'latest') q.sort_type = '2';
        else if (tid === 'hot') q.sort_type = '1';
        else if (tid === 'male') q.gender = '1';
        else if (tid === 'female') q.gender = '2';
        if (typeof extend === 'string' && extend) {
            try {
                extend = JSON.parse(extend);
            } catch (e) {
                extend = {};
            }
        }
        if (extend && typeof extend === 'object') {
            Object.keys(extend).forEach(k => {
                const v = extend[k];
                if (v && String(v) !== '' && String(v) !== 'all' && String(v) !== '0') q[k] = String(v);
            });
        }
        if (page > 1) q.page = String(page);
        const qs = Object.keys(q).map(k => k + '=' + encodeURIComponent(q[k])).join('&');
        try {
            const router = await fetchRouterData('/category?' + qs);
            const p = (router.loaderData || {}).category_page || {};
            const rows = p.recommendList || [];
            return setResult(rows.map(mapItem));
        } catch (e) {
            log('红果一级出错: ' + e.message);
            return setResult([]);
        }
    },
    二级: async function () {
        const {orId} = this;
        const sid = String(orId || '').replace('hg-series-v1:', '');
        try {
            const router = await fetchRouterData('/detail?series_id=' + encodeURIComponent(sid));
            const p = (router.loaderData || {}).detail_page || {};
            const s = p.seriesDetail || {};
            const vids = s.vid_list || [];
            const actors = (s.celebrities || []).map(c => String(c.nickname || '')).filter(n => n);
            const eps = vids.map((v, i) => '第' + (i + 1) + '集$' + EPISODE_PREFIX + v).join('#');
            return {
                vod_id: sid,
                vod_name: String(s.series_name || ''),
                vod_pic: String(s.series_cover || ''),
                vod_year: '',
                vod_area: '',
                vod_director: '',
                vod_actor: actors.join(','),
                vod_content: String(s.series_intro || ''),
                vod_remarks: String(s.episode_right_text || ''),
                vod_play_from: '红果',
                vod_play_url: eps,
            };
        } catch (e) {
            log('红果二级出错: ' + e.message);
            return {
                vod_id: sid,
                vod_name: '详情获取失败',
                vod_pic: '',
                vod_content: '',
                vod_play_from: '红果',
                vod_play_url: '',
            };
        }
    },
    搜索: async function (key, quick, pg) {
        try {
            // 官网搜索结果固定 10 条，翻页由 SSR 自身控制；pg 仅做兼容
            const router = await fetchRouterData('/search/' + encodeURIComponent(key));
            const pageData = (router.loaderData || {})['search_(keyword)/page'] || {};
            const rows = pageData.searchList || [];
            return setResult(rows.map(mapItem));
        } catch (e) {
            log('红果搜索出错: ' + e.message);
            return setResult([]);
        }
    },
    lazy: async function (flag, id) {
        // 播放 id：hg-episode-v1:<数字vid> → 主服务 /proxy 门面（壳子一定可达主服务，
        // 直连插件的 127.0.0.1:9877 只有本机能用）；proxy_rule 转发插件解析后 302 到 mediaProxy 流式转发
        const vid = String(id || '').replace(EPISODE_PREFIX, '').trim();
        if (!/^\d+$/.test(vid)) {
            return {parse: 0, url: 'toast://播放引用无效（vid 需为数字）'};
        }
        const playUrl = this.requestHost + '/proxy/' + encodeURIComponent('红果短剧[短]') + '/?do=hg&vid=' + vid + '#.mp4';
        // 预热：提前触发插件解密（不等待），壳子随后请求播放地址时大概率已命中缓存
        req(`${HG_BRIDGE}/resolve?vid=${vid}`, {timeout: 120000}).catch(() => {});
        return {parse: 0, url: playUrl};
    },
    proxy_rule: async function (params) {
        if (params.do !== 'hg') return [404, 'text/plain', 'not found'];
        const vid = String(params.vid || '').trim();
        if (!/^\d+$/.test(vid)) return [400, 'text/plain', 'bad vid'];
        // 插件 /resolve 同步完成 签名→下载→CENC解密 并返回本地缓存地址（首次解密耗时数十秒，之后命中缓存秒回）
        // 首次解密耗时可达数十秒，req 默认 5s 超时会掐断，放大到 120s
        const resp = await req(`${HG_BRIDGE}/resolve?vid=${vid}`, {timeout: 120000});
        if (resp.code !== 200) return [502, 'text/plain', '红果桥解析失败: ' + resp.code];
        let srcUrl = '';
        try {
            srcUrl = String(JSON.parse(resp.content).url || '');
        } catch (e) {
            return [502, 'text/plain', '红果桥响应异常'];
        }
        if (!srcUrl.startsWith('http')) return [502, 'text/plain', '未取得解密地址'];
        // toBytes=2：主服务 302 到 /mediaProxy 流式转发插件里的解密 mp4（支持 Range/拖动）
        return [200, 'video/mp4', srcUrl, {}, 2];
    },
};
