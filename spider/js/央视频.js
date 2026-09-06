/*
@header({
  searchable: 0,
  filterable: 0,
  quickSearch: 0,
  title: '央视频',
  '类型': '影视',
  lang: 'ds'
})
*/

// 央视频 demo 源：栏目节目列表 + hls_h5e 加密流解密播放
// 依赖插件 cctv-h5e（插件市场安装，默认 127.0.0.1:7796；自定义过端口的改下面常量）
// 链路：lazy 拼主服务 /proxy 回调 → proxy_rule 转发插件 /m3u8 与 /ts（m3u8 里的行带 base 回流主服务）
// → 客户端播放器只访问主服务端口，插件仅本机通信
const H5E_API = 'http://127.0.0.1:7796';
// 模块名 encode + 尾部斜杠（/proxy/:module/* 的通配段必须有落点）
const MODULE_PROXY_PREFIX = '/proxy/' + encodeURIComponent('央视频') + '/?do=h5e&u=';
// 直播播放回调：lazy 直接拼频道名，proxy 按 do=live 分流
const MODULE_PROXY_PREFIX_LIVE = '/proxy/' + encodeURIComponent('央视频') + '/?do=live&ch=';

// 栏目拼音缩写 → tv.cctv.com/lm/<缩写>/index.shtml；TOPC 栏目 id 从页面提取并缓存
const COLUMN_CACHE = {};
const COLUMNS = [
    {type_id: 'live', type_name: '直播'},
    {type_id: 'xwlb', type_name: '新闻联播'},
    {type_id: 'jdft', type_name: '焦点访谈'},
    {type_id: 'cwxc', type_name: '朝闻天下'},
    {type_id: 'wjxw', type_name: '晚间新闻'},
    {type_id: 'jsbd', type_name: '军事报道'},
    {type_id: 'hxla', type_name: '海峡两岸'},
    {type_id: 'jrgz', type_name: '今日关注'},
    {type_id: 'txzq', type_name: '天下足球'},
];

// 直播频道清单：与 cctv-h5e 插件 /live/channels 一致（ch 值同时用作播放 id）
const LIVE_CHANNELS = [
    ['cctv1', 'CCTV-1 综合'], ['cctv2', 'CCTV-2 财经'], ['cctv3', 'CCTV-3 综艺'],
    ['cctv4', 'CCTV-4 中文国际'], ['cctv5', 'CCTV-5 体育'], ['cctv5plus', 'CCTV-5+ 体育赛事'],
    ['cctv6', 'CCTV-6 电影'], ['cctv7', 'CCTV-7 国防军事'], ['cctv8', 'CCTV-8 电视剧'],
    ['cctv9', 'CCTV-9 纪录'], ['cctv10', 'CCTV-10 科教'], ['cctv11', 'CCTV-11 戏曲'],
    ['cctv12', 'CCTV-12 社会与法'], ['cctv13', 'CCTV-13 新闻'], ['cctv15', 'CCTV-15 音乐'],
    ['cctv16', 'CCTV-16 奥林匹克'], ['cctv17', 'CCTV-17 农业农村'],
];

async function getColumnId(slug) {
    if (COLUMN_CACHE[slug]) return COLUMN_CACHE[slug];
    const html = await request(`https://tv.cctv.com/lm/${slug}/index.shtml`);
    const m = (html || '').match(/TOPC[A-Za-z0-9]{12,}/);
    if (!m) throw new Error(`栏目 ${slug} 未找到（页面无 TOPC id，可能缩写不存在）`);
    COLUMN_CACHE[slug] = m[0];
    return m[0];
}

async function fetchVideoList(slug, pg) {
    const columnId = await getColumnId(slug);
    const apiUrl = `https://api.cntv.cn/NewVideo/getVideoListByColumn?id=${columnId}&n=30&p=${pg || 1}&mode=0&serviceId=tvcctv&sort=desc`;
    const body = await request(apiUrl);
    const json = JSON.parse(body);
    return (json && json.data && json.data.list) || [];
}

async function fetchVideoInfo(guid) {
    const body = await request(`https://vdn.apps.cntv.cn/api/getHttpVideoInfo.do?pid=${guid}`);
    return JSON.parse(body);
}

function pickH5eUrl(info) {
    const mf = info && info.manifest;
    if (!mf) return '';
    let url = mf.hls_h5e_url || mf.hls_enc_url || mf.hls_enc2_url || '';
    if (url) url = url.replace(/^(https?:\/\/)[^/]+\/asp\/enc2\//, '$1drm.cntv.vod.dnsv1.com/asp/enc2/');
    return url;
}

var rule = {
    title: '央视频',
    host: 'https://tv.cctv.com',
    class_parse: async function () {
        return {class: COLUMNS, filters: {}};
    },
    play_parse: true,
    searchable: 0,
    filterable: 0,
    quickSearch: 0,
    推荐: async function () {
        const list = await fetchVideoList('xwlb', 1);
        const d = list.map(it => ({
            title: it.title || '',
            img: it.image || '',
            desc: (it.time || '').slice(5, 16) + ' ' + (it.length || ''),
            url: it.guid,
        }));
        return setResult(d.slice(0, 8));
    },
    一级: async function (tid, pg) {
        try {
            const list = await fetchVideoList(tid, pg);
            const d = list.map(it => ({
                title: it.title || '',
                img: it.image || '',
                desc: (it.time || '').slice(5, 16) + ' ' + (it.length || ''),
                url: it.guid,
            }));
            return setResult(d);
        } catch (e) {
            log('央视频一级出错: ' + e.message);
            return setResult([]);
        }
    },
    一级: async function (tid, pg) {
        // 直播分类：单一入口卡片，二级进频道列表（央视大全[官]同款形态）
        if (tid === 'live') {
            return setResult([{title: '央视直播·全部频道', img: '', desc: 'CCTV 全频道 cdrm 流解密直播', url: 'live'}]);
        }
        try {
            const list = await fetchVideoList(tid, pg);
            const d = list.map(it => ({
                title: it.title || '',
                img: it.image || '',
                desc: (it.time || '').slice(5, 16) + ' ' + (it.length || ''),
                url: it.guid,
            }));
            return setResult(d);
        } catch (e) {
            log('央视频一级出错: ' + e.message);
            return setResult([]);
        }
    },
    二级: async function () {
        const {orId} = this;
        // 直播频道入口列表：一个 vod，播放标签即各频道
        if (orId === 'live') {
            return {
                vod_name: '央视直播·频道列表',
                vod_pic: '',
                vod_content: 'CCTV 频道直播，cdrm 加密流经 cctv-h5e 插件解密播放',
                vod_play_from: 'LIVE',
                vod_play_url: LIVE_CHANNELS.map(([ch, name]) => name + '$' + ch).join('#'),
            };
        }
        const guid = orId;
        try {
            const info = await fetchVideoInfo(guid);
            const h5e = pickH5eUrl(info);
            return {
                vod_name: info.title || '央视频',
                vod_pic: info.image || '',
                vod_content: (h5e ? 'h5e 加密流，经 cctv-h5e 插件解密播放' : '该视频未提供 h5e 播放列表'),
                vod_play_from: 'H5E解密',
                vod_play_url: '正片$' + guid,
            };
        } catch (e) {
            log('央视频二级出错: ' + e.message);
            return {
                vod_name: '详情获取失败',
                vod_pic: '',
                vod_content: '',
                vod_play_from: 'H5E解密',
                vod_play_url: '正片$' + guid,
            };
        }
    },
    lazy: async function (flag, id) {
        // 直播判定按 id 白名单而非 flag：壳子回传 vod_play_from 形态不可控（缺失/小写/改写均常见），
        // 而频道 id（cctv1/cctv5plus…）与点播 guid（32位hex）天然不冲突
        const ch = (id || '').toLowerCase();
        if (LIVE_CHANNELS.some(([c]) => c === ch)) {
            return {parse: 0, url: this.requestHost + MODULE_PROXY_PREFIX_LIVE + ch + '#.m3u8'};
        }
        // 点播：id = guid → h5e 地址 → 主服务 /proxy 回调（客户端只访问主服务端口）
        // URL 尾部 `#.m3u8` 伪后缀：fragment 不发给服务器，帮按后缀嗅探格式的播放器识别 HLS
        const info = await fetchVideoInfo(id);
        const h5e = pickH5eUrl(info);
        if (!h5e) return {parse: 0, url: 'toast://该视频没有 h5e 加密播放列表'};
        const playUrl = this.requestHost + MODULE_PROXY_PREFIX + encodeURIComponent(h5e) + '#.m3u8';
        return {parse: 0, url: playUrl};
    },
    proxy_rule: async function (params) {
        const base = encodeURIComponent(this.requestHost + MODULE_PROXY_PREFIX);
        if (params.do === 'live') {
            const ch = (params.ch || '').toLowerCase();
            if (!ch) return [400, 'text/plain', 'missing ch'];
            const resp = await req(`${H5E_API}/live/m3u8?ch=${ch}&base=${base}`);
            if (resp.code !== 200) return [502, 'text/plain', '插件拉取直播 m3u8 失败: ' + resp.code];
            return [200, 'application/vnd.apple.mpegurl', resp.content];
        }
        if (params.do !== 'h5e') return [404, 'text/plain', 'not found'];
        const target = params.u || params.url || '';
        if (!target) return [400, 'text/plain', 'missing u'];
        // target 是 encode 过的绝对地址（. 不被 encode，直接探测后缀）
        const isM3u8 = /\.m3u8/.test(target);
        if (isM3u8) {
            const resp = await req(`${H5E_API}/m3u8?url=${target}&base=${base}`);
            if (resp.code !== 200) return [502, 'text/plain', '插件拉取 m3u8 失败: ' + resp.code];
            return [200, 'application/vnd.apple.mpegurl', resp.content];
        }
        const resp = await req(`${H5E_API}/ts?u=${target}`, {buffer: 2});
        if (resp.code !== 200) return [502, 'text/plain', '插件解密分片失败: ' + resp.code];
        // content 已是 base64，toBytes=1 由框架还原为二进制
        return [200, 'video/mp2t', resp.content, {}, 1];
    },
};
