/*
@header({
  searchable: 1,
  filterable: 1,
  quickSearch: 0,
  title: '央视解密[官]',
  logo: 'https://p2.img.cctvpic.com/photoAlbum/page/performance/img/2019/8/28/1566979406603_367.png',
  lang: 'ds',
  isProxyPath: true,
})
*/

// 央视大全点播结构（移植自 央视大全[官].js：分类/筛选/搜索/二级剧集解析）
// + 央视频 demo 的播放算法（点播 h5e 加密流、直播 cdrm，均经 cctv-h5e 插件解密）
// 依赖插件 cctv-h5e（插件市场安装，默认 127.0.0.1:7796；自定义过端口的改下面常量）
// 链路：lazy 拼主服务 /proxy 回调 → proxy_rule 转发插件 /m3u8 与 /ts（m3u8 里的行带 base 回流主服务）
// → 客户端播放器只访问主服务端口，插件仅本机通信
const H5E_API = 'http://127.0.0.1:7796';
// 模块名 encode + 尾部斜杠（/proxy/:module/* 的通配段必须有落点）
const MODULE_PROXY_PREFIX = '/proxy/' + encodeURIComponent('央视解密[官]') + '/?do=h5e&u=';
// 直播播放回调：lazy 直接拼频道 id，proxy 按 do=live 分流
const MODULE_PROXY_PREFIX_LIVE = '/proxy/' + encodeURIComponent('央视解密[官]') + '/?do=live&ch=';

const HOST = 'https://api.cntv.cn';

// 直播频道清单：与 cctv-h5e 插件 /live/channels 一致（ch 值同时用作播放 id）
const LIVE_CHANNELS = [
    ['cctv1', 'CCTV-1 综合'], ['cctv2', 'CCTV-2 财经'], ['cctv3', 'CCTV-3 综艺'],
    ['cctv4', 'CCTV-4 中文国际'], ['cctv5', 'CCTV-5 体育'], ['cctv5plus', 'CCTV-5+ 体育赛事'],
    ['cctv6', 'CCTV-6 电影'], ['cctv7', 'CCTV-7 国防军事'], ['cctv8', 'CCTV-8 电视剧'],
    ['cctv9', 'CCTV-9 纪录'], ['cctv10', 'CCTV-10 科教'], ['cctv11', 'CCTV-11 戏曲'],
    ['cctv12', 'CCTV-12 社会与法'], ['cctv13', 'CCTV-13 新闻'], ['cctv15', 'CCTV-15 音乐'],
    ['cctv16', 'CCTV-16 奥林匹克'], ['cctv17', 'CCTV-17 农业农村'],
];

// 点播 guid（32位hex）与直播频道 id 天然不冲突，播放分流按 id 特征判定，不依赖 flag
const LIVE_IDS = new Set(LIVE_CHANNELS.map(([c]) => c));

function pickH5eUrl(info) {
    const mf = info && info.manifest;
    if (!mf) return '';
    let url = mf.hls_h5e_url || mf.hls_enc_url || mf.hls_enc2_url || '';
    if (url) url = url.replace(/^(https?:\/\/)[^/]+\/asp\/enc2\//, '$1drm.cntv.vod.dnsv1.com/asp/enc2/');
    return url;
}

async function fetchVideoInfo(guid) {
    const body = await request(`https://vdn.apps.cntv.cn/api/getHttpVideoInfo.do?pid=${guid}`);
    return JSON.parse(body);
}

// 正则取文本
function getRegexText(text, regexText, index) {
    const match = text.match(new RegExp(regexText, 'ms'));
    return match ? (match[index] || '') : '';
}

function removeHtml(txt) {
    return txt.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ');
}

// 对象转查询串（与沙箱 drpyCustom.js 的 objectToQueryString 行为一致，自带一份便于源文件独立调试）
function encodeIfContainsSpecialChars(value) {
    return /[&=?#]/.test(value) ? encodeURIComponent(value) : value;
}

function objectToQueryString(obj) {
    return Object.entries(obj)
        .map(([key, value]) => `${encodeIfContainsSpecialChars(key)}=${encodeIfContainsSpecialChars(String(value))}`)
        .join('&');
}

var rule = {
    title: '央视解密[官]',
    host: 'https://api.cntv.cn',
    homeUrl: '/lanmu/columnSearch?&fl=&fc=&cid=&p=1&n=500&serviceId=tvcctv&t=json',
    url: '/list/getVideoAlbumList?p=fypage&n=24&serviceId=tvcctv&topv=1&t=json',
    searchUrl: 'https://search.cctv.com/ifsearch.php?page=fypage&qtext=**&sort=relevance&pageSize=20&type=video&vtime=-1&datepid=1&channel=&pageflag=0&qtext_str=**',
    searchable: 1,
    filterable: 1,
    quickSearch: 0,
    class_name: '4K专区&栏目大全&特别节目&纪录片&电视剧&动画片',
    class_url: '4K专区&栏目大全&特别节目&纪录片&电视剧&动画片',
    filter_url: 'channel={{fl.channel}}&sc={{fl.sc}}&bigday={{fl.bigday}}&year={{fl.year}}',
    filter: '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',
    headers: {
        'User-Agent': 'PC_UA'
    },
    timeout: 10000,
    play_parse: true,
    limit: 6,
    double: false,
    推荐: async function () {
        let {input, publicUrl} = this;
        let liveImgUrl = urljoin(publicUrl, './images/lives.jpg');
        let html = await request(input);
        let vods = get_list_lm(html, '栏目大全');
        vods.unshift({
            vod_name: '央视直播',
            vod_pic: liveImgUrl,
            vod_id: 'live',
            vod_remarks: 'CCTV台·插件解密',
        });
        return vods;
    },
    一级: async function () {
        let {MY_CATE, MY_FL, MY_PAGE} = this;
        let page_count = 24;
        let queryString = objectToQueryString(MY_FL);
        let year_prefix = ''  //栏目大全的年月筛选过滤
        if (MY_CATE === '栏目大全') {
            page_count = 20;
            let url = `${HOST}/lanmu/columnSearch?p=${MY_PAGE}&n=${page_count}&serviceId=tvcctv&t=json`;
            if (queryString) {
                url += `&${queryString}`;
            }
            let year = MY_FL.year || '';
            let month = MY_FL.month || '';
            if (year) {
                year_prefix = year + month
            }
            let html = await request(url);
            return get_list_lm(html, MY_CATE, year_prefix)
        } else if (MY_CATE === '4K专区') {
            let cid = 'CHAL1558416868484111'
            let url = `${HOST}/NewVideo/getLastVideoList4K?serviceId=cctv4k&cid=${cid}&p=${MY_PAGE}&n=${page_count}&t=json`;
            let html = await request(url);
            return get_list_4k(html, MY_CATE);
        } else {
            let channelMap = {
                "特别节目": "CHAL1460955953877151",
                "纪录片": "CHAL1460955924871139",
                "电视剧": "CHAL1460955853485115",
                "动画片": "CHAL1460955899450127",
            };
            let channelid = channelMap[MY_CATE];
            let url = this.input + `&channelid=${channelid}`;
            if (queryString) {
                url += `&${queryString}`;
            }
            let html = await request(url);
            return get_list_pk(html, MY_CATE)
        }
    },
    二级: async function () {
        let {orId} = this;
        let vid = orId;
        // 直播频道入口列表：一个 vod，播放标签即各频道（播放走 cctv-h5e 插件解密 cdrm）
        if (vid === 'live') {
            return {
                vod_id: vid,
                vod_name: 'CCTV直播频道列表',
                vod_pic: '',
                type_name: '直播',
                vod_remarks: '只含官方CCTV频道',
                vod_content: 'cdrm 加密流经 cctv-h5e 插件解密播放',
                vod_play_from: 'CCTV直播',
                vod_play_url: LIVE_CHANNELS.map(([ch, name]) => `${name}$${ch}`).join('#'),
            };
        }
        let year_prefix = '';
        if (orId.includes('$$$')) {
            year_prefix = orId.split('$$$')[0];
            vid = orId.split('$$$')[1];
        }
        let aid = vid.split('||');
        let tid = aid[0];
        let title = aid[1];
        let lastVideo = aid[2];
        let logo = aid[3];
        let id = aid[4];
        let vod_year = aid[5];
        let actors = aid.length > 6 ? aid[6] : '';
        let brief = aid.length > 7 ? aid[7] : '';
        let count = aid.length > 8 ? aid[8] : '';
        let desc = aid.length > 9 ? aid[9] : '';
        let fromId = 'CCTV';
        let reqUrl = '';
        if (tid === '栏目大全') {
            let lastUrl = `https://api.cntv.cn/video/videoinfoByGuid?guid=${id}&serviceId=tvcctv`;
            let html = await request(lastUrl);
            let topicId = JSON.parse(html).ctid;
            reqUrl = `https://api.cntv.cn/NewVideo/getVideoListByColumn?id=${topicId}&d=&p=1&n=100&sort=desc&mode=0&serviceId=tvcctv&t=json&d=${year_prefix}`;
        } else if (tid === '4K专区') {
            reqUrl = `https://api.cntv.cn/NewVideo/getVideoListByAlbumIdNew?id=${id}&serviceId=cctv4k&p=1&n=100&mode=0&pub=1`;
            fromId = 'CCTV4K';
        } else {
            reqUrl = `https://api.cntv.cn/NewVideo/getVideoListByAlbumIdNew?id=${id}&serviceId=tvcctv&p=1&n=100&mode=0&pub=1`;
        }
        let video_list = [];
        try {
            if (tid === '搜索') {
                fromId = '中央台';
                video_list = [title + "$" + lastVideo];
            } else {
                let html = await request(reqUrl);
                let list = JSON.parse(html).data.list;
                video_list = get_episodes_list(list);
                if (video_list.length < 1) {
                    html = await request(lastVideo);
                    let patternTxt;
                    if (['电视剧', '纪录片', '4K专区'].includes(tid)) {
                        patternTxt = "'title':\\s*'(.+?)',\\n{0,1}\\s*'brief':\\s*'(.+?)',\\n{0,1}\\s*'img':\\s*'(.+?)',\\n{0,1}\\s*'url':\\s*'(.+?)'";
                    } else if (tid === '特别节目') {
                        patternTxt = "class=\"tp1\"><a\\s*href=\"(https://.+?)\"\\s*target=\"_blank\"\\s*title=\"(.+?)\"></a></div>";
                    } else if (tid === '动画片') {
                        patternTxt = `'title':\\s*'(.+?)',\\n{0,1}\\s*'img':\\s*'(.+?)',\\n{0,1}\\s*'brief':\\s*'(.+?)',\\n{0,1}\\s*'url':\\s*'(.+?)'`;
                    } else if (tid === '栏目大全') {
                        patternTxt = "href=\"(.+?)\" target=\"_blank\" alt=\"(.+?)\" title=\".+?\">";
                    }
                    video_list = get_episodes_list_re(html, patternTxt, tid);
                    fromId = '央视';
                }
            }
        } catch (e) {
            log(`解析二级发生了错误: ${e.message}`);
        }
        if (video_list.length < 1) {
            return {}
        }
        let vod = {
            "vod_id": vid,
            "vod_name": title.replace(' ', ''),
            "vod_pic": logo,
            "type_name": tid,
            "vod_year": vod_year,
            "vod_area": "",
            "vod_remarks": count ? `共${count}集` : desc,
            "vod_actor": actors,
            "vod_director": '',
            "vod_content": brief
        };
        vod['vod_play_from'] = fromId;
        vod['vod_play_url'] = video_list.join('#');
        return vod
    },
    搜索: async function () {
        let {input} = this;
        let html = await request(input);
        return get_list_search(html, '搜索');
    },
    lazy: async function (flag, id) {
        // 直播判定按 id 白名单而非 flag：壳子回传 vod_play_from 形态不可控（缺失/小写/改写均常见），
        // 而频道 id（cctv1/cctv5plus…）与点播 guid（32位hex）/视频页 URL 天然不冲突
        const ch = (id || '').toLowerCase();
        if (LIVE_IDS.has(ch)) {
            return {parse: 0, url: this.requestHost + MODULE_PROXY_PREFIX_LIVE + ch + '#.m3u8'};
        }
        // 点播：id = guid（CCTV/CCTV4K）或视频页 URL（搜索/二级兜底，抓页面提取 var guid）
        // → getHttpVideoInfo 取 h5e 加密清单 → 主服务 /proxy 回调（客户端只访问主服务端口）
        // URL 尾部 `#.m3u8` 伪后缀：fragment 不发给服务器，帮按后缀嗅探格式的播放器识别 HLS
        try {
            let guid = id;
            if (/^https?:\/\//.test(id)) {
                const html = await request(id);
                guid = getRegexText(html, 'var\\sguid\\s*=\\s*"(.+?)";', 1);
                if (!guid) return {parse: 0, url: 'toast://页面未找到视频 guid'};
            }
            const info = await fetchVideoInfo(guid);
            const h5e = pickH5eUrl(info);
            if (!h5e) return {parse: 0, url: 'toast://该视频没有 h5e 加密播放列表'};
            return {parse: 0, url: this.requestHost + MODULE_PROXY_PREFIX + encodeURIComponent(h5e) + '#.m3u8'};
        } catch (e) {
            log('lazy出错: ' + e.message);
            return {parse: 0, url: 'toast://播放解析失败: ' + e.message};
        }
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
}

// 获取片库一级数据
function get_list_pk(html, tid) {
    let d = [];
    let list = JSON.parse(html).data.list;
    list.forEach(it => {
        let url = it.url;
        let title = it.title;
        let desc = it.sc + ((typeof it.year === 'undefined' || it.year === '') ? '' : ('•' + it.year)) + ((typeof it.count === 'undefined' || it.count === '') ? '' : ('•共' + it.count + '集'));
        let img = it.image;
        let id = it.id;
        let brief = it.brief || '';
        let year = it.year || '';
        let actors = it.actors || '';
        let count = it.count;
        if (url) {
            let guids = [tid, title, url, img, id, year, actors, brief, count];
            let guid = guids.join('||');
            d.push({
                title: title,
                desc: desc,
                pic_url: img,
                url: guid
            });
        }
    });
    return setResult(d)
}

// 获取栏目一级数据
function get_list_lm(html, tid, year_prefix) {
    let d = [];
    let list = JSON.parse(html).response.docs;
    list.forEach(it => {
        let id = it.lastVIDE.videoSharedCode;
        let desc = it.lastVIDE.videoTitle;
        let title = it.column_name;
        let url = it.column_website;
        let img = it.column_logo;
        let year = it.column_playdate;
        let actors = '';
        let brief = it.column_brief;
        let count = it.count;
        if (url.toString().length > 0) {
            let guids = [tid, title, url, img, id, year, actors, brief, count, desc];
            let guid = guids.join('||');
            d.push({
                title: title,
                desc: desc.includes('》') ? desc.split('》')[1].trim() : desc.trim(),
                pic_url: img,
                url: year_prefix ? year_prefix + '$$$' + guid : guid
            });
        }
    });
    return setResult(d)
}

// 获取4k一级数据
function get_list_4k(html, tid) {
    let d = [];
    let list = JSON.parse(html).data.list;
    list.forEach(it => {
        let desc = it.sc + ' ' + it.title;
        let id = it.id;
        let vod = it.last_video;
        let img = vod.image;
        let url = vod.url;
        let title = vod.title;
        let brief = vod.brief || '';
        let year = vod.year || '';
        let actors = vod.actors || '';
        let count = it.count;
        if (url) {
            let guids = [tid, title, url, img, id, year, actors, brief, count];
            let guid = guids.join('||');
            d.push({
                title: title,
                desc: desc,
                pic_url: img,
                url: guid,
            })
        }
    });
    return setResult(d)
}

// 获取搜索列表数据
function get_list_search(html, tid) {
    let d = [];
    let list = JSON.parse(html).list;
    list.forEach(it => {
        let url = it.urllink;
        let title = removeHtml(it.title);
        let img = it.imglink;
        let vid = it.id;
        let brief = it.channel;
        let year = it.uploadtime;
        if (url) {
            let guids = [tid, title, url, img, vid, year, '', brief];
            let guid = guids.join('||');
            d.push({
                title: title,
                desc: year,
                pic_url: img,
                url: guid,
            });
        }
    });
    return setResult(d)
}

// 获取集数
function get_episodes_list(json_list) {
    let videos = []
    for (const vod of json_list) {
        let url = vod['guid'];
        let title = vod['title'];
        if (url) {
            videos.push(title + "$" + url);
        }
    }
    return videos
}

// 获取集数列表（二级剧集兜底：从栏目/专辑网页正则提取）
function get_episodes_list_re(htmlTxt, patternTxt, tid) {
    const regex = new RegExp(patternTxt, 'gm'); // 全局和多行匹配
    const matches = [...htmlTxt.matchAll(regex)]; // 获取所有匹配项
    const videos = [];

    for (const match of matches) {
        let title = null;
        let url = null;
        if (['电视剧', '纪录片', '4K专区', '动画片'].includes(tid)) {
            title = match[1];
            url = match[4];
        } else {
            title = match[2];
            url = match[1];
        }
        if (!title || !url) continue; // 如果没有 title 或 url，跳过
        videos.push(`${title}$${url}`);
    }

    return videos;
}
