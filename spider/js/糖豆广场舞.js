/*
@header({
  searchable: 1,
  filterable: 1,
  quickSearch: 0,
  title: '糖豆广场舞',
  author: 'EylinSir',
  类型: '影视',
  logo: 'https://www.tangdou.com/favicon.ico',
  lang: 'ds',
})
*/

var rule = {
    类型: '影视',
    author: 'EylinSir',
    title: '糖豆广场舞',
    desc: '糖豆广场舞源',
    logo: 'https://www.tangdou.com/favicon.ico',
    host: 'https://api-h5.tangdou.com',
    img_host: 'https://bimg.tangdou.com',
    homeUrl: 'https://www.tangdou.com',
    searchable: 1,
    quickSearch: 0,
    filterable: 1,
    timeout: 10000,
    play_parse: true,
    uuid: `${Date.now()}_${Math.floor(Date.now() % 100000)}`,
    cache: {},
    cache_timeout: 300,

    headers: {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'zh,zh-CN;q=0.9',
        'Connection': 'keep-alive',
        'Host': 'api-h5.tangdou.com',
        'Referer': 'https://www.tangdou.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    },

    json2list(arr) {
        return (arr || []).reduce((d, item) => {
            const vid = String(item.vid || '');
            if (!vid) return d;
            const title = (item.title || '').trim();
            const cover_path = item.cover || item.img || item.video_img || '';
            const img = cover_path && !cover_path.startsWith('http') ? this.img_host + cover_path : cover_path;
            const remarks = item.duration_str || item.teacher || item.author || '';
            d.push({ title, url: vid, pic_url: img, desc: remarks });
            return d;
        }, []);
    },

    async fetchData(url, cache_key, use_cache = true) {
        if (use_cache && cache_key && this.cache[cache_key]) {
            const [cached, timestamp] = this.cache[cache_key];
            if (Date.now() / 1000 - timestamp < this.cache_timeout) return cached;
        }
        const html = await request(url, { headers: this.headers });
        const data = JSON.parse(html || '{}');
        if (use_cache && cache_key) this.cache[cache_key] = [data, Date.now() / 1000];
        return data;
    },

    async class_parse() {
        const classes = [
            { type_name: '广场舞', type_id: '1' },
            { type_name: '民族舞', type_id: '2' },
            { type_name: 'jazz/现代舞', type_id: '3' },
            { type_name: '健身', type_id: '4' },
            { type_name: '双人舞', type_id: '5' },
            { type_name: '步法', type_id: '6' },
            { type_name: '气球', type_id: '7' },
            { type_name: '瑜伽', type_id: '8' },
            { type_name: '二人转', type_id: '9' }
        ];
        const yearOptions = ['全部', '2026', '2025', '2024', '2023', '2022', '2021', '2020', '2019', '2018', '2017及以前'];
        const sortOptions = [{ n: '最新', v: 'new' }, { n: '最热', v: 'hot' }, { n: '推荐', v: 'rec' }];
        const filters = {};
        classes.forEach(c => {
            filters[c.type_id] = [
                { key: 'year', name: '年份', value: yearOptions.map((n, i) => ({ n, v: i === 0 ? '0' : yearOptions[i] })) },
                { key: 'sort', name: '排序', value: sortOptions }
            ];
        });
        return { class: classes, filters };
    },

    async 推荐() {
        const data = await this.fetchData(`${this.host}/mtangdou/home/feed?page=1&num=20&uuid=${this.uuid}`, 'home_feed');
        return setResult(data?.data ? this.json2list(data.data) : []);
    },

    async 一级(tid, pg, filter, extend) {
        let api = `${this.host}/mtangdou/home/feed?page=${pg}&num=30&uuid=${this.uuid}`;
        if (tid !== '0') api += `&type=${tid}`;
        const sort = (extend && extend.sort) || 'new';
        if (sort === 'hot' || sort === 'rec') api += `&sort=${sort}`;
        const data = await this.fetchData(api, `cat_${tid}_${pg}_${sort}`);
        return setResult(data?.data ? this.json2list(data.data) : []);
    },

    async 二级(ids) {
        const rawId = ids || this.input;
        const vid = String(rawId).split('||')[0];
        const [playData, shareData] = await Promise.all([
            this.fetchData(`${this.host}/mtangdou/video/play?vid=${vid}&uuid=${this.uuid}`, null, false),
            this.fetchData(`${this.host}/sample/share/main?vid=${vid}`, null, false)
        ]);
        if (!shareData?.data) return { list: [] };
        const info = shareData.data;
        const content = (info.desc || info.description || '').trim() || '快乐舞步，跳出健康好生活！';
        const cover = info.cover || info.img || '';
        const coverUrl = cover && !cover.startsWith('http') ? this.img_host + cover : cover;
        let playUrl = playData?.data?.play_url || info.video_url || '';
        const title = (info.title || '').trim();
        const vodPlayUrl = playUrl ? `${title}$${vid}||${playUrl}` : '';
        const remarks = info.duration_str ? `时长: ${info.duration_str}` : '';
        return {
            vod_id: vid,
            vod_name: title,
            vod_pic: coverUrl,
            vod_year: String(info.year || ''),
            vod_area: info.area || '大陆',
            vod_actor: String(info.teacher || info.author || ''),
            vod_director: '',
            vod_content: content,
            vod_play_from: '糖豆',
            vod_remarks: remarks,
            vod_play_url: vodPlayUrl
        };
    },

    async 搜索() {
        const key = this.KEY, pg = this.MY_PAGE || 1;
        const data = await this.fetchData(`${this.host}/mtangdou/search?word=${encodeURIComponent(key)}&page=${pg}&num=30&uuid=${this.uuid}`, null, false);
        if (data?.data) return setResult(this.json2list(data.data));
        if (pg === 1) {
            const feed = await this.fetchData(`${this.host}/mtangdou/home/feed?page=1&num=100&uuid=${this.uuid}`, 'search_feed');
            if (feed?.data) {
                const filtered = feed.data.filter(item => String(item.title || '').toLowerCase().includes(key.toLowerCase()));
                return setResult(this.json2list(filtered));
            }
        }
        return setResult([]);
    },

    async lazy(flag, id) {
        const source = id || this.input || '';
        const [vid, playUrl = ''] = String(source).split('||');
        let url = playUrl;
        if (!url) {
            const data = await this.fetchData(`${this.host}/mtangdou/video/play?vid=${vid}&uuid=${this.uuid}`, null, false);
            url = data?.data?.play_url || '';
        }
        if (url) {
            return {
                parse: 0,
                playUrl: '',
                url,
                header: {
                    'Referer': 'https://www.tangdou.com/',
                    'User-Agent': this.headers['User-Agent']
                }
            };
        }
        return { parse: 0, playUrl: '', url: '' };
    }
};