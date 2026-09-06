/*
@header({
  searchable: 0,
  filterable: 0,
  quickSearch: 0,
  title: '央视频直播',
  lang: 'ds'
})
*/

// 央视频 App（yangshipin / bkliveinfo）直播源 —— DS 版（由 cat 源 spider/catvod/央视直播代理.js 移植）
// 纯算法生成 cKey，匿名可用，零第三方依赖；随机源走沙箱注入的 CryptoJS（WordArray.random 底层为安全随机）
//   buildPacket(动态报文 + 包内校验和)
//     -> encryptTeaPacket(随机 pad + 2 字节盐 + 7 字节 0，CBC 链，TEA 16 轮)
//     -> 追加 4 字节校验和 -> 整包异或 CKEY_XOR -> customBase64 -> 前缀 '--01'
//   报文内嵌 ck_guard_time：guard 体 -> TEA(GUARD_TEA_KEY) -> 异或 GUARD_XOR -> 大写 hex
// 仅实现 relay 模式：清单是 3 分片滚动窗口，302 直跳会让播放器脱离代理反复轮询固定 CDN 地址，
// 几秒内被限流 403 断流；relay 下播放器始终回代理换票，分片绝对化后直连 CDN。
// 链路：lazy 拼主服务 /proxy 回调（带 #.m3u8 伪后缀帮嗅探）→ proxy_rule 取票换清单 relay 下发。

// 模块名 encode + 尾部斜杠（/proxy/:module/* 的通配段必须有落点）；do 缺省即 ds 引擎
const PROXY_PREFIX = '/proxy/' + encodeURIComponent('央视频直播') + '/?cnlid=';
// 单频道直链前缀 + txt 直播列表直链（壳子直播模块直接吃，与 cat 版直播代理等效）
const PROXY_LIVE_LIST = '/proxy/' + encodeURIComponent('央视频直播') + '/?flag=live';

// cnlid -> { url, time }，取票短缓存（够两次清单刷新，赶在 CDN 限流前换票）
const TICKET_TTL = 10 * 1000;
const MAX_ATTEMPTS = 3;
const ticketCache = new Map();

const CFG = {
    PLATFORM: 4330403,
    APP_VERSION: 'V8.22.1035.3031',
    API_URL: 'https://bkliveinfo.ysp.cctv.cn/',
    // 解析失败时跳转的兜底视频，避免播放器直接黑屏
    FALLBACK_VIDEO: 'https://kjjsaas-sh.oss-cn-shanghai.aliyuncs.com/u/3401405881/20240818-936952-fc31b16575e80a7562cdb1f81a39c6b0.mp4',
    // 只申报 AVC/H.264 能力，不申报 HEVC，兼容电视盒子与内置播放器
    SPVCODE: Buffer.from('H(30:1080,60:1080|30:1080,60:1080)').toString('base64'),
    UPSTREAM_HEADERS: {
        'Accept': 'application/vnd.apple.mpegurl,application/json,*/*',
        'Referer': 'https://live.cctv.cn/',
        'User-Agent': 'qqlive',
    },
    REQ_TIMEOUT: 12000,
};

const KEYS = {
    DELTA: 0x9e3779b9,
    ROUNDS: 16,
    CKEY_TEA_KEY: Buffer.from('59b2f7cf725ef43c34fdd7c123411ed3', 'hex'),
    GUARD_TEA_KEY: Buffer.from('110DBEC10C23E7D2E56A1CAD6914EF1B', 'hex'),
    CKEY_XOR: Buffer.from('842eed08f066e6ea48b4caa991ed6ff3', 'hex'),
    GUARD_XOR: Buffer.from('b3c953a06913ad4d', 'hex'),
};

const PKT = {
    HEADER: Buffer.from('0000004200000004000004d2', 'hex'),
    SDT_FROM: 'dcgh',
    RAND_FLAG: '_zj1A5Gh6QYcxWjIUGos2w==',
    BUNDLE_ID: 'nil',
    UUID4: '57eab0c4-2c58-44c6-8ae9-dd2757525dc5',
    CKEY_VERSION: 'v0.1.000',
    PACKAGE_NAME: 'com.cctv.yangshipin.app.iphone',
    EX_JSON_BUS: 'ex_json_bus',
    EX_JSON_VS: 'ex_json_vs',
};

// 频道表：GitHub channels.js 的 63 个匿名可用频道（已剔除匿名回 iretcode=25 的付费剧场）
// [名称, cnlid, livepid, 清晰度档位]
const CHANNELS = [
    ['CCTV1综合', '2024078201', '600001859', 'fhd'],
    ['CCTV2财经', '2024075401', '600001800', 'fhd'],
    ['CCTV3综艺', '2024068501', '600001801', 'fhd'],
    ['CCTV4中文国际', '2029797101', '600001814', 'fhd'],
    ['CCTV5体育', '2024078401', '600001818', 'fhd'],
    ['CCTV5+体育赛事', '2024078001', '600001817', 'fhd'],
    ['CCTV6电影', '2013693901', '600108442', 'fhd'],
    ['CCTV7国防军事', '2024072001', '600004092', 'fhd'],
    ['CCTV8电视剧', '2029793001', '600001803', 'fhd'],
    ['CCTV9纪录', '2024078601', '600004078', 'fhd'],
    ['CCTV10科教', '2024078701', '600001805', 'fhd'],
    ['CCTV11戏曲', '2027248701', '600001806', 'fhd'],
    ['CCTV12社会与法', '2027248801', '600001807', 'fhd'],
    ['CCTV13新闻', '2029797201', '600001811', 'fhd'],
    ['CCTV14少儿', '2027248901', '600001809', 'fhd'],
    ['CCTV15音乐', '2027249001', '600001815', 'fhd'],
    ['CCTV16奥林匹克', '2027249101', '600098637', 'fhd'],
    ['CCTV16 4K', '2027249301', '600099502', 'fhd'],
    ['CCTV17农业农村', '2027249401', '600001810', 'fhd'],
    ['CCTV4K超高清', '2029810301', '600002264', 'fhd'],
    ['CCTV8K超高清', '2026774101', '600156816', 'fhd'],
    ['CGTN', '2024181701', '600014550', 'fhd'],
    ['CGTN法语', '2024181801', '600084704', 'fhd'],
    ['CGTN俄语', '2024181901', '600084758', 'fhd'],
    ['CGTN阿拉伯语', '2024182001', '600084782', 'fhd'],
    ['CGTN西班牙语', '2024182101', '600084744', 'fhd'],
    ['CGTN纪录', '2024182301', '600084781', 'fhd'],
    ['CCTV风云剧场', '2025637103', '600099658', 'shd'],
    ['CCTV第一剧场', '2026874203', '600099655', 'shd'],
    ['CCTV怀旧剧场', '2026874303', '600099620', 'shd'],
    ['北京卫视', '2024052703', '600002309', 'fhd'],
    ['江苏卫视', '2024171103', '600002521', 'fhd'],
    ['东方卫视', '2024054503', '600002483', 'fhd'],
    ['浙江卫视', '2024054703', '600002520', 'fhd'],
    ['湖南卫视', '2024054803', '600002475', 'fhd'],
    ['湖北卫视', '2024171203', '600002508', 'fhd'],
    ['广东卫视', '2024060903', '600002485', 'fhd'],
    ['广西卫视', '2024060703', '600002509', 'fhd'],
    ['黑龙江卫视', '2029797003', '600002498', 'fhd'],
    ['海南卫视', '2024055603', '600002506', 'fhd'],
    ['重庆卫视', '2024061103', '600002531', 'fhd'],
    ['深圳卫视', '2024061303', '600002481', 'fhd'],
    ['四川卫视', '2024061403', '600002516', 'fhd'],
    ['河南卫视', '2029797303', '600002525', 'fhd'],
    ['东南卫视', '2024061503', '600002484', 'fhd'],
    ['贵州卫视', '2024061603', '600002490', 'fhd'],
    ['江西卫视', '2024061703', '600002503', 'fhd'],
    ['辽宁卫视', '2024171303', '600002505', 'fhd'],
    ['安徽卫视', '2024171403', '600002532', 'fhd'],
    ['河北卫视', '2024171503', '600002493', 'fhd'],
    ['山东卫视', '2029787903', '600002513', 'fhd'],
    ['天津卫视', '2019927003', '600152137', 'fhd'],
    ['吉林卫视', '2025561503', '600190405', 'fhd'],
    ['陕西卫视', '2029795103', '600190400', 'fhd'],
    ['宁夏卫视', '2025608503', '600190737', 'fhd'],
    ['内蒙古卫视', '2025561203', '600190401', 'fhd'],
    ['云南卫视', '2025561303', '600190402', 'fhd'],
    ['山西卫视', '2025560803', '600190407', 'fhd'],
    ['青海卫视', '2025559103', '600190406', 'fhd'],
    ['西藏卫视', '2025558003', '600190403', 'fhd'],
    ['CETV1', '2022823801', '600171827', 'fhd'],
    ['国学频道', '2029360403', '600213139', 'fhd'],
    ['新疆卫视', '2019927403', '600152138', 'fhd'],
];

// action 卡片（复制直播直链）：注意推荐/一级必须返回裸 vod 数组（不走 setResult 转换，否则 vod_tag/vod_id 会被转换丢弃）
function actionCard(requestHost, pic) {
    return {
        vod_id: JSON.stringify({
            actionId: '代理地址',
            id: 'proxy_url',
            type: 'input',
            title: 'txt直播列表直链（可贴到壳子直播配置）',
            tip: '可复制的地址',
            value: requestHost + PROXY_LIVE_LIST,
        }),
        vod_pic: pic,
        vod_name: '复制直播直链',
        vod_tag: 'action',
    };
}

// 直播卡片配图：主服务 public 静态资源（央视大全[官]同款）
function liveImgUrl(publicUrl) {
    return urljoin(publicUrl, './images/lives.jpg');
}

var rule = {
    title: '央视频直播',
    host: 'https://bkliveinfo.ysp.cctv.cn',
    // 惯例字段占位：纯 API 直播源用不到，但缺失时引擎前置 parse 会直接放弃，源方法不被调用
    url: '/live',
    searchUrl: '/search',
    searchable: 0,
    filterable: 0,
    quickSearch: 0,
    play_parse: true,
    class_parse: async function () {
        return {class: [{type_id: 'live', type_name: '央视频直播'}], filters: {}};
    },
    推荐: async function () {
        let {requestHost, publicUrl} = this;
        return [actionCard(requestHost, liveImgUrl(publicUrl))];
    },
    action: async function (action, value) {
        if (action === '代理地址') {
            return JSON.stringify({
                action: {
                    actionId: '__copy__',
                    content: JSON.parse(value).proxy_url
                },
                toast: '直播直链已复制到剪贴板'
            });
        }
        return '';
    },
    一级: async function (tid) {
        // 直播分类：复制直链卡片 + 频道入口（二级进频道列表）
        if (tid === 'live') {
            let {requestHost, publicUrl} = this;
            let pic = liveImgUrl(publicUrl);
            return [
                actionCard(requestHost, pic),
                {vod_id: 'live', vod_name: '央视频直播·全部频道', vod_pic: pic, vod_remarks: '63个频道 cKey 纯算法直连'},
            ];
        }
        return [];
    },
    二级: async function () {
        const {orId} = this;
        if (orId === 'live') {
            return {
                vod_name: '央视频直播·频道列表',
                vod_pic: urljoin(this.publicUrl, './images/lives.jpg'),
                vod_content: '央视频App接口，cKey 纯算法生成，匿名直连',
                vod_play_from: 'LIVE',
                vod_play_url: CHANNELS.map(([name, cnlid]) => `${name}$${cnlid}`).join('#'),
            };
        }
        return {};
    },
    lazy: async function (flag, id) {
        // id 即 cnlid；pid/defn 由 proxy_rule 查频道表，防参数篡改
        return {parse: 0, url: this.requestHost + PROXY_PREFIX + id + '#.m3u8'};
    },
    proxy_rule: async function (params) {
        // txt 直播列表直链：壳子直播模块直接吃（getProxyUrl 为引擎注入的本模块代理基址）
        if (params.flag === 'live') {
            const api = this.getProxyUrl() + '&cnlid=';
            const lines = CHANNELS.map(([name, cnlid]) => `${name},${api}${cnlid}#.m3u8`);
            return [200, 'text/plain', '央视频App,#genre#\n' + lines.join('\n')];
        }
        const entry = CHANNELS.find(c => c[1] === params.cnlid);
        if (!entry) return [404, 'text/plain', 'unknown cnlid'];
        const [, cnlid, pid, defn] = entry;
        try {
            const text = await getManifest(cnlid, pid, defn);
            if (text) {
                return [200, 'application/vnd.apple.mpegurl', text];
            }
        } catch (e) {
            log('ysp proxy error:', e.message);
        }
        // 解析失败：302 跳兜底视频
        return [302, 'video/mp4', '', {Location: CFG.FALLBACK_VIDEO}];
    },
}

// ================= 取流 =================

// 请求 App 接口取播放地址，返回 m3u8 URL 或 null
async function getRealUrl(cnlid, pid, defn) {
    try {
        const ticket = createCKey(cnlid);
        const platform = String(CFG.PLATFORM);
        const params = {
            'atime': '120',
            'livepid': pid,
            'cnlid': cnlid,
            'appVer': CFG.APP_VERSION,
            'app_version': '300090',
            'caplv': '1',
            'cmd': '2',
            'defn': defn,
            'device': 'iPhone',
            'encryptVer': '4.2',
            'getpreviewinfo': '0',
            'hevclv': '0',
            'lang': 'zh-Hans_CN',
            'livequeue': '0',
            'logintype': '1',
            'nettype': '1',
            'newnettype': '1',
            'newplatform': platform,
            'platform': platform,
            'sdtfrom': 'v3021',
            'spacode': '23',
            'spaudio': '1',
            'spdemuxer': '6',
            'spdrm': '2',
            'spdynamicrange': '1',
            'spflv': '1',
            'spflvaudio': '1',
            'sphdrfps': '60',
            'sphttps': '1',
            'spvcode': CFG.SPVCODE,
            'spvideo': '4',
            'stream': '1',
            'system': '1',
            'sysver': 'ios18.2.1',
            'uhd_flag': '0',
            'cKey': ticket.cKey,
            'guid': ticket.guid,
            'fntick': String(ticket.timestamp),
            'flowid': ticket.flowId,
            'playbacktime': '0',
        };
        const query = new URLSearchParams(params).toString();
        let resp = await req(CFG.API_URL + '?' + query, {headers: CFG.UPSTREAM_HEADERS, timeout: CFG.REQ_TIMEOUT});
        const data = JSON.parse(resp.content);
        if (!data || parseInt(data.iretcode) !== 0) {
            return null;
        }
        const url = data.playurl || '';
        if (typeof url === 'string' && url.startsWith('http')) {
            return url;
        }
        // 兜底：backurl_list 里挑一个可用的官方地址
        for (const item of (data.backurl_list || [])) {
            if (typeof item === 'string' && item.startsWith('http')) {
                return item;
            }
        }
        return null;
    } catch (e) {
        console.log('getRealUrl error:', e.message);
        return null;
    }
}

// 取可直接下发的 m3u8 正文。实测「复用旧票反复拉」会被 CDN 回 403，
// 「换票再拉」稳定 200：拉清单失败立即弃票重取，最多 MAX_ATTEMPTS 轮
async function getManifest(cnlid, pid, defn) {
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
        const now = Date.now();
        const entry = ticketCache.get(cnlid);
        let url = (entry && (now - entry.time) < TICKET_TTL) ? entry.url : null;
        if (!url) {
            url = await getRealUrl(cnlid, pid, defn);
            if (url) {
                ticketCache.set(cnlid, {url, time: now});
            }
        }
        if (!url) {
            continue;
        }
        const text = await resolveManifest(url);
        if (text) {
            return text;
        }
        // 拉清单失败（多为 CDN 403）：弃票，下一轮强制换票
        ticketCache.delete(cnlid);
    }
    return null;
}

// 取回可直接下发的媒体清单正文，失败返回 null
async function resolveManifest(url) {
    try {
        let text = await fetchText(url);
        if (!text || !text.trimStart().startsWith('#EXTM3U')) {
            return null;
        }
        const variant = firstVariant(text, url);
        if (variant) {
            text = await fetchText(variant);
            if (!text || !text.trimStart().startsWith('#EXTM3U')) {
                return null;
            }
            url = variant;
        }
        return absolutize(text, url);
    } catch (e) {
        return null;
    }
}

async function fetchText(url) {
    let resp = await req(url, {headers: CFG.UPSTREAM_HEADERS, timeout: CFG.REQ_TIMEOUT});
    return resp.content || '';
}

// 若为 master playlist，返回第一个 variant 的绝对地址；否则返回 null
function firstVariant(text, baseUrl) {
    const lines = text.split('\n').map(ln => ln.trim());
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
            for (let j = i + 1; j < lines.length; j++) {
                if (lines[j] && !lines[j].startsWith('#')) {
                    return new URL(lines[j], baseUrl).toString();
                }
            }
        }
    }
    return null;
}

// 把清单里的相对分片路径补全为绝对地址，让播放器直连 CDN 拉分片
function absolutize(text, baseUrl) {
    return text.split('\n').map(line => {
        const stripped = line.trim();
        if (stripped && !stripped.startsWith('#')
            && !stripped.startsWith('http://') && !stripped.startsWith('https://') && !stripped.startsWith('//')) {
            try {
                return new URL(stripped, baseUrl).toString();
            } catch (e) {
                return line;
            }
        }
        return line;
    }).join('\n');
}

// ================= TEA 核心 =================

// 对应 JS 原版 checksum()：value = (0x83 * value + byte) & 0x7fffffff
function checksum(data) {
    let value = 0;
    for (const byte of data) {
        value = (0x83 * value + byte) & 0x7fffffff;
    }
    return value >>> 0;
}

// 腾讯经典 TEA 单块加密（16 轮，大端），对应 teaEncryptBlock()
function teaEncryptBlock(block, key) {
    let y = block.readUInt32BE(0);
    let z = block.readUInt32BE(4);
    const k = [key.readUInt32BE(0), key.readUInt32BE(4), key.readUInt32BE(8), key.readUInt32BE(12)];
    let total = 0;
    for (let i = 0; i < KEYS.ROUNDS; i++) {
        total = (total + KEYS.DELTA) >>> 0;
        y = (y + ((((z << 4) + k[0]) >>> 0) ^ ((z + total) >>> 0) ^ (((z >>> 5) + k[1]) >>> 0))) >>> 0;
        z = (z + ((((y << 4) + k[2]) >>> 0) ^ ((y + total) >>> 0) ^ (((y >>> 5) + k[3]) >>> 0))) >>> 0;
    }
    const out = Buffer.alloc(8);
    out.writeUInt32BE(y, 0);
    out.writeUInt32BE(z, 4);
    return out;
}

// 随机字节生成：WordArray.random(n) 走安全随机源，经 hex 转 Buffer 复用（CryptoJS 由沙箱注入）
const defaultRand = n => Buffer.from(CryptoJS.enc.Hex.stringify(CryptoJS.lib.WordArray.random(n)), 'hex');

// 对应 encryptTeaPacket()：
// 1 字节(随机量高5位|pad长度) + pad 随机字节 + 2 字节随机盐 + 明文 + 7 字节 0，
// 再以 8 字节为单位做 CBC 链：明文块先异或上一密文块，TEA 后再异或上一混合块
function encryptTeaPacket(payload, key, rand = defaultRand) {
    const saltLen = 2;
    const zeroLen = 7;
    const padLength = (8 - ((payload.length + 10) % 8)) % 8;
    const plain = Buffer.concat([
        Buffer.from([(rand(1)[0] & 0xf8) | padLength]),
        rand(padLength),
        rand(saltLen),
        payload,
        Buffer.alloc(zeroLen),
    ]);
    const out = Buffer.alloc(plain.length);
    let prevPlain = Buffer.alloc(8);
    let prevCipher = Buffer.alloc(8);
    for (let off = 0; off < plain.length; off += 8) {
        const source = plain.subarray(off, off + 8);
        const mixed = Buffer.alloc(8);
        const cipher = Buffer.alloc(8);
        for (let i = 0; i < 8; i++) {
            mixed[i] = source[i] ^ prevCipher[i];
        }
        const encrypted = teaEncryptBlock(mixed, key);
        for (let i = 0; i < 8; i++) {
            cipher[i] = encrypted[i] ^ prevPlain[i];
        }
        cipher.copy(out, off);
        prevPlain = mixed;
        prevCipher = cipher;
    }
    return out;
}

// ================= 报文拼装 =================

const uint16 = v => {
    const b = Buffer.alloc(2);
    b.writeUInt16BE(v & 0xffff);
    return b;
};

const uint32 = v => {
    const b = Buffer.alloc(4);
    b.writeUInt32BE(v >>> 0);
    return b;
};

// 2 字节大端长度 + 数据，对应 lengthPrefixed()
const lengthPrefixed = v => {
    const d = Buffer.isBuffer(v) ? v : Buffer.from(String(v), 'utf8');
    return Buffer.concat([uint16(d.length), d]);
};

// 取字符串末 5 位，不足 5 位返回空串，对应 guardTail()
const guardTail = v => {
    const s = String(v);
    return s.length >= 5 ? s.slice(-5) : '';
};

// 生成报文内嵌的 ck_guard_time（大写 hex），对应 createGuard()
function createGuard(timestamp, guid, rand) {
    const body = Buffer.concat([
        uint32(timestamp),
        lengthPrefixed(guardTail(guid)),
        lengthPrefixed(guardTail('null')),
        lengthPrefixed(guardTail('null')),
        lengthPrefixed('-1'),
    ]);
    const plain = lengthPrefixed(body);
    const encrypted = Buffer.concat([
        encryptTeaPacket(plain, KEYS.GUARD_TEA_KEY, rand),
        uint32(checksum(plain)),
    ]);
    for (let i = 0; i < encrypted.length; i++) {
        encrypted[i] ^= KEYS.GUARD_XOR[i & 7];
    }
    return encrypted.toString('hex').toUpperCase();
}

// 拼装 cKey 明文报文，对应 buildPacket()
function buildPacket(channelId, timestamp, guid, guard, uid) {
    const platform = CFG.PLATFORM;
    const body = Buffer.concat([
        PKT.HEADER,
        uint32(platform),
        uint32(0), // 占位，稍后写入整包校验和
        uint32(timestamp),
        lengthPrefixed(PKT.SDT_FROM),
        lengthPrefixed(PKT.RAND_FLAG),
        lengthPrefixed(CFG.APP_VERSION),
        lengthPrefixed(String(channelId)),
        lengthPrefixed(guid),
        uint32(1),
        uint32(1),
        lengthPrefixed(uid),
        lengthPrefixed(PKT.BUNDLE_ID),
        lengthPrefixed(PKT.UUID4),
        lengthPrefixed(PKT.BUNDLE_ID),
        lengthPrefixed(PKT.CKEY_VERSION),
        lengthPrefixed(PKT.PACKAGE_NAME),
        lengthPrefixed(String(platform)),
        lengthPrefixed(PKT.EX_JSON_BUS),
        lengthPrefixed(PKT.EX_JSON_VS),
        lengthPrefixed(guard),
    ]);
    const packet = Buffer.concat([uint16(body.length), body]);
    // 校验和写在偏移 18（2 字节长度 + 12 字节头 + 4 字节平台号），计算时占位为零
    packet.writeUInt32BE(checksum(packet), 18);
    return packet;
}

// 对应 customBase64()：+/ 换 _-，去掉尾部 =
const customBase64 = data => data.toString('base64').replaceAll('+', '_').replaceAll('/', '-').replaceAll('=', '');

// RFC 4122 v4 UUID（crypto-js 无此原语，用安全随机字节拼装）
function uuidV4() {
    const b = defaultRand(16);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = b.toString('hex');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// 生成 cKey，对应 createCKey()。返回 { cKey, guid, timestamp, flowId }
// now/rand/guid/uid 可注入以便确定性测试
function createCKey(channelId, {now, guid, uid, rand} = {}) {
    const timestamp = Math.floor((now ?? Date.now()) / 1000);
    guid = guid || defaultRand(16).toString('hex');
    uid = uid || defaultRand(4).toString('hex').toUpperCase(); // 服务端不校验 uid，随机即可
    rand = rand || defaultRand;

    const guard = createGuard(timestamp, guid, rand);
    const packet = buildPacket(channelId, timestamp, guid, guard, uid);
    const encrypted = Buffer.concat([
        encryptTeaPacket(packet, KEYS.CKEY_TEA_KEY, rand),
        uint32(checksum(packet)),
    ]);
    for (let i = 0; i < encrypted.length; i++) {
        encrypted[i] ^= KEYS.CKEY_XOR[i & 15];
    }

    return {
        cKey: '--01' + customBase64(encrypted),
        guid,
        timestamp,
        flowId: uuidV4().toUpperCase() + '_' + CFG.PLATFORM,
    };
}
