/*
@header({
  searchable: 1,
  filterable: 1,
  quickSearch: 1,
  title: '网飞猫',
  author: 'EylinSir',
  类型: '影视',
  logo: 'https://vf.cyscyy.com/vod_pc_static_ncat/images/p/logo.png?ver=123456666',
  lang: 'ds',
})
*/

var rule = {
    类型: '影视',
    author: 'EylinSir',
    title: '网飞猫',
    searchable: 1,
    quickSearch: 1,
    filterable: 1,
    play_parse: true,
    logo: 'https://vf.cyscyy.com/vod_pc_static_ncat/images/p/logo.png?ver=123456666',

    // API 配置 (v3.5.0)
    host1: 'https://vcache.mjrlin.cn',  // cache 域名（配置/首页/分类/详情，走 .capi）
    host2: 'https://vlogic.mjrlin.cn',  // logic 域名（搜索/cinema，不走 .capi）
    host3: 'https://vres.jgmyzx.com/vod1',   // vod1 组（视频图），预处理会从 appInit 覆盖
    host4: 'https://vsres.jgmyzx.com/vod1',  // sres 组（banner/备用图）
    path1: 'os=android&appId=ncat&userLevel=0',
    path2: 'os=android&appId=ncat&userChannel=c200000&userLevel=0',

    // 密钥
    aesKey: 'ayt5wy5afwmwrpb19k9s3psx3dymyd0n',
    aesIv: 'b3t069ijy7pirw0j',
    hmacKey: 'ksggsr4tp6difdo1c3im8fqd3g',

    // 设备信息
    deviceId: '0bae5781e3efe9da',
    deviceCreatedAt: '1785239862097',
    appVersion: '3.5.0',
    package: 'com.ncatC200000V260728.T180135',
    ua: 'com.ncatC200000V260728.T180135/3.5.0 Dalvik/2.1.0 (Linux; U; Android 12; NOH-AN01 Build/HUAWEINOH-AN01)',
    deviceInfo: 'eyJicmFuZCI6IkhVQVdFSSIsIm1vZGVsIjoiTk9ILUFOMDEiLCJ0eXBlIjoicGhvbmUiLCJyZXNvbHV0aW9uWCI6IjExNTIiLCJyZXNvbHV0aW9uWSI6IjIyNTYiLCJvcmllbnRhdGlvbiI6IjEiLCJvc05hbWUiOiJhbmRyb2lkIiwib3NWZXJzaW9uIjoiMTIiLCJvc0xldmVsIjoiMzEiLCJhYmkiOiJhcm02NC12OGEsYXJtZWFiaS12N2EsYXJtZWFiaSIsImFuZHJvaWRJZCI6IjBiYWU1NzgxZTNlZmU5ZGEiLCJ1dWlkIjoiNWQyYzc0MzUtNzRjZC00NzFmLThiNDEtZWQ1OGM5ZTdlZjU4IiwiZ2FpZCI6IiJ9',

    // 分类映射
    class_name: '电影&剧集&动漫&综艺&韩剧&短剧',
    class_url: '1&2&3&4&2002&6',
    searchUrl: '/vod/search/query?channelId=0&k=**&next=fypage&',

    // 认证状态 (匿名登录后填充，持久化到 local 存储)
    userId: '',
    xToken: '',
    _storageKey: 'ncat_user_info',

    // AES-CBC 解密 (输入为 base64，输出为 utf8 文本；自动处理 zlib 解压)
    aesDecrypt: function(b64data) {
        try {
            const ciphertext = CryptoJS.enc.Base64.parse(b64data);
            if (!ciphertext || ciphertext.sigBytes === 0) return null;

            const key = CryptoJS.enc.Utf8.parse(this.aesKey);
            const iv = CryptoJS.enc.Utf8.parse(this.aesIv);
            const decrypted = CryptoJS.AES.decrypt(
                { ciphertext: ciphertext },
                key,
                { iv: iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
            );

            const buf = Buffer.from(decrypted.toString(CryptoJS.enc.Latin1), 'binary');
            // zlib 压缩检测 (0x78 是 zlib 头)
            if (buf.length >= 2 && buf[0] === 0x78 &&
                (buf[1] === 0x01 || buf[1] === 0x9c || buf[1] === 0xda)) {
                return zlib.inflateSync(buf).toString('utf8');
            }
            return buf.toString('utf8');
        } catch (e) {
            log('AES解密失败: ' + e.message);
            return null;
        }
    },

    hmacsha1: function(str) {
        return CryptoJS.HmacSHA1(str, this.hmacKey).toString(CryptoJS.enc.Hex);
    },

    paixu: function(str) {
        return str ? str.split('&').sort().join('&') : '';
    },

    // 签名串后缀 (登录后追加 &userId)
    buildSignSuffix: function() {
        let suffix = 'appId=ncat&deviceCreatedAt=' + this.deviceCreatedAt +
            '&deviceId=' + this.deviceId + '&st=2';
        if (this.userId) suffix += '&userId=' + this.userId;
        return suffix + '|';
    },

    // 构建请求头 (登录后追加 userid/x-token；extra 合并额外头)
    buildHeaders: function(t, sign, extra) {
        const headers = {
            'user-agent': this.ua,
            'appId': 'ncat',
            'os': 'android',
            'appVersion': this.appVersion,
            'package': this.package,
            'deviceId': this.deviceId,
            'deviceCreatedAt': this.deviceCreatedAt,
            'deviceInfo': this.deviceInfo,
            'channelId': 'c200000',
            'x-d-video': '1',
            'apiVer': 'v2',
            'st': '2',
            'ts': t,
            'sign': sign
        };
        if (this.userId) headers['userid'] = this.userId;
        if (this.xToken) headers['x-token'] = this.xToken;
        if (extra) Object.assign(headers, extra);
        return headers;
    },

    // 匿名登录获取 token (搜索接口必需)
    anonymousLogin: async function() {
        try {
            // 1. 先尝试从 local 存储恢复凭证
            try {
                const saved = await local.get(this._storageKey, 'ncat_user');
                if (saved) {
                    const obj = JSON.parse(saved);
                    if (obj.userId && obj.xToken) {
                        this.userId = obj.userId;
                        this.xToken = obj.xToken;
                        return true;
                    }
                }
            } catch (e) {}

            // 2. POST /user/anonymous 获取匿名账号
            const t = String(Date.now());
            const signStr = 'post|/user/anonymous||' + t + '|' + this.buildSignSuffix();
            const headers = this.buildHeaders(t, this.hmacsha1(signStr), {
                'x-cdn': '1',
                'Content-Type': 'application/x-www-form-urlencoded'
            });

            const res = await req(this.host1 + '/user/anonymous', {
                method: 'post',
                headers: headers,
                data: {},
                buffer: 2
            });

            if (!res || !res.content) return false;
            const text = this.aesDecrypt(res.content);
            if (!text) return false;

            const obj = JSON.parse(text);
            if (obj.code !== 200 || !obj.data || !obj.data.id || !obj.data.token) {
                log('匿名登录失败: ' + text.substring(0, 300));
                return false;
            }

            this.userId = String(obj.data.id);
            this.xToken = obj.data.token;

            // 3. 设置青少年模式为 1 (避免内容被过滤)
            if (String(obj.data.teenMode) !== '1') {
                try {
                    const t2 = String(Date.now());
                    const signStr2 = 'post|/user/teenMode||' + t2 + '|' + this.buildSignSuffix();
                    const headers2 = this.buildHeaders(t2, this.hmacsha1(signStr2), {
                        'x-cdn': '1',
                        'Content-Type': 'application/x-www-form-urlencoded'
                    });
                    await req(this.host1 + '/user/teenMode', {
                        method: 'post',
                        headers: headers2,
                        data: { status: '1' },
                        postType: 'form',
                        buffer: 2
                    });
                } catch (e) {
                    log('设置青少年模式失败: ' + e.message);
                }
            }

            // 4. 持久化到 local 存储
            try {
                await local.set(this._storageKey, 'ncat_user', JSON.stringify({
                    userId: this.userId,
                    xToken: this.xToken
                }));
            } catch (e) {}

            return true;
        } catch (e) {
            log('匿名登录异常: ' + e.message);
            return false;
        }
    },

    // 发送 GET 请求获取数据
    // path(签名用)做 decodeURIComponent，url(实际请求)用原始字符串
    getData: async function(urlPath) {
        let path, url;
        const isSearch = urlPath.includes('search/') || urlPath.includes('cinema/');
        if (isSearch) {
            path = decodeURIComponent(urlPath) + this.path2;
            url = this.host2 + urlPath + this.path2;
        } else {
            path = decodeURIComponent(urlPath.replace('?', '.capi?')) + this.path1;
            url = this.host1 + urlPath.replace('?', '.capi?') + this.path1;
        }

        const t = String(Date.now());
        const params = path.split('?');
        const paramStr = this.paixu(params[1]);

        const signStr = 'get|' + params[0] + '|' + paramStr + '|' + t + '|' + this.buildSignSuffix();
        const sign = this.hmacsha1(signStr);

        const headers = this.buildHeaders(t, sign);

        try {
            // buffer:2 返回 base64，避免二进制加密数据被文本解码破坏
            const res = await req(url, { method: 'get', headers: headers, buffer: 2 });
            if (!res || !res.content) return null;

            const content = res.content;

            // 先尝试明文 base64 JSON (配置接口可能未加密)
            try {
                const obj = JSON.parse(base64Decode(content));
                return obj.data || obj;
            } catch (e) {}

            // 再尝试 AES 解密 + zlib 解压
            const decrypted = this.aesDecrypt(content);
            if (decrypted) {
                try {
                    const obj = JSON.parse(decrypted);
                    return obj.data || obj;
                } catch (e2) {
                    log('JSON解析失败: ' + e2.message);
                }
            }
            return null;
        } catch (e) {
            log('请求失败: ' + e.message);
            return null;
        }
    },

    // 映射视频列表为 drpy 格式
    mapVodList: function(list) {
        if (!list || !Array.isArray(list)) return [];
        return list.map(it => {
            const imgBase = it.imageGroup === 'vod1' ? this.host3 : this.host4;
            let vodId = it.vodId || it.id || '';
            if (!vodId && it.url) {
                const m = String(it.url).match(/vodId=([^&]+)/);
                if (m) vodId = m[1];
            }
            return {
                vod_id: String(vodId),
                vod_name: it.title || it.name || '',
                vod_pic: imgBase + (it.imagePath || it.coverPath || ''),
                vod_remarks: it.bottomLabel || it.dateLabel || '',
                vod_actor: it.actors ? it.actors.map(a => a.name).join(',') : '',
                type_name: it.labels ? it.labels.map(l => l.name).join(',') : ''
            };
        });
    },

    // 初始化
    预处理: async function() {
        try {
            await this.anonymousLogin();

            const config = await this.getData('/v4/config/appInit?');
            if (config && config.groups) {
                config.groups.forEach(g => {
                    if (g.id === 'vod1' && g.url && g.url[0]) this.host3 = g.url[0].domain;
                    if (g.id === 'sres' && g.url && g.url[0]) this.host4 = g.url[0].domain;
                });
            }

            const channelList = [
                { n: '全部', v: '' },
                { n: '动作', v: 'action' }, { n: '喜剧', v: 'comedy' },
                { n: '爱情', v: 'romance' }, { n: '科幻', v: 'sci-fi' },
                { n: '悬疑', v: 'mystery' }, { n: '恐怖', v: 'horror' },
                { n: '剧情', v: 'drama' }, { n: '战争', v: 'war' },
                { n: '犯罪', v: 'crime' }, { n: '奇幻', v: 'fantasy' },
                { n: '冒险', v: 'adventure' }, { n: '动画', v: 'animation' },
                { n: '纪录片', v: 'documentary' }, { n: '短片', v: 'short' },
                { n: '情色', v: 'erotic' }, { n: '同性', v: 'gay' },
                { n: '音乐', v: 'music' }, { n: '歌舞', v: 'musical' },
                { n: '家庭', v: 'family' }, { n: '儿童', v: 'kids' },
                { n: '传记', v: 'biography' }, { n: '历史', v: 'history' },
                { n: '运动', v: 'sport' }, { n: '黑色电影', v: 'black' },
                { n: '灾难', v: 'disaster' }, { n: '西部', v: 'western' },
                { n: '惊悚', v: 'thriller' }, { n: '记录', v: 'reality' },
                { n: '灵异', v: 'ghost' }
            ];
            const areaList = [
                { n: '全部', v: '' },
                { n: '大陆', v: '大陆' }, { n: '香港', v: '香港' },
                { n: '台湾', v: '台湾' }, { n: '美国', v: '美国' },
                { n: '韩国', v: '韩国' }, { n: '日本', v: '日本' },
                { n: '英国', v: '英国' }, { n: '法国', v: '法国' },
                { n: '泰国', v: '泰国' }, { n: '印度', v: '印度' },
                { n: '其他', v: '其他' }
            ];
            const yearList = [
                { n: '全部', v: '' },
                ...Array.from({ length: 25 }, (_, i) => ({ n: String(2025 - i), v: String(2025 - i) })),
                { n: '更早', v: '2000' }
            ];
            const sortList = [
                { n: '最新', v: '1' }, { n: '最热', v: '2' }, { n: '推荐', v: '3' }
            ];

            const baseFilters = [
                { key: 'class', name: '类型', value: channelList },
                { key: 'area', name: '地区', value: areaList },
                { key: 'year', name: '年份', value: yearList },
                { key: 'sort', name: '排序', value: sortList }
            ];

            const tids = this.class_url.split('&');
            this.filter = Object.fromEntries(tids.map(tid => [tid, baseFilters]));
        } catch (e) {
            log('初始化失败: ' + e.message);
        }
    },

    // 推荐
    推荐: async function() {
        try {
            const data = await this.getData('/v4/vod/home?');
            if (!data || !data.blocks) return [];

            const vods = [];
            data.blocks.forEach(block => {
                if (block._vod === 'section' && block.header.title !== '每日推荐') {
                    vods.push(...this.mapVodList(block.data.slice(0, 4)));
                } else if (block._vod === 'section2' || block._vod === 'section5') {
                    vods.push(...this.mapVodList(block.data.slice(0, 6)));
                }
            });
            return vods;
        } catch (e) {
            log('推荐加载失败: ' + e.message);
            return [];
        }
    },

    // 一级 - 分类列表
    一级: async function(tid, pg, filter, extend) {
        try {
            const sort = extend.sort || '1';
            const category = extend.class || '';
            const area = extend.area || '';
            const year = extend.year || '';

            const url = '/vod/channel/list?channelId=' + tid +
                '&sort=' + sort + '&category=' + category +
                '&area=' + area + '&language=&year=' + year +
                '&next=' + encodeURIComponent('page=' + pg) + '&';

            const data = await this.getData(url);
            if (!data || !data.items) return [];
            return this.mapVodList(data.items);
        } catch (e) {
            log('一级加载失败: ' + e.message);
            return [];
        }
    },

    // 二级 - 详情
    二级: async function(ids) {
        try {
            const id = ids[0];
            if (!id) return {};

            const data = await this.getData('/v2/vod/detail?vodId=' + id + '&');
            if (!data) return {};

            // 获取播放源
            const playFrom = [];
            const playUrl = [];
            if (data.playSources && data.playSources.length > 0) {
                data.playSources.forEach(source => {
                    const urls = (source.list || []).map(item => {
                        const url = item.playUrls && item.playUrls[0] ? item.playUrls[0].url : '';
                        return (item.title || '') + '$' + url;
                    }).join('#');
                    if (urls) {
                        playFrom.push(source.name);
                        playUrl.push(urls);
                    }
                });
            }

            const imgBase = data.imageGroup === 'vod1' ? this.host3 : this.host4;

            return {
                vod_name: data.title || '',
                vod_pic: imgBase + (data.imagePath || ''),
                vod_actor: data.actors ? data.actors.map(a => a.name).join(',') : '',
                vod_area: data.premiereDate ? data.premiereDate.split(' ')[0] : '',
                vod_year: data.premiereDate ? data.premiereDate.split('-')[0] : '',
                type_name: data.labels ? data.labels.map(l => l.name).join(',') : '',
                vod_content: data.summary || '',
                vod_play_from: playFrom.join('$$$'),
                vod_play_url: playUrl.join('$$$')
            };
        } catch (e) {
            log('二级加载失败: ' + e.message);
            return {};
        }
    },

    // 搜索
    搜索: async function(key, quick, pg) {
        try {
            // key 不做 encodeURIComponent，签名时 path 用 decodeURIComponent 还原
            const url = '/vod/search/query?channelId=0&k=' + key +
                '&next=' + encodeURIComponent('page=' + pg) + '&';
            const data = await this.getData(url);
            if (!data || !data.items) return [];

            return this.mapVodList(data.items).map(v => {
                if (v.vod_name) {
                    v.vod_name = v.vod_name.replace(/<font color="[^"]*">/g, '').replace(/<\/font>/g, '');
                }
                return v;
            });
        } catch (e) {
            log('搜索失败: ' + e.message);
            return [];
        }
    },

    // lazy - 播放解析
    lazy: async function(flag, id) {
        if (id && id.startsWith('http')) {
            return { parse: 0, url: id, header: { 'User-Agent': this.ua } };
        }
        return { parse: 0, url: '' };
    }
};
