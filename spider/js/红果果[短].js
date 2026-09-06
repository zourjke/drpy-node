/*
@header({
  searchable: 1,
  filterable: 1,
  quickSearch: 1,
  title: '红果果[短]',
  '类型': '短剧',
  lang: 'ds'
})
*/

// 红果果[短]：全自包含红果短剧源（不依赖 hongguo-bridge 等本地插件）。
// 数据层：官网(hongguoduanju.com) SSR _ROUTER_DATA 做短剧分类/榜单/详情，
//        番茄小说 App API(bookapi/search/tab) 做真人剧/漫剧/AI剧分类与搜索——需字节系全套签名头。
// 签名层：x-gorgon/x-ladon/x-helios/x-medusa 全套纯 JS 实现（SM3/变种MD5/自研哈希三分支/手写protobuf/自定义AES变体），
//         算法块自实测可用的 Fastify 版(1:1)移植，勿随意改动常量与位运算顺序。
// 播放层：video_model 拿清晰度 → fallback_api 拿 video_list → spade URL 解密 → spade_a 派生 CENC 内容密钥；
//        proxy_rule 按客户端 __range 拉远端 1MB 段、AES-128-CTR 逐样本解密后 base64 回传（206 分段，免落盘秒开）。
// 依赖沙箱能力：require('node:crypto')（rootRequire 直通）、Buffer、axios；Node<18 无 SM3 会签名失败。

const crypto = require('node:crypto');

const SITE = 'https://hongguoduanju.com';
const VIDEO_API = 'https://api5-normal-sinfonlineb.fqnovel.com/novel/player/multi_video_model/v1/';
const APP_SEARCH_API = 'https://api5-normal-sinfonlinea.fqnovel.com/reading/bookapi/search/tab/v';
const VIDEO_UA = 'com.phoenix.read/71332 (Linux; U; Android 16; zh_CN; 25053RT47C; Build/BP2A.250605.031.A3; Cronet/TTNetVersion:04657795 2026-01-23 QuicVersion:c67e9834 2025-09-08)';
const APP_UA = 'com.phoenix.read/72232 (Linux; U; Android 16; zh_CN; 25053RT47C; Build/BP2A.250605.031.A3)';
const DEVICE = {
    iid: '1905892595382586', device_id: '1905892595378490', ac: 'wifi', channel: 'update_64', aid: '8662', app_name: 'novelread',
    version_code: '71332', version_name: '7.1.3.32', device_platform: 'android', os: 'android',
    ssmix: 'a', device_type: '25053RT47C', device_brand: 'Redmi', language: 'zh', os_api: '36',
    os_version: '16', manifest_version_code: '71332', resolution: '1280*2772', dpi: '520',
    update_version_code: '71332', host_abi: 'arm64-v8a', dragon_device_type: 'phone', pv_player: '71332',
    compliance_status: '0', need_personal_recommend: '1', player_so_load: '1', is_android_pad_screen: '0',
};
const APP_DEVICE = {
    ...DEVICE, version_code: '72232', version_name: '7.2.2.32', manifest_version_code: '72232',
    update_version_code: '72232', pv_player: '72232',
};
const SELECTOR_GROUPS = [
    { key: 'background', name: '全部背景', items: [['现代', 'cate_757'], ['都市', 'cate_1'], ['古代', 'cate_758'], ['乡村', 'cate_11'], ['年代', 'cate_79'], ['架空', 'cate_452'], ['职场', 'cate_127'], ['民国', 'cate_390'], ['校园', 'cate_4'], ['宫廷', 'cate_1153'], ['荒岛', 'cate_1162']] },
    { key: 'topic', name: '全部主题', items: [['现言', 'cate_1021'], ['女性成长', 'cate_1048'], ['脑洞', 'cate_262'], ['奇幻', 'cate_1020'], ['玄幻', 'cate_1019'], ['古言', 'cate_439'], ['战神', 'cate_1038'], ['宫斗', 'cate_246'], ['仙侠', 'cate_1013'], ['权谋', 'cate_1047'], ['种田', 'cate_1180'], ['年代爱情', 'cate_1022'], ['悬疑', 'cate_165'], ['喜剧', 'cate_303'], ['青春', 'cate_297'], ['志怪', 'cate_1027'], ['民国爱情', 'cate_1025'], ['灵异', 'cate_751'], ['家国情怀', 'cate_1235'], ['法律', 'cate_1136'], ['刑侦', 'cate_1148'], ['抗战', 'cate_504'], ['武侠', 'cate_1172'], ['民国传奇', 'cate_1240'], ['动作', 'cate_302'], ['求生', 'cate_1168'], ['科幻', 'cate_1092'], ['恐怖', 'cate_1219'], ['商战', 'cate_1225']] },
    { key: 'setting', name: '全部设定', items: [['打脸虐渣', 'cate_1051'], ['大男主', 'cate_1207'], ['大女主', 'cate_760'], ['马甲', 'cate_266'], ['重生', 'cate_36'], ['穿越', 'cate_37'], ['系统', 'cate_19'], ['先婚后爱', 'cate_265'], ['家长里短', 'cate_862'], ['小人物', 'cate_1010'], ['破镜重圆', 'cate_475'], ['神豪', 'cate_20'], ['豪门', 'cate_936'], ['强者回归', 'cate_1045'], ['异能', 'cate_598'], ['传承觉醒', 'cate_1007'], ['虐恋', 'cate_1008'], ['医生', 'cate_487'], ['强强联合', 'cate_1049'], ['赘婿逆袭', 'cate_1044'], ['甜宠', 'cate_96'], ['娱乐圈', 'cate_43'], ['神医', 'cate_26'], ['青梅竹马', 'cate_387'], ['姐弟恋', 'cate_762'], ['玄学', 'cate_929'], ['追妻火葬场', 'cate_616'], ['业界精英', 'cate_1293'], ['一见钟情', 'cate_477'], ['福宝', 'cate_1291'], ['捞偏门', 'cate_1287'], ['反派主角', 'cate_1042'], ['萌宠', 'cate_428'], ['方言', 'cate_1255'], ['双向救赎', 'cate_1200'], ['白月光', 'cate_615'], ['灵魂互换', 'cate_831'], ['病娇', 'cate_380'], ['暴富', 'cate_1191'], ['黑道', 'cate_826'], ['丧尸', 'cate_582'], ['特种兵', 'cate_375']] },
    { key: 'gender', name: '全部受众', items: [['男频', '1'], ['女频', '0']] },
    { key: 'time', name: '全部时间', items: [['7天内上新', '1'], ['14天内上新', '2'], ['30天内上新', '3'], ['90天内上新', '4']] },
    { key: 'sort_type', name: '全部推荐', items: [['最新', '2'], ['最热', '1']] },
];
const CATEGORY_CONFIG = {
    short: { type_name: '短剧', kind: 'category', query: 'tab=1&sort_type=1' },
    human: { type_name: '真人剧', kind: 'app', tabType: 11, keyword: '短剧', fallback: 'hot-real-drama' },
    comic: { type_name: '漫剧', kind: 'app', tabType: 19, keyword: '热门', fallback: 'hot-comic-drama' },
    ai: { type_name: 'AI剧', kind: 'app', tabType: 11, keyword: 'AI剧', fallback: 'hot-ai-drama' },
    rank_hot: { type_name: '红果热播榜', kind: 'rank', route: 'hot-drama' },
    rank_human: { type_name: '真人剧热播榜', kind: 'rank', route: 'hot-real-drama' },
    rank_comic: { type_name: '漫剧热播榜', kind: 'rank', route: 'hot-comic-drama' },
    rank_ai: { type_name: 'AI剧热播榜', kind: 'rank', route: 'hot-ai-drama' },
};
const CATEGORIES = Object.entries(CATEGORY_CONFIG).map(([type_id, value]) => ({ type_id, type_name: value.type_name }));
const FILTER_GROUPS = SELECTOR_GROUPS.map((group) => ({
    key: group.key,
    name: group.name,
    value: [{ n: '全部', v: '' }, ...group.items.map(([n, v]) => ({ n, v }))],
}));
const FILTERS = Object.fromEntries(Object.keys(CATEGORY_CONFIG).map((typeId) => [typeId, FILTER_GROUPS]));
const RANK_ROUTE_RE = /^(hot-drama|hot-real-drama|hot-comic-drama|hot-ai-drama)$/;
const PAGE_SIZE = 24;
const SEG_SIZE = 1024 * 1024; // proxy 单段回传上限：钳制 Range 防止整文件 base64 撑爆内存
const pageCache = new Map();
const streamCache = new Map();
const videoInfoCache = new Map();
const appSearchCache = new Map();

function str(value, fallback = '') { return String(value == null ? fallback : value).trim(); }
function pageNumber(value) { const n = Number.parseInt(value, 10); return Number.isFinite(n) && n > 0 ? n : 1; }
function cleanUrl(value) { return str(value).replace(/\\\//g, '/').replace(/\\u0026/g, '&').replace(/&amp;/g, '&'); }
function jsonBody(value) { try { return JSON.parse(value); } catch { return null; } }
function playKey(vid, quality = 'auto') { return `${str(vid)}|${str(quality) || 'auto'}`; }
// 签名对 query 字节级敏感：python urllib.parse.quote 的 ['!'*'()'] 兜底编码行为须保持一致
function pythonUrlEncode(values) {
    return Object.entries(values).map(([key, value]) => {
        const encode = (item) => encodeURIComponent(String(item == null ? '' : item))
            .replace(/[!'()]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`);
        return `${encode(key)}=${encode(value)}`;
    }).join('&');
}

async function getText(url, options = {}) {
    const resp = await axios(url, {
        headers: { 'User-Agent': VIDEO_UA, 'Accept-Language': 'zh-CN,zh;q=0.9', ...options.headers },
        timeout: options.timeout || 20000,
        responseType: 'text',
    });
    if (resp.status !== 200) throw new Error(`HTTP ${resp.status}: ${url}`);
    return resp.data;
}

// ---------- 官网 SSR 数据 ----------

function extractAssignedJson(source, marker = '_ROUTER_DATA') {
    const start = source.indexOf(marker);
    if (start < 0) throw new Error('页面没有路由数据');
    const first = source.indexOf('{', start);
    if (first < 0) throw new Error('路由数据格式错误');
    let depth = 0; let quote = false; let escaped = false;
    for (let i = first; i < source.length; i += 1) {
        const ch = source[i];
        if (quote) { if (escaped) escaped = false; else if (ch === '\\') escaped = true; else if (ch === '"') quote = false; continue; }
        if (ch === '"') quote = true;
        else if (ch === '{' || ch === '[') depth += 1;
        else if (ch === '}' || ch === ']') { depth -= 1; if (depth === 0) return JSON.parse(source.slice(first, i + 1)); }
    }
    throw new Error('路由数据不完整');
}

async function routerData(url) {
    const cached = pageCache.get(url);
    if (cached && Date.now() - cached.time < 180000) return cached.value;
    const value = extractAssignedJson(await getText(url));
    pageCache.set(url, { time: Date.now(), value });
    return value;
}

// 一级/搜索/推荐的卡片必须是 TVBox 风格字段：引擎 setResult 只认 url/title/desc/img 并转成 vod_*，
// 直接返回 vod_name/vod_pic 会在转换中全部丢失（列表有条目但名称图片全空）
function itemToCard(item) {
    const source = item?.video_data && typeof item.video_data === 'object' ? item.video_data : item;
    const categoryList = Array.isArray(source?.category_list) ? source.category_list.map((value) => value?.name || value).filter(Boolean) : [];
    const tags = Array.isArray(source?.tags) ? source.tags : categoryList;
    const count = Number(source?.episode_cnt || source?.series_episode_info?.episode_cnt || 0);
    return {
        url: str(source?.series_id), title: str(source?.series_name || source?.series_title || item?.name), img: cleanUrl(source?.series_cover),
        desc: str(source?.episode_right_text) || (count ? `全${count}集` : ''),
        tname: tags.slice(0, 5).join('/'), content: str(source?.series_intro),
    };
}

function categoryData(data) {
    const page = data?.loaderData?.category_page || {};
    return page.recommendList || page.categoryData?.recommendList || [];
}

function decodeHtml(value) {
    return str(value)
        .replace(/&quot;/g, '"')
        .replace(/&#x2F;|&#47;/gi, '/')
        .replace(/&#x27;|&#39;/gi, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
}

function rankData(html) {
    const match = html.match(/data-fn-name="r"[^>]*data-fn-args="([^"]+)"/);
    if (!match) throw new Error('榜单页面没有数据');
    const args = jsonBody(decodeHtml(match[1]));
    const payload = Array.isArray(args) ? args[2] : null;
    if (!payload?.isSuccess || !Array.isArray(payload.rankList)) throw new Error('榜单数据格式错误');
    return payload;
}

function rankItemToCard(item) {
    return itemToCard({
        series_id: item?.seriesId || item?.series_id || item?.id,
        series_name: item?.title || item?.seriesTitle || item?.series_name,
        series_cover: item?.cover || item?.seriesCover || item?.series_cover,
        series_intro: item?.description || item?.intro || item?.seriesIntro,
        episode_cnt: item?.episodeCount || item?.episode_cnt,
        tags: item?.tags,
    });
}

async function rankPage(route, page = 1) {
    if (!RANK_ROUTE_RE.test(route)) throw new Error('不支持的榜单');
    const suffix = page > 1 ? `?page=${page}` : '';
    const payload = rankData(await getText(`${SITE}/rank/${route}${suffix}`));
    const pagination = payload.pagination || {};
    const list = payload.rankList.map(rankItemToCard).filter((item) => item.url && item.title);
    return {
        list,
        pagination: {
            totalPages: Number(pagination.totalPages || 1),
            pageNum: Number(pagination.pageNum || page),
            pageSize: Number(pagination.pageSize || list.length || PAGE_SIZE),
            total: Number(pagination.total || pagination.totalCount || (Number(pagination.totalPages || 1) * Number(pagination.pageSize || list.length || PAGE_SIZE))),
        },
    };
}

function categoryType(value) {
    const raw = str(value).replace(/^category\?/, '').replace(/^type_id=/, '');
    if (CATEGORY_CONFIG[raw]) return raw;
    const query = new URLSearchParams(raw);
    const route = str(query.get('rank') || query.get('route'));
    if (RANK_ROUTE_RE.test(route)) return Object.entries(CATEGORY_CONFIG).find(([, item]) => item.route === route && item.kind === 'rank')?.[0] || 'rank_hot';
    return 'short';
}

function filterValues(value) {
    if (typeof value === 'string') {
        const candidates = [value];
        try { candidates.push(decodeURIComponent(value)); } catch (e) {}
        for (const candidate of candidates) {
            try {
                const parsed = JSON.parse(candidate);
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return filterValues(parsed);
            } catch (e) {}
            const query = Object.fromEntries(new URLSearchParams(candidate).entries());
            if (Object.keys(query).length) return filterValues(query);
        }
        return {};
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const result = {};
    for (const [key, item] of Object.entries(value)) {
        if (key === 'filters') continue;
        if (item !== undefined && item !== null && str(item) && str(item) !== '-1') result[key] = str(item);
    }
    return result;
}

async function categoryPage(query, page = 1) {
    const params = new URLSearchParams(query);
    if (page > 1) params.set('page', String(page));
    return routerData(`${SITE}/category?${params}`);
}

// ---------- App 搜索（签名接口） ----------

function appFilterKeyword(config, filters) {
    const names = [];
    for (const value of Object.values(filters || {})) {
        const item = SELECTOR_GROUPS.flatMap((group) => group.items).find(([, id]) => id === value);
        if (item) names.push(item[0]);
    }
    return [config.keyword, ...names].filter(Boolean).join(' ');
}

async function appCategoryPage(typeId, config, filters, page) {
    const keyword = appFilterKeyword(config, filters);
    let result = await appSearchPage(keyword, config.tabType, page, PAGE_SIZE);
    if (!result.list.length && keyword !== config.keyword) result = await appSearchPage(config.keyword, config.tabType, page, PAGE_SIZE);
    return {
        page, pagecount: result.hasMore ? page + 1 : page, limit: PAGE_SIZE,
        total: (page - 1) * PAGE_SIZE + result.list.length + (result.hasMore ? 1 : 0), list: result.list,
        type_id: typeId,
    };
}

function appSearchParams(keyword, tabType, limit, cursor = {}, page = 1) {
    const values = {
        ...APP_DEVICE,
        query: str(keyword), count: String(limit), offset: String(Math.max(0, (page - 1) * limit)), tab_type: String(tabType),
        bookshelf_search_plan: '4', use_correct: 'true', user_is_login: '0',
    };
    if (cursor.search_id) values.search_id = cursor.search_id;
    if (cursor.passback) values.passback = cursor.passback;
    return values;
}

function appSearchCells(cell) {
    const result = [];
    if (cell && typeof cell === 'object') result.push(cell);
    if (typeof cell?.lynx_data === 'string') {
        const payload = jsonBody(cell.lynx_data);
        for (const item of Array.isArray(payload?.cell_data) ? payload.cell_data : []) {
            if (item && typeof item === 'object') result.push(item);
        }
    }
    return result;
}

function appSearchVod(cell) {
    const video = Array.isArray(cell?.video_data) ? cell.video_data.find((item) => item && typeof item === 'object') : null;
    if (!video) return null;
    const title = cell?.search_high_light?.title?.text || video.title || cell.cell_name;
    const id = video.series_id || cell.book_id || cell.search_result_id;
    if (!id || !title) return null;
    return {
        url: str(id), title: str(title), img: cleanUrl(video.cover || video.cover_url),
        desc: video.episode_cnt ? `全${video.episode_cnt}集` : str(video.rec_text || video.sub_title),
        tname: str(video.video_desc || video.sub_title), content: str(video.video_desc),
    };
}

async function appSearchPage(keyword, tabType, page = 1, limit = 20) {
    const cacheKey = `${tabType}|${keyword}|${page}`; const cached = appSearchCache.get(cacheKey);
    if (cached && Date.now() - cached.time < 300000) return cached.value;
    let cursor = {};
    if (page > 1) {
        const previous = await appSearchPage(keyword, tabType, page - 1, limit);
        cursor = previous.cursor || {};
    }
    const data = await signedAppGet(appSearchParams(keyword, tabType, limit, cursor, page));
    const tabs = Array.isArray(data.search_tabs) ? data.search_tabs : Array.isArray(data.data?.search_tabs) ? data.data.search_tabs : [];
    const tab = tabs.find((item) => Number(item?.tab_type) === Number(tabType)) || {};
    const list = []; const seen = new Set();
    for (const cell of Array.isArray(tab.data) ? tab.data : []) {
        for (const item of appSearchCells(cell)) {
            const vod = appSearchVod(item);
            if (vod && !seen.has(vod.url)) { seen.add(vod.url); list.push(vod); }
        }
    }
    const value = {
        list, hasMore: Boolean(tab.has_more),
        cursor: { search_id: str(tab.search_id), passback: str(tab.passback), next_offset: str(tab.next_offset) },
    };
    appSearchCache.set(cacheKey, { time: Date.now(), value }); return value;
}

// ---------- 字节系签名算法（实测黑盒，勿改常量/位序） ----------

function md5(value) { return crypto.createHash('md5').update(value).digest('hex').toUpperCase(); }
function sm3(value) { return crypto.createHash('sm3').update(value).digest(); }
function u32(value) { return Number(value) >>> 0; }
function rol32(value, count) { const n = count & 31; const x = u32(value); return u32((x << n) | (x >>> (32 - n))); }
function ror32(value, count) { const n = count & 31; const x = u32(value); return u32((x >>> n) | (x << (32 - n))); }
function ror64(value, count) { const n = BigInt(count) & 63n; const x = BigInt.asUintN(64, BigInt(value)); return BigInt.asUintN(64, (x >> n) | (x << (64n - n))); }
function le32(value) { const b = Buffer.alloc(4); b.writeUInt32LE(u32(value)); return b; }
function be32(value) { const b = Buffer.alloc(4); b.writeUInt32BE(u32(value)); return b; }
function zigzag(value) { const n = BigInt(value); return n < 0n ? ((-n) * 2n - 1n) : n * 2n; }
function varint(value) { let n = BigInt(value); const out = []; while (n > 127n) { out.push(Number((n & 127n) | 128n)); n >>= 7n; } out.push(Number(n)); return Buffer.from(out); }
function protoField(tag, value, type = 'string') {
    if (value === undefined || value === null || value === '') return Buffer.alloc(0);
    if (type === 'bytes' || type === 'string' || type === 'message') {
        const body = type === 'bytes' ? Buffer.from(value) : type === 'message' ? value : Buffer.from(String(value));
        return Buffer.concat([varint((BigInt(tag) << 3n) | 2n), varint(body.length), body]);
    }
    if (type === 'float') { const body = Buffer.alloc(4); body.writeFloatLE(Number(value)); return Buffer.concat([varint((BigInt(tag) << 3n) | 5n), body]); }
    return Buffer.concat([varint(BigInt(tag) << 3n), varint(type === 'sint' ? zigzag(value) : value)]);
}
function proto(fields) { return Buffer.concat(fields.map(([tag, value, type]) => protoField(tag, value, type))); }
function getIv(iv, data) { let value = u32(iv); for (let i = 0; i < data.length; i += 1) { if ((i & 1) === 0) value = u32((value >>> 4) ^ value ^ (value << 6) ^ data[i]); else value = u32(~((value >>> 7) ^ value ^ (data[i] | (value << 12)))); } return value; }
function sumMd5(data) { let check = 0x20220420; for (let i = 0; i < 12; i += 1) { const temp = (i & 1) === 0 ? (check >>> 3) ^ check : (check >>> 5) ^ check; check = (i & 1) === 0 ? data[i] ^ (check << 7) : data[i] | (check << 11); if ((i & 1) !== 0) check = ~check; check = u32(check ^ temp); } return u32((check | 4) ^ 0x1000000); }
const BRANCH2_SV = [0xa7aefe20,0x7149f1d6,0x47e4ca07,0xe9b58f67,0x93b924de,0xc614d0f5,0x38afe0ef,0xb2bbad73,0xe24444c3,0x9d3aec9b,0xdf7b37e4,0xd8b16d40,0xf8ac31b8,0x76b9a90b,0x31d833ee,0x953fce64,0x353595a4,0x4609c13b,0x36925008,0x8c6d0925,0x5df5c177,0x1cfbf52b,0x8a4fa7f0,0x114ca35e,0x8193f984,0x7a7a8733,0x316ab4d5,0x3c20cfc9,0xa6d84453,0x3a18500c,0x798ec47a,0x97a76b28,0x66c4ff96,0x51716443,0xdd2fc3b,0xb5696da7,0xbbeb3ac5,0x5c53d204,0xd32608ce,0x7279b9ec,0xf4188ecf,0xf7d793db,0x332cc491,0xab76ae15,0x9bebe727,0x18a01384,0x5be9f8a7,0x5f90a754,0x39b663c0,0x36673c83,0x7c92f514,0x9d7d94d7,0xe2e8d9aa,0x5f7e9ea9,0x7abd4551,0x569e05da,0x40a25632,0x3df5a9a5,0xbab37d80,0x454286dc,0x3f5d4e78,0x3d7b75d,0xb1fe4af7,0xa5ab26a3];
const BRANCH2_ORDERS = Buffer.from('0f0704000908030a060b050d0e010c020f05080c0009020103070e060b0a0d04060500070c000a04080f010b0d09020e060b02050403080101070a000d0c090e0d070e0f0b0208030c0509010004060a0d0902060f0b0a040807000c0503010e0c090f07060f030e020d0405010b0a000c050a090e0802040407030f01060b000b0f0408020a0700090d06010e03050c0b060a0508020c03070f0e090d0001040906080f050800040a0b030d01020c0e090d0c0604070a03030f00080105020e01000d0f090a0b0e0402080703060c0501080a0c0f0905060b000304020e070d04080f000c0f0e0d0a01060207090503040205080d0b0a0606000e0f070c09030a08040f000b01060d0c0709030e05020a070b050f00020e0108030d0c0609040d070f08050f06040b0a0e0c090002030d0c020704010b0e0e08060f09050003','hex');
function md5V3Step(kind, a, b, c, d, m, shift, constant) { let f; if (kind === 0) f = (b & c) | ((~b) & d); else if (kind === 1) f = (b & d) | (c & (~d)); else if (kind === 2) f = b ^ c ^ d; else f = c ^ (b | (~d)); return u32(b + rol32(u32(a + f + m + constant), shift)); }
function md5SumV3(message, countV2, orders, countV1) {
    const sv = BRANCH2_SV.map((value) => ror32(value, countV1)); const start = [ror32(0x79e0f2fb, countV2), ror32(0xc8b52570, countV2), ror32(0xebc2f8cd, countV2), ror32(0x7c104d93, countV2)]; const endCount = (countV2 + 6) & 255; const end = [ror32(0x19be4866, endCount), ror32(0xe85986b4, endCount), ror32(0xe19b326e, endCount), ror32(0x71d1d7d4, endCount)]; const m = []; for (let i = 0; i < 16; i += 1) m.push(message.readUInt32LE(i * 4)); let [a,b,c,d] = start;
    const run = (kind, order, shifts, offset) => { for (let i = 0; i < 16; i += 1) { const phase = i & 3; const next = phase === 0 ? md5V3Step(kind,a,b,c,d,m[orders[offset + i]],shifts[i],sv[offset + i]) : phase === 1 ? md5V3Step(kind,d,a,b,c,m[orders[offset + i]],shifts[i],sv[offset + i]) : phase === 2 ? md5V3Step(kind,c,d,a,b,m[orders[offset + i]],shifts[i],sv[offset + i]) : md5V3Step(kind,b,c,d,a,m[orders[offset + i]],shifts[i],sv[offset + i]); if (phase === 0) a = next; else if (phase === 1) d = next; else if (phase === 2) c = next; else b = next; } };
    run(0, orders, [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22], 0);
    run(1, orders, [5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20], 16);
    run(2, orders, [4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23], 32);
    run(3, orders, [6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21], 48);
    const ret = Buffer.alloc(16); ret.writeUInt32LE(u32((start[0] + a) ^ end[0]), 0); ret.writeUInt32LE(u32((start[1] + b) ^ end[1]), 4); ret.writeUInt32LE(u32((start[2] + c) ^ end[2]), 8); ret.writeUInt32LE(u32((start[3] + d) ^ end[3]), 12); return Buffer.concat([ret, le32(sumMd5(ret))]);
}
function branch2F13(iv, querySm3, bodyMd5, tsBytes, khronos) { const v = (iv & 13) * 86; const ivV0 = ((v >>> 15) & 255) + ((v >>> 8) & 255); const n1 = [0x8980f29b,0xeb549c7f,0xb08726db,0xd40cb5e6,0xe8f559e4][ivV0]; const countV1 = (n1 + khronos + 1) & 255; const countV2 = u32(n1 + khronos); const shift = (countV2 + 5) & 7; const seed = [0x84,0x96,0x77,0x9d,0xd4,0x15,0x0b,0xf8]; const pad = Buffer.from(seed.map((value) => ((value | (value << 8)) >> shift) & 255)); const input = Buffer.concat([querySm3,bodyMd5,tsBytes,pad,Buffer.from('a0010000','hex')]); return md5SumV3(input,countV2,BRANCH2_ORDERS.subarray(ivV0 << 6,(ivV0 + 1) << 6),countV1); }
function bxor(a, b) { const out = Buffer.alloc(Math.min(a.length, b.length)); for (let i = 0; i < out.length; i += 1) out[i] = a[i] ^ b[i]; return out; }
function hashF13(querySm3, bodyMd5, tsBytes, khronos) {
    const iv = getIv(getIv(getIv(0x20230928, querySm3), bodyMd5), tsBytes); const low = iv & 15; const ivV0 = (low * 171) >> 9; const branch = low - ivV0 * 3;
    if (branch === 2) return branch2F13(iv, querySm3, bodyMd5, tsBytes, khronos);
    if (branch !== 0) return Buffer.concat([querySm3.subarray(0, 16), bodyMd5, le32(sumMd5(Buffer.concat([querySm3, bodyMd5]))) ]);
    const ivV1List = [0xc4a78580, 0xb3c0fd39, 0xc58c5686, 0xc9aa3ba7, 0xf5a7adf2, 0x963c2ed1]; const ivV1 = ivV1List[ivV0]; const countV1 = (ivV1 + khronos + 1) & 255; const countV2 = u32(ivV1 + khronos);
    const tt02 = [0xebb64faf,0x7aadcc2,0xcf3187bf,0xe01138ff,0x6d0bfcff,0x5a30a3be,0xb41ad638,0x34180eb8,0xf233eb6f,0xb1a584cc,0xccc30dc7,0x47d1db51,0xd55653de,0x70a84fa1,0x57473c12,0xf76f0288,0x2c077f0a,0xda0dcad0,0xfbb86f6c,0xfdc4cf00,0x688a020d,0xe676c6a6,0x8cd6338b,0x1a3c8d0e,0xcce8b06b,0x6ad0ed0b,0xa0522717,0xdc71ac83,0x2285db71,0xd5b4dda6,0x736f8650,0x6560306c,0x617ce2a6,0xe423417e,0xa40e143,0x544e4032,0x88dffb2a,0x716c1ae0,0x4c467a88,0x5b23bb3,0xe1d0b866,0xbaa3dcb8,0xae3374d3,0xc3381a50,0x1702f75b,0xfe6da368,0xf0b4cf48,0x4e0ffbb8,0x72aad10d,0x26c53a3d,0xf2bce0f6,0xb4557581,0x4a257fdd,0x8c3182a2,0xab0b3b86,0x3d5dfb14,0x4f103634,0xd37b52d7,0x444eff16,0xeb0a33d1,0x6ca86f6e,0x284ba7,0x8387cfa,0x5fb37586];
    const tt = tt02.map((value) => ror32(value, countV1)); const n0 = (countV2 + 2) & 7; const seed = [0xfa,0x45,0x61,0xd7]; const pad = Buffer.from(seed.map((value) => ((value | (value << 8)) >> n0) & 255));
    const data = Buffer.concat([querySm3, bodyMd5, tsBytes, pad, Buffer.from('00000000000001a0','hex')]); const di = []; for (let i = 0; i < data.length; i += 4) di.push(data.readUInt32BE(i)); let di0 = di[0]; for (let i = 0; i < 112; i += 1) { const di1 = di[i + 1]; const di14 = di[i + 14]; const r1 = rol32(di1, 14) ^ rol32(di1, 25) ^ (di1 >>> 3); const r2 = rol32(di14, 13) ^ rol32(di14, 15) ^ (di14 >>> 10); di.push(u32(di0 + di[i + 9] + r1 + r2)); di0 = di1; }
    const init = [0x7aba4fc8,0x67166507,0x6403fa00,0x340f512f,984304912,3005047866,2874125293,2152413264].map((v) => ror32(v, countV2 & 31)); const chosen = [[101,5,7,6,3,2,1,0,5,4,3],[96,0,6,7,5,3,2,1,5,4,4],[96,7,6,2,1,4,0,5,4,3,5],[99,3,6,2,4,5,1,0,0,7,6],[96,0,5,6,7,3,1,2,5,4,4],[100,2,0,3,5,4,6,7,2,1,5]][ivV0]; let d = init.slice(); for (let i = 0; i < chosen[0]; i += 1) { const base = ivV1 + i; const n0v = di[base & 127]; const n1 = ((d[chosen[3]] ^ d[chosen[4]]) & d[chosen[1]]) ^ d[chosen[3]]; const n2 = rol32(d[chosen[1]],26)^rol32(d[chosen[1]],21)^rol32(d[chosen[1]],7); const n4 = u32(n0v+n1+n2+tt[base&63]+d[chosen[5]]); const n5=rol32(d[chosen[2]],30)^rol32(d[chosen[2]],19)^rol32(d[chosen[2]],10); const n6=(d[chosen[2]]&d[chosen[6]])|((d[chosen[2]]|d[chosen[6]])&d[chosen[7]]); const n7=u32(n5+n6); const old=d[chosen[9]]; d.unshift(d.pop()); d[chosen[10]]=u32(n7+n4); d[chosen[8]]=u32(old+n4); }
    const ret = Buffer.alloc(32); for (let i = 0; i < 8; i += 1) ret.writeUInt32BE(u32(d[i]+init[i]), i*4); const folded = bxor(ret.subarray(0,16), ret.subarray(16)); folded.copy(ret,0); return Buffer.concat([ret.subarray(0,16), le32(sumMd5(ret.subarray(0,16)))]);
}
function reverseBits(value) { let result = 0; for (let i = 0; i < 8; i += 1) result = (result << 1) | ((value >> i) & 1); return result; }
function rc4Gorgon(data, key) {
    const s = Array.from({ length: 256 }, (_v, i) => i); let j = 0;
    for (let i = 0; i < 256; i += 1) { j = (j + s[i] + key[i % key.length]) & 255; s[i] = s[j]; }
    let i = 0; j = 0;
    return Buffer.from(data.map((value) => { i += 1; const x = s[i]; j += x; const y = s[j & 255]; s[i] = y; return value ^ s[(y + y) & 255]; }));
}
function xGorgon(query, body, timestamp, random) {
    const sdk = Buffer.alloc(4); sdk.writeUInt32LE(67503104);
    const input = Buffer.concat([crypto.createHash('md5').update(query).digest().subarray(0, 4), body ? crypto.createHash('md5').update(body).digest().subarray(0, 4) : Buffer.alloc(4), Buffer.alloc(4), sdk, be32(timestamp)]);
    const key = [0x4a, 0x40, 0x16, (random >> 8) & 255, 0x47, 0x6c, 0x01, random & 255]; const out = rc4Gorgon([...input], key);
    for (let i = 0; i < out.length; i += 1) { let value = out[i]; value = ((value >> 4) | (value << 4)) & 255; const next = i + 1 < out.length ? out[i + 1] : out[0]; out[i] = (~(reverseBits((next ^ value) & 255) ^ 20)) & 255; }
    return Buffer.concat([Buffer.from('8404', 'hex'), Buffer.from([random & 255, (random >> 8) & 255, 0x40, 0x01]), out]).toString('hex');
}
function deviceProto(deviceId, version) { return proto([[1,1,'sint'],[2,2,'sint'],[3,'8662'],[4,deviceId],[5,'Ai6svO3PyrwDOUSmO6ZcResxu'],[6,'!noperm!'],[7,-888888,'sint'],[8,-888888,'sint'],[9,3,'sint'],[10,-888888,'sint'],[11,'!notset!'],[12,'Asia/Shanghai,8'],[13,'zh_CN'],[14,4,'sint'],[16,255.24993896484375,'float'],[17,35.58599090576172,'float'],[18,3.467449188232422,'float'],[19,3.467449188232422,'float'],[20,255.1754913330078,'float'],[21,42.17544174194336,'float'],[22,'16'],[23,41,'sint'],[24,36,'sint'],[25,1728388016635,'sint'],[26,1728388016635,'sint'],[27,1728388016635,'sint'],[28,1728388016637,'sint'],[29,-1,'sint'],[30,'25053RT47C'],[31,'Redmi'],[32,'25053RT47C'],[33,'25053RT47C'],[34,'Xiaomi'],[35,'Redmi'],[36,'Redmi'],[38,31,'sint']]); }
const SBOX = Buffer.from('+n0Ia5xZs0sEXznQOEqRmQBnpiCf9U2Ccybu3xhmgzOAAxn72f6uqqmwUsYL83klTni0NqxdGieeiNu9PGPsSRXBMB/cuFbUbM3KCUPINaPvHvSW0vwOcnuUhNHqRVpiAj/TEoE0K91+5ijypUYTATsh9mE3KSoN7Yyvv51cuyR2D3XkU4nhmI2xmmVwT1RMWKtub4sjxAcRDLrPoKSO2AU9FLLadMPX577Wf95IFj6FkKFVt3dCIsmGUC4X+WQxLJvxbRxEaOPpqJOXyzJX6+Vxaq3AzMfF/WAdoi1Hp+JRaV56zgpBtpWP97mH4DoGEIq1+FvV8LyS/3wvwugbQOwb2r26mJEMsiuDQTRn+wrYdrVGBVlhI3WQhyrjUBVMrLF5667llUcEaPCGPVGLD8qO5LlO8hKCvA7V9+8oJc9bXelqVQLhM76T5/WtnT45JKji+hdX0HoNCDDWuKON/QeaxB5uImSX0h2wv0VmP2zd2yeApxHcpsVS+MC2yFwAc2B7oBkTqsk1SEvTpM2fmfMQREBUfin0Bh+iq6EvPPavhWI2IX9e3yAas7Tm/3KEj2UmlFp36kN4x0rMLBRrxuh0U/zUHM4xcAMYjJY4MonxOl/X+alpt2M3WMI7w3HLnpIBigtNiJu7T21v4P6lSd5WFgntnMEt7oF92XzRLkJbTcGmXepE/UVOG6E/0YnhfS+q26utWcuxzpooyeD2cDlK1/8w9d28VzsRjbLuALbmGlp8+d7EzS6Au7lMpZ+ECMZvQmzwJ+eLOpxR+2chdUExp8ogQyq3v9l68rX4jCwjg0+PYKAEEzcU4wHFY2ZcdIHfWL1okD3SszT0GZMyKdZJrg1L2AeerB4tC0C4crp2EHGo5FYdSP7lwkeR2ocmnR+Ia8CYviUJlzOjhRZef9xuVOn3qcjow3fQgivsAmKKkg4+sA8F8/GWeDiGNhg8JM8KtFPMYWWkx5TVFX5t73kiNRJqjlIGVXtGZFCV4gzt0xcDopuZ6xz8r9Rzafpf9ywev8jh8592gHFIqpStZPuJxmDDMrNN0uBE3V+oscdoIzTJbRJ/t+sVvqnReJOgDJKk10fjisJwqyZBmnmn2BSFj8BvVtCMEbkuPOKdzw7eA11GPs04Qw8zWtkaZWwiO/wwpojqN6K0jY5RnNZA7vn4hPSul+nKCkVnVwQvg1zVxcSCtqORmB9KrJaBbssbCQivGJVJfVTt+hYxOtq4ZvWl8f4QAQZ0zGPffCgl9s6yT4vlvIdpu4YhBwA25wtQWZsc6GJYGWHyvSdeuh3mmUI9DSq13Fsp8C1MU3tqc04/df9LoTUXVXI5INOw/e8C7Hd+5CvbkMEFnnrUUmskEw==','base64');
function xorBytes(a, b) { const out = Buffer.from(a); for (let i = 0; i < out.length; i += 1) out[i] ^= b[i % b.length]; return out; }
function matrix(bytes) { return Array.from({ length: 4 }, (_v, i) => Array.from(bytes.subarray(i * 4, i * 4 + 4))); }
function flat(rows) { return Buffer.from(rows.flat()); }
function aesMix(rows) { for (let i = 0; i < 4; i += 1) { const t=rows[0][i]^rows[1][i]^rows[2][i]^rows[3][i]; const u=rows[0][i]; const xt=(x)=>((x<<1)^((x&128)?0x1b:0))&255; rows[0][i]^=t^xt(rows[0][i]^rows[1][i]); rows[1][i]^=t^xt(rows[1][i]^rows[2][i]); rows[2][i]^=t^xt(rows[2][i]^rows[3][i]); rows[3][i]^=t^xt(rows[3][i]^u); } }
class AesV3 {
    constructor(key, khronos) { this.wordSize=khronos&3; this.box=SBOX.subarray(this.wordSize*256,(this.wordSize+1)*256); this.con=[[1,0,2,3],[1,3,0,2],[0,1,3,2],[1,0,2,3]][this.wordSize]; this.con2=[[1,0,2,3],[2,0,3,1],[0,1,3,2],[1,0,2,3]][this.wordSize]; this.order=[[0,9,14,11,4,13,2,7,8,1,6,15,12,5,10,3],[0,9,14,15,4,13,2,7,8,1,6,3,12,5,10,11],[0,9,14,7,4,13,2,11,8,1,6,3,12,5,10,15],[0,9,14,11,4,13,2,7,8,1,6,15,12,5,10,3]][this.wordSize]; const init=[0xca025ddc,0x823dc546,0xc9420583,0xc298225f][this.wordSize]; const initial=Buffer.alloc(16); for(let i=0;i<4;i+=1)initial.writeUInt32LE(init,i*4); const mk=xorBytes(initial,key); const expanded=Buffer.concat([mk,Buffer.alloc(32)]); let rounds=8; for(let i=4;i<12;i+=1){let at=4*(i-1);let a=expanded[at],b=expanded[at+1],c=expanded[at+2],d=expanded[at+3];if((i&3)===0){const t=(u32(init>>((rounds&24)))^this.box[b])&255;b=this.box[c];c=this.box[d];d=this.box[a];a=t;}rounds+=2;expanded[at+4]=a^expanded[at-12];expanded[at+5]=b^expanded[at-11];expanded[at+6]=c^expanded[at-10];expanded[at+7]=d^expanded[at-9];} this.keys=Array.from({length:12},(_v,i)=>Array.from(expanded.subarray(i*4,i*4+4))); }
    add(rows,key) { for(let i=0;i<4;i+=1) for(let j=0;j<4;j+=1) rows[i][j]^=key[i][j]; }
    addCon(rows, keys) { for(let i=0;i<4;i+=1) for(let j=0;j<4;j+=1) rows[i][j]^=keys[i][this.con2[j]]; }
    sub(rows) { for(let i=0;i<4;i+=1) for(let j=0;j<4;j+=1) rows[i][j]=this.box[rows[i][j]]; const old=rows.map((x)=>x.slice()); for(let i=0;i<4;i+=1) rows[i]=old[this.con2[i]]; }
    shift(rows) { const b=flat(rows); for(let i=0;i<16;i+=1) rows[Math.floor(i/4)][i%4]=b[this.order[i]]; }
    shiftCon(rows) { const old=rows.map((x)=>x.slice()); for(let i=0;i<4;i+=1) rows[i]=this.con2.map((x)=>old[i][x]); }
    block(value) { const rows=matrix(value); this.addCon(rows,this.keys.slice(0,4)); for(let i=1;i<3;i+=1){this.sub(rows);this.shift(rows);if(i===1){this.shiftCon(rows);aesMix(rows);}this.addCon(rows,this.keys.slice(i*4));}this.add(rows,this.keys.slice(4));return flat(rows); }
    encrypt(data, iv) { const source=Buffer.from(data); const plaintext=Buffer.alloc(32); for(let i=0;i<31;i+=1){const at=i*8;const n0=(source[at]>>4)&2;const n1=n0|(source[at+1]&64);const n2=n1|((source[at+2]>>2)&1);const n3=n2|((source[at+3]<<3)&128);const n4=n3|((source[at+4]>>1)&4);const n5=n4|((source[at+5]<<3)&16);const n6=n5|((source[at+6]<<5)&32);plaintext[i]=n6|((source[at+7]>>4)&8);} plaintext[31]=1; const blocks=[]; let previous=Buffer.from(iv); for(let i=0;i<plaintext.length;i+=16){const value=this.block(xorBytes(plaintext.subarray(i,i+16),previous));blocks.push(value);previous=value;} const key=Buffer.concat(blocks); const out=Buffer.from(source); for(let i=0;i<31;i+=1){const at=i*8; const k=key[i]; out[at]&=0xdf;out[at]|=(k<<4)&32;out[at+1]&=0xbf;out[at+1]|=k&64;out[at+2]&=0xfb;out[at+2]|=(k<<2)&4;out[at+3]&=0xef;out[at+3]|=(k>>3)&16;out[at+4]&=0xf7;out[at+4]|=(k+k)&8;out[at+5]&=0xfd;out[at+5]|=(k>>3)&2;out[at+6]&=0xfe;out[at+6]|=(k>>5)&1;out[at+7]&=0x7f;out[at+7]|=(k<<4)&128;} return Buffer.concat([key.subarray(-1),out]); }
}
function xmxor(data, key) { const encoded=Buffer.alloc(data.length); for(let i=0;i<data.length;i+=1){const at=(i*4)&28;const d0=key[at],d1=key[at+1];let d2=((((data[i]<<4)|(data[i]>>>4))&255)+d0);d2=(~d2)^d1;d2=((((d2&255)<<3)|((d2&255)>>>5))&255);d2=(d2+d1)&255;d2=(d2^d0)&255;encoded[data.length-i-1]=(~d2)&255;} let last=encoded[encoded.length-1]^encoded[encoded.length-2];const first=encoded[0];encoded[0]=(~last+first)&255;encoded[1]=((encoded[0]^encoded[encoded.length-1]^254)+encoded[1])&255;encoded[2]=(encoded[2]+((last-first)^(((encoded[1]<<3)|(encoded[1]>>>5))&255)^2))&255;for(let i=0;i<encoded.length-4;i+=1){const temp=(((encoded[i+2]<<3)|(encoded[i+2]>>>5))&255)^encoded[i+1]^(i+3);encoded[i+3]=(~temp+encoded[i+3])&255;}encoded[encoded.length-1]^=encoded[encoded.length-2];let sum=0;for(let i=0;i<encoded.length-1;i+=1)sum+=encoded[i+1];encoded[0]=((encoded[0]^encoded[1])+sum)&255;return encoded; }
function keyHash(signKey, random) { const input=Buffer.concat([signKey,le32(random),signKey]); const hash=sm3(input); const d1=(random>>16)&255; let d2=((d1<<11)|(random>>>24))^(d1>>5)^d1; d2=(~d2)>>>0; return [hash,le32(d2)]; }
function buildMedusa(url, body, khronos) {
    const bodyMd5=body?crypto.createHash('md5').update(body).digest():Buffer.alloc(16); const querySm3=sm3(url.split('?')[1]); const ts=le32(khronos); const queryBodyTs=hashF13(querySm3,bodyMd5,ts,khronos); const nested=proto([[1,111,'sint'],[2,10,'sint'],[3,694367,'sint'],[5,586952199,'sint']]); const messageRand=Math.floor(Math.random()*0x100000000); const envLaunch=Math.floor(Math.random()*21)+100; const envPid=Math.floor(Math.random()*2000)+10001; const env=proto([[1,envLaunch,'sint'],[2,146331399,'sint'],[3,146331396,'sint'],[5,7,'sint'],[6,'v04.06.04.03-bugfix'],[7,envPid,'sint'],[12,deviceProto(DEVICE.device_id,DEVICE.version_name),'message'],[13,proto([[1,Math.floor(Date.now()/1000),'sint'],[2,-2,'sint'],[4,200,'sint']]),'message'],[14,DEVICE.version_name]]); const queryHash=sm3(Buffer.concat([Buffer.from(url.split('?')[1]),bodyMd5,Buffer.from('none')])); const message=proto([[1,Buffer.from('f7e85ffad7d7dc3bd62ac87057cf6118','hex'),'bytes'],[2,3,'sint'],[3,messageRand,'sint'],[4,'8662'],[5,DEVICE.device_id],[6,'1588093228'],[7,DEVICE.version_name],[8,'v04.06.04-ml-android'],[9,67503104,'sint'],[10,Buffer.from('4001000000000000','hex'),'bytes'],[12,khronos,'sint'],[13,queryBodyTs,'bytes'],[14,querySm3.subarray(0,6),'bytes'],[15,nested,'message'],[16,'AXYQOS6n2m60x1fVZHIrH3iol'],[17,khronos,'sint'],[19,queryHash,'bytes'],[20,'none'],[21,312,'sint'],[23,env,'message'],[24,'{\"cmr\":16777216,\"cmr2\":16777216,\"un_h\":1879194040,\"vpn\":0,\"kd\":0,\"fkd\":3672518972,\"pd\":-1872573247,\"dyn\":\"\",\"do\":0,\"tk\":true}']]); const random=Math.floor(Math.random()*0x100000000); const [hash,seed]=keyHash(Buffer.from('8ebdfa3806ecc5cee79423e6029ed82540bc2218bb7eae f71cb691f7aa8aa2f5'.replace(/ /g,''),'hex'),random); let transformed=xmxor(message,hash); transformed=Buffer.concat([Buffer.from('4001000000000000','hex'),transformed]).reverse(); for(let i=0;i<transformed.length;i+=1)transformed[i]^=seed[(~i)&3]; const check=((querySm3[0]&63)<<14)|0x18000001|((queryBodyTs[0]&63)<<8); const xmRand=Math.floor(Math.random()*0x100000000); const packed=Buffer.concat([Buffer.from([0x35]),le32(xmRand),le32(check),transformed,Buffer.from([random>>16,random>>24])]); const encrypted=new AesV3(Buffer.from('f1593376766ea98d34f31b057a9d5be4','hex'),khronos).encrypt(packed,Buffer.from('1fe109a4125283f418de9e051a969e12','hex')); const version=Buffer.from('03000000f7e85ffad7d7dc3bd62ac87057cf6118','hex'); const prefix=Buffer.alloc(20); for(let i=0;i<20;i+=4) prefix.writeUInt32LE(u32(version.readUInt32LE(i)^khronos),i); return Buffer.concat([prefix,Buffer.from([random&255,(random>>8)&255,0,1]),encrypted]).toString('base64');
}
function helios(khronos) {
    const random = Math.floor(Math.random() * 0x100000000); const data = Buffer.concat([le32(random), Buffer.from('8662')]); const digest = crypto.createHash('md5').update(data).digest(); const ascii = Buffer.from(digest.toString('hex'), 'ascii'); const words = [];
    for (let i = 0; i < 4; i += 1) words.push(ascii.readBigUInt64LE(i * 8)); const table = [words[0]]; let b0 = words[0]; let b8 = words[1]; words.splice(0, 2);
    for (let i = 0; i < 34; i += 1) { let x8 = BigInt.asUintN(64, ror64(b8, 8) + b0); x8 = BigInt.asUintN(64, x8 ^ BigInt(i)); words.push(x8); x8 = BigInt.asUintN(64, x8 ^ ror64(b0, 61)); table.push(x8); b0 = x8; b8 = words.shift(); }
    const text = Buffer.from(`${khronos}-1588093228-8662`); const pad = Buffer.alloc(Math.ceil((text.length + 1) / 16) * 16, 16 - (text.length % 16)); text.copy(pad); const output = [];
    for (let at = 0; at < pad.length; at += 16) { let a = pad.readBigUInt64LE(at); let b = pad.readBigUInt64LE(at + 8); for (let i = 0; i < 34; i += 1) { b = BigInt.asUintN(64, table[i] ^ (a + ror64(b, 8))); a = BigInt.asUintN(64, b ^ ror64(a, 61)); } const block = Buffer.alloc(16); block.writeBigUInt64LE(a); block.writeBigUInt64LE(b, 8); output.push(block); }
    return Buffer.concat([le32(random), ...output]).toString('base64');
}

function branchOf(url, body, khronos) { const bodyMd5 = body ? crypto.createHash('md5').update(body).digest() : Buffer.alloc(16); const q = sm3(url.split('?')[1]); const iv = getIv(getIv(getIv(0x20230928, q), bodyMd5), le32(khronos)); const low = iv & 15; return low - (((low * 171) >> 9) * 3); }
async function signedAppGet(values) {
    const khronos = Math.floor(Date.now() / 1000); const ticket = Date.now();
    const query = pythonUrlEncode({ ...values, ts: String(khronos), _rticket: String(ticket) });
    const url = `${APP_SEARCH_API}?${query}`;
    const random = Math.floor(Math.random() * 65536); const body = null;
    const headers = {
        'User-Agent': APP_UA, Accept: 'application/json; charset=utf-8,application/x-protobuf',
        'x-ss-req-ticket': String(ticket), 'x-tt-request-tag': 't=0;n=0', 'sdk-version': '2',
        'passport-sdk-version': '50561', 'x-xs-from-web': '0', 'x-khronos': String(khronos),
        'x-ladon': be32(khronos).toString('base64'), 'x-argus': le32(khronos).toString('base64'),
        'x-gorgon': xGorgon(query, body, khronos, random), 'x-helios': helios(khronos),
        'x-medusa': buildMedusa(url, body, khronos), 'x-tt-dt': '',
    };
    const resp = await axios(url, { headers, timeout: 20000, responseType: 'text' });
    const data = jsonBody(resp.data);
    if (resp.status !== 200 || !data || Number(data.code) !== 0) throw new Error(`App search failed: ${data?.message || resp.status}`);
    return data;
}

function videoModelUrl() { const query = new URLSearchParams({ ...DEVICE }); return `${VIDEO_API}?${query}`; }

function signedVideoRequest(payload) {
    const khronos = Math.floor(Date.now() / 1000); const body = Buffer.from(payload); const ticketBase = Date.now(); let requestTicket = ticketBase; let query = ''; let url = '';
    // branch 1 的签名变体服务端不认：抖动 _rticket 找一个可用的 branch（最多试 32 秒偏移）
    for (let offset = 0; offset < 32; offset += 1) { requestTicket = ticketBase + offset; const values = { ...DEVICE, ts: String(khronos), _rticket: String(requestTicket) }; query = pythonUrlEncode(values); url = `${VIDEO_API}?${query}`; if (branchOf(url, body, khronos) !== 1) break; }
    const random = Math.floor(Math.random() * 65536); const headers = {
        'User-Agent': VIDEO_UA, Accept: 'application/json; charset=utf-8,application/x-protobuf', 'Content-Type': 'application/json; charset=UTF-8',
        'x-xs-from-web': '0', 'x-ss-req-ticket': String(requestTicket), 'x-tt-request-tag': 't=0;n=0', 'sdk-version': '2', 'passport-sdk-version': '50561',
        'x-vc-bdturing-sdk-version': '3.7.2.cn', 'x-ss-stub': md5(body), 'x-gorgon': xGorgon(query, body, khronos, random),
        'x-khronos': String(khronos), 'x-ladon': be32(khronos).toString('base64'), 'x-argus': le32(khronos).toString('base64'),
        'x-helios': helios(khronos), 'x-medusa': buildMedusa(url, body, khronos), 'x-tt-dt': '',
    };
    return { url, headers, body };
}

async function requestVideoModel(vid) {
    const payload = JSON.stringify({
        biz_param: { detail_page_version: 0, device_level: 3, disable_digg_stat: false, need_all_video_definition: true, need_mp4_align: false, use_os_player: false, use_server_dns: false, video_platform: 1024 },
        mixed_video_id_map: { '1004': [str(vid)] },
    });
    const signed = signedVideoRequest(payload);
    const resp = await axios.post(signed.url, signed.body, { headers: signed.headers, timeout: 20000, responseType: 'text' });
    const data = jsonBody(resp.data);
    if (resp.status !== 200 || !data || Number(data.Code || data.code || 0) !== 0) throw new Error(`video_model failed: ${data?.Message || data?.message || resp.status}`);
    return data;
}

function modelForVideo(data, vid) {
    const map = data?.data || {};
    const entry = map[str(vid)] || Object.values(map).find((value) => value && typeof value === 'object');
    if (!entry) throw new Error('video_model 没有对应视频');
    const model = typeof entry.video_model === 'string' ? jsonBody(entry.video_model) : entry.video_model;
    if (!model) throw new Error('video_model 内容为空');
    return model;
}

function parseFallback(value) {
    if (typeof value === 'string') { const parsed = jsonBody(value); return parsed?.fallback_api || value; }
    if (Array.isArray(value)) return str(value[0]);
    return str(value?.fallback_api);
}

function qualityNumber(value) {
    const text = str(value); const match = text.match(/(2160|1440|1080|720|576|540|480|360)/);
    if (match) return Number(match[1]);
    return ({ '1920': 1080, '1280': 720, '1024': 576, '854': 480, '640': 360 })[text] || (/^\d{3,4}$/.test(text) ? Number(text) : 0);
}
function qualityLabel(value) {
    const n = qualityNumber(value); if (n) return `${n}P`;
    const labels = { low: '流畅', smooth: '流畅', medium: '标清', normal: '高清', high: '超清', original: '原画', uhd: '原画', super_high: '原画' };
    return labels[str(value).toLowerCase()] || str(value, '自动');
}
function qualityRows(videoList) {
    const rows = [];
    if (!videoList || typeof videoList !== 'object') return rows;
    for (const [key, value] of Object.entries(videoList)) {
        const item = value && typeof value === 'object' ? value : {};
        const quality = str(item.quality_desc || item.height || item.vheight || item.quality || key);
        if (item.main_url && !rows.some((row) => row.quality === key)) rows.push({ key, quality, item });
    }
    return rows.sort((a, b) => qualityNumber(b.quality || b.key) - qualityNumber(a.quality || a.key));
}

async function fetchVideoInfo(vid) {
    const cached = videoInfoCache.get(str(vid));
    if (cached && Date.now() - cached.time < 300000) return cached.value;
    const model = modelForVideo(await requestVideoModel(vid), vid);
    const fallback = parseFallback(model.fallback_api);
    if (!fallback) throw new Error('fallback_api 为空');
    const outer = jsonBody(await getText(fallback));
    const info = outer?.video_info?.data || {};
    const value = { model, info, rows: qualityRows(info.video_list) };
    videoInfoCache.set(str(vid), { time: Date.now(), value });
    return value;
}

// ---------- spade URL 解密与 CENC 内容密钥 ----------

function deriveContentKey(value) {
    const raw = Buffer.from(str(value).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    if (raw.length < 3) throw new Error('spade_a too short');
    let v8 = raw.length - (raw[0] ^ raw[1] ^ raw[2]) + 47;
    v8 = Math.min(v8, raw.length - 1);
    if (v8 < 33) throw new Error('spade_a key length invalid');
    const work = Buffer.from(raw.subarray(1, 1 + v8)); let a = 85; let b = 246;
    for (let i = 0; i < v8; i += 1) {
        const old = work[i]; const previous = i & 1 ? a : b;
        if (i & 1) a = old; else b = old;
        const pop = i.toString(2).split('1').length - 1;
        work[i] = (-21 - pop + (previous ^ old)) & 255;
    }
    return Buffer.from(work.subarray(1, 33).toString('ascii'), 'hex');
}

function decryptSpadeUrl(value, seed) {
    const encoded = str(value); if (!encoded) return '';
    const raw = Buffer.from(encoded, 'base64');
    if (raw.length < 5) throw new Error('spade URL ciphertext too short');
    if (raw[0] !== 0xa8 || raw[2] !== 0x01 || raw[3] !== 0x00) throw new Error('spade URL header format error');
    const cipherLength = Math.floor((raw.length - 4) / 16) * 16;
    if (!cipherLength) throw new Error('spade URL ciphertext has no complete block');
    const constants = Buffer.from('4dd4c2e6b83162090e52b3c7a6733ba41cb2462b829ab58a196b39db57177524f49baf7f08e8d68d26a72e37c1a95a2f1f05a51892aef2949732b62a38aadd58', 'hex');
    const h1 = crypto.createHash('sha512').update(seed).digest(); const h2 = crypto.createHash('sha512').update(Buffer.concat([h1, constants])).digest();
    const decipher = crypto.createDecipheriv('aes-128-cbc', h2.subarray(0, 16), h2.subarray(16, 32));
    decipher.setAutoPadding(false);
    let plaintext = Buffer.concat([decipher.update(raw.subarray(4, 4 + cipherLength)), decipher.final()]);
    if (plaintext.length) {
        const padding = plaintext[plaintext.length - 1];
        if (padding >= 1 && padding <= 16 && padding <= plaintext.length) plaintext = plaintext.subarray(0, plaintext.length - padding);
    }
    while (plaintext.length && plaintext[plaintext.length - 1] === 0) plaintext = plaintext.subarray(0, plaintext.length - 1);
    return plaintext.toString('utf8');
}

// ---------- CENC(MP4) 索引解析与分段解密 ----------

function readBox(data, offset) {
    if (offset < 0 || offset + 8 > data.length) return null;
    let size = data.readUInt32BE(offset); const type = data.toString('ascii', offset + 4, offset + 8);
    let header = 8;
    if (size === 1) {
        if (offset + 16 > data.length) return null;
        const large = data.readBigUInt64BE(offset + 8); if (large > BigInt(Number.MAX_SAFE_INTEGER)) return null;
        size = Number(large); header = 16;
    } else if (size === 0) size = data.length - offset;
    if (size < header || offset + size > data.length) return null;
    return { offset, size, type, header, bodyStart: offset + header };
}

function findBox(data, type, start = 0) {
    for (let offset = Math.max(0, start); offset + 8 <= data.length; offset += 1) {
        const box = readBox(data, offset);
        if (box?.type === type) return box;
    }
    return null;
}

function boxBody(data, type, start = 0) {
    const box = findBox(data, type, start); return box ? data.subarray(box.bodyStart, box.offset + box.size) : null;
}

function readU64(data, offset) {
    const value = data.readBigUInt64BE(offset); if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('MP4 offset too large');
    return Number(value);
}

function parseTrack(moov, track) {
    const stbl = findBox(moov, 'stbl', track.bodyStart); if (!stbl) return null;
    const stsz = boxBody(moov, 'stsz', stbl.bodyStart); const stsc = boxBody(moov, 'stsc', stbl.bodyStart);
    const chunkBox = findBox(moov, 'stco', stbl.bodyStart) || findBox(moov, 'co64', stbl.bodyStart);
    const saiz = boxBody(moov, 'saiz', stbl.bodyStart); const saio = boxBody(moov, 'saio', stbl.bodyStart);
    if (!stsz || !stsc || !chunkBox || !saiz || !saio || stsz.length < 12 || stsc.length < 8 || saiz.length < 9 || saio.length < 8) return null;
    const defaultSampleSize = stsz.readUInt32BE(4); const sampleCount = stsz.readUInt32BE(8); const sizes = [];
    if (defaultSampleSize) sizes.push(...Array(sampleCount).fill(defaultSampleSize));
    else for (let i = 0; i < sampleCount && 12 + (i + 1) * 4 <= stsz.length; i += 1) sizes.push(stsz.readUInt32BE(12 + i * 4));
    if (sizes.length !== sampleCount) return null;
    const chunkCount = chunkBox.bodyStart + 8 <= chunkBox.offset + chunkBox.size ? moov.readUInt32BE(chunkBox.bodyStart + 4) : 0;
    const offsets = [];
    for (let i = 0; i < chunkCount; i += 1) {
        const at = chunkBox.bodyStart + 8 + i * (chunkBox.type === 'co64' ? 8 : 4);
        if (at + (chunkBox.type === 'co64' ? 8 : 4) > chunkBox.offset + chunkBox.size) return null;
        offsets.push(chunkBox.type === 'co64' ? readU64(moov, at) : moov.readUInt32BE(at));
    }
    const entryCount = stsc.readUInt32BE(4); const entries = [];
    for (let i = 0; i < entryCount; i += 1) {
        const at = 8 + i * 12; if (at + 8 > stsc.length) return null;
        entries.push({ firstChunk: stsc.readUInt32BE(at), samplesPerChunk: stsc.readUInt32BE(at + 4) });
    }
    const samplesPerChunk = offsets.map((_value, index) => {
        let selected = 0; for (const entry of entries) if (entry.firstChunk <= index + 1) selected = entry.samplesPerChunk; return selected;
    });
    const auxDefault = saiz[4]; const auxCount = saiz.readUInt32BE(5); const auxSizes = [];
    if (auxDefault) auxSizes.push(...Array(auxCount).fill(auxDefault));
    else for (let i = 0; i < auxCount && 9 + i < saiz.length; i += 1) auxSizes.push(saiz[9 + i]);
    if (auxSizes.length !== auxCount) return null;
    const saioVersion = saio.readUInt32BE(0) >>> 24; const offsetSize = saioVersion === 1 ? 8 : 4;
    const saioCount = saio.readUInt32BE(4); if (!saioCount || 8 + offsetSize > saio.length) return null;
    const auxOffset = offsetSize === 8 ? readU64(saio, 8) : saio.readUInt32BE(8);
    return { sizes, offsets, samplesPerChunk, auxOffset, auxSizes, sampleCount };
}

function buildSamples(data, tracks) {
    const samples = [];
    for (const track of tracks) {
        let sampleIndex = 0; let auxPos = 0;
        const auxTotal = track.auxSizes.reduce((sum, size) => sum + Math.max(size, 8), 0);
        if (track.auxOffset < 0 || track.auxOffset + auxTotal > data.length) throw new Error('MP4 auxiliary data out of range');
        const aux = data.subarray(track.auxOffset, track.auxOffset + auxTotal);
        for (let chunk = 0; chunk < track.offsets.length && sampleIndex < track.sampleCount; chunk += 1) {
            let offset = track.offsets[chunk]; const count = track.samplesPerChunk[chunk] || 0;
            for (let index = 0; index < count && sampleIndex < track.sampleCount; index += 1) {
                const size = track.sizes[sampleIndex]; const auxSize = Math.max(track.auxSizes[sampleIndex] || 8, 8);
                if (offset + size > Number.MAX_SAFE_INTEGER || auxPos + auxSize > aux.length) throw new Error('MP4 sample index out of range');
                const iv = Buffer.alloc(16); aux.copy(iv, 0, auxPos, auxPos + Math.min(8, auxSize));
                samples.push({ start: offset, end: offset + size, iv }); offset += size; sampleIndex += 1; auxPos += auxSize;
            }
        }
    }
    return samples.sort((a, b) => a.start - b.start);
}

function replaceFourcc(data, from, to) {
    let offset = 0; const source = Buffer.from(from);
    while ((offset = data.indexOf(source, offset)) >= 0) { data.write(to, offset, 'ascii'); offset += source.length; }
}

function replaceSinf(data) {
    let offset = 0;
    while ((offset = data.indexOf(Buffer.from('sinf'), offset)) >= 0) {
        if (offset < 4) { offset += 4; continue; }
        const size = data.readUInt32BE(offset - 4); const end = offset - 4 + size;
        if (size >= 8 && size < 50000 && end <= data.length) { data.write('free', offset, 'ascii'); data.fill(0, offset + 4, end); offset = end; }
        else offset += 4;
    }
}

function prepareCencHeader(data, key) {
    const ftypSize = data.readUInt32BE(0); const moov = readBox(data, ftypSize);
    if (!moov || moov.type !== 'moov') throw new Error('invalid MP4 moov');
    const moovBody = data.subarray(moov.bodyStart, moov.offset + moov.size); const tracks = [];
    let cursor = 0; while (true) { const track = findBox(moovBody, 'trak', cursor); if (!track) break; tracks.push(track); cursor = track.offset + track.size; }
    const parsed = tracks.map((track) => parseTrack(moovBody, track)).filter(Boolean);
    const samples = key ? buildSamples(data, parsed) : [];
    const header = Buffer.from(data.subarray(0, moov.offset + moov.size));
    replaceFourcc(header, 'encv', 'hvc1'); replaceFourcc(header, 'enca', 'mp4a'); replaceSinf(header);
    return { header, samples };
}

function addCounter(iv, blocks) {
    const value = (iv.readBigUInt64BE(0) << 64n) | iv.readBigUInt64BE(8); const next = (value + BigInt(blocks)) & ((1n << 128n) - 1n);
    const result = Buffer.alloc(16); result.writeBigUInt64BE(next >> 64n, 0); result.writeBigUInt64BE(next & ((1n << 64n) - 1n), 8); return result;
}

function decryptPartial(data, start, key, prepared) {
    const output = Buffer.from(data); const end = start + output.length;
    if (start < prepared.header.length) prepared.header.copy(output, 0, start, Math.min(end, prepared.header.length));
    if (!key) return output;
    let index = 0; while (index < prepared.samples.length && prepared.samples[index].end <= start) index += 1;
    for (; index < prepared.samples.length; index += 1) {
        const sample = prepared.samples[index]; if (sample.start >= end) break;
        const overlapStart = Math.max(start, sample.start); const overlapEnd = Math.min(end, sample.end); if (overlapStart >= overlapEnd) continue;
        const relative = overlapStart - sample.start; const block = Math.floor(relative / 16); const skip = relative % 16;
        const decipher = crypto.createDecipheriv('aes-128-ctr', key, addCounter(sample.iv, block));
        if (skip) decipher.update(Buffer.alloc(skip));
        const decrypted = Buffer.concat([decipher.update(output.subarray(overlapStart - start, overlapEnd - start)), decipher.final()]);
        decrypted.copy(output, overlapStart - start);
    }
    return output;
}

// ---------- 播放流解析与 Range 代理 ----------

async function resolveStream(vid, quality) {
    const cacheKey = playKey(vid, quality); const cached = streamCache.get(cacheKey); if (cached && Date.now() - cached.time < 300000) return cached.value;
    const { info, rows } = await fetchVideoInfo(vid); const wanted = str(quality, 'auto');
    const selected = rows.find((row) => row.key === wanted || qualityNumber(row.quality) === qualityNumber(wanted)) || rows[0]; if (!selected) throw new Error('没有可用清晰度');
    let url = cleanUrl(selected.item.main_url); const seed = Buffer.from(str(info.key_seed), 'base64');
    if (seed.length && url) url = decryptSpadeUrl(url, seed);
    const result = { url, quality: qualityLabel(selected.quality || selected.key), key: selected.item.spade_a ? deriveContentKey(selected.item.spade_a) : null };
    streamCache.set(cacheKey, { time: Date.now(), value: result }); return result;
}

async function remoteRange(stream, start, end) {
    const resp = await axios(stream.url, {
        headers: { 'User-Agent': VIDEO_UA, Referer: 'https://novel.snssdk.com/', Range: `bytes=${start}-${end}` },
        timeout: 30000, responseType: 'arraybuffer',
    });
    let data = Buffer.from(resp.data);
    let total = Number(String(resp.headers['content-range'] || '').match(/\/(\d+)$/)?.[1] || 0);
    if (resp.status === 200) {
        total ||= Number(resp.headers['content-length'] || data.length);
        data = data.subarray(start, end + 1);
    }
    const expected = end - start + 1;
    if (data.length !== expected) throw new Error(`媒体 Range 长度异常: ${data.length}/${expected}`);
    return { data, total };
}

// 预取 ftyp+moov 并建 CENC 样本索引（结果挂在 stream 上随 streamCache 缓存）
async function prepareHeader(stream) {
    if (stream.prepared) return stream.prepared;
    if (!stream.preparePromise) stream.preparePromise = (async () => {
        const firstEnd = 256 * 1024 - 1; const first = await remoteRange(stream, 0, firstEnd); let head = first.data;
        const total = first.total || head.length; if (head.length < 16) throw new Error('MP4 头过短');
        const ftypSize = head.readUInt32BE(0); if (ftypSize < 8 || ftypSize + 8 > head.length) throw new Error('MP4 ftyp 异常');
        if (head.toString('ascii', 4, 8) !== 'ftyp' || head.toString('ascii', ftypSize + 4, ftypSize + 8) !== 'moov') throw new Error('MP4 moov 不在 ftyp 后');
        const moovSize = head.readUInt32BE(ftypSize); const moovEnd = ftypSize + moovSize;
        if (moovSize < 8 || moovEnd > total || moovEnd > 8 * 1024 * 1024) throw new Error(`MP4 moov 异常: ${moovSize}`);
        if (moovEnd > head.length) {
            const extra = await remoteRange(stream, head.length, moovEnd - 1);
            head = Buffer.concat([head, extra.data]);
        }
        head = head.subarray(0, moovEnd);
        const p = stream.key ? prepareCencHeader(head, stream.key) : { header: head, samples: [] };
        stream.prepared = { total, header: p.header, samples: p.samples };
        return stream.prepared;
    })();
    try { return await stream.preparePromise; } finally { delete stream.preparePromise; }
}

function parseRangeHeader(value, total) {
    const match = str(value).match(/^bytes=(\d*)-(\d*)/i); if (!match) return null;
    let start; let end;
    if (!match[1]) { const length = Math.min(total, Number(match[2])); if (!length) return 'invalid'; start = total - length; end = total - 1; }
    else { start = Number(match[1]); end = match[2] ? Number(match[2]) : total - 1; }
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= total || start > end) return 'invalid';
    return [start, Math.min(end, total - 1)];
}

// ---------- DS rule ----------

var rule = {
    title: '红果果[短]',
    host: SITE,
    // 惯例占位：drpyS 前置 parse（searchParse/cateParse）在 searchUrl/url 缺失时直接放弃调用源方法（返回空对象）
    url: '/category',
    searchUrl: '/search/**',
    play_parse: true,
    searchable: 1,
    filterable: 1,
    quickSearch: 1,
    class_parse: async function () {
        return { class: CATEGORIES, filters: FILTERS };
    },
    推荐: async function () {
        try {
            const data = await categoryPage('sort_type=1');
            return setResult(categoryData(data).slice(0, 12).map(itemToCard));
        } catch (e) {
            log('红果果推荐出错: ' + e.message);
            return setResult([]);
        }
    },
    一级: async function (tid, pg, filter, extend) {
        const page = pageNumber(pg);
        const rawId = str(tid || 'short');
        const typeId = categoryType(rawId);
        const config = CATEGORY_CONFIG[typeId];
        const requestedFilters = filterValues(extend);
        try {
            if (config.kind === 'app') {
                let result;
                try { result = await appCategoryPage(typeId, config, requestedFilters, page); } catch (e) { result = null; }
                if (result && result.list.length) return setResult(result.list);
                const fallback = await rankPage(config.fallback, page);
                return setResult(fallback.list);
            }
            if (config.kind === 'rank') {
                const result = await rankPage(config.route, page);
                return setResult(result.list);
            }
            const query = new URLSearchParams(config.query);
            if (rawId.includes('=') && !CATEGORY_CONFIG[rawId]) {
                const requested = new URLSearchParams(rawId.replace(/^category\?/, ''));
                for (const [key, value] of requested) query.set(key, value);
            }
            for (const [key, value] of Object.entries(requestedFilters)) query.set(key, value);
            const data = await categoryPage(query.toString(), page);
            return setResult(categoryData(data).map(itemToCard));
        } catch (e) {
            log('红果果一级出错: ' + e.message);
            return setResult([]);
        }
    },
    二级: async function () {
        const { orId } = this;
        const id = str(Array.isArray(orId) ? orId[0] : orId);
        if (!id) return { list: [] };
        try {
            const data = await routerData(`${SITE}/detail?series_id=${encodeURIComponent(id)}`);
            const series = data?.loaderData?.detail_page?.seriesDetail || {};
            const vids = (series.vid_list || []).map(str).filter(Boolean);
            if (!vids.length) return { list: [] };
            let rows = [];
            try { rows = (await fetchVideoInfo(vids[0])).rows; } catch (e) {}
            const sources = (rows.length ? rows : [{ key: 'auto', quality: 'auto' }])
                .map((row) => ({ name: qualityLabel(row.quality || row.key), episodes: vids.map((vid, index) => `第${index + 1}集$${playKey(vid, row.key)}`).join('#') }));
            // 二级不经 setResult 转换，直接返回 vod_* 完整对象
            const categoryList = Array.isArray(series.category_list) ? series.category_list.map((v) => v?.name || v).filter(Boolean) : [];
            const tags = Array.isArray(series.tags) ? series.tags : categoryList;
            const count = Number(series.episode_cnt || series.series_episode_info?.episode_cnt || 0);
            return {
                vod_id: id,
                vod_name: str(series.series_name || series.series_title),
                vod_pic: cleanUrl(series.series_cover),
                vod_remarks: str(series.episode_right_text) || (count ? `全${count}集` : ''),
                type_name: tags.slice(0, 5).join('/'),
                vod_content: str(series.series_intro),
                vod_play_from: sources.map((source) => source.name).join('$$$'),
                vod_play_url: sources.map((source) => source.episodes).join('$$$'),
            };
        } catch (e) {
            log('红果果二级出错: ' + e.message);
            return { vod_id: id, vod_name: '详情获取失败', vod_play_from: '红果', vod_play_url: '' };
        }
    },
    搜索: async function (key, quick, pg) {
        const page = pageNumber(pg);
        const word = str(key);
        if (!word) return setResult([]);
        try {
            const app = await appSearchPage(word, 11, page, 20);
            if (app.list.length) return setResult(app.list);
        } catch (e) {
            log('红果果App搜索失败回退官网: ' + e.message);
        }
        try {
            const data = await routerData(`${SITE}/search/${encodeURIComponent(word)}?page=${page}`);
            const pageData = data?.loaderData?.['search_(keyword)/page'] || data?.loaderData?.search_page || {};
            const list = Array.isArray(pageData.searchList) ? pageData.searchList.map(itemToCard).filter((item) => item.url && item.title) : [];
            return setResult(list);
        } catch (e) {
            log('红果果搜索出错: ' + e.message);
            return setResult([]);
        }
    },
    lazy: async function (flag, id) {
        const [vid, quality = 'auto'] = str(id).split('|');
        if (!/^\d+$/.test(vid)) return { parse: 0, url: 'toast://播放引用无效（vid 需为数字）' };
        // 壳子只保证可达主服务：播放回流走 /proxy 门面，proxy_rule 进程内解密
        const playUrl = this.requestHost + '/proxy/' + encodeURIComponent('红果果[短]') + '/?do=play&vid=' + vid + '&q=' + encodeURIComponent(quality || 'auto') + '#.mp4';
        // 预热：异步预取视频模型与 MP4 头（建 CENC 索引），壳子随后请求时大概率已就绪
        resolveStream(vid, quality || 'auto').then((stream) => prepareHeader(stream)).catch(() => {});
        return { parse: 0, url: playUrl };
    },
    proxy_rule: async function (params) {
        if (params.do !== 'play') return [404, 'text/plain', 'not found'];
        const vid = str(params.vid);
        const quality = str(params.q) || 'auto';
        if (!/^\d+$/.test(vid)) return [400, 'text/plain', 'bad vid'];
        try {
            const stream = await resolveStream(vid, quality);
            const prepared = await prepareHeader(stream);
            const total = prepared.total;
            // __range 由框架注入（客户端 Range 头）；无 Range 按 0 起段，全部钳制到 SEG_SIZE 防整文件 base64
            const requested = parseRangeHeader(params.__range, total);
            if (requested === 'invalid') return [416, 'text/plain', 'range not satisfiable'];
            let [start, end] = requested || [0, Math.min(total, SEG_SIZE) - 1];
            end = Math.min(end, start + SEG_SIZE - 1, total - 1);
            const remote = await remoteRange(stream, start, end);
            const output = decryptPartial(remote.data, start, stream.key, prepared);
            return [206, 'video/mp4', Buffer.from(output).toString('base64'), {
                'Content-Range': `bytes ${start}-${end}/${total}`,
                'Accept-Ranges': 'bytes',
            }, 1];
        } catch (e) {
            log('红果果代理出错: ' + e.message);
            return [502, 'text/plain', '红果果解析失败: ' + e.message];
        }
    },
};
