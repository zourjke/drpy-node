/*
@header({
  searchable: 1,
  filterable: 0,
  quickSearch: 1,
  title: 'libvio影视',
  author: 'EylinSir',
  '类型': '影视',
  lang: 'ds'
})
*/

var rule = {
    author: 'EylinSir',
    title: 'libvio影视',
    类型: '影视',
    host: 'https://libhd.com',
    headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
        'Referer': 'https://libhd.com'
    },
    编码: 'utf-8',
    timeout: 20000,
    homeUrl: '/',
    class_name: '电影&电视剧&动漫&日韩剧&欧美剧',
    class_url: '1&2&4&15&16',
    url: '/type/fyclass-fypage.html',
    searchUrl: '/search/----------fypage---.html?wd=**',
    detailUrl: '/detail/fyid.html',
    playUrl: '/play/fyid.html',
    searchable: 1,
    quickSearch: 1,
    filterable: 0,
    limit: 90,
    double: false,
    play_parse: true,

    推荐: async function(tid, pg, filter, extend) {
        return this.一级();
    },

    一级: async function(tid, pg, filter, extend) {
        let { input, pdfa, pdfh, pd } = this;
        let html = await request(input);
        let d = pdfa(html, '.stui-vodlist li').map(it => ({
            title: pdfh(it, 'a&&title'),
            pic_url: pd(it, '.lazyload&&data-original'),
            desc: pdfh(it, '.pic-text&&Text'),
            url: pd(it, 'a&&href')
        }));
        return setResult(d);
    },

    二级: async function(ids) {
        try {
            let { input, pdfa, pdfh, pd } = this;
            let html = await request(input);

            let VOD = {
                vod_name: pdfh(html, 'h1&&Text') || '',
                vod_pic: pd(html, 'img&&data-original', input) || pd(html, 'img&&src', input) || '',
                vod_content: pdfh(html, '.detail-content&&Text') || pdfh(html, '*:contains(简介：)&&Text') || '',
                vod_play_from: '',
                vod_play_url: '',
                vod_play_pan: ''
            };

            let descLines = pdfa(html, '.stui-content__detail p.data').slice(0, 5).map(p => pdfh(p, 'p&&Text'));
            let allDesc = descLines.join(' ');
            const getMeta = (key) => (allDesc.match(new RegExp(`${key}：([^\\/]+)`)) || [])[1]?.trim() || '';

            VOD.vod_type = getMeta('类型');
            VOD.vod_area = getMeta('地区');
            VOD.vod_year = getMeta('年份');
            VOD.vod_actor = getMeta('主演');
            VOD.vod_director = getMeta('导演');
            VOD.vod_total = (allDesc.match(/总集数：(\d+)/) || [])[1] || '';
            VOD.vod_score = (html.match(/<span[^>]*class="douban"[^>]*>([^<]+)<\/span>/i) || [])[1]?.trim() || '';
            VOD.vod_remarks = descLines.join(' ');

            let playform = [], playurls = [], playPans = [];

            const parsePanUrl = async (url, name) => {
                url = url.replace(/`/g, '').trim();
                playPans.push(url);

                if (url.includes('pan.quark.cn')) {
                    let sd = await Quark.getShareData(url);
                    if (!sd) return [];
                    return (await Quark.getFilesByShareUrl(sd)).map(v => {
                        let fileName = v.file_name || v.name || name;
                        let token = [sd.shareId, v.stoken, v.fid, v.share_fid_token, v.subtitle?.fid || '', v.subtitle?.share_fid_token || ''].join('*');
                        return `${fileName}$${token}`;
                    });
                }

                if (url.includes('drive.uc.cn')) {
                    let sd = await UC.getShareData(url);
                    if (!sd) return [];
                    return (await UC.getFilesByShareUrl(sd)).map(v => {
                        let fileName = v.file_name || v.name || name;
                        let token = [sd.shareId, v.stoken, v.fid, v.share_fid_token, v.subtitle?.fid || '', v.subtitle?.share_fid_token || ''].join('*');
                        return `${fileName}$${token}`;
                    });
                }

                if (url.includes('pan.baidu.com')) {
                    let sd = await Baidu2.getShareData(url);
                    if (!sd) return [];
                    return Object.values(sd).flat().map(v => {
                        let fileName = v.file_name || v.name || name;
                        let token = [v.path, v.uk, v.shareid, v.fsid].join('*');
                        return `${fileName}$${token}`;
                    });
                }

                if (url.includes('pan.xunlei.com')) {
                    let sd = await Xun.getShareData(url);
                    if (!sd) return [];
                    return Object.values(sd).flat().map(v => {
                        let fileName = v.name || name;
                        let token = [v.fileId, v.share_id, v.parent_id, v.pass_code_token].join('*');
                        return `${fileName}$${token}`;
                    });
                }

                return [];
            };

            let sections = pdfa(html, '.stui-vodlist__head');
            for (let sec of sections) {
                let lineName = (pdfh(sec, '.stui-pannel__head h3&&Text') || pdfh(sec, 'h3&&Text') || '').replace(/[\uE000-\uF8FF]/g, '').trim();
                if (!lineName) continue;
                if (/夸克|UC|迅雷|百度|网盘|下载/.test(lineName)) continue;

                let links = pdfa(sec, '.stui-content__playlist li a');
                let episodeList = links.map(a => {
                    let title = pdfh(a, 'a&&Text');
                    let href = pd(a, 'a&&href', input);
                    return title && href ? `${title}$${href}` : '';
                }).filter(Boolean);

                if (episodeList.length) {
                    playform.push(lineName);
                    playurls.push(episodeList.join('#'));
                }
            }

            let netdiskPanels = pdfa(html, '.playlist-panel.netdisk-panel');
            for (let panel of netdiskPanels) {
                let lineName = pdfh(panel, '.netdisk-head-inner h3&&Text') || '';
                lineName = lineName.replace(/[\uE000-\uF8FF]/g, '').trim();
                if (!lineName) continue;

                let episodeList = [];
                for (let item of pdfa(panel, '.netdisk-list .netdisk-item')) {
                    let url = pd(item, 'a&&href', input);
                    if (!url) continue;
                    let name = pdfh(item, '.netdisk-name&&Text') || '文件';
                    name = name.replace(/[\uE000-\uF8FF]/g, '').trim();
                    let items = await parsePanUrl(url, name);
                    episodeList.push(...items);
                }

                if (episodeList.length) {
                    playform.push(lineName);
                    playurls.push(episodeList.join('#'));
                }
            }

            VOD.vod_play_from = playform.join('$$$');
            VOD.vod_play_url = playurls.join('$$$');
            VOD.vod_play_pan = playPans.join('$$$');
            return VOD;

        } catch (error) {
            return {
                vod_name: '加载失败',
                vod_pic: '',
                vod_content: `解析失败：${error.message}`,
                vod_remarks: '请检查网络或配置',
                vod_play_from: '错误$$$无效',
                vod_play_url: `详情：${error.message}$$$请重试`,
                vod_play_pan: ''
            };
        }
    },

    搜索: async function(wd, quick, pg) {
        return this.一级();
    },

    lazy: async function(flag, id, flags) {
        let { mediaProxyUrl } = this;

        if (/夸克|视频下载 \(夸克\)/.test(flag)) {
            let ids = id.split('*'), urls = [];
            let headers = { 'Cookie': ENV.get('quark_cookie') };

            (await Quark.getUrl(ids[0], ids[1], ids[2], ids[3])).forEach(item => {
                if (item) {
                    urls.push("无限" + item.name, item.url + "#isVideo=true##fastPlayMode##threads=20#");
                    urls.push("无限猫" + item.name, `http://127.0.0.1:5575/proxy?thread=${ENV.get('thread') || 6}&chunkSize=256&url=` + encodeURIComponent(item.url) + '&header=' + encodeURIComponent(JSON.stringify(headers)));
                }
            });

            (await Quark.getDownload(ids[0], ids[1], ids[2], ids[3], true)).forEach(t => {
                if (t.url) {
                    urls.push("猫" + t.name, `http://127.0.0.1:5575/proxy?thread=${ENV.get('thread') || 6}&chunkSize=256&url=` + encodeURIComponent(t.url));
                    urls.push(t.name, t.url + "#isVideo=true##fastPlayMode##threads=20#");
                }
            });

            (await Quark.getLiveTranscoding(ids[0], ids[1], ids[2], ids[3])).filter(t => t.accessable).forEach(t => {
                urls.push(t.resolution === 'low' ? "流畅" : t.resolution === 'high' ? "高清" : t.resolution === 'super' ? "超清" : t.resolution, t.video_info.url + "#isVideo=true##fastPlayMode##threads=20#");
            });

            return { parse: 0, url: urls, header: headers };
        }

        if (/UC|视频下载\(UC\)/.test(flag)) {
            let ids = id.split('*');
            let down = await UC.getDownload(ids[0], ids[1], ids[2], ids[3], true);
            return await UC.getLazyResult(down, mediaProxyUrl);
        }

        if (flag.includes('百度')) {
            let ids = id.split('*');
            let url = await Baidu2.getAppShareUrl(ids[0], ids[1], ids[2], ids[3]);
            return {
                parse: 0,
                url: ["原画", url + "#isVideo=true##fastPlayMode##threads=10#"],
                header: {
                    "User-Agent": 'netdisk;P2SP;2.2.91.136;android-android;',
                    "Cookie": ENV.get('baidu_cookie'),
                }
            };
        }

        if (/迅雷|视频下载\(迅雷\)/.test(flag)) {
            log('迅雷云盘开始解析');
            let ids = id.split('*');
            let urls = await Xun.getShareUrl(ids[0], ids[1], ids[3]);
            const header = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/67.0.3396.99 Safari/537.36"
            };
            if (ENV.get('xun_auth') !== '') {
                try {
                    let url = await Xun.getDownloadUrl(ids[0], ids[1], ids[3]);
                    if (url !== '') {
                        const proxyHeader = `&header=${encodeURIComponent(JSON.stringify(header))}`;
                        urls.push('原画', url + "#isVideo=true##fastPlayMode##threads=20#");
                        urls.push("猫画", `http://127.0.0.1:5575/proxy?thread=${ENV.get('thread') || 6}&chunkSize=256&url=` + encodeURIComponent(url) + proxyHeader);
                    }
                } catch (err) {
                    log(`迅雷本地凭证可能已过期，请重新登录: ${err.message}`);
                }
            }
            return {
                parse: 0,
                url: urls,
                header: header
            };
        }

        return { parse: 1, url: this.input, header: this.headers };
    }
};
