/*
@header({
  searchable: 0,
  filterable: 0,
  quickSearch: 0,
  title: '推送',
  '类型': '影视',
  lang: 'ds'
})
*/

const {getHtml} = $.require('./_lib.request.js')
const {
    formatPlayUrl,
} = misc;
const aliTranscodingCache = {};
const aliDownloadingCache = {};
var rule = {
    title: '推送',
    host: '',
    class_name: '推送',
    class_url: 'push',
    url: '',
    play_parse: true,
    推荐: async function () {
        let {publicUrl} = this;
        let icon = urljoin(publicUrl, './images/icon_cookie/推送.jpg');
        return [{
            vod_id: 'https://vdse.bdstatic.com//628ca08719cef5987ea2ae3c6f0d2386.mp4',
            vod_name: '测试推送直链',
            vod_pic: icon,
            vod_remarks: '纯二级源'
        }]
    },
    一级: async function (tid, pg, filter, extend) {
        let {MY_CATE, MY_PAGE, input} = this;
        return []
    },
    二级: async function (ids) {
        let {input, orId, publicUrl} = this;
        let playform = []
        let playurls = []
        // log('[push_agent] orId:', orId);
        input = decodeURIComponent(orId);
        // 清理输入，只保留有效的URL部分，移除可能的日志内容
        input = input.replace(/\[\d{4}-\d{2}-\d{2}.*$/, '').trim();
        let icon = urljoin(publicUrl, './images/icon_cookie/推送.jpg');
        let vod = {
            vod_pic: icon,
            vod_id: orId,
            vod_content: 'DS推送:道长&秋秋倾情打造',
        }
        let playPans = [];
        if (/^[\[{]/.test(input.trim())) {
            try {
                let push_vod = JSON.parse(input);
                push_vod = Array.isArray(push_vod) ? push_vod[0] : push_vod;
                vod.vod_actor = push_vod.actor || push_vod.vod_actor || '';
                vod.vod_content = push_vod.content || push_vod.vod_content || '';
                vod.vod_director = push_vod.director || push_vod.vod_director || '';
                vod.vod_play_from = push_vod.from || push_vod.vod_play_from || '';
                vod.vod_name = push_vod.name || push_vod.vod_name || '';
                vod.vod_pic = push_vod.pic || push_vod.vod_pic || '';
                vod.vod_play_url = push_vod.url || push_vod.vod_play_url || '';
                // 推送json兼容依赖播放属性
                vod.vod_play_api = push_vod.vod_play_api || '';
                vod.vod_play_flag = push_vod.vod_play_flag || null;
                vod.vod_play_index = push_vod.vod_play_index || null;
                vod.vod_play_position = push_vod.vod_play_position || null;
                log('[push_agent] vod success:', vod);
                return vod
            } catch (e) {
                log('[push_agent] vod error:', e.message);
            }
        }
        log('[push_agent] decode input:', input);
        if (input.indexOf('@') > -1) {
            let list = input.split('@');
            // log(list);
            for (let i = 0; i < list.length; i++) {
                if (/pan.quark.cn|drive.uc.cn|www.alipan.com|www.aliyundrive.com|cloud.189.cn|yun.139.com|caiyun.139.com|www.123684.com|www.123865.com|www.123912.com|www.123pan.com|www.123pan.cn|www.123592.com|pan.baidu.com|pan.xunlei.com/.test(list[i])) {
                    if (/pan.quark.cn/.test(list[i])) {
                        playPans.push(list[i]);
                        const shareData = Quark.getShareData(list[i]);
                        if (shareData) {
                            const videos = await Quark.getFilesByShareUrl(shareData);
                            if (videos.length > 0) {
                                playform.push('Quark-' + shareData.shareId);
                                playurls.push(videos.map((v) => {
                                    const list = [shareData.shareId, v.stoken, v.fid, v.share_fid_token, v.subtitle ? v.subtitle.fid : '', v.subtitle ? v.subtitle.share_fid_token : ''];
                                    return v.file_name + '$' + list.join('*');
                                }).join('#'))
                            } else {
                                playform.push('Quark-' + shareData.shareId);
                                playurls.push("资源已经失效，请访问其他资源")
                            }
                        }
                    }
                    if (/drive.uc.cn/.test(list[i])) {
                        playPans.push(list[i]);
                        const shareData = UC.getShareData(list[i]);
                        if (shareData) {
                            const videos = await UC.getFilesByShareUrl(shareData);
                            if (videos.length > 0) {
                                playform.push('UC-' + shareData.shareId);
                                playurls.push(videos.map((v) => {
                                    const list = [shareData.shareId, v.stoken, v.fid, v.share_fid_token, v.subtitle ? v.subtitle.fid : '', v.subtitle ? v.subtitle.share_fid_token : ''];
                                    return v.file_name + '$' + list.join('*');
                                }).join('#'))
                            } else {
                                playform.push('UC-' + shareData.shareId);
                                playurls.push("资源已经失效，请访问其他资源")
                            }
                        }
                    }
                    if (/www.alipan.com|www.aliyundrive.com/.test(list[i])) {
                        playPans.push(list[i]);
                        const shareData = Ali.getShareData(list[i]);
                        if (shareData) {
                            const videos = await Ali.getFilesByShareUrl(shareData);
                            log(videos)
                            if (videos.length > 0) {
                                playform.push('Ali-' + shareData.shareId);
                                playurls.push(videos.map((v) => {
                                    const ids = [v.share_id, v.file_id, v.subtitle ? v.subtitle.file_id : ''];
                                    return formatPlayUrl('', v.name) + '$' + ids.join('*');
                                }).join('#'))
                            } else {
                                playform.push('Ali-' + shareData.shareId);
                                playurls.push("资源已经失效，请访问其他资源")
                            }
                        }
                    }
                    if (/cloud.189.cn/.test(list[i])) {
                        playPans.push(list[i]);
                        let data = await Cloud.getShareData(list[i])
                        let hasValidFiles = false;
                        Object.keys(data).forEach(it => {
                            if (Array.isArray(data[it]) && data[it].length > 0) {
                                playform.push('Cloud-' + it)
                                const urls = data[it].map(item => item.name + "$" + [item.fileId, item.shareId].join('*')).join('#');
                                playurls.push(urls);
                                hasValidFiles = true;
                            }
                        })
                        if (!hasValidFiles) {
                            playform.push('Cloud-' + Date.now());
                            playurls.push("资源已经失效，请访问其他资源")
                        }
                    }
                    if (/yun.139.com|caiyun.139.com/.test(list[i])) {
                        playPans.push(list[i]);
                        let data = await Yun.getShareData(list[i])
                        let hasValidFiles = false;
                        Object.keys(data).forEach(it => {
                            if (Array.isArray(data[it]) && data[it].length > 0) {
                                playform.push('Yun-' + it)
                                const urls = data[it].map(item => item.name + "$" + [item.contentId, item.linkID].join('*')).join('#');
                                playurls.push(urls);
                                hasValidFiles = true;
                            }
                        })
                        if (!hasValidFiles) {
                            playform.push('Yun-' + Date.now());
                            playurls.push("资源已经失效，请访问其他资源")
                        }
                    }
                    if (/www.123684.com|www.123865.com|www.123912.com|www.123pan.com|www.123pan.cn|www.123592.com/.test(list[i])) {
                        playPans.push(list[i]);
                        let shareData = await Pan.getShareData(list[i])
                        let videos = await Pan.getFilesByShareUrl(shareData)
                        let allVideos = Array.isArray(videos) ? videos : Object.values(videos).flat();
                        if (allVideos.length > 0) {
                            playform.push('Pan123-' + shareData);
                            playurls.push(allVideos.map((v) => {
                                const list = [v.ShareKey, v.FileId, v.S3KeyFlag, v.Size, v.Etag];
                                return v.FileName + '$' + list.join('*');
                            }).join('#'))
                        }
                    }
                    if (/pan.baidu.com/.test(list[i])) {
                        let data = await Baidu2.getShareData(list[i])
                        let vod_content_add = [vod.vod_content];
                        Object.keys(data).forEach((it, index) => {
                            playform.push('Baidu-' + Number(index + 1));
                            vod_content_add.push(it);
                            const urls = data[it].map(item => item.name + "$" + [item.path, item.uk, item.shareid, item.fsid].join('*')).join('#');
                            playurls.push(urls);
                        })
                        vod.vod_content = vod_content_add.join('\n');
                    }
                    if (/pan.xunlei.com/.test(input)) {
                        const data = await Xun.getShareData(input)
                        Object.keys(data).forEach(it => {
                            playform.push('Xun-' + it)
                            const urls = data[it].map(item => item.name + "$" + [item.fileId, item.share_id, item.parent_id, item.pass_code_token].join('*')).join('#');
                            playurls.push(urls);
                        })
                    }

                } else {
                    playform.push('推送');
                    playurls.push("推送" + '$' + list[i])
                }
            }
        } else if (/pan.quark.cn|drive.uc.cn|www.alipan.com|www.aliyundrive.com|cloud.189.cn|yun.139.com|caiyun.139.com|www.123684.com|www.123865.com|www.123912.com|www.123pan.com|www.123pan.cn|www.123592.com|pan.baidu.com|pan.xunlei.com/.test(input)) {
            if (/pan.quark.cn/.test(input)) {
                playPans.push(input);
                const shareData = Quark.getShareData(input);
                if (shareData) {
                    const videos = await Quark.getFilesByShareUrl(shareData);
                    if (videos.length > 0) {
                        playform.push('Quark-' + shareData.shareId);
                        playurls.push(videos.map((v) => {
                            const list = [shareData.shareId, v.stoken, v.fid, v.share_fid_token, v.subtitle ? v.subtitle.fid : '', v.subtitle ? v.subtitle.share_fid_token : ''];
                            return v.file_name + '$' + list.join('*');
                        }).join('#'))
                    } else {
                        playform.push('Quark-' + shareData.shareId);
                        playurls.push("资源已经失效，请访问其他资源")
                    }
                }
            }
            if (/drive.uc.cn/.test(input)) {
                playPans.push(input);
                const shareData = UC.getShareData(input);
                if (shareData) {
                    const videos = await UC.getFilesByShareUrl(shareData);
                    if (videos.length > 0) {
                        playform.push('UC-' + shareData.shareId);
                        playurls.push(videos.map((v) => {
                            const list = [shareData.shareId, v.stoken, v.fid, v.share_fid_token, v.subtitle ? v.subtitle.fid : '', v.subtitle ? v.subtitle.share_fid_token : ''];
                            return v.file_name + '$' + list.join('*');
                        }).join('#'))
                    } else {
                        playform.push('UC-' + shareData.shareId);
                        playurls.push("资源已经失效，请访问其他资源")
                    }
                }
            }
            if (/www.alipan.com|www.aliyundrive.com/.test(input)) {
                playPans.push(input);
                const shareData = Ali.getShareData(input);
                if (shareData) {
                    const videos = await Ali.getFilesByShareUrl(shareData);
                    log(videos);
                    if (videos.length > 0) {
                        playform.push('Ali-' + shareData.shareId);
                        playurls.push(videos.map((v) => {
                            const ids = [v.share_id, v.file_id, v.subtitle ? v.subtitle.file_id : ''];
                            return formatPlayUrl('', v.name) + '$' + ids.join('*');
                        }).join('#'))
                    } else {
                        playform.push('Ali-' + shareData.shareId);
                        playurls.push("资源已经失效，请访问其他资源")
                    }
                }
            }
            if (/cloud.189.cn/.test(input)) {
                playPans.push(input);
                let data = await Cloud.getShareData(input)
                let hasValidFiles = false;
                Object.keys(data).forEach(it => {
                    if (Array.isArray(data[it]) && data[it].length > 0) {
                        playform.push('Cloud-' + it)
                        const urls = data[it].map(item => item.name + "$" + [item.fileId, item.shareId].join('*')).join('#');
                        playurls.push(urls);
                        hasValidFiles = true;
                    }
                })
                if (!hasValidFiles) {
                    playform.push('Cloud-' + Date.now());
                    playurls.push("资源已经失效，请访问其他资源")
                }
            }
            if (/yun.139.com|caiyun.139.com/.test(input)) {
                playPans.push(input);
                let data = await Yun.getShareData(input)
                let hasValidFiles = false;
                Object.keys(data).forEach(it => {
                    if (Array.isArray(data[it]) && data[it].length > 0) {
                        playform.push('Yun-' + it)
                        const urls = data[it].map(item => item.name + "$" + [item.contentId, item.linkID].join('*')).join('#');
                        playurls.push(urls);
                        hasValidFiles = true;
                    }
                })
                if (!hasValidFiles) {
                    playform.push('Yun-' + Date.now());
                    playurls.push("资源已经失效，请访问其他资源")
                }
            }
            if (/www.123684.com|www.123865.com|www.123912.com|www.123pan.com|www.123pan.cn|www.123592.com/.test(input)) {
                playPans.push(input);
                let shareData = await Pan.getShareData(input)
                let videos = await Pan.getFilesByShareUrl(shareData)
                let allVideos = Array.isArray(videos) ? videos : Object.values(videos).flat();
                if (allVideos.length > 0) {
                    playform.push('Pan123-' + shareData);
                    playurls.push(allVideos.map((v) => {
                        const list = [v.ShareKey, v.FileId, v.S3KeyFlag, v.Size, v.Etag];
                        return v.FileName + '$' + list.join('*');
                    }).join('#'));
                }
            }
            if (/pan.baidu.com/.test(input)) {
                let data = await Baidu2.getShareData(input)
                let vod_content_add = [vod.vod_content];
                Object.keys(data).forEach((it, index) => {
                    playform.push('Baidu-' + Number(index + 1));
                    vod_content_add.push(it);
                    const urls = data[it].map(item => item.name + "$" + [item.path, item.uk, item.shareid, item.fsid].join('*')).join('#');
                    playurls.push(urls);
                })
                vod.vod_content = vod_content_add.join('\n');
            }
            if (/pan.xunlei.com/.test(input)) {
                const data = await Xun.getShareData(input)
                Object.keys(data).forEach(it => {
                    playform.push('Xun-' + it)
                    const urls = data[it].map(item => item.name + "$" + [item.fileId, item.share_id, item.parent_id, item.pass_code_token].join('*')).join('#');
                    playurls.push(urls);
                })
            }

        } else {
            playform.push('推送');
            playurls.push("推送" + '$' + input)
        }
        vod.vod_play_from = playform.join("$$$")
        vod.vod_play_url = playurls.join("$$$")
        vod.vod_play_pan = playPans.join("$$$")
        return vod
    },
    lazy: async function (flag, id, flags) {
        let {input, mediaProxyUrl} = this;
        const urls = [];
        // 如果id包含完整的URL（比如playParse直接传入完整URL），尝试从中提取云盘链接
        if (id && id.includes('http')) {
            // 使用正则表达式提取有效的云盘URL
            const urlRegex = /https?:\/\/[\w.-]+(?:\.[\w\.-]+)+[\w\-\._~:/?#[\]@!\$&'\(\)\*\+,;=.]+/g;
            const matches = id.match(urlRegex);
            if (matches && matches.length > 0) {
                input = matches[0];
            }
        }
        if (flag === '推送') {
            if (tellIsJx(input)) {
                return {parse: 1, jx: 1, url: input}
            } else {
                // 确保返回parse: 0和正确的URL格式，避免前端创建新的播放列表
                return {parse: 0, url: ["原画", input]}
            }
        } else if (/Quark-|UC-|Ali-|Cloud-|Yun-|Pan123-|Baidu-|Xun-/.test(flag)) {
            const ids = id.split('*');
            let UCDownloadingCache = {};
            let downUrl = ''
            if (flag.startsWith('Quark-')) {
                log("夸克网盘解析开始")
                const headers = {
                    // 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 QuarkPC/4.5.5.535 quark-cloud-drive/2.5.40 Channel/pckk_other_ch',
                    // 'origin': 'https://pan.quark.cn',
                    // 'referer': 'https://pan.quark.cn/',
                    'Cookie': ENV.get('quark_cookie')
                };
                //无限不转存
                const link = await Quark.getUrl(ids[0], ids[1], ids[2], ids[3]);
                link.forEach(item => {
                    if (item !== undefined) {
                        urls.push("无限" + item.name, item.url + "#isVideo=true##fastPlayMode##threads=20#")
                        urls.push("无限猫" + item.name, `http://127.0.0.1:5575/proxy?thread=${ENV.get('thread') || 6}&chunkSize=256&url=` + encodeURIComponent(item.url) + '&header=' + encodeURIComponent(JSON.stringify(headers)));
                    }
                });
                const down = await Quark.getDownload(ids[0], ids[1], ids[2], ids[3], true);
                down.forEach((t) => {
                    if (t.url !== undefined) {
                        urls.push("猫" + t.name, `http://127.0.0.1:5575/proxy?thread=${ENV.get('thread') || 6}&chunkSize=256&url=` + encodeURIComponent(t.url));
                        urls.push(t.name, t.url + "#isVideo=true##fastPlayMode##threads=20#")
                    }
                });
                const transcoding = (await Quark.getLiveTranscoding(ids[0], ids[1], ids[2], ids[3])).filter((t) => t.accessable);
                transcoding.forEach((t) => {
                    urls.push(t.resolution === 'low' ? "流畅" : t.resolution === 'high' ? "高清" : t.resolution === 'super' ? "超清" : t.resolution, t.video_info.url + "#isVideo=true##fastPlayMode##threads=20#")
                });
                // urls.push("原画", down.download_url + '#fastPlayMode##threads=10#');
                // urls.push("原代服", mediaProxyUrl + `?thread=${ENV.get('thread') || 6}&form=urlcode&randUa=1&url=` + encodeURIComponent(down.download_url) + '&header=' + encodeURIComponent(JSON.stringify(headers)));
                // if (ENV.get('play_local_proxy_type', '1') === '2') {
                //     urls.push("原代本", `http://127.0.0.1:7777/?thread=${ENV.get('thread') || 6}&form=urlcode&randUa=1&url=` + encodeURIComponent(down.download_url) + '&header=' + encodeURIComponent(JSON.stringify(headers)));
                // } else {
                //     urls.push("原代本", `http://127.0.0.1:5575/proxy?thread=${ENV.get('thread') || 6}&chunkSize=256&url=` + encodeURIComponent(down.download_url));
                // }
                // const transcoding = (await Quark.getLiveTranscoding(ids[0], ids[1], ids[2], ids[3])).filter((t) => t.accessable);
                // transcoding.forEach((t) => {
                //     urls.push(t.resolution === 'low' ? "流畅" : t.resolution === 'high' ? "高清" : t.resolution === 'super' ? "超清" : t.resolution, t.video_info.url)
                // });
                return {
                    parse: 0,
                    url: urls,
                    header: headers
                }
            }
            if (flag.startsWith('UC-')) {
                console.log("UC网盘解析开始");
                if (!UCDownloadingCache[ids[1]]) {
                    const down = await UC.getDownload(ids[0], ids[1], ids[2], ids[3], true);
                    if (down) UCDownloadingCache[ids[1]] = down;
                }
                const downCache = UCDownloadingCache[ids[1]];
                return await UC.getLazyResult(downCache, mediaProxyUrl)
            }
            if (flag.startsWith('Ali-')) {
                const transcoding_flag = {
                    UHD: "4K 超清",
                    QHD: "2K 超清",
                    FHD: "1080 全高清",
                    HD: "720 高清",
                    SD: "540 标清",
                    LD: "360 流畅"
                };
                log("网盘解析开始");
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
                        'Referer': 'https://www.aliyundrive.com/',
                    },
                }
            }
            if (flag.startsWith('Cloud-')) {
                log("天翼云盘解析开始")
                const url = await Cloud.getShareUrl(ids[0], ids[1]);
                urls.push("原画", url + "#isVideo=true#")
                return {
                    parse: 0,
                    url: urls
                }
            }
            if (flag.startsWith('Yun-')) {
                log('移动云盘解析开始')
                const url = await Yun.getSharePlay(ids[0], ids[1])
                urls.push("原画", url + "#isVideo=true#")
                return {
                    parse: 0,
                    url: urls
                }
            }
            if (flag.startsWith('Pan123-')) {
                log('盘123解析开始')
                const url = await Pan.getDownload(ids[0], ids[1], ids[2], ids[3], ids[4])
                urls.push("原画", url)
                let data = await Pan.getLiveTranscoding(ids[0], ids[1], ids[2], ids[3], ids[4])
                data.forEach((item) => {
                    urls.push(item.name, item.url)
                })
                return {
                    parse: 0,
                    url: urls
                }
            }
            if (flag.startsWith('Baidu-')) {
                log('百度网盘开始解析')
                //App原画不转存
                let url = await Baidu2.getAppShareUrl(ids[0], ids[1], ids[2], ids[3])
                urls.push("原画", url + "#isVideo=true##fastPlayMode##threads=10#")
                return {
                    parse: 0,
                    url: urls,
                    header: {
                        "User-Agent": 'netdisk;P2SP;2.2.91.136;android-android;',
                        "Cookie": ENV.get('baidu_cookie'),
                    }
                }
            }
            if (flag.startsWith('Xun-')) {
                log('迅雷云盘开始解析')
                //转码和下载的第二个值不同
                let urls = await Xun.getShareUrl(ids[0], ids[1], ids[3])
                // let url = await Xun.getDownloadUrl(ids[0],ids[2],ids[3])
                // if(url!==''){
                //     urls.push('原画',url+ "#isVideo=true##fastPlayMode##threads=20#")
                //     urls.push("猫画", `http://127.0.0.1:5575/proxy?thread=${ENV.get('thread') || 6}&chunkSize=256&url=` + encodeURIComponent(url));
                // }
                return {
                    parse: 0,
                    url: urls,
                    header: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/67.0.3396.99 Safari/537.36"
                    }
                }
            }

        } else {
            return input
        }
    },
}