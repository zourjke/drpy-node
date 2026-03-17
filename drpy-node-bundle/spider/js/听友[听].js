/*
@header({
  searchable: 2,
  filterable: 1,
  quickSearch: 0,
  title: '听友[听]',
  '类型': '听书',
  lang: 'ds'
})
*/
const {getHtml,req_,req_proxy} = $.require('./_lib.request.js')
const {decryptText,encryptText} = $.require('./_lib.tingyou.js')
var rule = {
    类型: '听书',
    title: '听友[听]',
    host: 'https://tingyou.fm',
    url: '/api/category_page/types/fyclass/popular/pfypage',
    detailUrl:'/api/chapters_list/fyid',
    searchUrl: '/api/search',
    searchable: 2,
    quickSearch: 0,
    timeout: 5000,
    class_parse:async function(){
        let classes = [
            {
                "type_id": 46,
                "type_name": "玄幻奇幻"
            },
            {
                "type_id": 11,
                "type_name": "武侠小说"
            },
            {
                "type_id": 19,
                "type_name": "言情通俗"
            },
            {
                "type_id": 21,
                "type_name": "相声小品"
            },
            {
                "type_id": 14,
                "type_name": "恐怖惊悚"
            },
            {
                "type_id": 17,
                "type_name": "官场商战"
            },
            {
                "type_id": 15,
                "type_name": "历史军事"
            },
            {
                "type_id": 9,
                "type_name": "百家讲坛"
            },
            {
                "type_id": 16,
                "type_name": "刑侦反腐"
            },
            {
                "type_id": 10,
                "type_name": "有声文学"
            },
            {
                "type_id": 18,
                "type_name": "人物纪实"
            },
            {
                "type_id": 36,
                "type_name": "广播剧"
            },
            {
                "type_id": 22,
                "type_name": "英文读物"
            },
            {
                "type_id": 23,
                "type_name": "轻音清心"
            },
            {
                "type_id": 31,
                "type_name": "二人转"
            },
            {
                "type_id": 33,
                "type_name": "健康养生"
            },
            {
                "type_id": 34,
                "type_name": "综艺娱乐"
            },
            {
                "type_id": 40,
                "type_name": "头条"
            },
            {
                "type_id": 38,
                "type_name": "戏曲"
            },
            {
                "type_id": 41,
                "type_name": "脱口秀"
            },
            {
                "type_id": 42,
                "type_name": "商业财经"
            },
            {
                "type_id": 43,
                "type_name": "亲子教育"
            },
            {
                "type_id": 44,
                "type_name": "教育培训"
            },
            {
                "type_id": 45,
                "type_name": "时尚生活"
            },
            {
                "type_id": 20,
                "type_name": "童话寓言"
            },
            {
                "type_id": 47,
                "type_name": "未分类"
            },
            {
                "type_id": 1,
                "type_name": "单田芳"
            },
            {
                "type_id": 2,
                "type_name": "刘兰芳"
            },
            {
                "type_id": 3,
                "type_name": "田连元"
            },
            {
                "type_id": 4,
                "type_name": "袁阔成"
            },
            {
                "type_id": 5,
                "type_name": "连丽如"
            },
            {
                "type_id": 8,
                "type_name": "孙一"
            },
            {
                "type_id": 30,
                "type_name": "王子封臣"
            },
            {
                "type_id": 25,
                "type_name": "马长辉"
            },
            {
                "type_id": 26,
                "type_name": "昊儒书场"
            },
            {
                "type_id": 27,
                "type_name": "王军"
            },
            {
                "type_id": 28,
                "type_name": "王玥波"
            },
            {
                "type_id": 29,
                "type_name": "石连君"
            },
            {
                "type_id": 12,
                "type_name": "粤语评书"
            },
            {
                "type_id": 35,
                "type_name": "关永超"
            },
            {
                "type_id": 6,
                "type_name": "张少佐"
            },
            {
                "type_id": 7,
                "type_name": "田战义"
            },
            {
                "type_id": 13,
                "type_name": "其他评书"
            }
        ]

        return {
            class:classes
        }
    },
    headers:{
        'User-Agent': 'zybk/1.0.6',
        'Accept-Encoding': 'gzip',
        'authorization': 'Bearer gAAAAABpsEFsPBrHfY1bGsn15TbqqXUC4WSFwm8VU97NW6qmSAewn1rbYMzbIXLajyJnSZ94oZsS6hil8Qkb-IknSuggyn9XLDitEE930CD9OapDQOzq1xSJb7foWNh5YdeT_7p4ZSyYyhW4b2ZWmI-Itb8YBTjDmWIM3FiTQ9MYATmWKJQ6d6IY5Z0bupvW6hjWoHppAa5v0_k2KkIEHdzyw7AiKTPPqUYVmKvrvISlBkMHGdyK83AgiOi80-mKwmCIY1kXuj_vg_mY1HxvmsPpNcYLaoOYUA==',
        // 'cookie':'session=dvJGYQ7gKDJvm-FXEzmCCHPd0IK7fzjLz1hfmi5RSxlhGi6EayEATHlH9_c%3D;'
    },
    play_parse: true,
    预处理: async () => {
        let data = '02956c849999374a66745e3ac9957f00ad9022036ec6b1a20c7f86327c8817';
        let config = {
            method: 'POST',
            url: 'https://azybk.tingyou8.vip/apk/auth/me',
            headers: {
                'User-Agent': 'zybk/1.0.6',
                'Accept-Encoding': 'gzip',
                'authorization': 'Bearer gAAAAABpsAkJlSPlhBJAKM71X7PpktM1kpibFvpxnJbGXBAN0ydCgx4gviLacuou6QJKAZ4FtCpdCe8HZLKdveUTv-BTfeVFB7wGBv6yiylsWmAeKwc5YLunEbwXQv1VtMLNn4W7e4PZQlLSSOTZHbwYsC0Herb1GohZ4NU47-85y_eNuz8qq0mmxtY_2JMG9T00YcFAevfvCkfkngr0ttUZEgLVK2W_SKfHL-CSvfe6mJWQxNh88p3ViNSTK0sbL-2XPgBdDPD3urXgA4eZ7pQfPYKF3aj3ow=='
            },
            data: data
        };
        let html = await axios.request(config).catch(e=>e.response.headers['set-cookie'])
        if(html[0]){
            rule.headers['cookie'] = html[0].replace('Path=/; Domain=tingyou8.vip; Max-Age=604800; HttpOnly','')
        }
        return []
    },
    lazy: async function () {
        let {input} = this;
        console.log(input)
        let data = {
            "album_id": Number(input.split('^')[0]),
            "chapter_idx": Number(input.split('^')[1])
        }
        let encodeData = await encryptText(JSON.stringify(data))
        let html = await req_('https://azybk.tingyou8.vip/apk/play/play_token','post', rule.headers,encodeData);
        let link = JSON.parse(await decryptText(html.payload)).play_url
        return {url: link, parse: 0};
    },
    double: true,
    一级: async function () {
        let {input} = this;
        const videos = []
        let html = await req_(input);
        let data = html.payload
        let list = JSON.parse(await decryptText(data)).data
        list.forEach(item => {
            videos.push({
                vod_id: item.id,
                vod_name: item.title,
                vod_pic: item.cover_url,
                vod_remarks: item.status === 1 ? "连载":"完结",
            })
        })
        return videos;
    },
    二级: async function () {
        let {input,orId} = this;
        let urls = [];
        let html = await req_(input);
        let list = JSON.parse(await decryptText(html.payload)).chapters
        list.forEach(item => {
            urls.push(item.title+"$"+orId+"^"+item.index)
        })
        let js = await req_(input.replace('chapters_list','album_detail'))
        let content = JSON.parse(await decryptText(js.payload))
        let VOD = {
            vod_id:content.id,
            vod_name:content.title,
            vod_pic:content.cover_url,
            vod_remarks:content.status === 1 ? "连载":"完结",
            vod_content:content.synosis||'',
            vod_play_from: '球球啦',
            vod_play_url: urls.join('#')
        };
        return VOD;
    },
    搜索: async function (wd, quick, pg) {
        let {input} = this;
        let videos = [];
        let data = {
            "keyword": wd,
            "page": pg,
            "sort_by": "updated_at",
            "sort_order": "desc"
        }
        let encodeData = await encryptText(JSON.stringify(data))
        let html = await req_('https://azybk.tingyou8.vip/apk/search','post', rule.headers,encodeData);
        let list = JSON.parse(await decryptText(html.payload)).results
        list.forEach(item => {
            videos.push({
                vod_id: item.id,
                vod_name: item.title,
                vod_pic: item.cover_url,
                vod_remarks: item.status === 1 ? "连载":"完结",
            })
        })
        return videos;
    }
}