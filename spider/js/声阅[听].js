/*
@header({
  searchable: 1,
  filterable: 1,
  quickSearch: 1,
  title: '声阅APP',
  author: 'EylinSir',
  类型: '听书',
  logo: 'https://pic.qqtf.com/up/2025-1/20251614147589.png',
  lang: 'ds',
})
*/

var rule = {
    title: '声阅APP',
    author: 'EylinSir',
    类型: '听书',
    searchable: 1,
    quickSearch: 1,
    filterable: 1,
    play_parse: true,
    host: 'http://tingshu.kuwo.cn',
    logo: 'https://pic.qqtf.com/up/2025-1/20251614147589.png',
    headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 12; NOH-AN01) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Mobile Safari/537.36'
    },

    class_name: '有声小说&热歌神曲&相声评书&亲子儿童&热播榜&免费榜&畅销榜&男频榜&女频榜&新品榜&精品榜',
    class_url: 'novel&music&crossTalk&kids&rank15&rank16&rank2&rank20&rank21&rank8&rank23',
    searchUrl: 'http://search.kuwo.cn/r.s?client=kt&all=**&ft=album&newsearch=1&itemset=web_2013&pn=fypage&rn=20&rformat=json&encoding=utf8&show_series_listen=1&mobi=1',

    cateConfig: {
        novel:     { path: '/v2/api/search/filter/albums', classifyId: '0', sortType: 'pubDate' },
        music:     { path: '/v2/api/search/filter/albums', classifyId: '0', categoryId: '37' },
        crossTalk: { path: '/v2/api/search/filter/albums', classifyId: '0', categoryId: '5',  sortType: 'playCnt' },
        kids:      { path: '/v2/api/search/filter/albums', classifyId: '0', categoryId: '1',  sortType: 'playCnt' }
    },

    rankSub: {
        15: [['有声小说','123'],['相声评书','126'],['历史','140'],['影视原声','141'],['两性情感','129'],['人文','137'],['音乐调频','131'],['戏曲','139'],['国漫游戏','130'],['畅销书','127'],['脱口秀','785'],['娱乐段子','132'],['个人提升','133'],['儿童','125'],['学科教育','128'],['商业财经','134'],['外语','138']],
        16: [['热门','475'],['有声小说','476'],['相声评书','477'],['戏曲','478'],['历史','479'],['人文','480'],['儿童','481'],['影视原声','482'],['两性情感','483'],['国漫游戏','484'],['音乐调频','485'],['脱口秀','786'],['学科教育','487'],['个人提升','488'],['商业财经','489'],['外语','490']],
        2:  [['热门','91'],['都市传说','72'],['玄幻奇幻','69'],['现代言情','73'],['悬疑推理','76'],['古代言情','74'],['武侠仙侠','75'],['历史军事','77'],['儿童','16']],
        20: [['男频热播','839'],['都市传说','842'],['玄幻仙侠','843'],['恐怖悬疑','844'],['历史军事','846']],
        21: [['女频热播','848'],['总裁萌宝','850'],['穿越重生','852'],['中短篇','854']],
        8:  [['热门','92'],['有声小说','93'],['相声','594'],['评书','595'],['历史','596'],['人文','597'],['儿童','95'],['影视原声','568'],['两性情感','98'],['音乐调频','564'],['广播剧','593'],['教育','565'],['畅销书','96']],
        23: [['全部','861'],['都市传说','856'],['玄幻仙侠','857'],['悬疑灵异','858'],['言情精选','859'],['历史军事','860']]
    },

    getJson: async function(url) {
        const res = await req(url, { method: 'get', headers: this.headers });
        if (!res || !res.content) return null;
        return JSON.parse(res.content);
    },

    mapAlbumList: function(list) {
        if (!list || !Array.isArray(list)) return [];
        return list.map(it => ({
            vod_id: String(it.albumId || it.albumid || ''),
            vod_name: it.albumName || it.name || '',
            vod_pic: it.coverImg || it.albumImg || it.img || '',
            vod_remarks: it.playCnt ? it.playCnt + '万' : (it.artist || (it.musiccnt ? it.musiccnt + '集' : ''))
        }));
    },

    toFilterValue: function(arr) {
        return arr.map(([n, v]) => ({ n, v }));
    },

    预处理: async function() {
        const novelClass = [['全部','0'],['玄幻奇幻','44'],['武侠仙侠','48'],['穿越架空','52'],['都市传说','42'],['科幻竞技','57'],['幻想言情','169'],['独家定制','170'],['古代言情','207'],['影视原著','213'],['悬疑推理','45'],['历史军事','56'],['现代言情','41'],['青春校园','55'],['文学名著','61']];
        const musicClass = [['全部','0'],['抖音神曲','253'],['怀旧老歌','252'],['创作|翻唱','248'],['催眠','254'],['古风','255'],['播客周刊','1423'],['民谣','1409'],['纯音乐','1408'],['3D电子','249'],['音乐课程','251'],['音乐推荐','246'],['音乐故事','247'],['情感治愈','250'],['儿童音乐','1407']];
        const crossTalkClass = [['全部','0'],['郭德纲','84'],['相声新人','222'],['张少佐','313'],['刘立福','314'],['评书大全','220'],['小品合辑','221'],['刘兰芳','309'],['连丽如','311'],['田占义','317'],['单口相声','219'],['袁阔成','310'],['孙一','315'],['王玥波','316'],['单田芳','217'],['热门相声','218'],['相声名家','290'],['粤语评书','320'],['关永超','325'],['马长辉','326'],['赵维莉','327'],['潮剧','1718'],['沪剧','1719'],['晋剧','1720']];
        const kidsClass = [['全部','0'],['益智故事','209'],['科普知识','83'],['国学经典','2'],['卡通动画','282'],['儿童教育','4'],['英语启蒙','12'],['早教启蒙','385'],['轻松哄睡','210']];

        const classFilter = (val) => [{ key: 'class', name: '类型', value: this.toFilterValue(val) }];

        const filter = {
            novel: [...classFilter(novelClass), { key: 'sort', name: '排序', value: [{ n: '最新', v: 'pubDate' }, { n: '最热', v: 'playCnt' }] }],
            music: classFilter(musicClass),
            crossTalk: classFilter(crossTalkClass),
            kids: classFilter(kidsClass)
        };

        for (const tabId in this.rankSub) {
            filter['rank' + tabId] = [{ key: 'sub', name: '分类', value: this.toFilterValue(this.rankSub[tabId]) }];
        }

        this.filter = filter;
    },

    推荐: async function() {
        const url = this.host + '/v2/api/product/change/data?uid=2744049313&appuid=2744049313&bksource=kwbook_ar_9.1.8.1_tunknown.apk&id=873&notrace=0&source=kwplayer_ar_9.1.8.1_tunknown.apk&currentPage=4&rn=12&platform=1&kweexVersion=1.1.5';
        const data = await this.getJson(url);
        if (!data || !data.data || !data.data.data) return [];

        return data.data.data.map(it => ({
            vod_id: String(it.moduleUrl || ''),
            vod_name: it.moduleTitle || '',
            vod_pic: it.moduleImg || '',
            vod_remarks: ''
        }));
    },

    一级: async function(tid, pg, filter, extend) {
        let url, listKey = 'data';

        if (tid.startsWith('rank')) {
            const tabId = tid.replace('rank', '');
            url = this.host + '/v2/api/product/rank/dataList?tabId=' + tabId +
                '&id=' + (extend.sub || '') + '&rn=10&pn=' + pg;
            listKey = 'rankDataList';
        } else {
            const cfg = this.cateConfig[tid];
            if (!cfg) return [];
            const classifyId = extend.class || cfg.classifyId;
            const sortType = extend.sort || cfg.sortType || '';
            url = this.host + cfg.path + '?classifyId=' + classifyId + '&rn=10&pn=' + pg;
            if (cfg.categoryId) url += '&categoryId=' + cfg.categoryId;
            if (sortType) url += '&sortType=' + sortType;
        }

        const data = await this.getJson(url);
        if (!data || !data.data) return [];

        const list = data.data[listKey] || data.data.data;
        return this.mapAlbumList(list);
    },

    二级: async function(ids) {
        const albumId = ids[0];
        if (!albumId) return {};

        const url = 'http://search.kuwo.cn/r.s?stype=albuminfo&user=5b5fef483f589107&uid=2645060848&loginUid=0&loginSid=null&prod=kwplayer_ar_9.1.8.1&bkprod=kwbook_ar_9.1.8.1&source=kwplayer_ar_9.1.8.1_t87.apk&bksource=kwbook_ar_9.1.8.1_t87.apk&corp=kuwo&albumid=' + albumId + '&pn=0&rn=100&show_copyright_off=1&vipver=MUSIC_8.2.0.0_BCS17&mobi=1&sortby=3&show_digitalmusic_off=1&iskwbook=1';
        const data = await this.getJson(url);
        if (!data) return {};

        const playUrl = (data.musiclist || []).map(it =>
            (it.name || '') + '$' + (it.musicrid || '')
        ).join('#');

        return {
            vod_name: data.name || '',
            vod_pic: data.img || '',
            vod_content: data.info || '',
            vod_play_from: '声阅',
            vod_play_url: playUrl
        };
    },

    搜索: async function(key, quick, pg) {
        const page = pg - 1;
        const url = 'http://search.kuwo.cn/r.s?client=kt&all=' + encodeURIComponent(key) +
            '&ft=album&newsearch=1&itemset=web_2013&pn=' + page +
            '&rn=20&rformat=json&encoding=utf8&show_series_listen=1&mobi=1';
        const data = await this.getJson(url);
        if (!data || !data.albumlist) return [];

        return this.mapAlbumList(data.albumlist);
    },

    lazy: async function(flag, id) {
        if (!id) return { parse: 0, url: '' };

        const url = 'http://mobi.kuwo.cn/mobi.s?f=web&user=0&source=kwplayercar_ar_6.0.0.9_B_jiakong_vh.apk&type=convert_url_with_sign&rid=' + id + '&br=128kmp3';
        const data = await this.getJson(url);
        if (!data || !data.data || !data.data.url) {
            return { parse: 0, url: '' };
        }

        return { parse: 0, url: data.data.url };
    }
};