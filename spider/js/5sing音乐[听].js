/*
@header({
  searchable: 2,
  filterable: 1,
  quickSearch: 1,
  title: '5sing音乐',
  author: 'EylinSir',
  类型: '音乐',
  mergeList: true,
  more: {
    mergeList: 1,
  },
  logo: 'https://5sing.kugou.com/favicon.ico',
  lang: 'ds',
})
*/

var rule = {
    类型: '音乐',
    author: 'EylinSir',
    title: '5sing音乐',
    host: 'http://5sing.kugou.com',
    url: 'http://5sing.kugou.com/fyclass/list?t=1&s=&l=&p=fypage',
    searchUrl: 'http://search.5sing.kugou.com/home/json?keyword=**&sort=1&page=fypage&filter=0&type=0',
    logo: 'https://5sing.kugou.com/favicon.ico',
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/47.0.2526.73 Safari/537.36',
        'Referer': 'http://5sing.kugou.com/'
    },
    searchable: 2,
    quickSearch: 1,
    filterable: 1,
    play_parse: true,
    timeout: 5000,
    class_name: '原创音乐&翻唱音乐',
    class_url: 'yc&fc',
    filter: {
        yc: [
            { key: 't', name: '排序', value: [{ n: '推荐', v: '1' }, { n: '最新', v: '-1' }, { n: '候选', v: '2' }] },
            { key: 'l', name: '语种', value: [
                { n: '全部', v: '' }, { n: '华语', v: '华语' }, { n: '欧美', v: '欧美' },
                { n: '日语', v: '日语' }, { n: '韩语', v: '韩语' }, { n: '粤语', v: '粤语' },
                { n: '方言', v: '方言' }, { n: '闽南语', v: '闽南语' }, { n: '古风', v: '古风' },
                { n: '其它', v: '其它' }
            ]}
        ],
        fc: [
            { key: 't', name: '排序', value: [{ n: '推荐', v: '1' }, { n: '最新', v: '-1' }, { n: '候选', v: '2' }] },
            { key: 'l', name: '语种', value: [
                { n: '全部', v: '' }, { n: '华语', v: '华语' }, { n: '欧美', v: '欧美' },
                { n: '日语', v: '日语' }, { n: '韩语', v: '韩语' }, { n: '粤语', v: '粤语' },
                { n: '方言', v: '方言' }, { n: '闽南语', v: '闽南语' }, { n: '古风', v: '古风' },
                { n: '其它', v: '其它' }
            ]}
        ]
    },

    一级: async function (tid, pg, filter, extend) {
        const t = extend?.t || '1';
        const l = extend?.l || '';
        const url = `http://5sing.kugou.com/${tid}/list?t=${t}&s=&l=${encodeURIComponent(l)}&p=${pg}`;
        const html = await request(url, { headers: this.headers });
        const $ = cheerio.load(html);
        let list = [];
        $('.lists dl').each((_, elem) => {
            const $item = $(elem);
            const $link = $item.find('.l_info a');
            const href = $link.attr('href');
            if (!href) return;
            const pic = ($item.find('img').attr('src') || '').replace(/_\d+x\d+\.\w+$/, '');
            const fullId = href.startsWith('http') ? href : `http://5sing.kugou.com${href}`;
            list.push({
                vod_name: $link.text().trim(),
                vod_pic: pic,
                vod_remarks: $item.find('.m_z').text().replace('音乐人：', '').trim(),
                vod_id: fullId + '@' + pic
            });
        });
        return list;
    },

    二级: '*',

    搜索: async function () {
        const res = await request(this.input, { headers: this.headers });
        const json = JSON.parse(res);
        if (!json?.list) return [];
        return json.list.map(item => {
            const sid = item.songId;
            const stype = item.type;
            if (!sid || !stype) return null;
            const t_str = stype == 1 ? 'yc' : stype == 2 ? 'fc' : 'yc';
            const pic = item.singerId ? `http://img.5sing.kgimg.com/force/${item.singerId}.jpg` : '';
            const fullId = `http://5sing.kugou.com/${t_str}/${sid}.html`;
            return {
                vod_name: (item.songName || '').replace(/<em>/g, '').replace(/<\/em>/g, ''),
                vod_pic: pic,
                vod_remarks: (item.singer || '').replace(/<em>/g, '').replace(/<\/em>/g, ''),
                vod_id: fullId + '@' + pic
            };
        }).filter(Boolean);
    },

    lazy: async function (flag, id) {
        const [detailUrl, cover = ''] = String(id || this.input || '').split('@');
        const match = detailUrl.match(/\/(\w+)\/(\d+)\.html/);
        if (!match) return { parse: 0, url: '', lrc: '', pic: '' };

        const [, t, sid] = match;
        const stype = (t === 'yc' || t === '1') ? 'yc' : 'fc';

        const ts = Math.floor(Date.now() / 1000).toString();
        const params = {
            appid: '3146', clienttime: ts, clientver: '610850', dfid: '-',
            from: 'com.sing.client.player', mid: '1144', songid: sid,
            songtype: stype, token: '', userfields: 'ID', uuid: '-',
            songfields: 'ID,SN,SK,SW,SS,ST,SI,CT,M,S,ZQ,WO,ZC,HY,YG,CK,D,RQ,DD,E,R,RC,SG,C,CS,LV,LG,SY,UID,PT,SCSR,SC,KM5'
        };
        const keys = Object.keys(params).sort();
        const sign = md5('UqgPMZpjgRZQ7s8JAuUIP5DQdo5O5NB' + keys.map(k => `${k}=${params[k]}`).join('') + 'UqgPMZpjgRZQ7s8JAuUIP5DQdo5O5NB');
        const qs = keys.map(k => `${k}=${params[k].replace(/,/g, '%2c')}`).join('&');
        const audioUrl = `https://5sapi.kugou.com/song/getSongUrl?${qs}&signature=${sign}`;

        let playUrl = '';
        try {
            const data = JSON.parse(await request(audioUrl, { headers: this.headers }));
            playUrl = data?.data?.squrl || data?.data?.hqurl || data?.data?.lqurl || '';
        } catch (_) {}

        let lrc = '';
        try {
            const data = JSON.parse(await request(`http://5sing.kugou.com/fm/m/json/lrc?songId=${sid}&songType=${stype}`, { headers: this.headers }));
            if (data.txt) lrc = data.txt;
        } catch (_) {}

        return {
            parse: 0,
            playUrl: '',
            url: playUrl ? ['标准音质', playUrl] : ['标准音质', ''],
            header: this.headers,
            lrc: lrc,
            cover: cover,
            pic: cover,
            height: 720
        };
    }
};