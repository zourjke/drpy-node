/*
@header({
  searchable: 1,
  filterable: 0,
  quickSearch: 1,
  title: '雷鲸小站[盘]',
  '类型': '影视',
  logo: 'https://www.leijing1.com/favicon.ico',
  lang: 'ds'
})
*/

const { req_proxy } = $.require('./_lib.request.js');
const { formatPlayUrl } = misc;

const rule = {
  title: '雷鲸小站[盘]',
  author: 'EylinSir',
  logo: 'https://www.leijing1.com/favicon.ico',
  host: 'https://www.leijing1.com',
  url: '/?tagId=fyclass&page=fypage',
  detailUrl: '/fyid',
  searchUrl: '/search?keyword=**&page=fypage',
  img: './images/icon_cookie/天翼.png',
  play_parse: true,
  searchable: 1,
  quickSearch: 1,
  class_name: '电影&剧集&动漫&影视原盘&纪录&综艺&演唱会&其他',
  class_url: '42204681950354&42204684250355&42204792950357&42212287587456&42204697150356&42210356650363&42317879720298&42238531387459',
  headers: {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Encoding': 'gzip, deflate',
    'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7',
    'Cache-Control': 'max-age=0',
    'Connection': 'keep-alive',
    'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  },

  预处理: async () => [],
  推荐: async function () {
    return await this.一级(0, 1);
  },

  一级: async function (tid, pg) {
    const { input, publicUrl } = this;
    const pic = urljoin(publicUrl, this.img);
    const html = await req_proxy(input, 'get', this.headers);
    const $ = pq(html);
    let videos = [];

    $('.topicList .topicItem').each((_, item) => {
      const a = $(item).find('h2 a:first');
      const title = a.text().trim();
      if (title && !/防失联|微信群|QQ群/.test(title)) {
        videos.push({
          vod_name: title,
          vod_id: a.attr('href'),
          vod_pic: pic
        });
      }
    });
    return videos;
  },

  二级: async function (ids) {
    const { publicUrl, input } = this;
    const pic = urljoin(publicUrl, this.img);

    if (ids === "no_data") {
      return { vod_name: "暂无数据", vod_id: ids, vod_pic: pic, vod_content: "当前分类暂无内容" };
    }

    const headers = { ...this.headers, 'Sec-Fetch-Site': 'same-origin', 'Referer': this.host + '/' };
    const html = await req_proxy(input, 'get', headers);
    const $ = pq(html);
    const contentHtml = $('.topicContent').html() || '';

    const vod = {
      vod_name: $('.title').text().trim(),
      vod_id: input,
      vod_pic: pic,
      vod_content: $('div.topicContent p:nth-child(1)').text(),
      vod_play_from: '',
      vod_play_url: '',
      vod_play_pan: ''
    };

    const yunLinkMatch = contentHtml.match(/(?:<a[^>]*href=["']|<span style="color:\s*#0070C0;\s*">)?(https:\/\/cloud\.189\.cn\/[^"'<]*)/i);
    const xunleiLinkMatch = contentHtml.match(/https:\/\/pan\.xunlei\.com\/[^"'<\s]*/i) || html.match(/https:\/\/pan\.xunlei\.com\/[^"'<\s]*/i);
    const extractCodeMatch = contentHtml.match(/提取码[：:]?\s*(\w{4})/i) || html.match(/提取码[：:]?\s*(\w{4})/i);

    if (xunleiLinkMatch) {
      let xunleiLink = xunleiLinkMatch[1] || xunleiLinkMatch[0];
      xunleiLink = xunleiLink.replace(/#+$/, '');
      let xunleiUrl = xunleiLink;
      if (extractCodeMatch && !xunleiLink.includes('pwd=')) {
        xunleiUrl = xunleiLink + (xunleiLink.includes('?') ? '&' : '?') + 'pwd=' + extractCodeMatch[1];
      }
      const data = await Xun.getShareData(xunleiUrl);
      if (data) {
        const [playform, playurls] = Object.entries(data).reduce(([f, u], [k, l]) => {
          f.push(`Xun-${k}`);
          u.push(l.map(i => `${i.name}$${i.fileId}*${i.share_id}*${i.parent_id}*${encodeURIComponent(i.pass_code_token || '')}`).join('#'));
          return [f, u];
        }, [[], []]);
        vod.vod_play_from = playform.join("$$$");
        vod.vod_play_url = playurls.join("$$$");
        vod.vod_play_pan = xunleiLink;
      }
    } else if (yunLinkMatch) {
      const link = yunLinkMatch[1];
      const data = await Cloud.getShareData(link);
      const [playform, playurls] = Object.entries(data).reduce(([f, u], [k, l]) => {
        f.push(`Cloud-${k}`);
        u.push(l.map(i => `${i.name}$${i.fileId}*${i.shareId}`).join('#'));
        return [f, u];
      }, [[], []]);
      vod.vod_play_from = playform.join("$$$");
      vod.vod_play_url = playurls.join("$$$");
      vod.vod_play_pan = link;
    }
    return vod;
  },

  搜索: async function (wd, quick, pg) {
    const { publicUrl } = this;
    const pic = urljoin(publicUrl, this.img);
    const searchUrl = `${this.host}/search?keyword=${encodeURIComponent(wd)}&page=${pg || 1}`;
    const headers = { ...this.headers, 'Sec-Fetch-Site': 'same-origin', 'Referer': this.host + '/' };
    const html = await req_proxy(searchUrl, 'get', headers);
    const $ = pq(html);
    const videos = [];

    $('.topicList .topicItem').each((_, item) => {
      const a = $(item).find('h2 a:first');
      const href = a.attr('href');
      if (href) {
        videos.push({
          vod_name: a.text().trim(),
          vod_id: href,
          vod_remarks: $(item).find('.summary').text().trim().substring(0, 100),
          vod_pic: pic
        });
      }
    });
    return videos;
  },

  lazy: async function (flag, id) {
    if (flag.startsWith('Xun-')) {
      log('迅雷云盘开始解析');
      let ids = id.split('*');
      let fileId = ids[0];
      let shareId = ids[1];
      let passCodeToken = ids[3] ? decodeURIComponent(ids[3]) : '';
      let urls = await Xun.getShareUrl(fileId, shareId, passCodeToken);
      const header = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/67.0.3396.99 Safari/537.36"
      };
      if (ENV.get('xun_auth') !== '') {
        try {
          let url = await Xun.getDownloadUrl(fileId, shareId, passCodeToken);
          if (url !== '') {
            const proxyHeader = `&header=${encodeURIComponent(JSON.stringify(header))}`;
            urls.push('原画', url + "#isVideo=true##fastPlayMode##threads=20#");
            urls.push("猫画", `http://127.0.0.1:5575/proxy?thread=${ENV.get('thread') || 6}&chunkSize=256&url=` + encodeURIComponent(url) + proxyHeader);
          }
        } catch (err) {
          log(`迅雷本地凭证可能已过期，请重新登录: ${err.message}`);
        }
      }
      return {
        parse: 0,
        url: urls,
        header: header
      };
    }
    if (flag.startsWith('Cloud-')) {
      const [fileId, shareId] = id.split('*');
      log("天翼云盘解析开始");
      return { url: `${await Cloud.getShareUrl(fileId, shareId)}#isVideo=true#` };
    }
    return;
  }
};
