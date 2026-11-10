/*
@header({
  searchable: 1,
  filterable: 1,
  quickSearch: 0,
  title: '王子TV',
  logo: 'https://i-blog.csdnimg.cn/blog_migrate/2621e710a94ab40ba66645d47f296aaf.gif',
  lang: 'ds'
})
*/

const { req_proxy } = $.require('./_lib.request.js');

var rule = {
  类型: '影视',
  title: '王子TV',
  author: '不告诉你',
  logo:'https://i-blog.csdnimg.cn/blog_migrate/2621e710a94ab40ba66645d47f296aaf.gif',
  host: 'https://www.wangzitv.com',
  hostJs: async function () {
        let HOST = this.HOST;
        let html = await request(HOST, {headers: {'User-Agent': 'Mozilla/5.0'}});
        HOST = jsp.pdfh(html, ".panel-box&&a:eq(0)&&href");
        return HOST;
    },
  url: '/vodshow/fyclass-fyfilter.html',
  //url:'/vodshow/fyclass-----------.html',
  searchUrl: '/vodsearch/**----------fypage---.html',
  searchable:1,quickSearch:1,double:true,timeout:10000,play_parse:true,filterable:1,invalid:true,
  //class_name: '电影&连续剧&动漫&综艺&短剧',class_url: 'dianying&dianshiju&dongman&zongyi&duanju',
  推荐: async function (tid, pg, filter, extend) {
    const homeFn = rule.一级.bind(this);
    return await homeFn();
  },
    一级: async function () {
        let {input, pdfa, pdfh, pd} = this;
        let html = await request(input);
        let d = [];
        let data = pdfa(html, '.module-items .module-poster-item');
        data.forEach((it) => {
            d.push({
                title: pdfh(it, 'a&&title'),
                pic_url: pd(it, '.lazyload&&data-original'),
                desc: pdfh(it, '.module-item-note&&Text'),
                url: pd(it, 'a&&href'),
            })
        });
        return setResult(d)
    },
    二级: async function (ids) {
        let {input, pdfa, pdfh, pd} = this;
        let html = await request(input);
        let VOD = {};
        VOD.vod_name = pdfh(html, 'h1&&Text');//名称
        VOD.vod_actor = pdfh(html, '.module-info-item:eq(2)&&Text');//演员
        VOD.vod_director = pdfh(html, '.module-info-item:eq(1)&&Text');//导演
        VOD.vod_remarks = pdfh(html, '');//备注
        VOD.vod_status = pdfh(html, '');//状态
        VOD.vod_content = pdfh(html, '.module-info-introduction&&Text');//简介
        let playlist = pdfa(html, '.module-play-list')
        let tabs = pdfa(html, '#y-playList .module-tab-item');
        let playmap = {};
        tabs.map((item, i) => {
            const form = pdfh(item, 'span&&Text');
            const list = playlist[i];
            const a = pdfa(list, 'body&&a');
            a.map((it) => {
                let title = pdfh(it, 'span&&Text');
                let urls = pd(it, 'a&&href', input);
                if (!playmap.hasOwnProperty(form)) {
                    playmap[form] = [];
                }
                playmap[form].push(title + "$" + urls);
            });
        });
        VOD.vod_play_from = Object.keys(playmap).join('$$$');
        const urls = Object.values(playmap);
        const playUrls = urls.map((urllist) => {
            return urllist.join("#");
        });
        VOD.vod_play_url = playUrls.join('$$$');
        return VOD;
    },
    搜索: async function (wd, quick, pg) {
        let {input, pdfa, pdfh, pd} = this;
        let html = ''
        let {data:search} = await req_proxy(input, 'get', rule.headers)
        if(search.match(/请输入验证码/g)){
            let {data:img,cookie:cookie} = await req_proxy(HOST+'/index.php/verify/index.html','get', {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            },{responseType: 'arraybuffer'})
            let img_content = Buffer.from(img, 'binary').toString('base64')
            let resp = await req(OCR_API, {
                method: "POST",
                headers: {
                    "Content-Type": "text/plain;charset=UTF-8",
                },
                body: img_content
            })
            let vercode = resp.content
            let {data:status} = await req_proxy(HOST+'/index.php/ajax/verify_check?type=search&verify='+vercode,"POST",{
                "Content-Type": "text/plain;charset=UTF-8",
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'X-Requested-With': 'XMLHttpRequest',
                "cookie":cookie
            })
            log(status.code)
            log("验证码识别结果："+status.msg)
            if(status.code === 1){
                rule.headers = {
                    "cookie":cookie
                }
            }
            let {data:search_html} = await req_proxy(input, 'get', rule.headers);
            html = search_html
        }else {
            html = search
        }
        let d = [];
        let data = pdfa(html, '.module-items&&.module-card-item');
        data.forEach((it) => {
            d.push({
                title: pdfh(it, 'a&&title'),
                pic_url: pd(it, '.lazyload&&data-original'),
                desc: pdfh(it, '.module-item-note&&Text'),
                url: pd(it, 'a&&href'),
            })
        });
        return setResult(d);
    },
  lazy: async function (flag, id, flags) {
        let {input, pdfa, pdfh, pd} = this;
        let html = await request(input);
        html = JSON.parse(html.match(/r player_.*?=(.*?)</)[1]);
        let url = html.url;
        if (html.encrypt == "1") {
            url = unescape(url)
            return {parse: 0, url: url}
        } else if (html.encrypt == "2") {
            url = unescape(base64Decode(url))
            return {parse: 0, url: url}
        }
        if (/m3u8|mp4/.test(url)) {
            input = url
            return {parse: 0, url: input}
        } else {
            return {parse: 0, url: input}
        }
    },
    filter_url:'{{fl.地区}}-{{fl.sort}}-{{fl.剧情}}-----fypage---{{fl.年份}}',
  class_parse: async function () {
    const { input, pdfa, pdfh, pd } = this;
    const filters = {};
    const html = await request(input, { headers: this.headers, timeout: this.timeout });
    // 类处理
    const data = pdfa(html, ".navbar ul li");
    const classes = data
      .map((it) => {
        const type_id = pdfh(it, "a&&href").replace(/\/type\/(.*).html/g, "$1");
        const type_name = pdfh(it, "span&&Text");
        if (["首页", "追剧周表", "今日更新", "热榜", "APP", null].includes(type_name)) return null;
        if (!type_id || !type_name) return null; // 确保 type_id 和 type_name 都不为空
        return { type_id, type_name };
      })
      .filter(Boolean);

    // 筛选处理
    const htmlUrl = classes.map((item) => ({
      url: `${this.host}/vodshow/${item.type_id}-----------.html`,
      options: { timeout: this.timeout, headers: this.headers },
    }));
    const htmlArr = await batchFetch(htmlUrl);
    htmlArr.map((it, i) => {
      const type_id = classes[i].type_id;
      const data = pdfa(it, "body&&.module-class-items");
      const categories = [
        { key: "剧情", name: "剧情" },
        { key: "地区", name: "地区" },
        { key: "年份", name: "年份" },
        { key: "by", name: "排序" },
      ];
      filters[type_id] = categories
        .map((category) => {
          const filteredData =
            data.filter((item) => pdfh(item, ".module-item-title&&Text") === category.name)[0] ||
            [];
          if (filteredData.length === 0) return null;
          const values = pdfa(filteredData, "a")
            .map((it) => {
              const nv = pdfh(it, "a&&Text");
              if (nv === category.name) return null;
              return {
                n: nv || "全部",
                v: nv === "全部" ? "" : nv,
              };
            })
            .filter(Boolean);
          return { key: category.key, name: category.name, value: values };
        })
        .filter(Boolean);
    });
    return { class: classes, filters };
  },
}