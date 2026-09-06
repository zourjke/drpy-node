/*
@header({
  searchable: 1,
  filterable: 0,
  quickSearch: 0,
  title: '新6V',
  author: 'EylinSir',
  '类型': '影视',
  logo: 'https://www.xb6v.com/favicon.ico',
  lang: 'ds'
})
*/

var rule = {
    类型: '影视',
    author: 'EylinSir',
    title: '新6V',
    host: 'https://www.xb6v.com',
    homeUrl: '/',
    url: '/fyclass/index_fypage.html',
    logo: 'https://www.xb6v.com/favicon.ico',
    searchUrl: '/e/search/1index.php',
    searchable: 1,
    quickSearch: 0,
    filterable: 0,
    timeout: 5000,
    limit: 20,
    play_parse: true,
    headers: {'User-Agent': MOBILE_UA},
    class_name: '喜剧片&动作片&爱情片&科幻片&恐怖片&剧情片&战争片&纪录片&动画片&电视剧&国剧&日韩剧&欧美剧&短剧&综艺',
    class_url: 'xijupian&dongzuopian&aiqingpian&kehuanpian&kongbupian&juqingpian&zhanzhengpian&jilupian&donghuapian&dianshiju&dianshiju/guoju&dianshiju/rihanju&dianshiju/oumeiju&dianshiju/duanju&ZongYi',

    推荐: '*',

    一级: async function () {
        return rule.getVodList(await fetch(this.input.replace('index_1.html', 'index.html')));
    },

    二级: async function () {
        let [id, kname, kpic, kremarks] = this.input.split('@');
        let html = await fetch(id);
        let content = pdfh(html, '#post_content&&Html').split("<hr>")[0];
        const clean = (s) => s ? s.replace(/<br\s*\/?>/gi, '/').replace(/<[^>]+>/g, '').replace(/&middot;|middot;/g, '·').replace(/&amp;/g, '&').replace(/&nbsp;|　/g, ' ').replace(/\s+/g, ' ').trim() : '';

        const getMeta = (keys) => {
            for (let key of keys) {
                let keyPattern = key.split('').join('[\\s　&nbsp;]*');
                let m = content.match(new RegExp(`◎${keyPattern}[:：\\s&nbsp;　]+([\\s\\S]*?)(?=◎|<hr>|$)`));
                if (m) {
                    return clean(m[1])
                        .replace(/^\/|\/$/g, '')
                        .replace(/\/+/g, '/')
                        .replace(/\s*\/\s*/g, '/');
                }
            }
            return '';
        };

        let tabs = [], urls = [];
        const addUrl = (name, list) => {
            if (!list.length) return;
            tabs.push(name);
            urls.push(list.join('#'));
        };

        // 磁力链接
        let mags = pdfa(html, "#post_content&&a[href^=magnet]").map(a => (pdfh(a, "a&&Text")||"磁力") + '$' + pd(a, "a&&href"));
        addUrl("磁力", mags);

        // 网盘链接
        let disks = pdfa(html, ".context&&.bd-address").map(a => {
            let href = pd(a, "a&&href");
            if (/(baidu|quark|uc|aliyundrive|pan\.xunlei)/.test(href) && !href.startsWith('push://')) {
                href = 'push://' + href;
            }
            return (pdfh(a, "Text") || "网盘") + "$" + href;
        });
        addUrl("网盘", disks);

        // 在线线路
        pdfa(html, '.widget.box.row:has(a.lBtn)').forEach((p, i) => {
            let links = pdfa(p, "body&&a.lBtn").map(a => {
                let u = pd(a, "a&&href");
                return (pdfh(a, "a&&title")||pdfh(a, "a&&Text")) + '$' + (u.startsWith('/') ? rule.host + u : u);
            });
            addUrl('线路 ' + (i + 1), links);
        });

        return {
            vod_id: id,
            vod_name: clean(pdfh(html, 'title')).replace(/(【.*?】)|(-6v.*)/g, ''),
            vod_pic: kpic,
            type_name: getMeta(['类别', '类别']),
            vod_remarks: kremarks,
            vod_year: getMeta(['年代', '年代']),
            vod_area: getMeta(['产地', '产地']),
            vod_actor: getMeta(['主演', '演员']),
            vod_director: getMeta(['导演']),
            vod_content: clean(content.match(/◎简　　介([\s\S]*?)(?=◎|<hr>|$)/)?.[1]).replace(/^\/+|\/+$/g, ''),
            vod_play_from: tabs.join('$$$'),
            vod_play_url: urls.join('$$$')
        };
    },
    
    搜索: async function () {
        let html = await post(this.host + '/e/search/1index.php', {
            body: "show=title&tempid=1&tbname=article&mid=1&dopost=search&submit=&keyboard=" + this.KEY,
            headers: {
                'User-Agent': MOBILE_UA,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': this.host + '/e/search/1index.php'
            }
        });
        return html && html.includes('id="post_container"') ? rule.getVodList(html) : [];
    },

    lazy: async function () {
        let url = this.input;
        if (/(magnet:|ed2k:|ftp:|push:\/\/)/.test(url)) {
            return {parse: 0, url: url};
        }
        return {parse: 1, url: url};
    },

    getVodList: function (html) {
        return (pdfa(html, "#post_container&&li") || []).map(it => {
            let name = pdfh(it, "a&&title").replace(/<[^>]+>|\[.*?\]|【.*?】/g, '').trim();
            let pic = pd(it, "img&&src");
            let remark = pdfh(it, "span&&Text");
            return {
                vod_name: name,
                vod_pic: pic,
                vod_remarks: remark,
                vod_id: `${pd(it, "a&&href")}@${name}@${pic}@${remark}`
            };
        });
    }
};