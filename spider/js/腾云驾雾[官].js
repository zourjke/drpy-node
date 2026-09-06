/*
@header({
  searchable: 2,
  filterable: 1,
  quickSearch: 0,
  title: '腾云驾雾[官]',
  '类型': '影视',
  logo: 'https://v.%71%71.com/favicon.ico',
  lang: 'ds'
})
*/

var rule = {
    title: '腾云驾雾[官]',
    host: 'https://v.%71%71.com',
    logo: 'https://v.%71%71.com/favicon.ico',
    homeUrl: '/x/bu/pagesheet/list?_all=1&append=1&channel=cartoon&listpage=1&offset=21&pagesize=21&iarea=-1',
    detailUrl: 'https://node.video.%71%71.com/x/api/float_vinfo2?cid=fyid',
    searchUrl: 'https://pbaccess.video.%71%71.com/trpc.videosearch.smartboxServer.HttpRountRecall/Smartbox?query=**&appID=3172&appKey=lGhFIPeD3HsO9xEp&pageNum=(fypage-1)&pageSize=10',
    searchable: 2,
    filterable: 1,
    url: '/x/bu/pagesheet/list?_all=1&append=1&channel=fyclass&listpage=1&offset=((fypage-1)*21)&pagesize=21&iarea=-1',
    filter_url: 'sort={{fl.sort or 75}}&iyear={{fl.iyear}}&year={{fl.year}}&itype={{fl.type}}&ifeature={{fl.feature}}&iarea={{fl.area}}&itrailer={{fl.itrailer}}&gender={{fl.sex}}&prefer={{fl.prefer}}&identity={{fl.identity}}&attraction={{fl.attraction}}&story={{fl.story}}',
    filter: 'H4sIAAAAAAAAE+1YW08bRxT+L/sMktcGG/JIoipVpfal6kMrVFmwUVYlODIbVCtCsjE25iJjE2JoMAQMLuZiY1JKjY3Jn9mZ3f0XHV/G50zGFEuNkxf8tPvNzpz7d874tTLxPKBPaMqjX14rv2kh5ZEyEwgayoAy7X/BUIUm10l1jb3P+qdetT6bbsDZsBUtNmD24htW5gY6OM2U2/iIp4OTfN0+X+C4qsyNN1ZaAvWQ5g+CRHJ9adYOJIkkVnCihfYJg2rnZLfL7W2jzUeEDwM+jPEhwIcw7gHcg3E34G6Mq4AL+rgAdyFcHe3g7BHhI4CPYNwHuA/jYK+K7VXBXvbIPDw+oBizfYmsb7R7ZBv6oMg+0/zGq6AGMq2LGtld6Tm2VuKCRmP8bBC5dmgfcBgiQufPrEy6DUMAnWidVObbMMSblK5IldsJZpJMliwdtWHwrnmzR/KL3HoQWfzTvN3jaQ2HxLfpJlcQXEV3onZ5hZsDqeHsHJN0nePI/GSZlHY5jizaWadbeY6DSdZqEpRUwSbrKE2uayhEHD/dpcthjvuQ3AX0/chDsX6hYn0RmNW/KhMboZf/o1iXz636iVxnyxfk46ZUrEKdqS72Q3kcLdr7YbTmBSlCkTf3QXREumis3VUDbElFxBFJ0XAGr7mQ+gVrQ9iHXJzYMqtLWB5EWKCX5j7ICma4qCfKVFbAn+gJZwps01xDnJiMk7UP+ExYs8MRa2kR74N0sPMfIZoILpVJ/a24q1EfKFkeiKBvRDDrD+qaEeoLFTSc9MDnXySME/6gEQhMf01G9wc1P4putkxWqz1Hl8RjbIc0ftHNPM2eyePX2ZF1m5SYhMSuzBon16HP2G7wkIJ6AOZ5SDCROpF28XXnj2NJacbsNMObFopAatc6S8sOiayw1iMNh05xA1S5Y+pCOSp2Nh92N6lU5KmO7u2T7U6HQedn35vVKpre+PfJgpWKy1Oj2DmQJ2trJFb573g2mmgr1Z/rU5P9uWp4uyf6J91oRvsdyQsfkcRp73me/4sUj6WwWhv/AOzuU1l57isr0d/3cLdzu0BLf/esiWvQQz5EJMOHBr0Agya+wVGAQW/VxVCzljcry/LwFysIWrXqo5kxk4GJQH8SRiQZ3Qj69SkN+2mxSt5EaOa6Zz+NjT2WnES2640ZL1uGogK7n479wP2kIj2/f/qdHN9m+Tm5tBN5I1HItz/+xM8Z9iCqSOasy5ywh8kB8T8/+QZgqB87dmuXzu3FE5K4kvmEpBJmPUuzVbrLa8zbPQuHPx+LM2WshSvJf6yROAfvO7Mn4Ie35s07KQUZ39HMoqy0wGz4dm5WV6RAsM4BvAy0aV/mGBPKtMliAJ0DX7brJ3Q/IUVSvGujrrkZo8DuKr8J6tP6rzMamwJnUI28DGrPcCJDAtzta0xy7PtuJAewSHL6pDZt6GwM7Qi0q6dmrd6jQBqu2QcyuZDDI6aKWalJAbBTq6QQ7Top+A1WxROGzoYpyLTsijV/Tw2j/E2Q43cklYRGDSo5uSwJ3zjhuJ3j5DIk5viMEQiGsOO36E6qR9Gt/5+Ee11zBB+f+xcbF/g7fRUAAA==',
    headers: {
        'User-Agent': 'PC_UA'
    },
    timeout: 5000,
    cate_exclude: '会员|游戏|全部',
    class_name: '精选&电影&电视剧&动漫&少儿&综艺&短剧&纪录片',
    class_url: 'choice&movie&tv&cartoon&child&variety&mini_series&doco',
    limit: 20,
    play_parse: true,
    推荐: async function () {
        let {input, pdfa, pdfh, pd} = this;
        let html = await request(input);
        let d = [];
        let data = pdfa(html, '.list_item');
        data.forEach((it) => {
            d.push({
                title: pdfh(it, 'img&&alt'),
                pic_url: pd(it, 'img&&src'),
                desc: pdfh(it, 'a&&Text'),
                url: pdfh(it, 'a&&data-float'),
            })
        });
        return setResult(d)
    },
    一级: async function () {
        let {input, pdfa, pdfh, pd, MY_CATE, MY_PAGE, MY_FL} = this;
        let d = [];

        // 短剧特殊处理
        if (MY_CATE === 'mini_series') {
            let apiUrl = 'https://pbaccess.video.qq.com/trpc.vector_layout.page_view.PageService/getPage?video_appid=3000010&vversion_platform=2';
            let fl = MY_FL || {};
            let filterParts = [];
            if (fl.prefer) filterParts.push('prefer=' + fl.prefer);
            if (fl.identity) filterParts.push('identity=' + fl.identity);
            if (fl.attraction) filterParts.push('attraction=' + fl.attraction);
            if (fl.story) filterParts.push('story=' + fl.story);
            let filterValue = filterParts.length > 0 ? filterParts.join('&') : 'sort=75';

            let pageContext = null;
            let cacheKey = 'mini_series_ctx_' + filterValue;

            if (MY_PAGE > 1) {
                try {
                    let cachedContext = typeof storage0 !== 'undefined' ? storage0.getItem(cacheKey) : '';
                    if (cachedContext) {
                        let contextObj = JSON.parse(cachedContext);
                        if (contextObj.page === MY_PAGE - 1 && contextObj.nextContext) {
                            pageContext = contextObj.nextContext;
                        } else if (MY_PAGE === 1) {
                            pageContext = null;
                        }
                    }
                } catch (e) {
                    log('读取缓存失败: ' + e.message);
                }
            } else {
                try {
                    if (typeof storage0 !== 'undefined') storage0.setItem(cacheKey, '');
                } catch (e) {}
            }

            let requestBody = {
                "page_params": {
                    "page_type": "channel",
                    "page_id": "120188",
                    "scene": "channel",
                    "new_mark_label_enabled": "1",
                    "vl_to_mvl": "1",
                    "free_watch_trans_info": "{\"ad_frequency_control_time_list\":{}}",
                    "ad_exp_ids": "100000",
                    "skip_privacy_types": "0",
                    "support_click_scan": "1"
                },
                "page_bypass_params": {
                    "params": {
                        "platform_id": "2",
                        "caller_id": "3000010",
                        "data_mode": "default",
                        "user_mode": "default",
                        "page_type": "channel",
                        "page_id": "120188",
                        "scene": "channel",
                        "new_mark_label_enabled": "1"
                    },
                    "scene": "channel",
                    "app_version": ""
                },
                "page_context": pageContext
            };

            if (filterParts.length > 0) {
                requestBody.page_bypass_params.params.filter_value = filterValue;
            }

            try {
                let html = await request(apiUrl, {
                    body: JSON.stringify(requestBody),
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
                        'Content-Type': 'application/json',
                        'Origin': 'https://v.qq.com',
                        'Referer': 'https://v.qq.com/channel/mini_series'
                    },
                    method: 'POST'
                });

                let json = JSON.parse(html);
                if (json.ret === 0 && json.data && json.data.CardList) {
                    if (json.data.has_next_page && json.data.page_context) {
                        try {
                            if (typeof storage0 !== 'undefined') {
                                storage0.setItem(cacheKey, JSON.stringify({
                                    page: MY_PAGE,
                                    nextContext: json.data.page_context
                                }));
                            }
                        } catch (e) {
                            log('保存缓存失败: ' + e.message);
                        }
                    }

                    json.data.CardList.forEach(function(card) {
                        if (card.type === 'pc_hot_filter') return;
                        if (card.type === '_eco_video_staggered' && card.children_list && card.children_list.card_list) {
                            let cards = card.children_list.card_list.cards || [];
                            cards.forEach(function(item) {
                                if (item.type === '_eco_video_staggered_drama_item' && item.params) {
                                    let params = item.params;
                                    let cid = params.cid || '';
                                    let posterInfo = {};
                                    let markInfo = {};
                                    try { posterInfo = JSON.parse(params.poster || '{}'); } catch (e) {}
                                    try { markInfo = JSON.parse(params.mark_label_list || '{}'); } catch (e) {}
                                    let title = posterInfo.title || '';
                                    let img = posterInfo.image_url || '';
                                    let remarks = '';
                                    if (markInfo.mark_label_list && markInfo.mark_label_list.length > 0) {
                                        remarks = markInfo.mark_label_list[0].prime_text || '';
                                    }

                                    if (cid && title) {
                                        d.push({
                                            title: title,
                                            pic_url: img,
                                            desc: remarks,
                                            url: 'https://node.video.qq.com/x/api/float_vinfo2?cid=' + cid
                                        });
                                    }
                                }
                            });
                        }
                    });
                }
            } catch (e) {
                log('短剧请求失败: ' + e.message);
            }
        } else {
            // 原有的普通分类处理逻辑
            let html = await request(input);
            let data = pdfa(html, '.list_item');
            data.forEach((it) => {
                d.push({
                    title: pdfh(it, 'img&&alt'),
                    pic_url: pd(it, 'img&&src'),
                    desc: pdfh(it, 'a&&Text'),
                    url: MY_CATE + '$' + pdfh(it, 'a&&data-float'),
                })
            });
        }
        return setResult(d)
    },
    二级: async function () {
        let {input, pdfh, pd, fetch_params} = this;
        let d = [];
        let VOD = {};
        let video_list = [];
        let video_lists = [];
        let list = [];
        let QZOutputJson;
        let html = await request(input);
        let sourceId = /get_playsource/.test(input) ? input.match(/id=(\d*?)&/)[1] : input.split("cid=")[1];
        let cid = sourceId;
        let detailUrl = "https://v.%71%71.com/detail/m/" + cid + ".html";
        log("详情页:" + detailUrl);
        try {
            let json = JSON.parse(html);
            VOD = {
                vod_url: input,
                vod_name: json.c.title,
                type_name: json.typ.join(","),
                vod_actor: json.nam.join(","),
                vod_year: json.c.year,
                vod_content: json.c.description,
                vod_remarks: json.rec,
                vod_pic: urljoin(input, json.c.pic)
            }
        } catch (e) {
            log("解析片名海报等基础信息发生错误:" + e.message)
        }
        if (/get_playsource/.test(input)) {
            eval(html);
            let indexList = QZOutputJson.PlaylistItem.indexList;
            for (const it of indexList) {
                let dataUrl = "https://s.video.qq.com/get_playsource?id=" + sourceId + "&plat=2&type=4&data_type=3&range=" + it + "&video_type=10&plname=qq&otype=json";
                eval(await fetch(dataUrl, fetch_params));
                let vdata = QZOutputJson.PlaylistItem.videoPlayList;
                vdata.forEach(function (item) {
                    d.push({
                        title: item.title,
                        pic_url: item.pic,
                        desc: item.episode_number + "\t\t\t播放量：" + item.thirdLine,
                        url: item.playUrl
                    })
                });
                video_lists = video_lists.concat(vdata)
            }
        } else {
            let json = JSON.parse(html);
            video_lists = json.c.video_ids;
            let url = "https://v.qq.com/x/cover/" + sourceId + ".html";
            if (video_lists.length === 1) {
                let vid = video_lists[0];
                url = "https://v.qq.com/x/cover/" + cid + "/" + vid + ".html";
                d.push({
                    title: "在线播放",
                    url: url
                })
            } else if (video_lists.length > 1) {
                for (let i = 0; i < video_lists.length; i += 30) {
                    video_list.push(video_lists.slice(i, i + 30))
                }
                let t1 = (new Date()).getTime();
                let reqUrls = video_list.map(it => {
                    let o_url = "https://union.video.qq.com/fcgi-bin/data?otype=json&tid=1804&appid=20001238&appkey=6c03bbe9658448a4&union_platform=1&idlist=" + it.join(",");
                    return {
                        url: o_url,
                        options: {
                            timeout: rule.timeout,
                            headers: rule.headers
                        }
                    }
                });
                let htmls = await batchFetch(reqUrls);
                let t2 = (new Date()).getTime();
                log(`批量请求二级 ${detailUrl} 耗时${t2 - t1}毫秒:`);
                htmls.forEach((ht) => {
                    if (ht) {
                        eval(ht);
                        QZOutputJson.results.forEach(function (it1) {
                            it1 = it1.fields;
                            let url = "https://v.qq.com/x/cover/" + cid + "/" + it1.vid + ".html";
                            d.push({
                                title: it1.title,
                                pic_url: it1.pic160x90.replace("/160", ""),
                                desc: it1.video_checkup_time,
                                url: url,
                                type: it1.category_map && it1.category_map.length > 1 ? it1.category_map[1] : ""
                            })
                        })
                    }
                });
            }
        }
        
        // 修正分类逻辑：使用关键词判断是否为预告/花絮
        let ygKeywords = ["预告", "花絮", "片花", "特辑", "幕后", "采访", "制作", "MV", "主题曲"];
        let yg = d.filter(function(it) {
            return it.type && ygKeywords.some(keyword => it.type.includes(keyword));
        });
        let zp = d.filter(function(it) {
            return !(it.type && ygKeywords.some(keyword => it.type.includes(keyword)));
        });

        // 构造播放线路
        let playFrom = [];
        let playUrl = [];
        
        if (zp.length > 0) {
            playFrom.push("qq");
            playUrl.push(zp.map(it => it.title + "$" + it.url).join("#"));
        }

        if (yg.length > 0) {
            playFrom.push("qq 预告及花絮");
            playUrl.push(yg.map(it => it.title + "$" + it.url).join("#"));
        }

        VOD.vod_play_from = playFrom.join("$$$");
        VOD.vod_play_url = playUrl.join("$$$");
        return VOD
    },

    搜索: async function () {
        let {input} = this;
        let d = [];
        let html = await request(input);
        let json = JSON.parse(html);
        if (json.data.smartboxItemList.length > 0) {
            for (const vod of json.data.smartboxItemList.filter(it => it.basicDoc && it.basicDoc.id)) {
                let cid = vod.basicDoc.id;
                let title = vod.basicDoc.title;
                let url = 'https://node.video.qq.com/x/api/float_vinfo2?cid=' + cid;
                if (vod.videoInfo && vod.videoInfo.imgUrl) {
                    d.push({
                        title: title,
                        img: vod.videoInfo.imgUrl,
                        url: url,
                        content: '',
                        desc: vod.videoInfo.typeName || ''
                    });
                } else {
                    let html1 = await request(url);
                    let data = JSON.parse(html1);
                    d.push({
                        title: data.c.title,
                        img: data.c.pic,
                        url: url,
                        content: data.c.description,
                        desc: data.rec
                    });
                }
            }
        }
        return setResult(d);
    },
    lazy: async function () {
        let {input} = this;
        return {jx: 1, url: input}
    }
}
