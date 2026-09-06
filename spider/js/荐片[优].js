/*
@header({
  searchable: 1,
  filterable: 1,
  quickSearch: 0,
  title: '荐片[优]',
  类型: '影视',
  logo: 'https://xiazai.xznkjzx.cn/soft/jianpian/img/logo.png',
  lang: 'ds',
})
*/

var rule = {
    title: '荐片[优]',
    host: 'https://api.ztcgi.com',
    homeUrl: '/api/slide/list?pos_id=88',
    url: '/api/crumb/list?fcate_pid=fyclass&category_id=&page=fypage&fyfilter',
    logo: 'https://xiazai.xznkjzx.cn/soft/jianpian/img/logo.png',
    class_name: '电影&电视剧&动漫&短剧&综艺',
    class_url: '1&2&3&67&4',
    detailUrl: '/api/video/detailv2?id=fyid',
    searchUrl: '/api/v2/search/videoV2?key=**&category_id=88&page=fypage&pageSize=20',
    searchable: 1,
    quickSearch: 0,
    filterable: 1,
    filter: {
        "1": [{"key":"cateId","name":"分类","value":[{"n":"全部","v":"1"},{"n":"首推","v":"5"},{"n":"动作","v":"6"},{"n":"喜剧","v":"7"},{"n":"战争","v":"8"},{"n":"恐怖","v":"9"},{"n":"剧情","v":"10"},{"n":"爱情","v":"11"},{"n":"科幻","v":"12"},{"n":"动画","v":"13"}]},{"key":"area","name":"地區","value":[{"n":"全部","v":"0"},{"n":"国产","v":"1"},{"n":"中国香港","v":"3"},{"n":"中国台湾","v":"6"},{"n":"美国","v":"5"},{"n":"韩国","v":"18"},{"n":"日本","v":"2"}]},{"key":"year","name":"年代","value":[{"n":"全部","v":"0"},{"n":"2025","v":"107"},{"n":"2024","v":"119"},{"n":"2023","v":"153"},{"n":"2022","v":"101"},{"n":"2021","v":"118"},{"n":"2020","v":"16"},{"n":"2019","v":"7"},{"n":"2018","v":"2"},{"n":"2017","v":"3"},{"n":"2016","v":"22"}]},{"key":"sort","name":"排序","value":[{"n":"热门","v":"hot"},{"n":"评分","v":"rating"},{"n":"更新","v":"update"}]}],
        "2": [{"key":"cateId","name":"分类","value":[{"n":"全部","v":"2"},{"n":"首推","v":"14"},{"n":"国产","v":"15"},{"n":"港台","v":"16"},{"n":"日韩","v":"17"},{"n":"海外","v":"18"}]},{"key":"area","name":"地區","value":[{"n":"全部","v":"0"},{"n":"国产","v":"1"},{"n":"中国香港","v":"3"},{"n":"中国台湾","v":"6"},{"n":"美国","v":"5"},{"n":"韩国","v":"18"},{"n":"日本","v":"2"}]},{"key":"year","name":"年代","value":[{"n":"全部","v":"0"},{"n":"2025","v":"107"},{"n":"2024","v":"119"},{"n":"2023","v":"153"},{"n":"2022","v":"101"},{"n":"2021","v":"118"},{"n":"2020","v":"16"},{"n":"2019","v":"7"},{"n":"2018","v":"2"},{"n":"2017","v":"3"},{"n":"2016","v":"22"}]},{"key":"sort","name":"排序","value":[{"n":"热门","v":"hot"},{"n":"评分","v":"rating"},{"n":"更新","v":"update"}]}],
        "3": [{"key":"cateId","name":"分类","value":[{"n":"全部","v":"3"},{"n":"首推","v":"19"},{"n":"海外","v":"20"},{"n":"日本","v":"21"},{"n":"国产","v":"22"}]},{"key":"area","name":"地區","value":[{"n":"全部","v":"0"},{"n":"国产","v":"1"},{"n":"中国香港","v":"3"},{"n":"中国台湾","v":"6"},{"n":"美国","v":"5"},{"n":"韩国","v":"18"},{"n":"日本","v":"2"}]},{"key":"year","name":"年代","value":[{"n":"全部","v":"0"},{"n":"2025","v":"107"},{"n":"2024","v":"119"},{"n":"2023","v":"153"},{"n":"2022","v":"101"},{"n":"2021","v":"118"},{"n":"2020","v":"16"},{"n":"2019","v":"7"},{"n":"2018","v":"2"},{"n":"2017","v":"3"},{"n":"2016","v":"22"}]},{"key":"sort","name":"排序","value":[{"n":"热门","v":"hot"},{"n":"评分","v":"rating"},{"n":"更新","v":"update"}]}],
        "4": [{"key":"cateId","name":"分类","value":[{"n":"全部","v":"4"},{"n":"首推","v":"23"},{"n":"国产","v":"24"},{"n":"海外","v":"25"},{"n":"港台","v":"26"}]},{"key":"area","name":"地區","value":[{"n":"全部","v":"0"},{"n":"国产","v":"1"},{"n":"中国香港","v":"3"},{"n":"中国台湾","v":"6"},{"n":"美国","v":"5"},{"n":"韩国","v":"18"},{"n":"日本","v":"2"}]},{"key":"year","name":"年代","value":[{"n":"全部","v":"0"},{"n":"2025","v":"107"},{"n":"2024","v":"119"},{"n":"2023","v":"153"},{"n":"2022","v":"101"},{"n":"2021","v":"118"},{"n":"2020","v":"16"},{"n":"2019","v":"7"},{"n":"2018","v":"2"},{"n":"2017","v":"3"},{"n":"2016","v":"22"}]},{"key":"sort","name":"排序","value":[{"n":"热门","v":"hot"},{"n":"评分","v":"rating"},{"n":"更新","v":"update"}]}],
        "67": [{"key":"cateId","name":"分类","value":[{"n":"全部","v":"67"},{"n":"言情","v":"70"},{"n":"爱情","v":"71"},{"n":"战神","v":"72"},{"n":"古代","v":"73"},{"n":"萌娃","v":"74"},{"n":"神医","v":"75"},{"n":"玄幻","v":"76"},{"n":"重生","v":"77"},{"n":"激情","v":"79"},{"n":"时尚","v":"82"},{"n":"剧情演绎","v":"83"},{"n":"影视","v":"84"},{"n":"人文社科","v":"85"},{"n":"二次元","v":"86"},{"n":"明星八卦","v":"87"},{"n":"随拍","v":"88"},{"n":"个人管理","v":"89"},{"n":"音乐","v":"90"},{"n":"汽车","v":"91"},{"n":"休闲","v":"92"},{"n":"校园教育","v":"93"},{"n":"游戏","v":"94"},{"n":"科普","v":"95"},{"n":"科技","v":"96"},{"n":"时政社会","v":"97"},{"n":"萌宠","v":"98"},{"n":"体育","v":"99"},{"n":"穿越","v":"80"},{"n":"","v":"81"},{"n":"闪婚","v":"112"}]},{"key":"sort","name":"排序","value":[{"n":"全部","v":""},{"n":"最新","v":"update"},{"n":"最热","v":"hot"}]}]
    },

    filter_url: 'area={{fl.area or "0"}}&year={{fl.year or "0"}}&type={{fl.cateId}}&sort={{fl.sort or "update"}}',
    filter_def: {1:{cateId:'1'},2:{cateId:'2'},3:{cateId:'3'},4:{cateId:'4'},67:{cateId:'67'}},
    headers: {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'},
    timeout: 15000,
    limit: 20,
    play_parse: true,

    lazy: async function(flag, id) {
        return {
            parse: 0,
            url: id.includes(".m3u8") ? id : `tvbox-xg:${id}`
        };
    },

    预处理: async function() {
        if (this.imghost) return;
        this.imghost = 'https://img1.vbwus.com';
        try {
            const res = JSON.parse(await request(this.host + '/api/v2/settings/resourceDomainConfig', {headers: this.headers}));
            if (res?.data?.imgDomain) {
                const domains = res.data.imgDomain.split(',').map(d => d.trim()).filter(Boolean);
                const imgDomains = domains.filter(d => d.startsWith('img'));
                const selected = (imgDomains.length > 0 ? imgDomains : domains)[Math.floor(Math.random() * (imgDomains.length > 0 ? imgDomains.length : domains.length))];
                this.imghost = 'https://' + selected;
            }
        } catch (e) {}
    },

    推荐: async function(tid, pg, filter, extend) {
        await this.预处理();
        const data = JSON.parse(await request(this.input)).data;
        return setResult(data.map(item => ({
            title: item.title,
            img: this.imghost + item.thumbnail,
            desc: (item.mask || '') + (item.score ? ' ⭐' + item.score : ''),
            url: item.jump_id || item.id
        })));
    },

    一级: async function(tid, pg, filter, extend) {
        await this.预处理();
        let apiUrl = this.input;
        const realTid = String(tid);
        if (realTid === '67') apiUrl = apiUrl.replace('/api/crumb/list', '/api/crumb/shortList');
        const data = JSON.parse(await request(apiUrl)).data;
        return setResult(data.map(item => {
            const isShort = realTid === '67';
            const imgUrl = this.imghost + (isShort ? (item.cover_image || item.path) : (item.thumbnail || item.path));
            return {
                title: item.title,
                img: imgUrl,
                desc: (item.mask || item.playlist?.title || '') + (item.score ? ' ⭐' + item.score : ''),
                url: `${item.id}@${realTid}`
            };
        }));
    },

    二级: async function(ids) {
        await this.预处理();
        const [id, tid] = this.input.split('=')[1].split('@');
        const isShort = tid === '67';
        const path = isShort ? '/api/detail' : '/api/video/detailv2';
        const param = isShort ? 'vid' : 'id';
        const res = JSON.parse(await request(`${this.host}${path}?${param}=${id}`, {headers: this.headers})).data;
        const vod = {
            vod_id: id,
            vod_name: res.title,
            vod_pic: this.imghost + (isShort ? (res.cover_image || res.path) : (res.thumbnail || res.path)),
            type_name: (res.types || []).map(t => t.name).join('/') || '',
            vod_year: res.year || '',
            vod_area: res.area || '',
            vod_remarks: res.update_cycle || res.mask || '',
            vod_actor: (res.actors || []).map(a => a.name).join('/') || '',
            vod_director: (res.directors || []).map(d => d.name).join('/') || '',
            vod_content: res.description || ''
        };
        const rename = name => name === "常规线路" ? "边下边播" : name;
        let sources = [];
        if (isShort) {
            const pl = res.playlist || [];
            if (pl.length) {
                const name = rename(pl[0]?.source_config_name || "短剧");
                const urls = pl.map(ep => `${ep.title}$${ep.url}`).join('#');
                sources.push({name, urls});
            }
        } else {
            (res.source_list_source || []).forEach(src => {
                const name = rename(src.name);
                const urls = (src.source_list || []).map(ep => `${ep.source_name || ep.weight}$${ep.url}`).join('#');
                if (urls) sources.push({name, urls});
            });
        }
        if (sources.length) {
            vod.vod_play_from = sources.map(s => s.name).join('$$$');
            vod.vod_play_url = sources.map(s => s.urls).join('$$$');
        }
        return vod;
    },

    搜索: async function(wd, quick, pg) {
        await this.预处理();
        const data = JSON.parse(await request(this.input)).data;
        return setResult(data.map(item => ({
            title: item.title,
            img: this.imghost + item.thumbnail,
            desc: (item.mask || '') + (item.score ? ' ⭐' + item.score : ''),
            url: item.id
        })));
    }
};
