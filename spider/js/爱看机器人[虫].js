/*
@header({
  searchable: 2,
  filterable: 0,
  quickSearch: 0,
  title: 'ikanbot',
  lang: 'ds'
})
*/

// http://localhost:5757/api/ikanbot?ac=list&t=1&pg=1
// http://localhost:5757/api/ikanbot?ac=detail&ids=447
// http://localhost:5757/api/ikanbot?wd=&pg=1
// http://localhost:5757/api/ikanbot?play=&flag=ikanbot
const {getHtml} = $.require('./_lib.request.js')
var rule = {
    类型: '影视',
    title: 'ikanbot',
    desc: 'ikanbot纯js版本',
    // homeUrl: 'https://v.ikanbot.com',
    // homeUrl: 'https://v.aikanbot.com',
    homeUrl: 'https://www1.ikanbot.com',
    url: '',
    searchUrl: '/search?q=**',
    searchable: 2,
    quickSearch: 0,
    headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1',
    },
    timeout: 5000,
    play_parse: true,
    class_parse: async () => {
        let classes = [];
        let filterObj = {};
        for (const cate of ['/hot/index-movie-热门.html', '/hot/index-tv-热门.html']) {
            const html = (await getHtml({
                url: rule.homeUrl + cate,
            })).data
            const $ = pq(html);
            const {cls, tags} = getClass($);
            classes.push(cls);
            filterObj[cls.type_id] = tags;
        }
        return {
            class: classes,
            filters: filterObj,
        }
    },
    预处理: async () => {
        rule.headers['referer'] = rule.homeUrl
        return []
    },
    推荐: async () => {
        return []
    },
    一级: async function (tid, pg, filter, extend) {
        let {getProxyUrl, MY_CATE, input} = this;
        if (pg <= 0) pg = 1;
        const link = rule.homeUrl + (extend.tag || tid).replace('.html', pg > 1 ? `-p-${pg}.html` : '.html');
        const html = (await getHtml({
            method: 'get',
            url: link,
            headers: rule.headers
        })).data
        const $ = pq(html);
        const items = $('div.v-list a.item');
        let videos = items.map((_, item) => {
            const img = $(item).find('img:first')[0];
            return {
                vod_id: item.attribs.href,
                vod_name: img.attribs.alt,
                // vod_pic: getProxyUrl() + '&url=' + base64Encode(img.attribs['data-src']),
                vod_pic: img.attribs['data-src'],
                vod_remarks: '',
            };
        }).toArray();
        return videos
    },
    二级: async function (ids) {
        let {input} = this;
        const html = (await getHtml(rule.homeUrl + ids[0])).data;
        const $ = pq(html);

        const detail = $('div.detail');
        const remarks = $('span#line-tips').text();
        let vod = {
            vod_id: ids[0],
            vod_pic: '', // jsBase + base64Encode($('div.item-root > img')[0].attribs['data-src']),
            vod_remarks: '',
            vod_content: remarks || '',
            vod_name: $(detail).find('h2').text().trim(),
            vod_year: $(detail).find('h3:nth-child(3)').text(),
            vod_area: $(detail).find('h3:nth-child(4)').text(),
            vod_actor: $(detail).find('h3:nth-child(5)').text(),
        };
        const token = getToken($);
        const res = (await getHtml(rule.homeUrl + '/api/getResN?videoId=' + ids[0].substring(ids[0].lastIndexOf('/') + 1) + '&mtype=2&token=' + token, {
            headers: {
                Referer: 'play',
                'User-Agent': PC_UA,
            },
        })).data;
        const list = res.data.list;
        let playlist = {};
        let arr = []
        for (const l of list) {
            const flagData = JSON.parse(l.resData);
            for (const f of flagData) {
                const from = f.flag;
                const urls = f.url;
                if (!from || !urls) continue;
                if (playlist[from]) continue;
                playlist[from] = urls;
            }
        }
        for (var key in playlist) {
            if ('kuaikan' === key) {
                arr.push({
                    flag: '快看',
                    url: playlist[key],
                    sort: 1
                })
            } else if ('bfzym3u8' === key) {
                arr.push({
                    flag: '暴风',
                    url: playlist[key],
                    sort: 2
                })
            } else if ('ffm3u8' === key) {
                arr.push({
                    flag: '非凡',
                    url: playlist[key],
                    sort: 3
                })
            } else if ('lzm3u8' === key) {
                arr.push({
                    flag: '量子',
                    url: playlist[key],
                    sort: 4
                })
            } else {
                arr.push({
                    flag: key,
                    url: playlist[key],
                    sort: 5
                })
            }
        }
        arr.sort((a, b) => a.sort - b.sort);
        let playFrom = [];
        let playList = [];
        arr.map(val => {
            playFrom.push(val.flag);
            playList.push(val.url);
        })
        vod.vod_play_from = playFrom.join("$$$");
        vod.vod_play_url = playList.join("$$$");
        return vod
    },
    搜索: async function (wd, quick, pg) {
        let {input} = this
        let link = '';
        if (pg === 1) {
            link = rule.homeUrl + '/search?q=' + wd;
        } else {
            link = rule.homeUrl + '/search?q=' + wd + '&p=' + pg;
        }
        const html = (await getHtml({
            method: 'get',
            url: link,
            headers: rule.headers
        })).data
        const $ = pq(html);
        const items = $('div.media');
        let videos = items.map((_, item) => {
            const a = $(item).find('a:first')[0];
            const img = $(item).find('img:first')[0];
            const remarks = $($(item).find('span.label')[0]).text().trim();
            return {
                vod_id: a.attribs.href,
                vod_name: img.attribs.alt,
                vod_pic: '',
                vod_remarks: remarks || '',
            };
        }).toArray()
        return videos;
    },
    lazy: async function (flag, id, flags) {
        let {getProxyUrl, input} = this;
        return {parse: 0, url: input}
    },
    proxy_rule: async function (params) {
        let {input} = this;
        const t = base64Decode(input)
        const resp = (await getHtml({
            url: t,
            headers: {
                Referer: rule.homeUrl,
                'User-Agent': rule.headers
            },
            responseType: 'arraybuffer'

        })).data;
        return [200, 'image/jpeg', resp]
    }
};

function getClass($) {
    const nav = $('ul.nav-pills:eq(1) > li > a');
    let tags = {
        key: 'tag',
        name: '标签',
        value: nav.map((_, n) => {
            return {n: n.children[0].data, v: n.attribs.href};
        }).toArray(),
    };
    tags['init'] = tags.value[0].v;
    const title = $('title:first').text().split('-')[0].substring(2);
    return {cls: {type_id: tags.value[0].v, type_name: title}, tags: [tags]};
}

function getToken($) {
    const currentId = $('#current_id').val();
    let eToken = $('#e_token').val();
    if (!currentId || !eToken) return '';
    const idLength = currentId.length;
    const subId = currentId.substring(idLength - 4, idLength);
    let keys = [];
    for (let i = 0; i < subId.length; i++) {
        const curInt = parseInt(subId[i]);
        const splitPos = curInt % 3 + 1;
        keys[i] = eToken.substring(splitPos, splitPos + 8);
        eToken = eToken.substring(splitPos + 8, eToken.length);
    }
    return keys.join('');
}
