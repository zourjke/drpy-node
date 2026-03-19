/*
@header({
    searchable: 1,
    filterable: 1,
    quickSearch: 1,
    title: '网盘[模板]',
    '类型': '影视',
    lang: 'ds'
})
*/

var rule = {
    title: '网盘[模板]',
    host: '',
    url: '',
    searchUrl: '*',
    headers: {
        "User-Agent": "PC_UA",
        'Accept': 'text/html; charset=utf-8'
    },
    line_order: ['百度', '夸克', '优汐', '天翼', '123', '移动', '阿里'],
    play_parse: true,
    search_match: true,
    searchable: 1,
    filterable: 1,
    timeout: 60000,
    quickSearch: 1,

    // 夸克网盘转存配置（true=开启下载和转码，false=关闭转存）
    quark_transfer: false,

    hostJs: async function () {

        let parts = rule.params.split('$');
        if (parts.length < 2) {
            return host || '';
        }

        let _host = parts[0];
        let paramKey = decodeURIComponent(parts[1]);
        rule_type = parts.length > 2 ? parts[2] : "";
        rule._name = paramKey;

        // 读取有效的域名缓存
        const cacheKey = `domain_cache_${paramKey}`;
        let cached = await local.get('host_cache', cacheKey);
        console.log('读取域名缓存:', cacheKey, cached);
        if (cached) {
            // 验证缓存域名是否仍然有效
            let testRes = await request(cached, {
                method: 'HEAD',
                timeout: 3000,
                headers: {'User-Agent': 'Mozilla/5.0'}
            });
            if (testRes) {
                return cached;
            }
            // 缓存域名失效，继续获取新域名
            await local.set('host_cache', cacheKey, null);
        }

        let html = await request(_host);
        let json = JSON.parse(html);
        let config = json[paramKey] || {};

        let domains = Array.isArray(config) ? config : [config];
        domains = domains.filter(u => u && typeof u === 'string' && u.trim()).map(u => {
            u = u.trim();
            if (/^https?:\/\//i.test(u)) return u;
            if (u.includes('https') || u.includes('ssl')) {
                return `https://${u.replace(/^(https?:\/\/)?/i, '')}`;
            }
            return `http://${u.replace(/^(https?:\/\/)?/i, '')}`;
        });

        if (domains.length === 0) {
            return '';
        }

        const results = await Promise.any(
            domains.map(async (url) => {
                let res = await request(url, {
                    method: 'GET',
                    timeout: 5000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });

                if (res && res.includes('index.php')) {
                    return url;
                }
                throw new Error('无效域名');
            })
        ).catch(() => null);

        if (results) {
            await local.set('host_cache', cacheKey, results);
            return results;
        }

        return domains[0] || '';
    },

    class_parse: async function () {
        const {input, pdfa, pdfh, pd, host, MY_CATE} = this;

        const cacheKey = `class_cache_${input}_${MY_CATE || 'default'}`;
        const cacheExpiration = 7 * 24 * 60 * 60 * 1000; // 7天

        let cached = await local.get('class_cache', cacheKey);
        console.log('读取分类缓存:', cacheKey, cached ? '有缓存' : '无缓存');
        if (cached) {
            let parsed = JSON.parse(cached);
            if (parsed.timestamp > Date.now() - cacheExpiration &&
                parsed.classes && parsed.classes.length > 0 &&
                parsed.filters && Object.keys(parsed.filters).length > 0) {
                return {class: parsed.classes, filters: parsed.filters};
            } else {
                await local.set('class_cache', cacheKey, null);
            }
        }

        const classes = [];
        const filters = {};
        const seenTypeIds = new Set();

        let html = await request(input);
        let navItems = pdfa(html, '.nav-menu-items&&li') || [];
        navItems.forEach(item => {
            let href = pd(item, 'a&&href')?.trim() || '';
            let typeName = pdfh(item, 'a&&Text')?.trim() || '';
            let match = href.match(/\/([^\/]+)\.html$/);
            if (match && typeName && /^\d+$/.test(match[1]) && !seenTypeIds.has(match[1])) {
                classes.push({type_name: typeName, type_id: match[1]});
                seenTypeIds.add(match[1]);
            }
        });

        if (classes.length === 0) {
            return {class: [], filters: {}};
        }

        let urls = classes.map(item => {
            let url = rule_type ?
                `${host}/vodshow/${item.type_id}-----------.html` :
                `${host}/index.php/vod/show/id/${item.type_id}.html`;
            return {url, options: {headers: rule.headers, timeout: 5000}};
        });

        let htmls = await batchFetch(urls);

        const CATEGORIES = [
            {key: 'cateId', name: '类型', reg: /\/id\/(\d+)/},
            {key: 'class', name: '剧情'},
            {key: 'lang', name: '语言'},
            {key: 'area', name: '地区'},
            {key: 'year', name: '时间'},
            {key: 'letter', name: '字母'}
        ];

        let hasValidFilters = false;

        htmls.forEach((html, i) => {
            let type_id = classes[i].type_id;
            filters[type_id] = [];
            if (!html || html.length < 300) {
                return;
            }

            CATEGORIES.forEach(cat => {
                const libraryBoxes = pdfa(html, '.library-box');
                const box = libraryBoxes.find(b => pdfh(b, 'a&&Text').includes(cat.name));
                if (!box) return;

                const linkItems = pdfa(box, 'div a');
                let values = linkItems.map(a => {
                    const n = pdfh(a, "a&&Text") || "全部";
                    let v = n;
                    if (cat.key === 'cateId') {
                        const href = pd(a, 'a&&href', host);
                        v = href?.match(cat.reg)?.[1] || n;
                    }
                    if (/全部|字母/.test(n)) return {n: "全部", v: ""};
                    return {n, v};
                }).filter(x => x?.n)
                    .filter((item, idx, self) => self.findIndex(i => i.n === item.n) === idx);

                if (values.length > 3) {
                    filters[type_id].push({key: cat.key, name: cat.name, value: values});
                    hasValidFilters = true;
                }
            });

            filters[type_id].push({
                key: "by",
                name: "排序",
                value: [
                    {n: "时间", v: "time"},
                    {n: "人气", v: "hits"},
                    {n: "评分", v: "score"}
                ]
            });
            hasValidFilters = true;
        });

        if (classes.length > 0 && hasValidFilters) {
            await local.set('class_cache', cacheKey, JSON.stringify({
                timestamp: Date.now(),
                classes: classes,
                filters: filters
            }));
        }

        return {class: classes, filters};
    },

    推荐: async function () {
        let {input, pdfa, pdfh, pd} = this;
        let html = await request(input);

        let d = [];
        let items = pdfa(html, '.module-items .module-item') || [];

        items.forEach(it => {
            d.push({
                title: pdfh(it, 'a&&title') || '',
                img: pd(it, 'img&&data-src') || '',
                desc: pdfh(it, '.module-item-text&&Text') || '',
                url: pd(it, 'a&&href') || ''
            });
        });
        return setResult(d);
    },

    一级: async function () {
        let {input, pdfa, pdfh, pd, MY_CATE, MY_FL, MY_PAGE, host} = this;
        let fl = MY_FL || {};
        let pg = MY_PAGE || 1;
        let type = MY_CATE || fl.cateId;

        let url;
        if (rule_type) {
            url = `${host}/vodshow/${type}-${fl.area || ''}-${fl.by || 'time'}-${fl.class || ''}--${fl.letter || ''}---${pg}---${fl.year || ''}.html`;
        } else {
            let parts = [];
            if (fl.area) parts.push(`area/${fl.area}`);
            if (fl.by) parts.push(`by/${fl.by}`);
            if (fl.class) parts.push(`class/${fl.class}`);
            if (fl.lang) parts.push(`lang/${fl.lang}`);
            if (fl.letter) parts.push(`letter/${fl.letter}`);
            if (fl.year) parts.push(`year/${fl.year}`);
            url = `${host}/index.php/vod/show/${parts.join('/')}/id/${MY_CATE}/page/${pg}.html`;
        }

        let html = await request(url);

        if (!html) {
            return setResult([]);
        }

        let items = pdfa(html, '.module-items .module-item') || [];

        let d = items.map(it => {
            return {
                title: pd(it, 'a&&title') || pdfh(it, '.module-item-title&&Text') || '',
                pic_url: pd(it, 'img&&data-src') || pd(it, 'img&&src') || '',
                desc: pdfh(it, '.module-item-text&&Text') || pdfh(it, '.module-item-content&&Text') || '',
                url: pd(it, 'a&&href') || ''
            };
        }).filter(item => item !== null);

        return setResult(d);
    },
    二级: async function (ids) {
        let {input, pdfa, pdfh, pd, host} = this;
        let html = await request(input);

        let vod = {
            vod_name: pdfh(html, '.video-info h1&&Text') || pdfh(html, 'h1&&Text') || '未知名称',
            type_name: pdfh(html, '.tag-link&&Text') || '',
            vod_pic: pd(html, '.lazyload&&data-original') || pd(html, 'img&&data-src') || '',
            vod_content: pdfh(html, '.sqjj_a--span&&Text') || pdfh(html, '.video-info-content&&Text') || '暂无简介',
            vod_remarks: pdfh(html, '.video-info-items:eq(3)&&Text') || '',
            vod_year: pdfh(html, '.tag-link:eq(2)&&Text') || '未知年份',
            vod_area: pdfh(html, '.tag-link:eq(3)&&Text') || '未知地区',
            vod_actor: pdfh(html, '.video-info-actor:eq(1)&&Text') || '未知演员',
            vod_director: pdfh(html, '.video-info-actor:eq(0)&&Text') || '未知导演'
        };

        let allLinks = new Set();
        pdfa(html, '.module-row-title').forEach(item => {
            let link = pd(item, 'p&&Text')?.trim();
            if (link) allLinks.add(link);
        });

        let playSources = [];
        let counters = {百度: 1, 优汐: 1, 夸克: 1, 天翼: 1, 123: 1, 移动: 1, 阿里: 1};

        for (let link of allLinks) {
            if (/\.quark/.test(link)) {
                let share = await Quark.getShareData(link);
                if (!share) continue;
                let videos = await Quark.getFilesByShareUrl(share);
                if (videos && videos.length > 0) {
                    let name = '夸克#' + counters.夸克++;
                    let urls = videos.map(v => {
                        let sizeStr = v.formatted_size || (v.size ? formatFileSize(v.size) : '');
                        return `${v.file_name}${sizeStr ? ' 【' + sizeStr + '】' : ''}$${[share.shareId, v.stoken, v.fid, v.share_fid_token].join('*')}`;
                    }).join('#');
                    let pics = videos.map(v => v.thumbnail || '').join('#');
                    playSources.push({name, urls, pics, pan: link, type: '夸克'});
                }
            } else if (/\.uc/i.test(link)) {
                let share = await UC.getShareData(link);
                if (!share) continue;
                let videos = await UC.getFilesByShareUrl(share);
                if (videos && videos.length > 0) {
                    let name = '优汐#' + counters.优汐++;
                    let urls = videos.map(v => {
                        let sizeStr = v.formatted_size || (v.size ? formatFileSize(v.size) : '');
                        return `${v.file_name}${sizeStr ? ' 【' + sizeStr + '】' : ''}$${[share.shareId, v.stoken, v.fid, v.share_fid_token].join('*')}`;
                    }).join('#');
                    let pics = videos.map(v => v.thumbnail || '').join('#');
                    playSources.push({name, urls, pics, pan: link, type: '优汐'});
                }
            } else if (/\.189/.test(link)) {
                let share = await Cloud.getShareData(link);
                if (share && Object.keys(share).length > 0) {
                    Object.keys(share).forEach(k => {
                        if (share[k] && share[k].length > 0) {
                            let urls = share[k].map(v => {
                                let sizeStr = v.formatted_size || (v.size ? formatFileSize(v.size) : '');
                                return `${v.name}${sizeStr ? ' 【' + sizeStr + '】' : ''}$${[v.fileId, v.shareId].join('*')}`;
                            }).join('#');
                            let pics = share[k].map(v => v.thumbnail || '').join('#');
                            playSources.push({name: '天翼-' + k, urls, pics, pan: link, type: '天翼'});
                        }
                    });
                }
            } else if (/\.139/.test(link)) {
                let share = await Yun.getShareData(link);
                if (share && Object.keys(share).length > 0) {
                    Object.keys(share).forEach(k => {
                        if (share[k] && share[k].length > 0) {
                            let urls = share[k].map(v => {
                                let sizeStr = v.formatted_size || (v.size ? formatFileSize(v.size) : '');
                                return `${v.name}${sizeStr ? ' 【' + sizeStr + '】' : ''}$${[v.contentId, v.linkID].join('*')}`;
                            }).join('#');
                            let pics = share[k].map(v => v.thumbnail || '').join('#');
                            playSources.push({name: '移动-' + k, urls, pics, pan: link, type: '移动'});
                        }
                    });
                }
            } else if (/\.123/.test(link)) {
                let share = await Pan.getShareData(link);
                let videos = await Pan.getFilesByShareUrl(share);
                if (videos && Object.keys(videos).length > 0) {
                    Object.keys(videos).forEach(k => {
                        if (videos[k] && videos[k].length > 0) {
                            let urls = videos[k].map(v => {
                                let sizeStr = v.formatted_size || (v.Size ? formatFileSize(v.Size) : '');
                                return `${v.FileName}${sizeStr ? ' 【' + sizeStr + '】' : ''}$${[v.ShareKey, v.FileId, v.S3KeyFlag, v.Size, v.Etag].join('*')}`;
                            }).join('#');
                            let pics = videos[k].map(v => v.Thumbnail || '').join('#');
                            playSources.push({name: '123-' + k, urls, pics, pan: link, type: '123'});
                        }
                    });
                }
            } else if (/\.baidu/.test(link)) {
                let share = await Baidu2.getShareData(link);
                if (share && Object.keys(share).length > 0) {
                    Object.keys(share).forEach((k, idx) => {
                        if (share[k] && share[k].length > 0) {
                            let name = allLinks.size === 1 ? '百度#1' : '百度-' + k.split('/').pop();
                            let urls = share[k].map(v => {
                                let sizeStr = v.formatted_size || (v.size ? formatFileSize(v.size) : '');
                                return `${v.name}${sizeStr ? ' 【' + sizeStr + '】' : ''}$${[v.path, v.uk, v.shareid, v.fsid].join('*')}`;
                            }).join('#');
                            let pics = share[k].map(v => v.thumbnail || '').join('#');
                            playSources.push({name, urls, pics, pan: link, type: '百度'});
                        }
                    });
                }
            } else if (/\.alipan/.test(link)) {
                let share = await Ali.getShareData(link);
                if (!share) continue;
                let videos = await Ali.getFilesByShareUrl(share);
                if (videos && videos.length > 0) {
                    let name = '阿里#' + counters.阿里++;
                    let urls = videos.map(v => {
                        let sizeStr = v.formatted_size || (v.size ? formatFileSize(v.size) : '');
                        return `${v.name}${sizeStr ? ' 【' + sizeStr + '】' : ''}$${[v.share_id, v.file_id, v.subtitle?.file_id || ''].join('*')}`;
                    }).join('#');
                    let pics = videos.map(v => v.thumbnail || '').join('#');
                    playSources.push({name, urls, pics, pan: link, type: '阿里'});
                }
            }
        }

        // 按照 line_order 排序
        if (playSources.length > 0) {
            // 创建类型优先级映射
            const typePriority = {};
            rule.line_order.forEach((type, index) => {
                typePriority[type] = index;
            });

            playSources.sort((a, b) => {
                const priorityA = typePriority[a.type] !== undefined ? typePriority[a.type] : 999;
                const priorityB = typePriority[b.type] !== undefined ? typePriority[b.type] : 999;
                return priorityA - priorityB;
            });

            let playform = playSources.map(s => s.name);
            let playurls = playSources.map(s => s.urls);
            let playPics = playSources.map(s => s.pics);
            let playPans = playSources.map(s => s.pan);

            vod.vod_play_from = playform.join("$$$");
            vod.vod_play_url = playurls.join("$$$");
            vod.vod_play_pic = playPics.join('$$$');
            vod.vod_play_pic_ratio = 1.0;
            vod.vod_play_pan = playPans.join("$$$");
        }

        return vod;
    },

    搜索: async function (wd, quick, pg) {
        let {host, input, pdfa, pdfh, pd} = this;
        let url = rule_type ?
            `${host}/vodsearch/${wd}----------${pg}---.html` :
            `${host}/index.php/vod/search/page/${pg}/wd/${wd}.html`;

        let html = await request(url);
        let d = [];
        let items = pdfa(html, '.module-items .module-search-item') || [];

        items.forEach(it => {
            let title = pdfh(it, '.video-info&&a&&title');
            if (rule.search_match && !title.includes(wd)) return;
            d.push({
                title,
                img: pd(it, 'img&&data-src'),
                desc: pdfh(it, '.video-serial&&Text'),
                content: pdfh(it, '.video-info-item:eq(2)&&Text').replace(/(bsp;)|(&n.*?)|(&nbsp;)|(\s+)/gi, ''),
                url: pd(it, '.video-info&&a&&href')
            });
        });
        return setResult(d);
    },

    lazy: async function (flag, id, flags) {
        let {input, mediaProxyUrl} = this;
        let ids = input.split('*');
        let urls = [];
        let UCDownloadingCache = {};
        let UCTranscodingCache = {};

        if (flag.startsWith('夸克')) {
            console.log("夸克网盘解析开始");
            const headers = {
                'Cookie': ENV.get('quark_cookie')
            };

            // 始终获取基础链接
            const link = await Quark.getUrl(ids[0], ids[1], ids[2], ids[3]);
            link.forEach(item => {
                if (item !== undefined) {
                    urls.push("无限" + item.name, item.url + "#isVideo=true##fastPlayMode##threads=20#")
                    urls.push("无限猫" + item.name, `http://127.0.0.1:5575/proxy?thread=${ENV.get('thread') || 6}&chunkSize=256&url=` + encodeURIComponent(item.url) + '&header=' + encodeURIComponent(JSON.stringify(headers)));
                }
            });

            // 根据 quark_transfer 配置决定是否获取下载和转码链接
            if (rule.quark_transfer) {
                console.log("夸克网盘获取下载和转码链接");

                // 获取下载链接
                const down = await Quark.getDownload(ids[0], ids[1], ids[2], ids[3], true);
                down.forEach((t) => {
                    if (t.url !== undefined) {
                        urls.push(t.name, t.url + "#isVideo=true##fastPlayMode##threads=20#")
                        urls.push("猫" + t.name, `http://127.0.0.1:5575/proxy?thread=${ENV.get('thread') || 6}&chunkSize=1024&url=` + encodeURIComponent(t.url));
                    }
                });

                // 获取转码链接
                const transcoding = (await Quark.getLiveTranscoding(ids[0], ids[1], ids[2], ids[3])).filter((t) => t.accessable);
                transcoding.forEach((t) => {
                    urls.push(t.resolution === 'low' ? "流畅" : t.resolution === 'high' ? "高清" : t.resolution === 'super' ? "超清" : t.resolution, t.video_info.url + "#isVideo=true##fastPlayMode##threads=20#")
                });
            }

            return {
                parse: 0,
                url: urls,
                header: headers
            };
        } else if (flag.startsWith('UC')) {
            console.log("UC网盘解析开始");
            if (!UCDownloadingCache[ids[1]]) {
                let down = await UC.getDownload(ids[0], ids[1], ids[2], ids[3], true);
                if (down) UCDownloadingCache[ids[1]] = down;
            }
            let downCache = UCDownloadingCache[ids[1]];
            return await UC.getLazyResult(downCache, mediaProxyUrl);
        } else if (flag.startsWith('移动')) {
            console.log("移动网盘解析开始");
            let url = await Yun.getSharePlay(ids[0], ids[1]);
            return {
                url: `${url}`
            };
        } else if (flag.startsWith('天翼')) {
            console.log("天翼网盘解析开始");
            let url = await Cloud.getShareUrl(ids[0], ids[1]);
            return {
                url: `${url}`
            };
        } else if (flag.startsWith('123')) {
            console.log("123网盘解析开始");
            let url = await Pan.getDownload(ids[0], ids[1], ids[2], ids[3], ids[4]);
            urls.push("原画", url);
            return {
                parse: 0,
                url: urls
            };
        } else if (flag.startsWith('阿里')) {
            const transcoding_flag = {
                UHD: "4K 超清",
                QHD: "2K 超清",
                FHD: "1080 全高清",
                HD: "720 高清",
                SD: "540 标清",
                LD: "360 流畅"
            };
            console.log("阿里网盘解析开始");
            const down = await Ali.getDownload(ids[0], ids[1], flag === 'down');
            urls.push("原画", down.url + "#isVideo=true##ignoreMusic=true#");
            urls.push("极速原画", down.url + "#fastPlayMode##threads=10#");
            const transcoding = (await Ali.getLiveTranscoding(ids[0], ids[1])).sort((a, b) => b.template_width - a.template_width);
            transcoding.forEach((t) => {
                if (t.url !== '') {
                    urls.push(transcoding_flag[t.template_id], t.url);
                }
            });
            return {
                parse: 0,
                url: urls,
                header: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                    'Referer': 'https://www.aliyundrive.com/'
                }
            };
        } else if (flag.startsWith('百度')) {
            console.log("百度网盘开始解析");
            let url = await Baidu2.getAppShareUrl(ids[0], ids[1], ids[2], ids[3]);
            urls.push("原画", url + "#isVideo=true##fastPlayMode##threads=10#");
            urls.push(
                "原代本",
                `http://127.0.0.1:7777/?thread=${ENV.get('thread') || 6}&form=urlcode&randUa=1&url=` +
                encodeURIComponent(url)
            );
            return {
                parse: 0,
                url: urls,
                header: {
                    "User-Agent": 'netdisk;P2SP;2.2.91.136;android-android;'
                }
            };
        }
    }
}

function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    let units = ['B', 'KB', 'MB', 'GB', 'TB'], i = 0;
    while (bytes >= 1024 && i < 4) {
        bytes /= 1024;
        i++;
    }
    return bytes.toFixed(2) + ' ' + units[i];
}