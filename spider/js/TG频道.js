/*
@header({
  searchable: 1,
  filterable: 0,
  quickSearch: 1,
  title: 'TG频道',
  author: 'EylinSir',
  '类型': '影视',
  logo: 'https://api.xinac.net/icon/?url=https://t.me',
  lang: 'ds'
})
*/

const { req_proxy } = $.require('./_lib.request.js');
const MAX = 5;
let pc = { v: {}, s: {} };
let st = { k: '', i: 0 };

const R_DISK = {
  '百度': { r: /pan\.baidu\.com/, i: '百度.png' },
  '夸克': { r: /pan\.quark\.cn/, i: '夸克.png' },
  '阿里': { r: /www\.(aliyundrive|alipan)\.com/, i: '阿里.png' },
  '移动': { r: /(yun|caiyun)\.139\.com/, i: '移动.png' },
  '天翼': { r: /cloud\.189\.cn/, i: '天翼.png' },
  '115': { r: /(www\.115|115cdn)\.com/, i: '115.png' },
  'UC': { r: /(pan|drive)\.uc\.cn/, i: 'UC.png' },
  '123': { r: /123pan\.(com|cn)|123(684|865|912|592)\.com/i, i: '123.png' },
  '迅雷': { r: /pan\.xunlei\.com/, i: '迅雷.jpg' },
  '磁力': { r: /magnet:\?xt=urn:btih:[0-9a-f]{32,40}/i, i: '磁力.png' }
};

const R_BRACKET_ALL = /[\(\（\[【\{<].*?[\)\）\]】\}>]/g;
const R_CUT_OFF = /(?:\s+|(?=[第全共更完S\d]))(?:第|全|共|更|至|完结|S\d|EP?\d|20\d{2}|4K|1080|臻彩|高码|SDR|HDR|60帧|剧情|国漫|年番|喜剧|\d+B|\[|\d+\s*集).*/i;
const R_TAIL_FIX = /(?:[^\u4e00-\u9fa5A-Za-z0-9]+|\s+[第全共更至集])\s*$/;
const R_EP_STRICT = /\bS\d+E\d+\b|\bEP\d{1,4}\b|(?:\d{1,4}|[一二三四五六七八九十]+)\s*(?:集|话|期)|(?:第|更新?至?|全|共|至)\s*(?:\d{1,4}|[一二三四五六七八九十]+)(?:[-~]\d+)?\s*(?:集|话|期)?|完结/gi;
const R_QL_STRICT = /(?:4|8)K|1080[Pp]|HDR|Dolby|Atmos/g;
const getDisk = (u) => {
  if (u.startsWith('magnet')) return { n: '磁力', i: R_DISK['磁力'].i };
  const h = (u.match(/:\/\/(.*?)(?:\/|$)/) || [])[1];
  if (!h) return null;
  for (let k in R_DISK) {
    if (k !== '磁力' && R_DISK[k].r.test(h)) return { n: k, i: R_DISK[k].i };
  }
  return null;
};

const cTitle = (txt) => {
  let line = txt.split('\n').find(x => !/^[a-z]+\s+\d+$|^http/i.test(x.trim())) || txt.split('\n')[0];
  line = (line || '未知资源')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/^(名称|资源标题|中文名|片名)[：:\s]*/i, '')
    .trim();
  line = line.replace(R_BRACKET_ALL, ' ');
  line = line.replace(R_CUT_OFF, '');
  let prev;
  do {
    prev = line;
    line = line.replace(R_TAIL_FIX, '').trim();
  } while (line !== prev);
  return line;
};

const getTags = (txt) => {
  const epMatch = txt.match(R_EP_STRICT);
  let ep = '';
  if (epMatch) {
    ep = epMatch.reduce((a, b) => a.length > b.length ? a : b);
    if (/^至\s*\d/.test(ep)) {
      ep = '更' + ep;
    }
    else if (/^\d+\s*集$/.test(ep)) {
      ep = '第' + ep;
    }
  }
  const ql = (txt.match(R_QL_STRICT) || []).filter((v, i, a) => a.indexOf(v) === i);
  return [ep, ...ql].filter(Boolean).join(' ');
};

const addLink = (u, ctx) => {
  const d = getDisk(u);
  if (!d) return;
  ctx.s.add(u);
  ctx.c[d.n] = (ctx.c[d.n] || 0) + 1;
  const tag = ctx.c[d.n] > 1 ? `${d.n}${ctx.c[d.n]}` : d.n;
  const purl = d.n === '磁力' ? u : `点击播放$push://${u.replace(/#/g, '%23')}`;
  ctx.u.push(purl);
  ctx.f.push(tag);
  ctx.t.add(d.n);
};

const getUrl = (base, k, cache) => k ? `${base}${cache[k] || ''}` : base;

var rule = {
  类型: '影视',
  title: 'TG频道',
  author: 'EylinSir',
  host: 'https://t.me',
  url: '/s/fyclass',
  searchUrl: '?q=**',
  Pan_API: 'http://127.0.0.1:6080', // 网盘链接有效性检测过滤api，需自行替换
  logo: 'https://api.xinac.net/icon/?url=https://t.me',
  searchable: 1,
  quickSearch: 1,
  filterable: 0,
  play_parse: true,
  timeout: 18000,
  hikerListCol: 'icon_4',
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },

  class_parse: async function() {
    return { class: JSON.parse(await request(this.params)) };
  },

  lazy: async function(flag, id) {
    return { url: id.includes('$') ? id.split('$').slice(1).join('$').replace(/%23/g, '#') : id };
  },

  parseMessages: async function(html) {
    const { pdfa, pdfh } = this;
    const $ = require('cheerio').load(html);
    const msgs = pdfa(html, '.tgme_widget_message') || [];
    let res = [], allLinks = [];
    for (const m of msgs) {
      const htm = pdfh(m, '.tgme_widget_message_text&&Html') || '';
      const txt = htm.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
      if (!txt) continue;
      const title = cTitle(txt);
      const finalTitle = title || txt.split('\n')[0].replace(/https?:\/\/\S+/g, '').trim();
      const ctx = { c: {}, u: [], f: [], t: new Set(), s: new Set() };
      const nodes = [
        ...pdfa(m, '.tgme_widget_message_text a'), 
        ...pdfa(m, '.tgme_widget_message_inline_keyboard a')
      ];
      nodes.forEach(a => {
        const u = (pdfh(a, 'a&&href') || '').replace(/&#$/, '').trim();
        if (/^https?:\/\//.test(u)) addLink(u, ctx);
      });
      (txt.match(new RegExp(R_DISK['磁力'].r.source, 'gi')) || []).forEach(mg => addLink(mg.trim(), ctx));
      if (!ctx.u.length) continue;
      let pic = '';
      const sty = $(m).find('.tgme_widget_message_photo_wrap').attr('style') || '';
      const pm = sty.match(/url\(['"]?([^'"]+)['"]?\)/i);
      if (pm?.[1]) {
        pic = 'https://wsrv.nl/?url=' + encodeURIComponent(pm[1]) + '&output=jpg';
      } else if (ctx.t.size) {
        const ft = [...ctx.t][0];
        pic = urljoin(this.publicUrl, `./images/icon_cookie/${R_DISK[ft]?.i || '网盘.png'}`);
      }
      const dt = pdfh(m, '.tgme_widget_message_date time&&datetime') || '';
      const yr = dt.split('T')[0]?.substring(5) || '';
      const rm = getTags(txt);
      const links = [...ctx.s];
      res.push({
        vod_name: finalTitle,
        vod_year: yr + (ctx.t.size ? ` ${[...ctx.t].join('/')}` : ''),
        vod_remarks: rm,
        vod_pic: pic,
        vod_id: JSON.stringify({
          vod_name: finalTitle,
          vod_pic: pic,
          vod_content: txt.split('\n').slice(1).join('\n'),
          vod_play_from: ctx.f.join('$$$'),
          vod_play_url: ctx.u.join('$$$')
        }),
        links: links
      });
      allLinks.push(...links);
    }
    if (allLinks.length) {
      try {
        const mag = allLinks.filter(l => l.startsWith('magnet'));
        const http = allLinks.filter(l => !l.startsWith('magnet'));
        const valid = new Set(mag);
        if (http.length) {
          const check = JSON.parse(await request(`${this.Pan_API}/api/v1/links/check`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ links: http })
          }));
          [...(check.valid_links || []), ...(check.pending_links || [])].forEach(l => valid.add(l));
        }
        res = res.filter(it => it.links.some(l => valid.has(l)));
      } catch (e) { console.error('校验误:', e.message); }
    }
    res.forEach(it => delete it.links);
    const nxt = $('link[rel="prev"]').attr('href')?.split('?')?.[1];
    return { results: res.reverse(), nextPage: nxt ? `?${nxt}` : "0" };
  },

  一级: async function() {
    const { input, MY_PAGE } = this;
    if (!input || (MY_PAGE !== 1 && (!pc.v[input] || pc.v[input] === "0"))) return [];
    const u = getUrl(input, MY_PAGE !== 1 ? input : '', pc.v);
    const html = await req_proxy(u, 'get', this.headers);
    const { results, nextPage } = await this.parseMessages(html);
    pc.v[input] = nextPage;
    return results;
  },

  二级: function(ids) { return JSON.parse(ids); },

  搜索: async function() {
    const { KEY, MY_PAGE } = this;
    if (!KEY) return [];
    const { class: cls } = await this.class_parse();
    if (!cls?.length) return [];
    if (MY_PAGE === 1 || st.k !== KEY) {
      pc.s = {};
      st = { k: KEY, i: 0 };
    }
    let { i } = st;
    if (i >= cls.length && !Object.values(pc.s).some(p => p && p !== "0")) return [];
    if (i >= cls.length) i = st.i = 0;
    const batch = cls.slice(i, i + MAX);
    const res = (await Promise.all(batch.map(async c => {
      const cn = c.type_id?.replace(/^\//, '');
      if (!cn || pc.s[cn] === "0") return [];
      const base = `${this.host}/s/${cn}?q=${encodeURIComponent(KEY)}`;
      const u = getUrl(base, cn, pc.s);
      try {
        const html = await req_proxy(u, 'get', this.headers);
        const { results: cr, nextPage } = await this.parseMessages(html);
        pc.s[cn] = nextPage === "0" ? "0" : nextPage;
        return cr.map(it => ({
          ...it,
          vod_remarks: `${c.type_name || cn} ${it.vod_remarks}`.trim()
        }));
      } catch (e) {
        pc.s[cn] = "0";
        return [];
      }
    }))).flat();

    st.i = i + MAX;
    return res;
  }
};
