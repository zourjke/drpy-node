/*
@header({
  searchable: 1,
  filterable: 1,
  quickSearch: 1,
  title: '剧透社[盘]',
  author: 'EylinSir',
  '类型': '影视',
  logo: 'https://1.star2.cn/favicon.ico',
  lang: 'ds'
})
*/

var rule = {
    类型: '影视',
    author: 'EylinSir',
    title: '剧透社[盘]',
    host: 'https://1.star2.cn',
    url: '/fyclass/?page=fypage',
    searchUrl: '/search/?keyword=**',
    logo: 'https://1.star2.cn/favicon.ico',
    searchable: 1,
    quickSearch: 1,
    filterable: 1,
    timeout: 15000,
    class_name: '国剧&电影&动漫&短剧&综艺&韩日&英美&外剧',
    class_url: 'ju&mv&dm&dj&zy&rh&ym&wj',
    play_parse: true,
    limit: 20,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
        'Referer': 'https://1.star2.cn/',
        'Connection': 'keep-alive'
    },

    // 随机延时 (1.5s - 3s)
    _sleep: () => new Promise(r => setTimeout(r, Math.floor(Math.random() * 500) + 1500)),

    _fetch: async function(url) {
        await this._sleep();
        try {
            return await request(url, { headers: this.headers });
        } catch (e) {
            return null;
        }
    },

    // 列表解析（含标题清洗 + 精准排除干扰项）
    _getVideos: function(list) {
        if (!Array.isArray(list)) return [];
        
        return list.map(x => {
            let originalName = pdfh(x, "a&&Text") || '';
            
            // 【精准排除】只排除包含特定关键词的导航项，防止误杀
            if (originalName.includes('看短剧 / 网剧点我') || originalName.includes('连载短剧 / 网剧更新')) {
                return null;
            }

            return {
                // 标题：去掉【】开头，并只取第一个点号之前的部分
                vod_name: originalName.replace(/^【[^】]+】/, '').split('.')[0].trim(),
                vod_pic: this.publicUrl + '/images/icon_cookie/夸克.png',
                // Remarks：取点号后面的内容 (去掉点号本身)
                vod_remarks: originalName.replace(/^(【[^】]+】)?.*?\.(.+)$/, '$1$2'),
                vod_id: pd(x, "a&&href")
            };
        }).filter(x => x !== null); // 过滤掉标记为 null 的干扰项
    },
    
    一级: async function(tid, pg) {
        let url = this.input;
        let html = await this._fetch(url);
        return this._getVideos(pdfa(html, ".erx-list&&li"));
    },

    二级: async function(ids) {
        try {
            let id = Array.isArray(ids) ? ids[0] : ids;
            let url = this.input;
            let html = await this._fetch(url);
            let rawTitle = pdfh(html, 'h1&&Text') || '未知标题';
            let title = rawTitle.replace(/^【[^】]+】/, '').split('.')[0].trim();
            let remarks = rawTitle.replace(/^(【[^】]+】)?.*?\.(.+)$/, '$1$2');
            let allLines = [], playForm = [];
            let links = pdfa(html, '.dlipp-cont-bd a').map(btn => pdfh(btn, 'a&&href')).filter(l => l);

            // 百度网盘
            for (let link of links.filter(l => l.includes('pan.baidu.com'))) {
                await new Promise(r => setTimeout(r, 200));
                let data = await Baidu2.getShareData(link);
                if (data) {
                    Object.keys(data).forEach((it) => {
                        let videos = data[it];
                        if (videos && videos.length > 0) {
                            playForm.push('Baidu-' + (playForm.length + 1));
                            allLines.push(videos.map(item => 
                                item.name + "$" + [item.path, item.uk, item.shareid, item.fsid].join('*')
                            ).join('#'));
                        }
                    });
                }
            }

            // 夸克网盘
            for (let link of links.filter(l => l.includes('pan.quark.cn'))) {
                await new Promise(r => setTimeout(r, 200));
                let shareData = await Quark.getShareData(link);
                if (shareData) {
                    let videos = await Quark.getFilesByShareUrl(shareData);
                    if (videos && videos.length > 0) {
                        playForm.push('Quark-' + shareData.shareId);
                        allLines.push(videos.map(v => {
                            const list = [shareData.shareId, v.stoken, v.fid, v.share_fid_token, v.subtitle ? v.subtitle.fid : '', v.subtitle ? v.subtitle.share_fid_token : ''];
                            return v.file_name + '$' + list.join('*');
                        }).join('#'));
                    }
                }
            }

            return {
                vod_name: title,
                vod_pic: this.图片,
                vod_content: pdfh(html, '.card-text:eq(0)&&Text') || title,
                vod_remarks: remarks,
                vod_play_from: playForm.join('$$$') || '无资源',
                vod_play_url: allLines.join('$$$') || '暂无资源$#'
            };
        } catch (e) {
            return { vod_name: '解析失败', vod_play_from: '无资源', vod_play_url: '' };
        }
    },

    搜索: async function(wd, pg) {
        let url = `${this.host}/search/?keyword=${encodeURIComponent(wd)}${pg > 1 ? `&page=${pg}` : ''}`;
        let html = await this._fetch(url);
        return html ? this._getVideos(pdfa(html, ".erx-list&&li")) : [];
    },

    lazy: async function(flag, id, flags) {
        // 夸克解析
        if (flag.startsWith('Quark-')) {
            const ids = id.split('*');
            const down = await Quark.getDownload(ids[0], ids[1], ids[2], ids[3], true);
            let urls = [];
            
            // 下载链接：包含代理(猫)和直连(原画)
            if (down && Array.isArray(down)) {
                down.forEach((t) => {
                    if (t.url) {
                        urls.push("猫" + t.name, `http://127.0.0.1:5575/proxy?thread=${ENV.get('thread') || 6}&chunkSize=256&url=` + encodeURIComponent(t.url));
                        urls.push(t.name, t.url + "#isVideo=true##fastPlayMode##threads=20#");
                    }
                });
            }

            // 转码链接
            const trans = await Quark.getLiveTranscoding(ids[0], ids[1], ids[2], ids[3]).catch(() => []);
            trans.filter(t => t.accessable).forEach(t => {
                urls.push(t.resolution === 'low' ? "流畅" : t.resolution === 'high' ? "高清" : t.resolution === 'super' ? "超清" : t.resolution, t.video_info.url + "#isVideo=true##fastPlayMode##threads=20#");
            });

            return { parse: 0, url: urls, header: { 'Cookie': ENV.get('quark_cookie') } };
        }

        // 百度解析
        if (flag.startsWith('Baidu-')) {
            const ids = id.split('*');
            let url = await Baidu2.getAppShareUrl(ids[0], ids[1], ids[2], ids[3]);
            return {
                parse: 0,
                url: ["原画", url + "#isVideo=true##fastPlayMode##threads=10#"],
                header: { "User-Agent": 'netdisk;P2SP;2.2.91.136;android-android;', "Cookie": ENV.get('baidu_cookie') }
            };
        }

        return { parse: 0, url: id };
    }
};