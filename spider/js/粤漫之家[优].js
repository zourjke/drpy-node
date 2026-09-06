/*
@header({
  searchable: 0,
  filterable: 1,
  quickSearch: 0,
  title: '粤漫之家',
  author: '不告诉你',
  '类型': '影视',
  logo:'https://www.ymvid.com/favicon/favicon.ico',
  lang: 'ds'
})
*/

var rule = {
    title: '粤漫之家',
    author: '不告诉你',
    host: 'https://www.ymvid.com',
    url: '/list/fypage/fyfilter',
    logo:'https://www.ymvid.com/favicon/favicon.ico',
    searchUrl: '/search?p=fypage&keyword=**',//需要登陆
    searchable: 0,
    quickSearch: 0,
    filterable: 1,
    play_parse: true,
    double: true,
    timeout: 10000,
    headers: {
        "User-Agent": "MOBILE_UA"
    },
    class_name: '全部漫&粤语漫&国语漫',
    class_url: 'c0&c1&c2',
    filter_url: '{{fl.类型}}-{{fl.S or "s0"}}-{{fl.V or "v0"}}-l0-{{fl.T or "t0"}}-{{fl.Y or "y0"}}/{{fl.by or "time_desc"}}',
    filter_def: {'c0': {类型: 'c0'}, 'c2': {类型: 'c2'}, 'c1': {类型: 'c1'}},
    推荐: '*',
    一级: '.el-row .el-col;img&&alt;img&&src;.tips&&Text;a&&href',
    搜索: '.item-row;.item-title&&Text;.item-pic img&&src;.pic-tag&&Text;a&&href',
    二级: {
        "title": ".media-info&&h1&&Text",
        "img": ".lazyload&&data-original",
        //desc: '主要信息;年代;地区;演员;导演',
        "desc": ".media-info&&.type-row:eq(1)&&Text;.media-info&&.type-row:eq(0)&&Text;;;;",
        "content": ".intro-row&&p&&Text",
        "tabs": ".header-box",
        "lists": ".play-list:eq(#id)&&li a"
    },
    lazy: async function () {
        let {input, pdfh} = this;
        let url = input;
        try {
            // 获取页面HTML内容
            let html = await request(input, {
                headers: rule.headers,
            })

            // 提取关键元素属性
            let playlistData = pdfh(html, '.play-list&&data-id');
            let encryptedValue = pdfh(html, '.section-content input&&value');
            // 日期相关的浏览器编码
            const dateString = new Date().toISOString().split("T")[0];
            const browserCode = handleAES("403770cbda9dde06a2dda2af67b2b68c_" + dateString, true);
            rule.headers['cookie'] = 'browser-code=' + browserCode;

            // 解密主内容并拆分
            let mainDataId = pdfh(html, '#main&&data-id');
            let decryptedParts = handleAES(encryptedValue, false).split("?t=");

            // 判断视频类型并构建URL
            const isMainVideo = Number(playlistData.split("-")[1]) === 0;

            if (isMainVideo) {
                url = `${decryptedParts[0]}?t=${decryptedParts[1]}&vId=${mainDataId}`;
            } else {
                const pathPart = playlistData.split("-")[0];
                url = `${decryptedParts[0]}/${pathPart}?t=${decryptedParts[1]}&vId=${mainDataId}`;
            }

            url = `https://www.ymvid.com${url}`;

        } catch (error) {
            console.log(error);
        }

        // 确保URL包含视频格式参数
        if (!/m3u8|mp4|mkv/.test(url)) {
            url = url + '&type=m3u8';
        }

        // 返回最终结果
        return {
            parse: 0,
            url: url,
            header: rule.headers
        }

    },
    filter: 'H4sIAAAAAAAAA+2W204aURSG32WuvZjN4PGuT9CLGpOmMY1S0phW08TWhBgTlIJAKYxUQCrSYiSiggewRjn5MrP3zLxFh8pea5EmXLV3+07+f8Osb681y39TC+ja3KtN7V0wpM1p89qEtra0GvT+tG86vPzF+7yx9P5T8M+ZNU/m0ZobqQ1k78NHXduaeNKFWbbre1JnoDuPJk/CeR/oPHnDHwtSN0C3Iw2nEpa6H38/fiDycH4Sz3cy4lda6lN4/meFHzakPg26e5QVB1Wpz+DvxG9EJCr1WawzlnWLZ8CFwNxM88sLMJDYLva5GQcDkUWzIz6jgcyOeeSkE2AgtNvYF60cGEgtdup2Hm+bYKdrthkDA7l5dZc/dMAg4Kd71EBycX8v4hnoHJLb1bJXGBhILrZNEc6DgeReR50oXLoPyUWpzYs1q90Gb6TjVhtuxUdanryye+dgIDxPx3imCQbC2yd9q/sdDIR3tlO8hA8nbU+cknEwEN7qnvPaARhk0MM9uw+DaCC8fVHlD7dgEPhc0dmBcg0kt9pN3jDBIOSlH+SuDNL2RsqJl8Egbf9asRMpMEjb+2l+vcerLfBmScVlkcR3kM78vddKt94Fj5EBa4nwKTdhKv1k8lsV9+jYzkHT/OQW6sfWg0m/hxfBo3dWBwbK713E4sB62lWwoIYLi8djnjR+YQUIy2HPuZILIkDa1TwhOht55AJZj4m4KNXHP20Dnza/IDVGZwyHbwMreL7wTIoGvQp+GZH66E28IGUl70R4e3xZ61iW81h2ej2pk9IuU3bnm9RJI0vnItsQ+31pGSOFvCTdeLi1Or3xhYSwEJ/uveBDlbzRnuwHeZLKBsh+KvtANqjMQPZRWQeZEdnbgVKmBXo7cyiTJenJ0yDPUHkK5GkqAyWjlAwoGaVkQMkoJQNKRikZUDJKyYCSUUodKBml1IGSQuoASRl1YKSIOiBSQh0IKaAOgJRPBz6Kp2MTcR4Pb0XhDEBGhnE5hNMo0lnezvw1jYOv569F4c4twIJeWQ2+fhNcD+C70A0PZp4eWg6+XVkbPfX0Wojctbsr/2d+eL8UGh5a3FqcGCwTlbRU0lJJSyUtlbQ0lbRU0lJJSyWt/5K0fCppaSppqaSlkpZKWppKWippqaSlkta/T1pbvwEO4BScPxwAAA==',
}

// AES加密/解密函数
const handleAES = (inputText, isEncrypt) => {
    try {
        const AES_KEY = "AVSI6788^765idue";
        const cryptoKey = CryptoJS.enc.Utf8.parse(AES_KEY);

        return isEncrypt ?
            CryptoJS.enc.Base64.parse(
                CryptoJS.AES.encrypt(inputText, cryptoKey, {
                    mode: CryptoJS.mode.ECB,
                    padding: CryptoJS.pad.Pkcs7
                }).toString()
            ).toString(CryptoJS.enc.Hex) :
            CryptoJS.AES.decrypt(
                CryptoJS.enc.Base64.stringify(
                    CryptoJS.enc.Hex.parse(inputText)
                ),
                cryptoKey, {
                    mode: CryptoJS.mode.ECB,
                    padding: CryptoJS.pad.Pkcs7
                }
            ).toString(CryptoJS.enc.Utf8);
    } catch (error) {
    }
};
