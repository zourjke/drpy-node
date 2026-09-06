/*
@header({
  searchable: 2,
  filterable: 1,
  quickSearch: 0,
  title: '万象影视',
  '类型': '影视',
  lang: 'ds'
})
*/

var rule = {
    类型: '影视',
    title: '万象影视',
    desc: '万象影视资源站',
    host: 'https://vxvod.com',
    url: '/vodshow/fyfilter.html',
    searchUrl: '/vodsearch/**----------fypage---.html',
    searchable: 2,
    quickSearch: 0,
    filterable: 1,
    play_parse: true,
    filter_url:'{{fl.cateId}}-{{fl.area}}-{{fl.by}}-{{fl.class}}-{{fl.lang}}-{{fl.letter}}---fypage---{{fl.year}}',
    filter: {
        "dianying":[{"key":"cateId","name":"类型","value":[{"n":"全部","v":"dianying"},{"n":"动作片","v":"dongzuodianying"},{"n":"喜剧片","v":"xijudianying"},{"n":"爱情片","v":"aiqingdianying"},{"n":"科幻片","v":"kehuandianying"},{"n":"恐怖片","v":"juqingdianying"},{"n":"剧情片","v":"juqingdianying"},{"n":"战争片","v":"zhanzhengdianying"},{"n":"悬疑片","v":"xuanyidianying"},{"n":"犯罪片","v":"fanzui"},{"n":"纪录片","v":"jiludianying"},{"n":"动画片","v":"donghuadianying"}]},{"key":"class","name":"剧情","value":[{"n":"全部","v":""},{"n":"喜剧","v":"喜剧"},{"n":"爱情","v":"爱情"},{"n":"恐怖","v":"恐怖"},{"n":"动作","v":"动作"},{"n":"科幻","v":"科幻"},{"n":"剧情","v":"剧情"},{"n":"战争","v":"战争"},{"n":"警匪","v":"警匪"},{"n":"犯罪","v":"犯罪"},{"n":"动画","v":"动画"},{"n":"奇幻","v":"奇幻"},{"n":"武侠","v":"武侠"},{"n":"冒险","v":"冒险"},{"n":"枪战","v":"枪战"},{"n":"恐怖","v":"恐怖"},{"n":"悬疑","v":"悬疑"},{"n":"惊悚","v":"惊悚"},{"n":"经典","v":"经典"},{"n":"青春","v":"青春"},{"n":"文艺","v":"文艺"},{"n":"微电影","v":"微电影"},{"n":"古装","v":"古装"},{"n":"历史","v":"历史"},{"n":"运动","v":"运动"},{"n":"农村","v":"农村"},{"n":"儿童","v":"儿童"},{"n":"网络电影","v":"网络电影"}]},{"key":"area","name":"地区","value":[{"n":"全部","v":""},{"n":"中国","v":"中国"},{"n":"中国香港","v":"中国香港"},{"n":"中国台湾","v":"中国台湾"},{"n":"美国","v":"美国"},{"n":"韩国","v":"韩国"},{"n":"日本","v":"日本"},{"n":"泰国","v":"泰国"},{"n":"印度","v":"印度"},{"n":"英国","v":"英国"},{"n":"法国","v":"法国"},{"n":"加拿大","v":"加拿大"},{"n":"西班牙","v":"西班牙"},{"n":"其它","v":"其它"}]},{"key":"lang","name":"语言","value":[{"n":"全部","v":""},{"n":"国语","v":"国语"},{"n":"英语","v":"英语"},{"n":"粤语","v":"粤语"},{"n":"闽南语","v":"闽南语"},{"n":"韩语","v":"韩语"},{"n":"日语","v":"日语"},{"n":"法语","v":"法语"},{"n":"德语","v":"德语"},{"n":"其它","v":"其它"}]},{"key":"year","name":"年代","value":[{"n":"全部","v":""},{"n":"2025","v":"2025"},{"n":"2024","v":"2024"},{"n":"2023","v":"2023"},{"n":"2022","v":"2022"},{"n":"2021","v":"2021"},{"n":"2020","v":"2020"},{"n":"2019","v":"2019"},{"n":"2018","v":"2018"},{"n":"2017","v":"2017"},{"n":"2016","v":"2016"},{"n":"2015","v":"2015"},{"n":"2014","v":"2014"},{"n":"2013","v":"2013"},{"n":"2012","v":"2012"},{"n":"2011","v":"2011"},{"n":"2010","v":"2010"}]},{"key":"by","name":"排序","value":[{"n":"时间","v":"time"},{"n":"人气","v":"hits"},{"n":"评分","v":"score"}]}],
        "dianshiju":[{"key":"cateId","name":"类型","value":[{"n":"全部","v":"dianshiju"},{"n":"国产剧","v":"guochandianshiju"},{"n":"港剧","v":"gangju"},{"n":"台剧","v":"taiju"},{"n":"韩剧","v":"hanju"},{"n":"日剧","v":"riju"},{"n":"美剧","v":"meiju"},{"n":"泰国剧","v":"taiguoju"},{"n":"海外剧","v":"haiwaiju"}]},{"key":"class","name":"剧情","value":[{"n":"全部","v":""},{"n":"古装","v":"古装"},{"n":"战争","v":"战争"},{"n":"偶像","v":"偶像"},{"n":"喜剧","v":"喜剧"},{"n":"家庭","v":"家庭"},{"n":"犯罪","v":"犯罪"},{"n":"动作","v":"动作"},{"n":"奇幻","v":"奇幻"},{"n":"剧情","v":"剧情"},{"n":"历史","v":"历史"},{"n":"爱情","v":"爱情"},{"n":"悬疑","v":"悬疑"},{"n":"惊悚","v":"惊悚"},{"n":"科幻","v":"科幻"},{"n":"其他","v":"其他"}]},{"key":"area","name":"地区","value":[{"n":"全部","v":""},{"n":"内地","v":"内地"},{"n":"韩国","v":"韩国"},{"n":"香港","v":"香港"},{"n":"台湾","v":"台湾"},{"n":"日本","v":"日本"},{"n":"美国","v":"美国"},{"n":"泰国","v":"泰国"},{"n":"英国","v":"英国"},{"n":"新加坡","v":"新加坡"},{"n":"其他","v":"其他"}]},{"key":"lang","name":"语言","value":[{"n":"全部","v":""},{"n":"国语","v":"国语"},{"n":"英语","v":"英语"},{"n":"粤语","v":"粤语"},{"n":"闽南语","v":"闽南语"},{"n":"韩语","v":"韩语"},{"n":"日语","v":"日语"},{"n":"其它","v":"其它"}]},{"key":"year","name":"年代","value":[{"n":"全部","v":""},{"n":"2025","v":"2025"},{"n":"2024","v":"2024"},{"n":"2023","v":"2023"},{"n":"2022","v":"2022"},{"n":"2021","v":"2021"},{"n":"2020","v":"2020"},{"n":"2019","v":"2019"},{"n":"2018","v":"2018"},{"n":"2017","v":"2017"},{"n":"2016","v":"2016"},{"n":"2015","v":"2015"},{"n":"2014","v":"2014"},{"n":"2013","v":"2013"},{"n":"2012","v":"2012"},{"n":"2011","v":"2011"},{"n":"2010","v":"2010"}]},{"key":"letter","name":"字母","value":[{"n":"全部","v":""},{"n":"A","v":"A"},{"n":"B","v":"B"},{"n":"C","v":"C"},{"n":"D","v":"D"},{"n":"E","v":"E"},{"n":"F","v":"F"},{"n":"G","v":"G"},{"n":"H","v":"H"},{"n":"I","v":"I"},{"n":"J","v":"J"},{"n":"K","v":"K"},{"n":"L","v":"L"},{"n":"M","v":"M"},{"n":"N","v":"N"},{"n":"O","v":"O"},{"n":"P","v":"P"},{"n":"Q","v":"Q"},{"n":"R","v":"R"},{"n":"S","v":"S"},{"n":"T","v":"T"},{"n":"U","v":"U"},{"n":"V","v":"V"},{"n":"W","v":"W"},{"n":"X","v":"X"},{"n":"Y","v":"Y"},{"n":"Z","v":"Z"}]},{"key":"by","name":"排序","value":[{"n":"时间","v":"time"},{"n":"人气","v":"hits"},{"n":"评分","v":"score"}]}],
        "zongyi":[{"key":"cateId","name":"类型","value":[{"n":"全部","v":"zongyi"},{"n":"国产综艺","v":"guochanzongyi"},{"n":"港台综艺","v":"gangtaizongyi"},{"n":"日韩综艺","v":"rihanzongyi"},{"n":"海外综艺","v":"haiwaizongyi"}]},{"key":"class","name":"剧情","value":[{"n":"全部","v":""},{"n":"选秀","v":"选秀"},{"n":"情感","v":"情感"},{"n":"访谈","v":"访谈"},{"n":"播报","v":"播报"},{"n":"旅游","v":"旅游"},{"n":"音乐","v":"音乐"},{"n":"美食","v":"美食"},{"n":"纪实","v":"纪实"},{"n":"曲艺","v":"曲艺"},{"n":"生活","v":"生活"},{"n":"游戏互动","v":"游戏互动"},{"n":"财经","v":"财经"},{"n":"求职","v":"求职"}]},{"key":"area","name":"地区","value":[{"n":"全部","v":""},{"n":"内地","v":"内地"},{"n":"港台","v":"港台"},{"n":"日韩","v":"rihan"},{"n":"欧美","v":"oumei"}]},{"key":"lang","name":"语言","value":[{"n":"全部","v":""},{"n":"国语","v":"国语"},{"n":"英语","v":"英语"},{"n":"粤语","v":"粤语"},{"n":"闽南语","v":"闽南语"},{"n":"韩语","v":"韩语"},{"n":"日语","v":"日语"},{"n":"其它","v":"其它"}]},{"key":"year","name":"年代","value":[{"n":"全部","v":""},{"n":"2025","v":"2025"},{"n":"2024","v":"2024"},{"n":"2023","v":"2023"},{"n":"2022","v":"2022"},{"n":"2021","v":"2021"},{"n":"2020","v":"2020"},{"n":"2019","v":"2019"},{"n":"2018","v":"2018"},{"n":"2017","v":"2017"},{"n":"2016","v":"2016"},{"n":"2015","v":"2015"},{"n":"2014","v":"2014"},{"n":"2013","v":"2013"},{"n":"2012","v":"2012"},{"n":"2011","v":"2011"},{"n":"2010","v":"2010"}]},{"key":"letter","name":"字母","value":[{"n":"全部","v":""},{"n":"A","v":"A"},{"n":"B","v":"B"},{"n":"C","v":"C"},{"n":"D","v":"D"},{"n":"E","v":"E"},{"n":"F","v":"F"},{"n":"G","v":"G"},{"n":"H","v":"H"},{"n":"I","v":"I"},{"n":"J","v":"J"},{"n":"K","v":"K"},{"n":"L","v":"L"},{"n":"M","v":"M"},{"n":"N","v":"N"},{"n":"O","v":"O"},{"n":"P","v":"P"},{"n":"Q","v":"Q"},{"n":"R","v":"R"},{"n":"S","v":"S"},{"n":"T","v":"T"},{"n":"U","v":"U"},{"n":"V","v":"V"},{"n":"W","v":"W"},{"n":"X","v":"X"},{"n":"Y","v":"Y"},{"n":"Z","v":"Z"}]},{"key":"by","name":"排序","value":[{"n":"时间","v":"time"},{"n":"人气","v":"hits"},{"n":"评分","v":"score"}]}],
        "dongman":[{"key":"cateId","name":"类型","value":[{"n":"全部","v":"dongman"},{"n":"国产动漫","v":"guochandongman"},{"n":"日本动漫","v":"ribendongman"},{"n":"美国动漫","v":"meiguodongman"},{"n":"海外动漫","v":"haiwaidongman"}]},{"key":"class","name":"剧情","value":[{"n":"全部","v":""},{"n":"情感","v":"情感"},{"n":"科幻","v":"科幻"},{"n":"热血","v":"热血"},{"n":"推理","v":"推理"},{"n":"搞笑","v":"搞笑"},{"n":"冒险","v":"冒险"},{"n":"萝莉","v":"萝莉"},{"n":"校园","v":"校园"},{"n":"动作","v":"动作"},{"n":"机战","v":"机战"},{"n":"运动","v":"运动"},{"n":"战争","v":"战争"},{"n":"少年","v":"少年"},{"n":"少女","v":"少女"},{"n":"社会","v":"社会"},{"n":"原创","v":"原创"},{"n":"亲子","v":"亲子"},{"n":"益智","v":"益智"},{"n":"励志","v":"励志"},{"n":"其他","v":"其他"}]},{"key":"area","name":"地区","value":[{"n":"全部","v":""},{"n":"国产","v":"国产"},{"n":"日本","v":"日本"},{"n":"欧美","v":"欧美"},{"n":"其他","v":"其他"}]},{"key":"lang","name":"语言","value":[{"n":"全部","v":""},{"n":"国语","v":"国语"},{"n":"英语","v":"英语"},{"n":"粤语","v":"粤语"},{"n":"闽南语","v":"闽南语"},{"n":"韩语","v":"韩语"},{"n":"日语","v":"日语"},{"n":"其它","v":"其它"}]},{"key":"year","name":"年代","value":[{"n":"全部","v":""},{"n":"2025","v":"2025"},{"n":"2024","v":"2024"},{"n":"2023","v":"2023"},{"n":"2022","v":"2022"},{"n":"2021","v":"2021"},{"n":"2020","v":"2020"},{"n":"2019","v":"2019"},{"n":"2018","v":"2018"},{"n":"2017","v":"2017"},{"n":"2016","v":"2016"},{"n":"2015","v":"2015"},{"n":"2014","v":"2014"},{"n":"2013","v":"2013"},{"n":"2012","v":"2012"},{"n":"2011","v":"2011"},{"n":"2010","v":"2010"},{"n":"2009","v":"2009"},{"n":"2008","v":"2008"},{"n":"2007","v":"2007"},{"n":"2006","v":"2006"},{"n":"2005","v":"2005"},{"n":"2004","v":"2004"}]},{"key":"letter","name":"字母","value":[{"n":"全部","v":""},{"n":"A","v":"A"},{"n":"B","v":"B"},{"n":"C","v":"C"},{"n":"D","v":"D"},{"n":"E","v":"E"},{"n":"F","v":"F"},{"n":"G","v":"G"},{"n":"H","v":"H"},{"n":"I","v":"I"},{"n":"J","v":"J"},{"n":"K","v":"K"},{"n":"L","v":"L"},{"n":"M","v":"M"},{"n":"N","v":"N"},{"n":"O","v":"O"},{"n":"P","v":"P"},{"n":"Q","v":"Q"},{"n":"R","v":"R"},{"n":"S","v":"S"},{"n":"T","v":"T"},{"n":"U","v":"U"},{"n":"V","v":"V"},{"n":"W","v":"W"},{"n":"X","v":"X"},{"n":"Y","v":"Y"},{"n":"Z","v":"Z"}]},{"key":"by","name":"排序","value":[{"n":"时间","v":"time"},{"n":"人气","v":"hits"},{"n":"评分","v":"score"}]}],
        "duanju":[{"key":"class","name":"剧情","value":[{"n":"全部","v":""},{"n":"言情","v":"言情"},{"n":"民国","v":"民国"},{"n":"古装","v":"古装"},{"n":"脑洞","v":"脑洞"},{"n":"悬疑","v":"悬疑"},{"n":"重生","v":"重生"},{"n":"年代","v":"年代"},{"n":"穿越","v":"穿越"},{"n":"女频","v":"女频"},{"n":"反转","v":"反转"}]},{"key":"area","name":"地区","value":[{"n":"全部","v":""},{"n":"中国","v":"中国"},{"n":"美国","v":"美国"},{"n":"日本","v":"日本"},{"n":"韩国","v":"韩国"}]},{"key":"lang","name":"语言","value":[{"n":"全部","v":""},{"n":"国语","v":"国语"},{"n":"英语","v":"英语"},{"n":"韩语","v":"韩语"},{"n":"日语","v":"日语"},{"n":"其它","v":"其它"}]},{"key":"year","name":"年代","value":[{"n":"全部","v":""},{"n":"2025","v":"2025"},{"n":"2024","v":"2024"},{"n":"2023","v":"2023"},{"n":"2022","v":"2022"},{"n":"2021","v":"2021"},{"n":"2020","v":"2020"},{"n":"2019","v":"2019"},{"n":"2018","v":"2018"},{"n":"2017","v":"2017"},{"n":"2016","v":"2016"},{"n":"2015","v":"2015"},{"n":"2014","v":"2014"},{"n":"2013","v":"2013"},{"n":"2012","v":"2012"},{"n":"2011","v":"2011"},{"n":"2010","v":"2010"}]},{"key":"letter","name":"字母","value":[{"n":"全部","v":""},{"n":"A","v":"A"},{"n":"B","v":"B"},{"n":"C","v":"C"},{"n":"D","v":"D"},{"n":"E","v":"E"},{"n":"F","v":"F"},{"n":"G","v":"G"},{"n":"H","v":"H"},{"n":"I","v":"I"},{"n":"J","v":"J"},{"n":"K","v":"K"},{"n":"L","v":"L"},{"n":"M","v":"M"},{"n":"N","v":"N"},{"n":"O","v":"O"},{"n":"P","v":"P"},{"n":"Q","v":"Q"},{"n":"R","v":"R"},{"n":"S","v":"S"},{"n":"T","v":"T"},{"n":"U","v":"U"},{"n":"V","v":"V"},{"n":"W","v":"W"},{"n":"X","v":"X"},{"n":"Y","v":"Y"},{"n":"Z","v":"Z"}]},{"key":"by","name":"排序","value":[{"n":"时间","v":"time"},{"n":"人气","v":"hits"},{"n":"评分","v":"score"}]}]
    },
    filter_def:{
        dianying:{cateId:'dianying',by:'time'},
        dianshiju:{cateId:'dianshiju',by:'time'},
        zongyi:{cateId:'zongyi',by:'time'},
        dongman:{cateId:'dongman',by:'time'},
        duanju:{cateId:'duanju',by:'time'}
    },
    headers: {'User-Agent': MOBILE_UA},
    class_name:'电影&电视剧&综艺&动漫&短剧',
    class_url:'dianying&dianshiju&zongyi&dongman&duanju',
    
    预处理: async () => {
        return [];
    },
    
    推荐: async function (tid, pg, filter, extend) {
        let {input, pdfa, pdfh, pd} = this;
        let html = await request(input);
        let d = [];
        let data = pdfa(html, '.module-item');
        data.forEach((it) => {
            let title = pdfh(it, '.module-item-title&&title');
            let url = pd(it, '.module-item-title&&href');
            let id = url.match(/\/(\d+)/)?.[1] || '';
            let pic_url = pd(it, 'img&&data-src');
            if (pic_url && !pic_url.startsWith('http')) {
                pic_url = this.host + pic_url;
            }
            let desc = pdfh(it, '.module-item-style.video-class&&Text') || pdfh(it, '.video-class&&Text') || '';
            d.push({
                title: title,
                pic_url: pic_url,
                desc: desc,
                url: url,
                id: id
            });
        });
        return setResult(d);
    },
    
    一级: async function (tid, pg, filter, extend) {
        let {input, pdfa, pdfh, pd} = this;
        let html = await request(input);
        let d = [];
        let data = pdfa(html, '.module-item');
        data.forEach((it) => {
            let title = pdfh(it, '.module-item-title&&title');
            let url = pd(it, '.module-item-title&&href');
            let id = url.match(/\/(\d+)/)?.[1] || '';
            let pic_url = pd(it, 'img&&data-src');
            if (pic_url && !pic_url.startsWith('http')) {
                pic_url = this.host + pic_url;
            }
            let desc = pdfh(it, '.module-item-style.video-class&&Text') || pdfh(it, '.video-class&&Text') || '';
            d.push({
                title: title,
                pic_url: pic_url,
                desc: desc,
                url: url,
                id: id
            });
        });
        return setResult(d);
    },
    
    二级: async function (ids) {
        let {input, pdfa, pdfh, pd} = this;
        let html = await request(input);
        let VOD = {};
        
        // 提取标题
        let vod_name = pdfh(html, 'h1&&Text');
        vod_name = vod_name.split('/')[0].trim().replace(/.*《([^》]+)》.*/, "$1");
        VOD.vod_name = vod_name;
        
        // 提取图片
        VOD.vod_pic = pd(html, '.bgi.lazyload&&data-background-image') || '';
        if (VOD.vod_pic && !VOD.vod_pic.startsWith('http')) {
            VOD.vod_pic = this.host + VOD.vod_pic;
        }
        
        // 提取简介
        VOD.vod_content = pdfh(html, '.full_text&&span&&Text') || '暂无简介';
        
        // 提取导演、主演、年份、地区等信息
        VOD.vod_director = pdfh(html, 'li.data:contains(导演：)&&Text') || '';
        if (VOD.vod_director) {
            VOD.vod_director = VOD.vod_director.replace('导演：', '').trim();
        }
        
        VOD.vod_actor = pdfh(html, 'li.data:contains(主演：)&&Text') || '';
        if (VOD.vod_actor) {
            VOD.vod_actor = VOD.vod_actor.replace('主演：', '').trim();
        }
        
        VOD.vod_year = pdfh(html, 'li.data--span:contains(年)&&Text') || '';
        if (VOD.vod_year) {
            VOD.vod_year = VOD.vod_year.replace('年', '').trim();
        }
        
        VOD.vod_area = pdfh(html, 'li.data--span:contains(地区)&&Text') || '';
        if (VOD.vod_area) {
            VOD.vod_area = VOD.vod_area.replace('地区：', '').trim();
        }
        
        VOD.vod_lang = pdfh(html, 'li.data--span:contains(语言)&&Text') || '';
        if (VOD.vod_lang) {
            VOD.vod_lang = VOD.vod_lang.replace('语言：', '').trim();
        }
        
        // 提取播放列表
        let tabs = pdfa(html, '.play_source_tab a');
        let lists = pdfa(html, '.play_list_box');
        let playmap = {};
        
        tabs.map((item, i) => {
            let form = '';
            // 优先使用alt属性获取线路名称，这是最可靠的方式
            const altText = pd(item, 'alt');
            if (altText) {
                form = altText;
            } else {
                // 如果alt属性不存在，从文本中提取纯净的线路名称
                let fullText = pdfh(item, 'Text');
                // 尝试匹配中文线路名称，排除数字和图标
                let match = fullText.match(/[\u4e00-\u9fa5]+[\u4e00-\u9fa5\s]*[A-Za-z]*/);
                if (match) {
                    form = match[0].trim();
                } else {
                    // 如果没有中文，尝试提取英文部分
                    match = fullText.match(/[A-Za-z]+/);
                    form = match ? match[0] : `线路${i}`;
                }
            }
            
            // 确保线路名称不为空
            if (!form) {
                form = `线路${i}`;
            }
            
            const list = lists[i];
            if (list) {
                const items = pdfa(list, '.content_playlist li');
                playmap[form] = [];
                items.map((it) => {
                    let title = pdfh(it, 'a&&Text');
                    let urls = pd(it, 'a&&href', input);
                    playmap[form].push(title + "$" + urls);
                });
            }
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
        let html = await request(input);
        let d = [];
        let data = pdfa(html, '.vodlist.clearfix li.vodlist_item');
        data.forEach((it) => {
            let title = pdfh(it, 'a&&title');
            title = title.split('/')[0].trim().replace(/.*《([^》]+)》.*/, "$1");
            let url = pd(it, 'a&&href');
            let id = url.match(/\/(\d+)\.html/)?.[1] || '';
            let pic_url = pd(it, '.lazyload&&data-original');
            if (pic_url && !pic_url.startsWith('http')) {
                pic_url = this.host + pic_url;
            }
            let desc = pdfh(it, '.pic_text&&Text');
            let content = pdfh(it, '.vodlist_item_info&&Text');
            d.push({
                title: title,
                pic_url: pic_url,
                desc: desc,
                content: content,
                url: url,
                id: id
            });
        });
        return setResult(d);
    },
    
    lazy: async function (flag, id, flags) {
        let {input} = this;
        let html = await request(input);
        let match = html.match(/r player_.*?=(.*?)<\/script>/);
        if (match?.[1]) {
            let playerData = JSON.parse(match[1]);
            let url = playerData.url;
            if (url.indexOf('http') == -1) {
                let adysResponse = await request('https://adys.tv/player/?url=' + url, {});
                let adysMatch = adysResponse.match(/url":.*?['"](.*?)['"]/);
                if (adysMatch?.[1]) {
                    return {parse: 0, url: adysMatch[1]};
                }
            } else {
                return {parse: 0, url: url};
            }
        }
        return {parse: 0, url: input};
    }
};