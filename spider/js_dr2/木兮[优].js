/*
@header({
  searchable: 2,
  filterable: 0,
  quickSearch: 1,
  title: '木兮',
  类型: '影视',
  lang: 'dr2',
})
*/

function i4e(url, timestamp, session, traceId) {
    // 1. 获取 URL 的路径部分（去除查询参数）
    let hh = `${rule.host}/api`;
    let path = url.split("?")[0].replace(hh, '');

    // 2. 构造盐值 (Salt)
    let salt = "symx_" + session;

    // 3. 构造映射对象
    let mapObj = {
        p: path,
        t: timestamp,
        s: salt
    };

    // 4. 根据 traceId 构造原始 Payload 字符串
    let payload = traceId.split("").map(char => mapObj[char]).join("");

    // 5. 对 Payload 进行字符替换混淆
    payload = payload
        .replaceAll("1", "i")
        .replaceAll("0", "o")
        .replaceAll("5", "s");

    // 6. 使用 session 作为密钥，对 payload 进行 HmacSHA256 加密并转为字符串
    return CryptoJS.HmacSHA256(payload, session).toString();
}

function decrypt(data) {
    let key = "0x1A2B3C4D5E6F7A8B9C";
    let output = "";

    for (let i = 0; i < data.length; i += 2) {
        let hexChar = data.substr(i, 2);
        let intVal = parseInt(hexChar, 16);
        let charCode = intVal ^ key.charCodeAt((i / 2) % key.length);
        output += String.fromCharCode(charCode);
    }

    return output;
}

function gettime(params) {
    var prefix = params.substring(0, 12);
    var sum = 0;
    for (var i = 0; i < prefix.length; i++) {
        sum += parseInt(prefix.charAt(i), 10);
    }
    var checkDigit = sum % 10;
    var result = prefix + checkDigit.toString();
    return result;
}

globalThis.i4e = i4e;
globalThis.decrypt = decrypt;
globalThis.gettime = gettime;

var rule = {
    title: '木兮',
    host: 'https://film.symx.club',
    url: '/api/film/category/list?fyfilter',
    detailUrl: '/api/film/detail/play?filmId=fyid',
    searchUrl: '/api/film/search?keyword=**&pageNum=fypage&pageSize=10',
    filter_url: 'categoryId=fyclass&language={{fl.lang}}&pageNum=fypage&pageSize=15&sort={{fl.by or "updateTime"}}&year={{fl.year}}',
    searchable: 2,
    quickSearch: 1,
    filterable: 0,
    headers: {
        'User-Agent': 'SYMX_ANDROID',
        'x-platform': 'android'
    },
    play_parse: true,
    search_match: true,
    class_name: '电视剧&电影&综艺&动漫&短剧',
    class_url: '1&2&3&4&5',
    预处理: $js.toString(() => {
        let result = reqCookie(`${rule.host}/api/stats/track`, {
            method: 'GET',
            headers: {
                'User-Agent': 'SYMX_ANDROID',
                'x-platform': 'android',
                'referer': `${rule.host}/m/index`
            }
        }, false);
        console.log(result.cookie);
        rule.cookies = result.cookie;
        rule.headers["cookie"] = result.cookie;

        let result2 = request(`${rule.host}/api/system/config`, {
            method: 'GET',
            headers: {
                'User-Agent': 'SYMX_ANDROID',
                'x-platform': 'android',
                'cookie': rule.cookies,
                'referer': `${rule.host}/`
            }
        });
        let securityConfig = JSON.parse(result2).data;
        rule.reportId = decrypt(securityConfig.reportId);
        log("rule.reportId>>>>>" + rule.reportId);
        rule.session = decrypt(securityConfig.session);
        log("rule.session>>>>>" + rule.session);
        rule.traceId = decrypt(securityConfig.traceId);
        log("rule.traceId>>>>>" + rule.traceId);
    }),
    推荐: $js.toString(() => {
        let d = [];
        let html = request(input + '/api/film/category');
        let categories = JSON.parse(html).data;
        categories.forEach(category => {
            category.filmList.forEach(item => {
                let title = item.name;
                if (!/名称|排除/.test(title)) {
                    d.push({
                        title: title,
                        desc: item.updateStatus,
                        img: item.cover,
                        url: item.id,
                        content: item.blurb,
                    });
                }
            });
        });
        setResult(d);
    }),
    一级: $js.toString(() => {
        let d = [];
        let html = request(input);
        let data = JSON.parse(html).data.list;
        data.forEach(item => {
            let title = item.name;
            if (!/名称|排除/.test(title)) {
                d.push({
                    title: title,
                    desc: item.updateStatus,
                    img: item.cover,
                    url: item.id,
                    content: item.blurb,
                });
            }
        });
        setResult(d);
    }),

    二级: $js.toString(() => {
        let timestamp = Date.now();
        log("timestamp>>>>>" + timestamp);
        log("input>>>>>" + input);
        let sign = i4e(input, timestamp, rule.session, rule.traceId);
        let html = request(input, {
            headers: {
                'User-Agent': 'SYMX_ANDROID',
                'x-platform': 'android',
                'cookie': rule.cookies,
                [rule.reportId]: sign,
                'x-timestamp': timestamp,
                'referer': `${rule.host}`
            },
            method: 'GET'
        });
        log("html>>>>>" + html)

        let data = JSON.parse(html).data;

        rule.cid = data.categoryId;
        rule.filmid = data.id;

        // 定义类型映射
        let categoryMap = {
            1: "电视剧",
            2: "电影",
            3: "综艺",
            4: "动漫",
            5: "短剧"
        };

        let categoryName = categoryMap[data.categoryId];
        VOD = {
            vod_id: data.id,
            vod_name: data.name,
            type_name: categoryName,
            vod_pic: data.cover,
            vod_remarks: data.updateStatus,
            vod_content: data.blurb
        };

        let playlist = data.playLineList || [];
        let playFrom = [];
        let playUrl = [];

        playlist.forEach(line => {
            playFrom.push(line.playerName);
            let lines = line.lines || [];
            let lineUrls = lines.map(tag => {
                let title = tag.name;
                let url = tag.id;
                return `${title}$${url}@${url}`;
            });
            playUrl.push(lineUrls.join("#"));
        });

        VOD.vod_play_from = playFrom.join("$$$");
        VOD.vod_play_url = playUrl.join("$$$");
    }),

    搜索: $js.toString(() => {
        let d = [];

        let timestamp = new Date().getTime().toString();
        timestamp = gettime(timestamp);
        log("timestamp>>>>>" + timestamp);
        let sign = i4e(input, timestamp, rule.session, rule.traceId);
        let html = request(input, {
            headers: {
                'User-Agent': 'SYMX_ANDROID',
                'Accept': 'application/json, text/plain, */*',
                'x-platform': 'android',
                'x-timestamp': timestamp,
                [rule.reportId]: sign,
                'referer': `${rule.host}/m/search?keyword=${encodeURIComponent(KEY)}`,
                'cookie': rule.cookies
            },
            method: 'GET'
        });

        let data = JSON.parse(html).data.list;
        data.forEach(item => {
            let title = item.name;
            d.push({
                title: title,
                desc: item.updateStatus,
                img: item.cover,
                url: item.id,
                content: item.blurb,
            });
        });
        setResult(d);
    }),
    lazy: $js.toString(() => {
        let linesid = input.split('@')[1];
        let purl1 = `${rule.host}/api/danmaku?filmId=${rule.filmid}&index=${rule.cid}&lineId=${linesid}`;
        let timestamp1 = new Date().getTime().toString();
        timestamp1 = gettime(timestamp1);
        let sign1 = i4e(purl1, timestamp1, rule.session, rule.traceId);
        let html1 = request(purl1, {
            headers: {
                'User-Agent': 'SYMX_ANDROID',
                'Accept': 'application/json, text/plain, */*',
                'x-platform': 'android',
                'x-timestamp': timestamp1,
                [rule.reportId]: sign1,
                'referer': `${rule.host}/m/player?cid=${rule.cid}&film_id=${rule.filmid}&line_id=${linesid}`,
                'cookie': rule.cookies
            },
            method: 'GET'
        });

        let purl = `${rule.host}/api/line/play/parse?lineId=${linesid}`;

        let timestamp = new Date().getTime().toString();
        timestamp = gettime(timestamp);
        log("timestamp>>>>>" + timestamp);
        let sign = i4e(purl, timestamp, rule.session, rule.traceId);
        let html = request(purl, {
            headers: {
                'User-Agent': 'SYMX_ANDROID',
                'Accept': 'application/json, text/plain, */*',
                'x-platform': 'android',
                'x-timestamp': timestamp,
                [rule.reportId]: sign,
                'referer': `${rule.host}/m/player?cid=${rule.cid}&film_id=${rule.filmid}&line_id=${linesid}`,
                'cookie': rule.cookies
            },
            method: 'GET'
        });

        let url = JSON.parse(html).data;
        input = {
            parse: 0,
            url: url
        };
    }),

}