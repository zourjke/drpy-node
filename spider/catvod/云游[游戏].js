/*
@header({
searchable: 1,
filterable: 1,
quickSearch: 1,
title: 'yikm[游戏]',
lang: 'cat'
})
*/
let siteKey = "", siteType = "", sourceKey = "", ext = "", host = "";
const myGame = [
{
name: '原神启动！',
url: 'https://ys.mihoyo.com/cloud/m/',
pic: 'https://pan.uvqzu.cn/f/4Z1ue/IMG_20260305_170950.jpg'
},
{
name: '星穹铁道',
url: 'https://sr.mihoyo.com/cloud/m/#/',
pic: 'https://pan.uvqzu.cn/f/Q6ktP/IMG_20260305_171855.jpg'
},
{
name: '好游快爆',
url: 'https://m.3839.com/wap.html',
pic: 'https://pan.uvqzu.cn/f/01jtP/m.baidu.com_1162231158.png'
},
{
name: 'TapTap',
url: 'https://www.taptap.cn/',
pic: 'https://pan.uvqzu.cn/f/xpqhX/m.baidu.com_01172723iyvp.png'
},
{
name: '网易云游戏',
url: 'https://cg.163.com/#/game/recommend?tab_id=66051b810d5fa1f0204c294f',
pic: 'https://pan.uvqzu.cn/f/nAyHZ/IMG_20260305_175247.jpg'
},     
{
        name: '抖音',
        url: 'https://www.douyin.com/?is_from_mobile_home=1',
        pic: 'https://pan.uvqzu.cn/f/3lJuW/m.baidu.com_e2ecc9605e2f97e1135d87cab2ddcf08.jpeg'
    },   
     {
        name: '拼多多',
        url: 'https://mobile.yangkeduo.com/',
        pic: 'https://pan.uvqzu.cn/f/4ZrSe/IMG_20260305_183229.png'
    },   
     {
        name: '淘宝',
        url: 'https://main.m.taobao.com/',
        pic: 'https://pan.uvqzu.cn/f/Nw5HW/IMG_20260305_182200.jpg'
    },   
     {
        name: '京东',
        url: 'https://m.jd.com/',
        pic: 'https://pan.uvqzu.cn/f/janHj/IMG_20260305_181852.png'
    },    
{
name: '野草助手',
url: 'https://www.yecao.net/',
pic: 'https://pan.uvqzu.cn/f/JKPcD/m.baidu.com_20231207112652564.png'
},
{
name: '永劫无间',
url: 'https://cloudgame.ds.163.com/yjwj',
pic: 'https://pan.szfx.top/view.php/2c4445e75e023e2dd5b0439253957c77.jpg'
},
{
name: '梦幻西游',
url: 'https://xyh5.163.com/game/?channel=netease',
pic: 'https://pan.szfx.top/view.php/52902e10204e7b07dbc69f6e3fdec9ab.jpg'
},
{
name: '赛尔号',
url: 'https://s.61.com/',
pic: 'https://pan.szfx.top/view.php/f56ac1ae1dd1a49041199a6719fd9234.png'
},
{
name: '刘明野的工具箱',
url: 'https://tools.liumingye.cn/',
pic: 'https://pan.szfx.top/view.php/1dcefe9108bee4a51f0d8e59cffe7a04.png'
},
{
name: '4399小游戏',
url: 'https://h.4399.com/',
pic: 'https://pan.szfx.top/view.php/b5f614076f8a9df19e3cdd1d01bdf09a.png'
},
{
name: '一千个小游戏',
url: 'https://fuun.fun/',
pic: 'https://pan.szfx.top/view.php/8191c07bb1631cde242a61aa97d7fbe5.jpg'
},
{
name: '小霸王游戏机',
url: 'https://www.yikm.net',
pic: 'https://pan.szfx.top/view.php/4d88e211d22818b011d68073353f0d3d.jpg'
},
{
name: '红色警戒2',
url: 'https://ra2web.com/',
pic: 'https://pan.szfx.top/view.php/80ff902afb37581accc402666382a9fb.jpg'
},
{
name: 'X的世界',
url: 'https://bloxd.io',
pic: 'https://pan.szfx.top/view.php/0f6ff96aa13b4bb6c3adba724df6e34d.png'
},
{
name: '贪吃蛇',
url: 'http://slither.io/',
pic: 'https://pan.szfx.top/view.php/8818a2e27a1c6fa9a6d702e579ad9d1b.jpg'
},
{
name: '斗地主(人机)',
url: 'https://www.haiwaiqipai.com/games/doudizhus/index.html',
pic: 'https://www.haiwaiqipai.com/img/DouDiZhu.jpg'
},
{
name: '五子棋',
url: 'https://wuziqi.hongton.com',
pic: 'https://wuziqi.hongton.com/img/stype/init-bg.png'
},
{
name: '俄罗斯方块',
url: 'https://v2fy.com/game/tetris/',
pic: 'https://i-1-uc129.zswxy.cn/2023/0223/5d809bdb026646478a97a938f7b3300c.png'
},
{
name: '魂斗罗(美版)',
url: 'https://www.yikm.net/play?id=4137',
pic: 'https://img.1990i.com/fcpic/sj/436a.png',
header: {
'Upgrade-Insecure-Requests': '1',
'User-Agent': 'Mozilla/5.0 (Linux; Android 8.0; Pixel 2 Build/OPD3.170816.012) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.198 Mobile Safari/537.36'
}
},
];
async function request(url, obj) {
if (!obj) {
obj = {
headers: headers,
timeout: 5000
}
}
try {
const response = await req(url, obj);
let html = response.content;
return html;
} catch (e) {
console.log(`请求失败: ${url}`, e.message);
return '';
}
}
// 2. 全局默认请求头（匹配request函数，复用至vod_id的header）
const headers = {
'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Edg/144.0.0.0'
};
// 公共函数：返回统一的 header 配置
function hdr() {
return {
'Upgrade-Insecure-Requests': '1',
'User-Agent': 'Mozilla/5.0 (Linux; Android 8.0; Pixel 2 Build/OPD3.170816.012) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.198 Mobile Safari/537.36'
};
}
async function init(cfg) {
siteKey = cfg.skey;
siteType = cfg.stype;
sourceKey = cfg.sourceKey;
ext = cfg.ext;
host = "https://www.yikm.net";
}
async function home(filter) {
const classes = [
{
type_id: '定制',
type_name: '定制',
type_flag: '2-00-S'
}, {
type_id: '/nes?tag=0&e=0&page=',
type_name: 'FC',
type_flag: '[CFS]2-00-S'
}, {
type_id: '/nes?tag=&e=5&page=',
type_name: 'SFC',
type_flag: '[CFS]2-00-S',
}, {
type_id: '/nes?tag=9&e=&page=',
type_name: '街机',
type_flag: '[CFS]2-00-S',
}, {
type_id: '/nes?tag=&e=2&page=',
type_name: 'GBA',
type_flag: '[CFS]2-00-S',
}, {
type_id: '/nes?tag=&e=7&page=',
type_name: 'NDS',
type_flag: '[CFS]2-00-S',
}, {
type_id: '/nes?tag=&e=3&page=',
type_name: 'MD',
type_flag: '[CFS]2-00-S',
}, {
type_id: '/nes?tag=&e=6&page=',
type_name: 'DOS',
type_flag: '[CFS]2-00-S',
}
];
const filters = {
"/nes?tag=0&e=0&page=": [
{
key: 'class',
name: '分类',
value: [{"n": "FC高清", "v": "/nes?tag=&e=4&page="}, {
"n": "动作冒险",
"v": "/nes?tag=2&e=0&page="
}, {"n": "小游戏", "v": "/nes?tag=8&e=0&page="}, {
"n": "飞行射击",
"v": "/nes?tag=3&e=0&page="
}, {"n": "格斗", "v": "/nes?tag=4&e=0&page="}, {"n": "棋牌", "v": "/nes?tag=5&e=0&page="}, {
"n": "射击",
"v": "/nes?tag=6&e=0&page="
}, {"n": "运动比赛", "v": "/nes?tag=7&e=0&page="}, {"n": "角色扮演", "v": "/nes?tag=10&e=0&page="},]
}
], "/nes?tag=&e=5&page=": [
{
key: 'class',
name: '分类',
value: [{"n": "汉化", "v": "/nes?tag=汉化&e=5&page="}, {
"n": "平台",
"v": "/nes?tag=平台&e=5&page="
}, {"n": "策略", "v": "/nes?tag=策略&e=5&page="}, {
"n": "混合",
"v": "/nes?tag=混合&e=5&page="
}, {"n": "动作", "v": "/nes?tag=动作&e=5&page="}, {
"n": "角色扮演",
"v": "/nes?tag=角色扮演&e=5&page="
}, {"n": "射击", "v": "/nes?tag=射击&e=5&page="}, {
"n": "运动",
"v": "/nes?tag=运动&e=5&page="
}, {"n": "格斗", "v": "/nes?tag=格斗&e=5&page="}, {
"n": "休闲",
"v": "/nes?tag=休闲&e=5&page="
}, {"n": "冒险", "v": "/nes?tag=冒险&e=5&page="}, {
"n": "教育",
"v": "/nes?tag=教育&e=5&page="
}, {"n": "赛车", "v": "/nes?tag=赛车&e=5&page="}, {
"n": "模拟",
"v": "/nes?tag=模拟&e=5&page="
}, {"n": "其他", "v": "/nes?tag=其他&e=5&page="},]
}
], "/nes?tag=9&e=&page=": [
{
key: 'class',
name: '分类',
value: [{"n": "动作冒险", "v": "/nes?tag=动作&e=1&page="}, {
"n": "射击",
"v": "/nes?tag=射击&e=1&page="
}, {"n": "赛车", "v": "/nes?tag=赛车&e=1&page="}, {
"n": "格斗",
"v": "/nes?tag=格斗&e=1&page="
}, {"n": "体育", "v": "/nes?tag=体育&e=1&page="}, {
"n": "益智游戏",
"v": "/nes?tag=益智&e=1&page="
}, {"n": "其他", "v": "/nes?tag=其他&e=1&page="},]
}
], "/nes?tag=&e=2&page=": [
{
key: 'class',
name: '分类',
value: [{"n": "动作", "v": "/nes?tag=动作&e=2&page="}, {
"n": "冒险",
"v": "/nes?tag=冒险&e=2&page="
}, {"n": "角色扮演", "v": "/nes?tag=角色扮演&e=2&page="}, {
"n": "运动",
"v": "/nes?tag=运动&e=2&page="
}, {"n": "策略", "v": "/nes?tag=策略&e=2&page="}, {
"n": "格斗",
"v": "/nes?tag=格斗&e=2&page="
}, {"n": "射击", "v": "/nes?tag=射击&e=2&page="}, {
"n": "赛车",
"v": "/nes?tag=赛车&e=2&page="
}, {"n": "体育", "v": "/nes?tag=体育&e=2&page="}, {
"n": "益智游戏",
"v": "/nes?tag=益智&e=2&page="
}, {"n": "模拟", "v": "/nes?tag=模拟&e=2&page="}]
}
], "/nes?tag=&e=7&page=": [
{
key: 'class',
name: '分类',
value: [{"n": "角色扮演", "v": "/nes?tag=角色扮演&e=7&page="}, {
"n": "动作角色扮演",
"v": "/nes?tag=动作角色扮演&e=7&page="
}, {"n": "模拟角色扮演", "v": "/nes?tag=模拟角色扮演&e=7&page="}, {
"n": "动作游戏",
"v": "/nes?tag=动作游戏&e=7&page="
}, {"n": "冒险游戏", "v": "/nes?tag=冒险游戏&e=7&page="}, {
"n": "冒险解谜",
"v": "/nes?tag=冒险解谜&e=7&page="
}, {"n": "策略战棋", "v": "/nes?tag=策略战棋&e=7&page="}, {
"n": "模拟经营",
"v": "/nes?tag=模拟经营&e=7&page="
}, {"n": "体育竞技", "v": "/nes?tag=体育竞技&e=7&page="}, {
"n": "赛车竞速",
"v": "/nes?tag=赛车竞速&e=7&page="
}, {"n": "格斗游戏", "v": "/nes?tag=格斗游戏&e=7&page="}, {
"n": "大乱斗游戏",
"v": "/nes?tag=大乱斗游戏&e=7&page="
}, {"n": "射击游戏", "v": "/nes?tag=射击游戏&e=7&page="}, {
"n": "第一人称射击",
"v": "/nes?tag=第一人称射击&e=7&page="
}, {"n": "益智游戏", "v": "/nes?tag=益智游戏&e=7&page="}, {
"n": "养成游戏",
"v": "/nes?tag=养成游戏&e=7&page="
}, {"n": "音乐游戏", "v": "/nes?tag=音乐游戏&e=7&page="}, {
"n": "恋爱游戏",
"v": "/nes?tag=恋爱游戏&e=7&page="
}, {"n": "卡片游戏", "v": "/nes?tag=卡片游戏&e=7&page="}, {
"n": "桌面游戏",
"v": "/nes?tag=桌面游戏&e=7&page="}
]
}
], "/nes?tag=&e=3&page=": [
{
key: 'class',
name: '分类',
value: [{"n": "角色扮演", "v": "/nes?tag=角色扮演&e=3&page="}, {
"n": "动作冒险",
"v": "/nes?tag=动作冒险&e=3&page="
}, {"n": "策略", "v": "/nes?tag=策略&e=3&page="}, {
"n": "棋牌",
"v": "/nes?tag=棋牌&e=3&page="
}, {"n": "射击", "v": "/nes?tag=射击&e=3&page="}, {
"n": "模拟经营",
"v": "/nes?tag=模拟经营&e=3&page="
}, {"n": "战棋", "v": "/nes?tag=战棋&e=3&page="}, {
"n": "格斗",
"v": "/nes?tag=格斗&e=3&page="
}, {"n": "动作", "v": "/nes?tag=动作&e=3&page="}, {
"n": "解谜",
"v": "/nes?tag=解谜&e=3&page="
}, {"n": "模拟", "v": "/nes?tag=模拟&e=3&page="}, {
"n": "休闲益智",
"v": "/nes?tag=休闲益智&e=3&page="
}, {"n": "体育", "v": "/nes?tag=体育&e=3&page="}, {"n": "音乐", "v": "/nes?tag=音乐&e=3&page="}]
}
]
};
return JSON.stringify({
'class': classes,
'filters': filters
});
}
async function homeVod(params) {
return null;
}
async function category(tid, pg, filter, extend) {
extend = extend || {};
if (tid == '定制') {
  // 修复：返回空数组而不是null，避免App崩溃
  if (pg != 1) return JSON.stringify({'list': []});
const videos = [];
for (let it of myGame) {
videos.push({
vod_id: JSON.stringify({
actionId: 'browser',
type: 'browser',
title: '小游戏',
url: it.url,
header: it.header
}),
vod_name: it.name,
vod_pic: it.pic,
vod_tag: 'action'
});
}
return JSON.stringify({
'list': videos
});
}
if (extend.custom) {
return search(extend.custom, true, pg);
}
const classz = extend.class;
const targetUrl = classz ? host + classz + pg : host + tid + pg;
const html = await request(targetUrl);
if (!html) return [];
// 提取所有视频卡片
const videoCards = pdfa(html, '.row .col-md-3.col-xs-6 .card-blog');
const videos = [];
for (const card of videoCards) {
// 提取图片链接
const vod_pic = pdfh(card, '.card-image img&&src');
// 提取游戏名称
const vod_name = pdfh(card, 'h4 a&&Text');
// 提取游戏链接
const gamePath = pdfh(card, 'h4 a&&href');
const gameUrl = gamePath.startsWith('http') ? gamePath : host + gamePath;
// 提取标签（如果有多个标签，这里取第一个）
//const vod_tag = pdfh(card, '.table .label:first-child&&Text') || 'action';
videos.push({
vod_id: JSON.stringify({
actionId: 'browser',
type: 'browser',
title: '小游戏',
url: gameUrl,
textZoom: 100,
header: {
'Upgrade-Insecure-Requests': '1',
'User-Agent': 'Mozilla/5.0 (Linux; Android 8.0; Pixel 2 Build/OPD3.170816.012) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.198 Mobile Safari/537.36'
}
}),
vod_name: vod_name,
vod_pic: vod_pic,
vod_tag: 'action' // 统一转为小写
});
}
// 添加固定项（如crazygames和poki）
videos.push(
{
vod_id: JSON.stringify({
actionId: 'browser',
type: 'browser',
title: '小游戏',
url: 'https://www.crazygames.com'
}),
vod_name: 'crazygames',
vod_pic: '',
vod_tag: 'action'
},
{
vod_id: JSON.stringify({
actionId: 'browser',
type: 'browser',
title: '小游戏',
url: 'https://poki.com/zh'
}),
vod_name: 'poki',
vod_pic: '',
vod_tag: 'action'
}
);
return JSON.stringify({
'list': videos
});
}
async function search(wd, quick, pg) {
const p = pg || 1;
const url = host + '/search?name=' + encodeURIComponent(wd);
const html = await request(url);
if (!html) return [];
const videoCard = pdfa(html, '.row .col-md-3.col-xs-6');
console.log('【调试】网络数据：', videoCard);
// 提取所有视频卡片
const videoCards = pdfa(html, '.row .col-md-3.col-xs-6 .card.card-blog');
const videos = [];
for (const card of videoCards) {
// 提取图片链接
const vod_pic = pdfh(card, '.card-image img&&src');
// 提取游戏名称
const vod_name = pdfh(card, 'h4 a&&Text');
// 提取游戏链接
const gamePath = pdfh(card, 'h4 a&&href');
const gameUrl = gamePath.startsWith('http') ? gamePath : host + gamePath;
// 提取标签（如果有多个标签，这里取第一个）
//const vod_tag = pdfh(card, '.table .label:first-child&&Text') || 'action';
videos.push({
vod_id: JSON.stringify({
actionId: 'browser',
type: 'browser',
title: '小游戏',
url: gameUrl,
textZoom: 100,
header: {
'Upgrade-Insecure-Requests': '1',
'User-Agent': 'Mozilla/5.0 (Linux; Android 8.0; Pixel 2 Build/OPD3.170816.012) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.198 Mobile Safari/537.36'
}
}),
vod_name: vod_name,
vod_pic: vod_pic,
vod_tag: 'action'
});
}
return JSON.stringify({
'list': videos,
page: p
});
}
export function __jsEvalReturn() {
return {
init: init,
home: home,
homeVod: homeVod,
category: category,
search: search
};
}
