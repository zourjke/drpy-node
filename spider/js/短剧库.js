/*
@header({
  searchable: 2,
  filterable: 1,
  quickSearch: 1,
  title: '短剧库',
  '类型': '短剧',
  lang: 'ds'
})
*/

// 主分类 = 平台（红果/黄豆/黄果），子分类 = 各平台自己的分类（filter 按主分类 id 分组）
var filter_def = 'H4sIAAlpumoC/61a21MTzRL/X3iWktzBp+OjD6fqPPly6qtTC4nJYrLBXAT8yir4Qrgol0QQQSLIRS5CkAhqIET+mZ3dzX9xerOzMz2bJRChCq2a6d6Znu5f32byd1csqUSj2WTXo//+3fU8Mtr1qGtAynQ96FKkRAQGZHpSr9Rg/FKKZyNNLgWmtbGanitr78rabskkwlRKUp53x5KZrtcPLB69tKFeXJCZPQdPKiLFGZN2edjKMZBMyAOM5fGTVg5Jbt3GpsPy3eGUlJAcm1B6c3EHQ3MLSpdkm/jX678edA1H5GhWUjrUD8nvN3L79orxOF0sFoF1O1tJ//67MTZDVxqUleiIKY0tOFnYMbbzlBrNvooBMcqojak5fWnDPrdp6XQsgujk+Ce5KLO1pYyMiNr4W326QolxWVJMnTdPkY5JSgxG93kQMKF2ssRMqLzgBtaWT7h1RmRlMMttv1Qix58pKQMyNg/Jzz82aWzZ51PkEb4mubwwxvJkbZ3U31H6C/g8+ioW4Txfpsh5jVFjgt535tTaFKU9y8K2XCi1WiZrdW1rl5JfURdL3Kx6CyRS8nnHgLO8EXtBfzIMEiNltdGjNr2if1ln8kqKiROu5S/rRuUrpZoUkBATyWwNEUfl25rH+LFCDq7Yrll5BFn24Mr4+cYBYDjPaBYZ6PIfI1en1FFZwfo1VgsAYNv02YgJYKT8Q235AznOw/+274BgYWREfX6CG99EqmX+poH6JTmcvUtAeAFr9WdvpcJGrk6q/1BaOJuOIe3On6i1bWN/TMvlmVUlJSzJoxL4DwZbG0Vd7yM3WA9SgLE9blsPKAMoKBuFWXL8iRJN4PcjyLRH2/XGAVZZsFE7XLYFQOPDV3LwkX1pWle5yfQ3A9Mtwp6fgY2YdpvWccQA9XJXL0yKkSCeVeIyDvJOQ0ezLmbWyrvq78/wvzazSPmGswCJYWC+ldM1Pr3TVr5onzfJWpnFPTAsaAeWSY5yF4DwER3tNJVB9CGlC/ukEDRxrrpFAFMvP5LiilpdVC8OKRfIP4qto61sQJIhX+pCpBNTTZs42Fg5JfkZQU5QcjRqZdXmyV/ICanjaml+35gr0AV73AXp9jh8HoytTdgQ83hDPvekDxSve7QIhDwOTKu1VQAI+7A36J7rAiEuo3q+qX0q2oQ+JPxJEbIc+8LnDvkAFq4VXSBDrwO+lOLDwu8VkXB9fv5F6VCtLtuEQBBVE7Pa0SbJ5/g+fe4Rz9/T43BtJoDPPduH+gL8i9OaXrNtFOoNcck+5YyTt+yLHveSLNTrRxY41cb2tOlC4/0VkxqfdWbRmKiaUa1qKzfkCbpHNH9vT7tKx9/DjWJc1cluTR8/NIpHHPQhT8C9UgkiaDQOjvSl70z73JDG+Cxayut3hHZbwX6u4MbhijbzVq2+JZUKPzw3GdmvqOcFbWUe/JvTA+4JLuQNoR3zeEd+bm3tymBRJOTxYhCo53bp5vPxU5H3k5C42B4+BE8w6YleWwAOLpwHhS0U4IGCvtz5DTHN+PapsbXC6VzDxtQZ+TZrW62PC0nGf5HCEbnKke0T9iG2wERRO7MzbMDLYQL5svFhX0jdQWQgIW37kEMJKTuAFAzdFxmfInO5xpQdJXqRNoVs4wu6lzweb7DPPan7kCVPFqBH0GcOuKJQ+Frb4qVKwM+BoR1tkeUSmdwBFNt6DApOR6r2eYMevltj8SdZKPKtkBz5H/q87dneXvd6AzmmUEV5OSq0f470ZXsHpFCtsK4fFVnkQGAZ/wEw5wEtRBNSGHpVyE4dtgvTFV5MSLJQRrQpOdu3m0KF0lKDtummrBZe3xtjZUlEgR5wRM66q8tM57jNqBd5Hh0GiQadJY2jmGFFzLN7aOxv1to1MnRcxlvOa1c+ktlQohS1B2BWq7aGw5LyEsxzizLfJbGEJbNaNgtayT058laMVYPmv3u9EYCCkJ82FcGHdavgmoKMyon7vZZoc4PQ5gbA9erktncyCzuN7XnmYs8wrV2j2Nb52oCznWOR+Umy8J2do/mZdSmWtYTuUNU4FFoRzE3NQlEIKDA2x9zKOMtv3NKm1S8JqZiW7n8AUqEZ8LhD0OfoYuyo7mhL7KDuaDfstEWlfJ4d7rS/0GdLav2zljvVSywDIXVAii6eChHfgw6ydkZ2PoIXkDpPrVzCUrUxvmjVC/rHCTNKM/B6fI40T+qLwGxT/fj6Ff6sStP49c1mcJaYYsMTpOpQ5Cz83SVKY8SAl9BZOsCZjdHowNUN6MDVs+iAdyHfucrpwPWSgQ5cMU8HTBaoZhju6MDVlemAfTe5pl7Y4KADXtL8VGvL5iU7k1aYYtky23GVUXd1EhwHgu5BINAuP3rc1e93167X1+4mhQEtbRUz9wE0yMSNraKQBYQpsUwXzCZMiS21kIGFKbE8E7p8YUpUqaA7YYqvN2fUj9hKzQFbY7quLdv5jw4YbQNd5NCBnTiG7+TLdMCR9Au0am9kDUQjCOq/ldcKlRAdsDXfVMiV3U7SgSt86cA1qdOBayFBB669Nx3cyttxsU0H9HHBBLl5idrxex9/gRPK3vKStnTOaYlkFBU7WqGkn21xajoipQZinLz00/iwwMnPpJfJlJxBN/zHs3ptETHIClQhjqN4OzxLY3e5sfnDLqOhikbPgAJyzZdA8Qby8RPhKREYEuITy26JzL1HD5VQb6SxuJ2/tFr1qXCDmIoMJBNQD4fRRdiYcVVUq2+gLLGL1chwJJ25v6MBfW4LGgVONw8k3Ko/fmKhAS0hoMHtxTj9ED8ZW8d0crict14ib9acfEPJTETJyFLcoXHvffV4xtW6Xiu7pbR/P33Y2DhVzwuc6MHhUJ+ZaikKYU47/tGSuyxbQlnGbZkdCkuZSBqp6Z2xOSseH70f0mMn4+FOPaM2oa2XyPwGmV6z332k/u4eDILpglkEYiyZLJ4WFgFNJov3OpyYRB+WfbDj6FQa48r6FyDfbgcjf/DLBuxp9hXLYMBzl4Bp2gfb12oeeFvRlJiSAx6H/qOP2NQ1zmzysCl+Y2daAXHQCV7UOnax92ieeMBs7zpXnrCo+TAz4PhBAra7I1VgvIihx7oeEu+Grg9sjrgmOHN/Kjmc5rcWJtZk6R4iMo5h1oaCfTOxCPhvCrWD5kW2EE9h40fCNFuuXjH2JgXFmbzCNC9P9s1eq1rVphcwL55u944JvMK0+MwhXLI3efE0a3qapaZ6dQxWQ7zCtFivCm8lTXnxtBDTpLs4c2sauQNcHenSDbACLu8Ftg9cwp1F6+ZB77l5hP4/gLUQUroDgyMDMsrM5W1jb0LgUZKphBT/XzqWTGUcYUc8Wzgbz9hsNJ72ee4infOHLTdZosUMiMP0ItYmpGPykKw48iylDUmy8GDtsKCpcfMnRI+4KZtnTYS9Pf7eDk/rWBs+6faiB8yLmlGZtMD7+AniCTpY1MvP5Os7xMDX0Kp5/eIbOSlCZ4QY0J3O46dqtQxdHSl/IOfvsSTo2aWuXuwZU1+1t3N4EaTALQO6pJ09/nhkMvBip8/TQgzhq1KysG2c5LT3q3h51Oev1o3VeXJ4QHbPsYRe528szivq5S7mQG+PtaK2vEoKOX2xhHdBr49NGln7zRveoWQ6k3Y4q4Ak/ps/Cw1JJXJfVSjJzxln9nGfpSI8MDx98p+H+t43WJBSX8pDTSle/x8bWWRc6CkAAA==';;;;;

var rule = {
    title: '短剧库',
    host: 'http://127.0.0.1:8998',
    homeUrl: 'http://127.0.0.1:8998/api/home?plat=hongguo&page=1',
    searchUrl: 'http://127.0.0.1:8998/api/search?wd=**&page=fypage',
    url: 'http://127.0.0.1:8998/api/category?plat=fyclass&page=fypage',
    filter_url: 'cat={{fl.cat}}',
    class_name: '红果&围观&河马&山海&好看&百度&星芽&七猫&大芒&西饭&星星&薏米&悟圣&七星&酷我&牛牛&喜福&爽爽&五五&黄豆&黄豆2&黄果&黄果2&黄果旧版&黄剧&野果&51短剧&橙果&香蕉&黄瓜&狂飙&91短剧&2048短剧&短剧one',
    class_url: 'hongguo&weiguan&hema&shanhai&haokan&baidu&xingya&qimao&damang&xifan&xingxing&yimi&wusheng&qixing&kuwo&niuniu&xifu&shuang&wuwu&huangdou&huangdou2&huangguo&huangguo2&huangguoold&huangju&yeguo&dj51&chengguo&xiangjiao&huanggua&kuangbiao&dj91&md2048&duanjuone',
    filter: filter_def,
    filterable: 1,
    headers: {
        'User-Agent': 'MOBILE_UA'
    },
    timeout: 15000,
    multi: 1,
    searchable: 2,
    play_parse: true,
    推荐: 'json:data.list;vod_name;vod_pic;vod_remarks;vod_id;vod_content',
    一级: 'json:data.list;vod_name;vod_pic;vod_remarks;vod_id;vod_content',
    搜索: 'json:data.list;vod_name;vod_pic;vod_remarks;vod_id;vod_content',
    二级: async function () {
        let id = String(this.vid || this.orId || '').trim();
        if (!id) {
            id = String(this.input || '').split('?')[0].split('/').pop();
        }
        let platKey = '';
        let platName = '短剧库';
        // 平台名表：顺序与 class_name / class_url 一致，跟 Go 侧 platformOrder 同步
        const PLAT_NAMES = {
            hongguo: '红果', weiguan: '围观', hema: '河马', shanhai: '山海',
            haokan: '好看', baidu: '百度', xingya: '星芽', qimao: '七猫',
            damang: '大芒', xifan: '西饭', xingxing: '星星', yimi: '薏米',
            wusheng: '悟圣', qixing: '七星', kuwo: '酷我', niuniu: '牛牛', xifu: '喜福', shuang: '爽爽',
            wuwu: '五五', huangdou: '黄豆', huangdou2: '黄豆2', huangguo: '黄果',
            huangguo2: '黄果2', huangguoold: '黄果旧版', huangju: '黄剧',
            yeguo: '野果', dj51: '51短剧', chengguo: '橙果', xiangjiao: '香蕉',
            huanggua: '黄瓜', kuangbiao: '狂飙', dj91: '91短剧', md2048: '2048短剧',
            duanjuone: '短剧one'
        };
        let colonIdx = id.indexOf(':');
        if (colonIdx > 0) {
            platKey = id.substring(0, colonIdx);
            if (PLAT_NAMES[platKey]) platName = PLAT_NAMES[platKey];
        }
        let api = 'http://127.0.0.1:8998/api/detail?id=' + encodeURIComponent(id);
        let html = JSON.parse(await request(api));
        let d = html.data || {};
        let base_vod = {
            vod_id: id,
            vod_name: d.vod_name || '',
            type_name: d.vod_class || '',
            vod_pic: d.vod_pic || '',
            vod_content: d.vod_content || ''
        };
        let playUrls = [];
        for (let ep of (d.episodes || [])) {
            playUrls.push((ep.name || ('第' + ep.no + '集')) + '$' + ep.url);
        }
        base_vod.vod_play_from = platName;
        base_vod.vod_play_url = playUrls.join('#');
        return base_vod;
    },
    lazy: async function () {
        let {input} = this;
        let playPage = String(input || '').trim();
        if (!playPage) {
            return {parse: 0, url: ''};
        }
        let api = 'http://127.0.0.1:8998/api/play?url=' + encodeURIComponent(playPage);
        let res = JSON.parse(await request(api));
        if (res && res.code === 200 && res.data && res.data.url) {
            let playUrl = String(res.data.url);
            // 嗅探型播放器靠 URL 后缀识别格式，无扩展名时补伪后缀（fragment 不发给服务器）
            if (!/\.(m3u8|mp4|m4a|mp3|ts|flv|mkv)(\?|#|$)/i.test(playUrl)) {
                playUrl += '#.mp4';
            }
            return {parse: 0, url: playUrl};
        }
        return {parse: 0, url: playPage};
    }
};