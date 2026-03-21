/*
@header({
  searchable: 0,
  filterable: 0,
  quickSearch: 0,
  title: '设置中心',
  isProxyPath: true,
  logo: 'https://avatars.githubusercontent.com/u/49803097?v=4',
  more: {
    sourceTag: '设置,动作',
    actions: [
      {
        name: '推送',
        action: '{\'actionId\':\'推送视频播放\',\'id\':\'push\',\'type\':\'input\',\'title\':\'推送视频地址进行播放\',\'tip\':\'支持网盘、官链、直链、待嗅探链接\',\'value\':\'\',\'msg\':\'请输入待推送的视频地址\',\'imageUrl\':\'https://youke1.picui.cn/s1/2025/10/10/68e7ec0390944.jpg\',\'imageHeight\':200,\'imageType\':\'card_pic_3\',\'keep\':true,\'button\':4,\'width\':640,\'selectData\':\'123:=https://www.123684.com/s/oec7Vv-DggWh?ZY4K,腾讯:=https://v.qq.com/x/cover/mzc00200vkqr54u/u4100l66fas.html,爱奇艺:=http://www.iqiyi.com/v_1b0tk1b8tl8.html,夸克:=https://pan.quark.cn/s/6c8158e258f3,UC:=https://drive.uc.cn/s/59023f57d3ce4?public=1,阿里:=https://www.alipan.com/s/vgXMcowK8pQ,天翼:=https://cloud.189.cn/web/share?code=INJbU3NbqyUj,移动1:=https://yun.139.com/shareweb/#/w/i/0i5CLQ7BpV7Ai,移动2:=https://caiyun.139.com/m/i?2jexC1gcjeN7q,移动3:=https://yun.139.com/shareweb/#/w/i/2i2MoE9ZHn9p1,直链1:=https://vdse.bdstatic.com//628ca08719cef5987ea2ae3c6f0d2386.mp4,嗅探1:=https://www.6080kk.cc/haokanplay/178120-1-1.html,嗅探2:=https://www.hahads.com/play/537106-3-1.html,多集:=https://v.qq.com/x/cover/m441e3rjq9kwpsc/m00253deqqo.html#https://pan.quark.cn/s/6c8158e258f3,海阔二级单线路:=H4sIAAAAAAAAA52Uy27TQBSGXwUZlsT2GefadZ+AN3ATk7qKL7guUoKQXAQFeoEG6oKaVBUFlBZFbdQ0TXAIeRjPTJwVr8AYCsNyijQbnzPfPz72p3kk6WXf8aQFibzszFsb0l2p7Ni+YfusFAe78/W383C6eC8OmnEQsEVal7NxiEebeLQ/i75oKvl6iccfZwdPWY0OhnR8+uPbdnJ2kUx7ONrAo094skMOD+ZHHbL1nIbHbCf53KdBh7RPaP+Yfm8n5x+S3gWr016TtCb03VUa2Brh6A0Nm8ngVRysk7Nt+mI3aYfk9fs0YfMERxENn+FoKw6e3KJ7V8lgyF6+YnrG9UAPTLu6ZNgrpu4ZNlJRlrXve47FWrNomgzPEdJYydYtIx1/Z0rbXTzps9zrza5ZZo1l33dXFxSFPWlyvdGom5ZeNVblsmMpa27N0SvKQ6eipEwGIINAgYKGIA+lYg7kFbfKkta8Wnpqt6sC+8Z3/kQuyXm1qDZ+RbEMt6bXFVBBQ6UMy5KXfat2O4WQMIQ4pAlDGoeywlCWQzlhKMehvDCU51BBGCpwqCgMFTlUEoZKfyFQxX+uyqkbKMGdAHEnAP0Xxa0AcZWAawHiLgH3AsRlAi4GiNsE3AwQ1wm4GiDuE/zjhrhQiLuBxI1C3A0kbhTibqAb3DK/3ZAe/wSSQMKkPgYAAA==\'}',
        vod_name: '推送视频播放',
        vod_pic: 'https://youke1.picui.cn/s1/2025/10/10/68e7ec0390944.jpg',
        vod_tag: 'action'
      },
      {
        name: '连续对话',
        action: '{\'actionId\':\'连续对话\',\'id\':\'talk\',\'type\':\'input\',\'title\':\'连续对话\',\'tip\':\'请输入消息\',\'value\':\'\',\'msg\':\'开始新的对话\',\'button\':3,\'imageUrl\':\'https://img2.baidu.com/it/u=1206278833,3265480730&fm=253&fmt=auto&app=120&f=JPEG?w=800&h=800\',\'imageHeight\':200,\'imageType\':\'card_pic_3\',\'keep\':true,\'width\':680,\'height\':800,\'msgType\':\'long_text\',\'httpTimeout\':60,\'canceledOnTouchOutside\':false,\'selectData\':\'新的对话:=清空AI对话记录\'}'
      },
      {
        name: '查看夸克cookie',
        action: '查看夸克cookie'
      },
      {
        name: '设置夸克cookie',
        action: '设置夸克cookie'
      },
      {
        name: '夸克扫码',
        action: '夸克扫码'
      },
      {
        name: '设置玩偶域名',
        action: '{\'actionId\':\'玩偶域名\',\'id\':\'domain\',\'type\':\'input\',\'width\':450,\'title\':\'玩偶域名\',\'tip\':\'请输入玩偶域名\',\'value\':\'\',\'msg\':\'选择或输入使用的域名\',\'selectData\':\'1:=https://www.wogg.net/,2:=https://wogg.xxooo.cf/,3:=https://wogg.888484.xyz/,4:=https://www.wogg.bf/,5:=https://woggapi.333232.xyz/\'}'
      }
    ]
  },
  lang: 'ds'
})
*/

const {action_data, generateUUID} = $.require('./_lib.action.js');
const {
    _checkQuarkStatus,
    _checkUCStatus,
    _checkAliStatus,
    _checkBiliStatus,
    _checkBaiduStatus,
    QRCodeHandler,
    qrcode
} = $.require('./_lib.scan.js');
// 访问测试 http://127.0.0.1:5757/api/设置中心?ac=action&action=set-cookie
// 访问测试 http://127.0.0.1:5757/api/设置中心?ac=action&action=quarkCookieConfig&value={"cookie":"我是cookie"}
const AI_Cache = {};

let gitPublicUrl = 'https://github.catvod.com/https://raw.githubusercontent.com/hjdhnx/drpy-node/refs/heads/main/public/';
let liveImgUrl = urljoin(gitPublicUrl, './images/lives.jpg');
let quick_data = {
    腾讯: 'https://v.qq.com/x/cover/mzc00200vkqr54u/u4100l66fas.html',
    爱奇艺: 'http://www.iqiyi.com/v_1b0tk1b8tl8.html',
    夸克: 'https://pan.quark.cn/s/6c8158e258f3',
    UC: 'https://drive.uc.cn/s/59023f57d3ce4?public=1',
    阿里: 'https://www.alipan.com/s/vgXMcowK8pQ',
    天翼: 'https://cloud.189.cn/web/share?code=INJbU3NbqyUj',
    百度: 'https://pan.baidu.com/s/1L0UIv4p0X0QrbbKErJuc_w?pwd=2pwj',
    迅雷1: 'https://pan.xunlei.com/s/VOkBwLBNoXN8eO9WrcVbXdTcA1?pwd=8tvj#',
    迅雷2: 'https://pan.xunlei.com/s/VOin43oarqFZiGguKJEeqZoGA1?pwd=kybc',
    移动1: 'https://yun.139.com/shareweb/#/w/i/0i5CLQ7BpV7Ai',
    移动2: 'https://caiyun.139.com/m/i?2jexC1gcjeN7q',
    移动3: 'https://yun.139.com/shareweb/#/w/i/2i2MoE9ZHn9p1',
    123: 'https://www.123684.com/s/oec7Vv-DggWh?ZY4K',
    直链1: 'https://vdse.bdstatic.com//628ca08719cef5987ea2ae3c6f0d2386.mp4',
    嗅探1: 'https://www.6080kk.cc/haokanplay/178120-1-1.html',
    嗅探2: 'https://www.hahads.com/play/537106-3-1.html',
    央视跨源: 'cctv://3c18e2b3bba249b78b831e910608cfec',
    多集: 'https://v.qq.com/x/cover/m441e3rjq9kwpsc/m00253deqqo.html@https://pan.quark.cn/s/6c8158e258f3@https://pan.baidu.com/s/1TdbgcwaMG1dK7B5pQ1LbBg?pwd=1234',
    海阔二级单线路: gzip(JSON.stringify({
        "actor": "剧集",
        "content": "【道长DR】　　围绕上世纪30年代的上海滩，讲述了两位坚韧勇敢的女性在波澜诡谲的民国时代相互救赎、完成蜕变的动人故事。 收起",
        "director": "qingbenjiaren2024",
        "from": "线路223",
        "name": "卿本佳人2024",
        "pic": "https://pic3.yzzyimages.com/upload/vod/2024-11-21/17321619851.jpg",
        "url": "第01集$https://b.6080z.com/vodplay/101329-4-1.html#第02集$https://b.6080z.com/vodplay/101329-4-2.html#第03集$https://b.6080z.com/vodplay/101329-4-3.html#第04集$https://b.6080z.com/vodplay/101329-4-4.html#第05集$https://b.6080z.com/vodplay/101329-4-5.html#第06集$https://b.6080z.com/vodplay/101329-4-6.html#第07集$https://b.6080z.com/vodplay/101329-4-7.html#第08集$https://b.6080z.com/vodplay/101329-4-8.html#第09集$https://b.6080z.com/vodplay/101329-4-9.html#第10集$https://b.6080z.com/vodplay/101329-4-10.html#第11集$https://b.6080z.com/vodplay/101329-4-11.html#第12集$https://b.6080z.com/vodplay/101329-4-12.html#第12集$https://b.6080z.com/vodplay/101329-4-13.html#第13集$https://b.6080z.com/vodplay/101329-4-14.html#第14集$https://b.6080z.com/vodplay/101329-4-15.html#第15集$https://b.6080z.com/vodplay/101329-4-16.html#第16集$https://b.6080z.com/vodplay/101329-4-17.html#第17集$https://b.6080z.com/vodplay/101329-4-18.html#第18集$https://b.6080z.com/vodplay/101329-4-19.html#第19集$https://b.6080z.com/vodplay/101329-4-20.html#第20集$https://b.6080z.com/vodplay/101329-4-21.html#第21集$https://b.6080z.com/vodplay/101329-4-22.html#第22集$https://b.6080z.com/vodplay/101329-4-23.html"
    })),
};
let quick_data1 = {
    '大一实习': 'https://fanqienovel.com/page/7421167583522458648',
    '十日终焉': 'https://fanqienovel.com/page/7143038691944959011',
    '斩神': 'https://fanqienovel.com/page/6982529841564224526',
};
let quick_data1Q = {
    '掌门怀孕': 'https://www.qimao.com/shuku/2014393/',
    '史上最强师父': 'https://www.qimao.com/shuku/1817221/',
    '被逐出宗门后，美人师尊跪求我原谅': 'https://www.qimao.com/shuku/1886669/',
};
let quick_data2 = {
    '推送': 'push',
    '夸克': 'quark',
    'UC': 'uc',
    '阿里': 'ali',
    '天翼': 'cloud',
    '哔哩': 'bili',
    '系统配置': 'system',
    '测试': 'test',
};

let selectData = renderSelect(quick_data);
let selectData1 = renderSelect(quick_data1);
let selectDataList1Q = renderSelect(quick_data1Q);
let selectData2 = renderSelect(quick_data2);

function renderSelect(quick_data1) {
    let selectDataList1 = [];
    for (let key of Object.keys(quick_data1)) {
        selectDataList1.push(`${key}:=${quick_data1[key]}`);
    }
    return selectDataList1.join(',')
}

var rule = {
    类型: '设置',
    title: '设置中心',
    推荐: async function () {
        let {publicUrl, requestHost} = this;
        // log('publicUrl:', publicUrl);
        let setIcon = urljoin(publicUrl, './images/icon_cookie/设置.png');
        let searchIcon = urljoin(publicUrl, './images/icon_cookie/搜索.jpg');
        let chatIcon = urljoin(publicUrl, './images/icon_cookie/chat.webp');
        let drpysIcon = urljoin(publicUrl, './images/drpys.png');
        let drpyshIcon = urljoin(publicUrl, './images/drpysh.png');
        const data = deepCopy(action_data);
        const data1 = {
            vod_id: JSON.stringify({
                actionId: '源内搜索',
                id: 'wd',
                type: 'input',
                title: '源内搜索',
                tip: '请输入搜索内容',
                value: '',
                selectData: selectData2
            }),
            vod_name: '源内搜索',
            vod_pic: searchIcon,
            vod_tag: 'action',
        };
        data.push(data1);
        const data2 = {
            vod_id: JSON.stringify({
                actionId: 'browser',
                type: 'browser',
                title: 'DS仓库',
                url: 'https://repo.tvshare.cn/',
            }),
            vod_name: 'DS仓库',
            vod_pic: drpyshIcon,
            vod_tag: 'action'
        }
        data.unshift(data2);
        const data3 = {
            vod_id: JSON.stringify({
                actionId: 'browser',
                type: 'browser',
                title: '后台管理',
                url: requestHost + '/apps/admin',
                header: {'Authorization': 'Basic YWRtaW46ZHJweXM='},
            }),
            vod_name: '后台管理',
            vod_pic: drpysIcon,
            vod_tag: 'action'
        };
        data.unshift(data3);
        data.forEach(it => {
            if (!it.vod_pic) {
                it.vod_pic = setIcon;
            }
            if (it.vod_name === '连续对话') {
                it.vod_pic = chatIcon;
            }
        });
        return data;
    },
    // 推荐样式
    hikerListCol: 'icon_round_4',
    // 分类列表样式
    hikerClassListCol: 'avatar',
    // home_flag: '3-0-S',
    home_flag: '5',
    class_flag: '3-11-S',
    more: {
        sourceTag: '设置,动作',
        actions: [
            {
                name: '推送',
                action: JSON.stringify({
                    actionId: '推送视频播放',
                    id: 'push',
                    type: 'input',
                    title: '推送视频地址进行播放',
                    tip: '支持网盘、官链、直链、待嗅探链接',
                    value: '',
                    msg: '请输入待推送的视频地址',
                    imageUrl: liveImgUrl,
                    imageHeight: 200,
                    imageType: 'card_pic_3',
                    keep: true,
                    button: 4,
                    width: 640,
                    // selectData: '腾讯:=https://v.qq.com/x/cover/m441e3rjq9kwpsc/l0045w5hv1k.html,2:=bb输入默认值bbbbb,3:=c输入默认值ddd,4:=输入默认值,5:=111,6:=22222,7:=HOHO,HELLO,world'
                    selectData: selectData
                }),
                vod_name: '推送视频播放',
                vod_pic: liveImgUrl,
                vod_tag: 'action'
            },
            {
                name: '连续对话', action: JSON.stringify({
                    actionId: '连续对话',
                    id: 'talk',
                    type: 'input',
                    title: '连续对话',
                    tip: '请输入消息',
                    value: '',
                    msg: '开始新的对话',
                    button: 3,
                    imageUrl: 'https://img2.baidu.com/it/u=1206278833,3265480730&fm=253&fmt=auto&app=120&f=JPEG?w=800&h=800',
                    imageHeight: 200,
                    imageType: 'card_pic_3',
                    keep: true,
                    width: 680,
                    height: 800,
                    msgType: 'long_text',
                    httpTimeout: 60,
                    canceledOnTouchOutside: false,
                    selectData: '新的对话:=清空AI对话记录'
                })
            },
            {name: '查看夸克cookie', action: '查看夸克cookie'},
            {name: '设置夸克cookie', action: '设置夸克cookie'},
            {name: '夸克扫码', action: '夸克扫码'},
            {
                name: '设置玩偶域名', action: JSON.stringify({
                    actionId: '玩偶域名',
                    id: 'domain',
                    type: 'input',
                    width: 450,
                    title: '玩偶域名',
                    tip: '请输入玩偶域名',
                    value: '',
                    msg: '选择或输入使用的域名',
                    selectData: '1:=https://www.wogg.net/,2:=https://wogg.xxooo.cf/,3:=https://wogg.888484.xyz/,4:=https://www.wogg.bf/,5:=https://woggapi.333232.xyz/'
                }),
            }],
    },
    UCScanCheck: null,
    quarkScanCheck: null,
    baiduScanCheck: null,
    aliScanCheck: null,
    biliScanCheck: null,
    host: 'http://empty',
    class_name: '推送&夸克&UC&阿里&百度&哔哩&天翼&迅雷&系统配置&测试&接口挂载&视频解析',
    class_url: 'push&quark&uc&ali&baidu&bili&cloud&xun&system&test&apiLink&videoParse',
    url: '/fyclass',

    预处理: async function (env) {

    },

    一级: async function (tid, pg, filter, extend) {
        let {input, MY_CATE, MY_PAGE, publicUrl} = this;
        // log('publicUrl:', publicUrl);
        if (MY_PAGE > 1) {
            return []
        }
        let images = {
            'quark': urljoin(publicUrl, './images/icon_cookie/夸克.webp'),
            'uc': urljoin(publicUrl, './images/icon_cookie/UC.png'),
            'ali': urljoin(publicUrl, './images/icon_cookie/阿里.png'),
            'bili': urljoin(publicUrl, './images/icon_cookie/哔哩.png'),
            'cloud': urljoin(publicUrl, './images/icon_cookie/天翼.png'),
            'baidu': urljoin(publicUrl, './images/icon_cookie/百度.png'),
            'xun': urljoin(publicUrl,'./images/icon_cookie/迅雷.jpg'),
            'adult': urljoin(publicUrl, './images/icon_cookie/chat.webp'),
            'test': urljoin(publicUrl, './icon.svg'),
            'lives': urljoin(publicUrl, './images/lives.jpg'),
            'settings': urljoin(publicUrl, './images/icon_cookie/设置.png'),
            'read': urljoin(publicUrl, './images/icon_cookie/阅读.png'),
        };
        let d = [];
        switch (MY_CATE) {
            case 'push':
                d.push({
                    vod_id: JSON.stringify({
                        actionId: '推送视频播放',
                        id: 'push',
                        type: 'input',
                        title: '推送视频地址进行播放',
                        tip: '支持网盘、官链、直链、待嗅探链接',
                        value: '',
                        msg: '请输入待推送的视频地址',
                        imageUrl: images.lives,
                        imageHeight: 200,
                        imageType: 'card_pic_3',
                        keep: true,
                        // button: 3,
                        button: 4, //故意传4,壳子应该默认视为3
                        width: 640,
                        // selectData: '腾讯:=https://v.qq.com/x/cover/m441e3rjq9kwpsc/l0045w5hv1k.html,2:=bb输入默认值bbbbb,3:=c输入默认值ddd,4:=输入默认值,5:=111,6:=22222,7:=HOHO,HELLO,world'
                        selectData: selectData
                    }),
                    vod_name: '推送视频播放',
                    vod_pic: images.lives,
                    vod_tag: 'action'
                },);

                d.push({
                    vod_id: JSON.stringify({
                        actionId: '推送番茄小说',
                        id: 'push',
                        type: 'input',
                        title: '推送番茄小说网页目录链接进行解析',
                        tip: '支持番茄小说网页版链接',
                        value: 'https://fanqienovel.com/page/7421167583522458648',
                        msg: '请输入待推送的番茄小说网页版链接',
                        imageUrl: images.read,
                        imageHeight: 200,
                        imageType: 'card_pic_3',
                        keep: false,
                        selectData: selectData1
                    }),
                    vod_name: '推送番茄小说',
                    vod_pic: images.read,
                    vod_tag: 'action'
                },);

                d.push({
                    vod_id: JSON.stringify({
                        actionId: '推送七猫小说',
                        id: 'push',
                        type: 'input',
                        title: '推送七猫小说网页目录链接进行解析',
                        tip: '支持七猫小说网页版链接',
                        value: 'https://www.qimao.com/shuku/2014393/',
                        msg: '请输入待推送的七猫小说网页版链接',
                        imageUrl: images.read,
                        imageHeight: 200,
                        imageType: 'card_pic_3',
                        keep: false,
                        selectData: selectDataList1Q
                    }),
                    vod_name: '推送七猫小说',
                    vod_pic: images.read,
                    vod_tag: 'action'
                },);
                break;

            case 'quark':
                d.push(genMultiInput('quark_cookie', '设置夸克 cookie', null, images.quark));
                d.push(getInput('get_quark_cookie', '查看夸克 cookie', images.quark));
                d.push({
                    vod_id: '夸克扫码',
                    vod_name: '夸克扫码',
                    vod_pic: images.quark,
                    vod_remarks: '夸克',
                    vod_tag: 'action'
                });
                break;
            case 'uc':
                d.push(genMultiInput('uc_cookie', '设置UC cookie', null, images.uc));
                d.push(getInput('get_uc_cookie', '查看UC cookie', images.uc));
                d.push({
                    vod_id: 'UC扫码',
                    vod_name: 'UC扫码',
                    vod_pic: images.uc,
                    vod_remarks: 'UC',
                    vod_tag: 'action'
                });
                break;
            case 'ali':
                d.push(genMultiInput('ali_token', '设置阿里 token', null, images.ali));
                d.push(getInput('get_ali_token', '查看阿里 token', images.ali));
                d.push({
                    vod_id: '阿里扫码',
                    vod_name: '阿里扫码',
                    vod_pic: images.ali,
                    vod_remarks: '阿里',
                    vod_tag: 'action'
                });
                break;
            case 'cloud':
                d.push(genMultiInput('cloud_account', '设置天翼 账号', null, images.cloud));
                d.push(genMultiInput('cloud_password', '设置天翼 密码', null, images.cloud));
                // d.push(genMultiInput('cloud_cookie', '设置天翼 cookie', null, images.cloud));
                d.push(getInput('get_cloud_account', '查看天翼 账号', images.cloud));
                d.push(getInput('get_cloud_password', '查看天翼 密码', images.cloud));
                d.push(getInput('get_cloud_cookie', '查看天翼 cookie', images.cloud));
                break;
            case 'baidu':
                d.push(genMultiInput('baidu_cookie', '设置百度 cookie', null, images.baidu));
                d.push(getInput('get_baidu_cookie', '查看百度 cookie', images.baidu));
                d.push({
                    vod_id: '百度扫码',
                    vod_name: '百度扫码',
                    vod_pic: images.baidu,
                    vod_remarks: '百度',
                    vod_tag: 'action'
                });
                break;
            case 'bili':
                d.push(genMultiInput('bili_cookie', '设置哔哩 cookie', null, images.bili));
                d.push(getInput('get_bili_cookie', '查看哔哩 cookie', images.bili));
                d.push({
                    vod_id: '哔哩扫码',
                    vod_name: '哔哩扫码',
                    vod_pic: images.bili,
                    vod_remarks: '哔哩',
                    vod_tag: 'action'
                });
                break;
            case 'xun':
                d.push(genMultiInput('xun_username', '设置迅雷账号', null, images.xun));
                d.push(getInput('get_xun_username', '查看迅雷账号', images.xun));
                d.push({
                    vod_id: '迅雷登录',
                    vod_name: '迅雷登录',
                    vod_pic: images.xun,
                    vod_remarks: '迅雷',
                    vod_tag: 'action'
                });
                break;
            case 'system':
                d.push(genMultiInput('hide_adult', '设置青少年模式', '把值设置为1将会在全部接口隐藏18+源，其他值不过滤，跟随订阅', images.settings));
                d.push(getInput('get_hide_adult', '查看青少年模式', images.settings));
                d.push(genMultiInput('thread', '设置播放代理线程数', '默认为1，可自行配置成其他值如:10', images.settings));
                d.push(getInput('get_thread', '查看播放代理线程数', images.settings));
                d.push(genMultiInput('play_local_proxy_type', '设置原代本类型', '默认为1，可自行配置成其他值如:2 (1 不夜5575,2 mediaGo 7777 其他:5575)', images.settings));
                d.push(getInput('get_play_local_proxy_type', '查看原代本类型', images.settings));

                d.push(genMultiInput('play_proxy_mode', '设置播放代理模式', '默认为1，可自行配置成其他值如:2 (1 内存加速,2 磁盘加速 其他:内存加速)', images.settings));
                d.push(getInput('get_play_proxy_mode', '查看播放代理模式', images.settings));
                d.push(genMultiInput('enable_dr2', '设置drpy2源启用状态', '设置为1启用drpy2脚本服务，需要壳子内置处理；设置为2启用drpy2-fast，需要壳子适配新so(默认1，设置其他值关闭)', images.settings));
                d.push(getInput('get_enable_dr2', '查看drpy2源启用状态', images.settings));
                d.push(genMultiInput('enable_py', '设置py源启用状态', '设置为1可启用此功能,设置为2启用T4(默认没设置也属于启动，设置其他值关闭)', images.settings));
                d.push(getInput('get_enable_py', '查看py源启用状态', images.settings));
                d.push(genMultiInput('enable_php', '设置php源启用状态', '设置为1可启用此功能,设置为0可关闭(1-T4|2-T3 默认没设置也属于启动1，设置其他值关闭)', images.settings));
                d.push(getInput('get_enable_php', '查看php源启用状态', images.settings));
                d.push(genMultiInput('enable_cat', '设置cat源启用状态', '设置为1可启用此功能,设置为2启用T4(默认没设置也属于启动，设置其他值关闭)', images.settings));
                d.push(getInput('get_enable_cat', '查看cat源启用状态', images.settings));
                d.push(genMultiInput('enable_old_config', '设置兼容性配置', '设置为1可启用此功能(默认关闭)', images.settings));
                d.push(getInput('get_enable_old_config', '查看兼容性配置', images.settings));

                d.push(genMultiInput('now_ai', '设置当前AI', '1: 讯飞星火 2:deepseek 3.讯飞智能体 4.Kimi \n如果不填，连续对话默认使用讯飞星火', images.settings));
                d.push(getInput('get_now_ai', '查看当前AI', images.settings));
                d.push(genMultiInput('allow_forward', '设置允许代理转发', '设置为1可启用此功能，有一定的使用场景用于突破网络限制', images.settings));
                d.push(getInput('get_allow_forward', '查看允许代理转发', images.settings));
                d.push(genMultiInput('spark_ai_authKey', '设置讯飞AI鉴权', '在这个页面的http鉴权信息:\nhttps://console.xfyun.cn/services/bm4', images.settings));
                d.push(getInput('get_spark_ai_authKey', '查看讯飞AI鉴权', images.settings));
                d.push(genMultiInput('deepseek_apiKey', '设置deepseek AI鉴权', '在这个页面的http鉴权信息:\nhttps://platform.deepseek.com/api_keys', images.settings));
                d.push(getInput('get_deepseek_apiKey', '查看deepseek AI鉴权', images.settings));
                d.push(genMultiInput('sparkBotObject', '设置讯飞星火智能体 AI鉴权', '设置对象形式，如:{"appId":"6fafca", "uid":"道长", "assistantId":"tke24zrzq3f1"}\n 在这个页面的http鉴权信息:\nhttps://xinghuo.xfyun.cn/botcenter/createbot', images.settings));
                d.push(getInput('get_sparkBotObject', '查看讯飞星火智能体 AI鉴权', images.settings));

                d.push(genMultiInput('show_curl', '设置打印curl开关', '设置为1可启用此功能(默认关闭)', images.settings));
                d.push(getInput('get_show_curl', '查看打印curl开关', images.settings));
                d.push(genMultiInput('show_req', '设置打印req开关', '设置为1可启用此功能(默认关闭)', images.settings));
                d.push(getInput('get_req', '查看打印req开关', images.settings));

                d.push(genMultiInput('enable_rule_name', '设置配置名称开关', '设置为1可启用此功能(默认关闭)', images.settings));
                d.push(getInput('get_enable_rule_name', '查看配置名称开关', images.settings));

                break;
            case 'test':
                d.push({
                    vod_id: "proxyStream",
                    vod_name: "测试本地代理流",
                    vod_pic: images.lives,
                    vod_desc: "流式代理mp4等视频"
                });
                d.push(genMultiInput('enable_doh', '设置DOH启用状态', '设置为1开启(默认0关闭)', images.settings));
                d.push(getInput('get_enable_doh', '查看DOH启用状态', images.settings));
                d.push(genMultiInput('enable_system_proxy', '设置系统代理启用状态', '设置为0关闭(默认1开启)', images.settings));
                d.push(getInput('get_enable_system_proxy', '查看系统代理启用状态', images.settings));
                break;
            case 'apiLink':
                d.push(genMultiInput('link_url', '设置挂载地址', '可以挂载t4配置链接如 hipy-t4、不夜t4', images.settings));
                d.push(getInput('get_link_url', '查看挂载地址', images.settings));
                d.push(getInput('link_data', '更新挂载数据', images.settings, '将挂载的配置数据获取到系统内方便武魂融合，远程有更新也需要执行此内容'));
                d.push(getInput('get_link_data', '查看挂载数据', images.settings));
                d.push(genMultiInput('enable_link_data', '设置启用挂载数据', '设置为1可以启用。默认不启用。设置其他值禁用', images.settings));
                d.push(getInput('get_enable_link_data', '查看启用挂载数据', images.settings));
                d.push(genMultiInput('enable_link_push', '设置启用挂载推送', '设置为1可以启用。默认即关闭。设置其他值禁用', images.settings));
                d.push(getInput('get_enable_link_push', '查看启用挂载推送', images.settings));
                d.push(genMultiInput('enable_link_jar', '设置允许挂载Jar', '设置为1可以启用。默认即关闭。设置其他值禁用', images.settings));
                d.push(getInput('get_enable_link_jar', '查看允许挂载Jar', images.settings));
                d.push(genMultiInput('cat_sub_code', '猫爪订阅码', '自定义猫爪源的订阅码。默认为all', images.settings));
                d.push(getInput('get_cat_sub_code', '查看猫爪订阅码', images.settings));
                d.push(genMultiInput('must_sub_code', '严格订阅码', '设置为1可以启用。默认即关闭', images.settings));
                d.push(getInput('get_must_sub_code', '查看严格订阅码', images.settings));

                break;
            case 'videoParse':
                d.push(genMultiInput('mg_hz', '设置芒果解析画质', '默认为4，可自行配置成其他值 (视频质量，9=4K, 4=1080p, 3=720p, 2=560p)', images.settings));
                d.push(getInput('get_mg_hz', '查看芒果解析画质', images.settings));

                d.push(genMultiInput('PROXY_AUTH', '设置代理播放授权', '默认为drpys，可自行配置成其他值', images.settings));
                d.push(getInput('get_PROXY_AUTH', '查看代理播放授权', images.settings));

                d.push(genMultiInput('enable_self_jx', '设置启用自建解析', '默认为关闭，可自行配置成其他值(0关闭 1启用)', images.settings));
                d.push(getInput('get_enable_self_jx', '查看启用自建解析', images.settings));
                break;
        }
        return d
    },
    二级: async function (ids) {
        let {input, orId, getProxyUrl} = this;
        // log(input, orId);
        if (orId === 'proxyStream') {
            let media_url = 'https://vdse.bdstatic.com/628ca08719cef5987ea2ae3c6f0d2386.mp4';
            let m3u8_url = 'http://kjsp.aikan.miguvideo.com/PLTV/88888888/224/3221236432/1.m3u8';
            return {
                vod_id: 'proxyStream',
                vod_name: '测试代理流',
                vod_play_from: 'drpyS本地流代理',
                // vod_play_url: '测试播放流$' + getProxyUrl().split('?')[0] + media_url + '#不代理直接播$' + media_url + '#8k播放$' + m3u8_url,
                vod_play_url: '测试播放流$' + getProxyUrl().split('?')[0] + media_url + '#不代理直接播$' + media_url
            }
        }
    },
    play_parse: true,
    lazy: async function () {
        let {input} = this;
        return {parse: 0, url: input}
    },
    proxy_rule: async function () {
        let {input, proxyPath} = this;
        const url = proxyPath;
        log('start proxy:', url);
        try {
            const headers = {
                'user-agent': PC_UA,
            }
            return [200, null, url, headers, 2]
        } catch (e) {
            log('proxy error:', e.message);
            return [500, 'text/plain', e.message]
        }
    },
    action: async function (action, value) {
        let {httpUrl, imageApi, requestHost, publicUrl} = this;
        if (action === '迅雷登录'){
            if(ENV.get('xun_username')!==''){
                await Xun.getVerifyCode()
                return {action: getVerify('verify', '验证码', '请输入验证码').vod_id}
            }else {
                return '账号不能为空！'
            }
        }
        if (action === 'verify' && value){
            ENV.set('xun_auth','')
            let verification_code = JSON.parse(value).verify;
            await Xun.getVerify(verification_code)
            if(ENV.get('xun_auth')!==''){
                return '登录成功'
            }else {
                return '登录失败'
            }
        }
        if (action === 'set-cookie') {
            return JSON.stringify({
                action: {
                    actionId: 'quarkCookieConfig',
                    id: 'cookie',
                    type: 'input',
                    title: '夸克Cookie',
                    tip: '请输入夸克的Cookie',
                    value: '原值',
                    msg: '此弹窗是动态设置的参数，可用于动态返回原设置值等场景'
                }
            });
        }
        if (action === 'quarkCookieConfig' && value) {
            try {
                const obj = JSON.parse(value);
                const val = obj.cookie;
                return "我收到了：" + value;
            } catch (e) {
                return '发生错误：' + e;
            }
        }
        if (action === '源内搜索') {
            let content = JSON.parse(value);
            return JSON.stringify({
                action: {
                    actionId: '__self_search__',
                    skey: '', //目标源key，可选，未设置或为空则使用当前源
                    // skey: 'drpyS_小米盘搜[盘]', //目标源key，可选，未设置或为空则使用当前源 | 跳一级并非跳搜索
                    name: '搜索: ' + content.wd,
                    tid: content.wd,
                    flag: '0-0-S',
                    msg: '源内搜索'
                }
            });
        }

        if (action === '连续对话') {
            let content = JSON.parse(value);
            let prompt = content.talk.trim();
            if (!prompt) {
                return JSON.stringify({
                    action: {
                        actionId: '__keep__',
                    },
                    toast: '输入内容不可以为空哦~'
                });
                // return '输入内容不可以为空哦~'
            }
            // try {
            //     a = b;
            // } catch (e) {
            //     console.error('测试出错捕获：', e);
            // }
            // console.error('对象日志测试:', 0, '==== ', content, ' ====', true);

            if (prompt.startsWith('http')) {
                return JSON.stringify({
                    action: {
                        actionId: '__detail__',
                        skey: 'push_agent',
                        ids: prompt,
                    },
                    toast: '你要去看视频了'
                });
            }
            if (prompt.startsWith('清空AI对话记录')) {
                Object.keys(AI_Cache).forEach(key => {
                    delete AI_Cache[key];
                });
                return JSON.stringify({
                    action: {
                        actionId: '__keep__',
                        msg: '准备开始新的对话...',
                        reset: true
                    },
                    toast: '记录已清除，可以开始新的对话了'
                });
            }
            let user1 = '你';
            let user2 = 'AI';
            let replyContent = prompt;
            if (['1', '2', '3', '4'].includes(ENV.get('now_ai', '1'))) {
                if (rule.askLock) {
                    return JSON.stringify({
                        action: {
                            actionId: '__keep__',
                            msg: '请等待AI思考完成...',
                            reset: false
                        },
                        toast: 'AI思考中，请稍候继续提问'
                    });
                }
                let AI = null;
                switch (ENV.get('now_ai', '1')) {
                    case '1':
                        if (!AI_Cache['1']) {
                            AI_Cache['1'] = new AIS.SparkAI({
                                authKey: ENV.get('spark_ai_authKey'),
                                baseURL: 'https://spark-api-open.xf-yun.com',
                            });
                        }
                        AI = AI_Cache['1'];
                        user2 = '讯飞星火';
                        break;
                    case '2':
                        if (!AI_Cache['2']) {
                            AI_Cache['2'] = new AIS.DeepSeek({
                                apiKey: ENV.get('deepseek_apiKey'),
                            });
                        }
                        AI = AI_Cache['2'];
                        user2 = 'deepSeek';
                        break;
                    case '3':
                        if (!AI_Cache['3']) {
                            const sparkBotObject = ENV.get('sparkBotObject', {}, 1);
                            log('sparkBotObject:', sparkBotObject);
                            AI_Cache['3'] = new AIS.SparkAIBot(sparkBotObject.appId, sparkBotObject.uid, sparkBotObject.assistantId);
                        }
                        AI = AI_Cache['3'];
                        user2 = '讯飞智能体';
                        break;
                    case '4':
                        if (!AI_Cache['4']) {
                            AI_Cache['4'] = new AIS.Kimi({
                                apiKey: ENV.get('kimi_apiKey'),
                            });
                        }
                        AI = AI_Cache['4'];
                        user2 = 'Kimi';
                        break;
                }
                if (!AI) {
                    return '当前AI配置不正确，请进入设置中心-系统配置-设置当前AI'
                }
                rule.askLock = 1;
                try {
                    replyContent = await AI.ask('道长', prompt, {temperature: 1.0});
                } catch (error) {
                    replyContent = error.message;
                }
                rule.askLock = 0;
            }
            return JSON.stringify({
                action: {
                    actionId: '__keep__',
                    msg: `${user1}:` + prompt + '\n' + `${user2}:` + replyContent,
                    reset: true,
                    msgType: 'long_text',
                },
                toast: '你有新的消息'
            });
        }

        if (action === '夸克扫码') {
            if (rule.quarkScanCheck) {
                log('请等待上个扫码任务完成：' + rule.quarkScanCheck);
                return '请等待上个扫码任务完成';
            }
            let requestId = generateUUID();
            log(`[夸克扫码] httpUrl: ${httpUrl} | request_id: ${requestId}`);
            let data = (await axios({
                url: 'https://uop.quark.cn/cas/ajax/getTokenForQrcodeLogin',
                responseType: 'text',
                method: "POST",
                headers: {Referer: '', ...QRCodeHandler.HEADERS},
                data: {
                    request_id: requestId,
                    client_id: "532",
                    v: "1.2"
                }
            })).data;
            log('[夸克扫码] data:', data);
            let qcToken = JSON.parse(data).data.members.token;
            let qrcodeUrl = `https://su.quark.cn/4_eMHBJ?token=${qcToken}&client_id=532&ssb=weblogin&uc_param_str=&uc_biz_str=S%3Acustom%7COPT%3ASAREA%400%7COPT%3AIMMERSIVE%401%7COPT%3ABACK_BTN_STYLE%400`;
            log('[夸克扫码] qrcodeUrl:', qrcodeUrl);
            qrcode.platformStates[QRCodeHandler.PLATFORM_QUARK] = {
                token: qcToken,
                request_id: requestId
            };
            return JSON.stringify({
                action: {
                    actionId: 'quarkScanCookie',
                    id: 'quarkScanCookie',
                    canceledOnTouchOutside: false,
                    type: 'input',
                    title: '夸克扫码Cookie',
                    msg: '请使用夸克APP扫码登录获取',
                    width: 500,
                    button: 1,
                    timeout: 20,
                    qrcode: qrcodeUrl,
                    qrcodeSize: '400',
                    initAction: 'quarkScanCheck',
                    initValue: requestId,
                    cancelAction: 'quarkScanCancel',
                    cancelValue: requestId,
                    httpTimeout: 60,
                }
            });
        }
        if (action === 'quarkScanCheck') {
            log('quarkScanCheck value:', value);
            rule.quarkScanCheck = value;
            const state = qrcode.platformStates[QRCodeHandler.PLATFORM_QUARK];
            if (state) { // 生成二维码的时候设置了扫码id
                for (let i = 1; i <= 15; i++) {
                    if (!rule.quarkScanCheck) {
                        log('退出扫码检测：' + value);
                        return '扫码取消';
                    }
                    log('[quarkScanCheck]等待用户扫码，第' + i + '次');
                    const scanResult = await _checkQuarkStatus(state, httpUrl);
                    log('scanResult:', scanResult);
                    if (scanResult.status === 'CONFIRMED') {
                        let cookie = scanResult.cookie;
                        log('扫码成功获取到cookie:', cookie);
                        parseSaveCookie('quark_cookie', cookie);
                        rule.quarkScanCheck = null;
                        qrcode.platformStates[QRCodeHandler.PLATFORM_QUARK] = null;
                        return '扫描完成，已成功获取cookie并入库';
                    } else if (scanResult.status === 'EXPIRED') {
                        log('已过期')
                        break;
                    } else {
                        await sleep(1000);
                    }
                }
            }
            rule.quarkScanCheck = null;
            qrcode.platformStates[QRCodeHandler.PLATFORM_QUARK] = null;
            return JSON.stringify({
                action: {
                    actionId: 'quarkCookieError',
                    id: 'cookie',
                    type: 'input',
                    title: '夸克Cookie',
                    width: 300,
                    button: false,
                    imageUrl: 'https://preview.qiantucdn.com/agency/dp/dp_thumbs/1014014/15854479/staff_1024.jpg!w1024_new_small_1',
                    imageHeight: 200,
                    msg: '扫码超时,请重进'
                }
            });
        }
        if (action === 'quarkScanCancel') {
            log('用户取消扫码：' + value);
            rule.quarkScanCheck = null;
            qrcode.platformStates[QRCodeHandler.PLATFORM_QUARK] = null;
            return;
        }

        if (action === 'UC扫码') {
            if (rule.UCScanCheck) {
                log('请等待上个扫码任务完成：' + rule.UCScanCheck);
                return '请等待上个扫码任务完成';
            }
            let requestId = generateUUID();
            log(`UC扫码] httpUrl: ${httpUrl} | request_id: ${requestId}`);
            let data = (await axios({
                url: 'https://api.open.uc.cn/cas/ajax/getTokenForQrcodeLogin',
                responseType: 'text',
                method: "POST",
                headers: {Referer: '', ...QRCodeHandler.HEADERS},
                data: {
                    request_id: requestId,
                    client_id: "381",
                    v: "1.2",
                }
            })).data;
            log('[UC扫码] data:', data);
            let qcToken = JSON.parse(data).data.members.token;
            let qrcodeUrl = `https://su.uc.cn/1_n0ZCv?token=${qcToken}&client_id=381&uc_param_str=&uc_biz_str=S%3Acustom%7CC%3Atitlebar_fix`;
            // log('qrcodeUrl:', qrcodeUrl);
            qrcode.platformStates[QRCodeHandler.PLATFORM_UC] = {
                token: qcToken,
                request_id: requestId
            };
            return JSON.stringify({
                action: {
                    actionId: 'UCScanCookie',
                    id: 'UCScanCookie',
                    canceledOnTouchOutside: false,
                    type: 'input',
                    title: 'UC扫码Cookie',
                    msg: '请使用UC APP扫码登录获取',
                    width: 500,
                    button: 1,
                    timeout: 20,
                    qrcode: qrcodeUrl,
                    qrcodeSize: '400',
                    initAction: 'UCScanCheck',
                    initValue: requestId,
                    cancelAction: 'UCScanCancel',
                    cancelValue: requestId,
                    httpTimeout: 60,
                }
            });
        }
        if (action === 'UCScanCheck') {
            log('UCScanCheck value:', value);
            rule.UCScanCheck = value;
            const state = qrcode.platformStates[QRCodeHandler.PLATFORM_UC];
            if (state) { // 生成二维码的时候设置了扫码id
                for (let i = 1; i <= 15; i++) {
                    if (!rule.UCScanCheck) {
                        log('退出扫码检测：' + value);
                        return '扫码取消';
                    }
                    log('[UCScanCheck]等待用户扫码，第' + i + '次');
                    const scanResult = await _checkUCStatus(state, httpUrl);
                    log('scanResult:', scanResult);
                    if (scanResult.status === 'CONFIRMED') {
                        let cookie = scanResult.cookie;
                        log('扫码成功获取到cookie:', cookie);
                        parseSaveCookie('uc_cookie', cookie);
                        rule.UCScanCheck = null;
                        qrcode.platformStates[QRCodeHandler.PLATFORM_UC] = null;
                        return '扫描完成，已成功获取cookie并入库';
                    } else if (scanResult.status === 'EXPIRED') {
                        log('已过期')
                        break;
                    } else {
                        await sleep(1000);
                    }
                }
            }
            rule.UCScanCheck = null;
            qrcode.platformStates[QRCodeHandler.PLATFORM_UC] = null;
            return JSON.stringify({
                action: {
                    actionId: 'UCCookieError',
                    id: 'cookie',
                    type: 'input',
                    title: 'UC Cookie',
                    width: 300,
                    button: false,
                    imageUrl: 'https://preview.qiantucdn.com/agency/dp/dp_thumbs/1014014/15854479/staff_1024.jpg!w1024_new_small_1',
                    imageHeight: 200,
                    msg: '扫码超时,请重进'
                }
            });
        }
        if (action === 'UCScanCancel') {
            log('用户取消扫码：' + value);
            rule.UCScanCheck = null;
            qrcode.platformStates[QRCodeHandler.PLATFORM_UC] = null;
            return;
        }

        if (action === '阿里扫码') {
            if (rule.aliScanCheck) {
                log('请等待上个扫码任务完成：' + rule.aliScanCheck);
                return '请等待上个扫码任务完成';
            }
            log(`[阿里扫码] httpUrl: ${httpUrl}`);
            let data = (await axios({
                url: 'https://passport.aliyundrive.com/newlogin/qrcode/generate.do',
                responseType: 'text',
                method: "POST",
                headers: {
                    Referer: '', ...QRCodeHandler.HEADERS
                },
                data: {
                    appName: "aliyun_drive",
                    fromSite: "52",
                    appEntrance: "web",
                    isMobile: "false",
                    lang: "zh_CN",
                    returnUrl: "",
                    bizParams: "",
                    _bx_v: "2.2.3"
                }
            })).data;

            log('[阿里扫码] data:', data);
            const contentData = JSON.parse(data).content.data;
            let qrcodeUrl = contentData.codeContent;
            log('[阿里扫码] qrcodeUrl:', qrcodeUrl);
            qrcode.platformStates[QRCodeHandler.PLATFORM_ALI] = {
                ck: contentData.ck,
                t: contentData.t
            };
            return JSON.stringify({
                action: {
                    actionId: 'aliScanCookie',
                    id: 'aliScanCookie',
                    canceledOnTouchOutside: false,
                    type: 'input',
                    title: '阿里扫码Cookie',
                    msg: '请使用阿里云盘 APP扫码登录获取',
                    width: 500,
                    button: 1,
                    timeout: 20,
                    qrcode: qrcodeUrl,
                    qrcodeSize: '400',
                    initAction: 'aliScanCheck',
                    initValue: qrcodeUrl,
                    cancelAction: 'aliScanCancel',
                    cancelValue: qrcodeUrl,
                    httpTimeout: 60,
                }
            });
        }
        if (action === 'aliScanCheck') {
            log('aliScanCheck value:', value);
            rule.aliScanCheck = value;
            const state = qrcode.platformStates[QRCodeHandler.PLATFORM_ALI];
            if (state) { // 生成二维码的时候设置了扫码id
                for (let i = 1; i <= 15; i++) {
                    if (!rule.aliScanCheck) {
                        log('退出扫码检测：' + value);
                        return '扫码取消';
                    }
                    log('[aliScanCheck]等待用户扫码，第' + i + '次');
                    const scanResult = await _checkAliStatus(state, httpUrl);
                    log('scanResult:', scanResult);
                    if (scanResult.status === 'CONFIRMED') {
                        let cookie = scanResult.token;
                        log('扫码成功获取到cookie:', cookie);
                        parseSaveCookie('ali_token', cookie);
                        rule.aliScanCheck = null;
                        qrcode.platformStates[QRCodeHandler.PLATFORM_ALI] = null;
                        return '扫描完成，已成功获取cookie并入库';
                    } else if (scanResult.status === 'EXPIRED') {
                        log('已过期');
                        break;
                    } else {
                        await sleep(1000);
                    }
                }
            }
            rule.aliScanCheck = null;
            qrcode.platformStates[QRCodeHandler.PLATFORM_ALI] = null;
            return JSON.stringify({
                action: {
                    actionId: 'aliCookieError',
                    id: 'cookie',
                    type: 'input',
                    title: '阿里 Cookie',
                    width: 300,
                    button: false,
                    imageUrl: 'https://preview.qiantucdn.com/agency/dp/dp_thumbs/1014014/15854479/staff_1024.jpg!w1024_new_small_1',
                    imageHeight: 200,
                    msg: '扫码超时,请重进'
                }
            });
        }
        if (action === 'aliScanCancel') {
            log('用户取消扫码：' + value);
            rule.aliScanCheck = null;
            qrcode.platformStates[QRCodeHandler.PLATFORM_ALI] = null;
            return;
        }

        if (action === '哔哩扫码') {
            if (rule.biliScanCheck) {
                log('请等待上个扫码任务完成：' + rule.biliScanCheck);
                return '请等待上个扫码任务完成';
            }
            log(`UC扫码] httpUrl: ${httpUrl}`);
            const res = await axios({
                url: httpUrl,
                method: "POST",
                data: {
                    url: "https://passport.bilibili.com/x/passport-login/web/qrcode/generate",
                    headers: {
                        ...QRCodeHandler.HEADERS
                    },
                    params: {
                        source: "main-mini"
                    }
                }
            });
            const resData = res.data.data;
            // log('resData:', resData);
            if (resData.code !== 0) {
                throw new Error(resData.message);
            }
            const qrcodeData = resData.data;
            const qrcodeUrl = qrcodeData.url;
            qrcode.platformStates[QRCodeHandler.PLATFORM_BILI] = {
                qrcode_key: qrcodeData.qrcode_key
            };
            return JSON.stringify({
                action: {
                    actionId: 'billiScanCookie',
                    id: 'biliScanCookie',
                    canceledOnTouchOutside: false,
                    type: 'input',
                    title: '哔哩扫码Cookie',
                    msg: '请使用哔哩哔哩 APP扫码登录获取',
                    width: 500,
                    button: 1,
                    timeout: 20,
                    qrcode: qrcodeUrl,
                    qrcodeSize: '400',
                    initAction: 'biliScanCheck',
                    initValue: qrcodeUrl,
                    cancelAction: 'biliScanCancel',
                    cancelValue: qrcodeUrl,
                    httpTimeout: 60,
                }
            });
        }
        if (action === 'biliScanCheck') {
            log('biliScanCheck value:', value);
            rule.biliScanCheck = value;
            const state = qrcode.platformStates[QRCodeHandler.PLATFORM_BILI];
            if (state) { // 生成二维码的时候设置了扫码id
                for (let i = 1; i <= 15; i++) {
                    if (!rule.biliScanCheck) {
                        log('退出扫码检测：' + value);
                        return '扫码取消';
                    }
                    log('[biliScanCheck]等待用户扫码，第' + i + '次');
                    const scanResult = await _checkBiliStatus(state, httpUrl);
                    log('scanResult:', scanResult);
                    if (scanResult.status === 'CONFIRMED') {
                        let cookie = scanResult.cookie;
                        log('扫码成功获取到cookie:', cookie);
                        parseSaveCookie('bili_cookie', cookie);
                        rule.biliScanCheck = null;
                        qrcode.platformStates[QRCodeHandler.PLATFORM_BILI] = null;
                        return '扫描完成，已成功获取cookie并入库';
                    } else if (scanResult.status === 'EXPIRED') {
                        log('已过期')
                        break;
                    } else {
                        await sleep(1000);
                    }
                }
            }
            rule.biliScanCheck = null;
            qrcode.platformStates[QRCodeHandler.PLATFORM_BILI] = null;
            return JSON.stringify({
                action: {
                    actionId: 'biliCookieError',
                    id: 'cookie',
                    type: 'input',
                    title: '哔哩 Cookie',
                    width: 300,
                    button: false,
                    imageUrl: 'https://preview.qiantucdn.com/agency/dp/dp_thumbs/1014014/15854479/staff_1024.jpg!w1024_new_small_1',
                    imageHeight: 200,
                    msg: '扫码超时,请重进'
                }
            });
        }
        if (action === 'biliScanCancel') {
            log('用户取消扫码：' + value);
            rule.biliScanCheck = null;
            qrcode.platformStates[QRCodeHandler.PLATFORM_BILI] = null;
            return;
        }

        if (action === '百度扫码') {
            if (rule.baiduScanCheck) {
                log('请等待上个扫码任务完成：' + rule.baiduScanCheck);
                return '请等待上个扫码任务完成';
            }

            let requestId = generateUUID();
            let t3 = new Date().getTime().toString();
            let t1 = Math.floor(new Date().getTime() / 1000).toString();
            let call = `tangram_guid_${t3}`;
            log(`[百度扫码] httpUrl: ${httpUrl} | request_id: ${requestId}`);
            const res = await axios({
                url: httpUrl,
                method: "POST",
                data: {
                    url: "https://passport.baidu.com/v2/api/getqrcode",
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.61 Chrome/126.0.6478.61 Not/A)Brand/8  Safari/537.36',
                        'sec-ch-ua-platform': '"Windows"',
                        'sec-ch-ua': '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
                        'DNT': '1',
                        'sec-ch-ua-mobile': '?0',
                        'Sec-Fetch-Site': 'same-site',
                        'Sec-Fetch-Mode': 'no-cors',
                        'Sec-Fetch-Dest': 'script',
                        'Referer': 'https://pan.baidu.com/',
                        'Accept-Language': 'zh-CN,zh;q=0.9',
                    },
                    params: {
                        "lp": "pc",
                        "qrloginfrom": "pc",
                        "gid": requestId,
                        // "callback": `tangram_guid_${t3}`,
                        "apiver": "v3",
                        "tt": `${t3}`,
                        "tpl": "netdisk",
                        "logPage": `traceId%3Apc_loginv5_${t1}%2ClogPage%3Aloginv5`,
                        "_": `${t3}`
                    }
                }
            });
            const resData = res.data.data;
            log('[百度扫码] data:', resData);
            let qrcodeUrl = 'https://' + resData.imgurl;
            let channel_id = resData.sign;
            log('[百度扫码] qrcodeUrl:', qrcodeUrl);
            const qrCode = await _getQRCode(httpUrl, qrcodeUrl);
            const imageUploadUrl = imageApi + '/upload';
            log('[百度扫码] 图片上传接口 imageUploadUrl:', imageUploadUrl);
            // log('[百度扫码] qrCode:', qrCode);
            try {
                const basicHeader = createBasicAuthHeaders();
                const baiduQrcode = (await axios({
                    url: httpUrl,
                    method: "POST",
                    data: {
                        url: imageUploadUrl,
                        method: "POST",
                        headers: {
                            ...basicHeader
                        },
                        data: {imageId: 'baiduQrcode', base64Data: qrCode}
                    },
                })).data.data;
                log('[百度扫码] baiduQrcode:', baiduQrcode);
                qrcodeUrl = requestHost + baiduQrcode.data.imageUrl + `?t=${requestId}`;
                log('[百度扫码] ds代理 qrcodeUrl:', qrcodeUrl);
            } catch (e) {
                log('[百度扫码] error:', e.message);
            }
            qrcode.platformStates[QRCodeHandler.PLATFORM_BAIDU] = {
                t1: t1,
                t3: t3,
                channel_id: channel_id,
                request_id: requestId,
            };
            return JSON.stringify({
                action: {
                    actionId: 'baiduScanCookie',
                    id: 'baiduScanCookie',
                    canceledOnTouchOutside: false,
                    type: 'input',
                    title: '百度扫码Cookie',
                    msg: '请使用百度APP扫码登录获取',
                    width: 500,
                    button: 1,
                    timeout: 30,
                    imageUrl: qrcodeUrl,
                    imageHeight: 400,
                    // qrcode: qrcodeUrl,
                    // isQrcode: 1, // 告诉壳子我已经是二维码了，你不要再去生成了(图片链接或者base64文本)！！！
                    qrcodeSize: '400',
                    initAction: 'baiduScanCheck',
                    initValue: requestId,
                    cancelAction: 'baiduScanCancel',
                    cancelValue: requestId,
                    httpTimeout: 60,
                }
            });
        }
        if (action === 'baiduScanCheck') {
            log('baiduScanCheck value:', value);
            rule.baiduScanCheck = value;
            const state = qrcode.platformStates[QRCodeHandler.PLATFORM_BAIDU];
            if (state) { // 生成二维码的时候设置了扫码id
                setTimeout(() => {
                    if (rule.baiduScanCheck) {
                        rule.baiduScanCheck = null;
                    }
                }, 60000);
                for (let i = 1; i <= 5; i++) {
                    if (!rule.baiduScanCheck) {
                        log('退出扫码检测：' + value);
                        return '扫码取消';
                    }
                    log('[baiduScanCheck]等待用户扫码，第' + i + '次');
                    const scanResult = await _checkBaiduStatus(state, httpUrl);
                    log('scanResult:', scanResult);
                    if (scanResult.status === 'CONFIRMED') {
                        let cookie = scanResult.cookie;
                        log('扫码成功获取到cookie:', cookie);
                        parseSaveCookie('baidu_cookie', cookie);
                        rule.baiduScanCheck = null;
                        qrcode.platformStates[QRCodeHandler.PLATFORM_BAIDU] = null;
                        return '扫描完成，已成功获取cookie并入库';
                    } else if (scanResult.status === 'EXPIRED') {
                        log('已过期')
                        break;
                    } else {
                        await sleep(1000);
                    }
                }
            }
            rule.baiduScanCheck = null;
            qrcode.platformStates[QRCodeHandler.PLATFORM_BAIDU] = null;
            return JSON.stringify({
                action: {
                    actionId: 'baiduCookieError',
                    id: 'cookie',
                    type: 'input',
                    title: 'baiduCookie',
                    width: 300,
                    button: false,
                    imageUrl: 'https://preview.qiantucdn.com/agency/dp/dp_thumbs/1014014/15854479/staff_1024.jpg!w1024_new_small_1',
                    imageHeight: 200,
                    msg: '扫码超时,请重进'
                }
            });
        }
        if (action === 'baiduScanCancel') {
            log('用户取消扫码：' + value);
            rule.baiduScanCheck = null;
            qrcode.platformStates[QRCodeHandler.PLATFORM_BAIDU] = null;
            return;
        }


        if (action === '推送视频播放') {
            try {
                const obj = JSON.parse(value);
                return JSON.stringify({
                    action: {
                        actionId: '__detail__',
                        skey: 'push_agent',
                        // ids: encodeURIComponent(obj.push),
                        ids: obj.push,
                    },
                    toast: `开始解析视频:${obj.push}`
                });
            } catch (e) {
                return '推送视频播放发生错误：' + e.message;
            }
        }
        if (action === '推送番茄小说') {
            try {
                const obj = JSON.parse(value);
                return JSON.stringify({
                    action: {
                        actionId: '__detail__',
                        skey: 'drpyS_番茄小说[书]',
                        ids: obj.push,
                    },
                    toast: `开始解析小说:${obj.push}`
                });
            } catch (e) {
                return '推送番茄小说发生错误：' + e.message;
            }
        }
        if (action === '推送七猫小说') {
            try {
                const obj = JSON.parse(value);
                return JSON.stringify({
                    action: {
                        actionId: '__detail__',
                        skey: 'drpyS_七猫小说[书]',
                        ids: obj.push,
                    },
                    toast: `开始解析小说:${obj.push}`
                });
            } catch (e) {
                return '推送七猫小说发生错误：' + e.message;
            }
        }
        let cookie_sets = [
            'quark_cookie',
            'uc_cookie',
            'ali_token',
            'cloud_account',
            'cloud_password',
            'cloud_cookie',
            'bili_cookie',
            'baidu_cookie',
            'xun_username',
            'hide_adult',
            'thread',
            'play_local_proxy_type',
            'play_proxy_mode',
            'enable_doh',
            'enable_system_proxy',
            'enable_dr2',
            'enable_py',
            'enable_php',
            'enable_cat',
            'enable_old_config',
            'enable_rule_name',
            'spark_ai_authKey',
            'deepseek_apiKey',
            'sparkBotObject',
            'now_ai',
            'allow_forward',
            'show_curl',
            'show_req',
            'link_url',
            'enable_link_data',
            'enable_link_push',
            'enable_link_jar',
            'cat_sub_code',
            'must_sub_code',
            'mg_hz',
            'PROXY_AUTH',
            'enable_self_jx',
        ];
        let get_cookie_sets = [
            'get_quark_cookie',
            'get_uc_cookie',
            'get_ali_token',
            'get_cloud_account',
            'get_cloud_password',
            'get_cloud_cookie',
            'get_bili_cookie',
            'get_baidu_cookie',
            'get_xun_username',
            'get_hide_adult',
            'get_thread',
            'play_local_proxy_type',
            'get_play_proxy_mode',
            'get_enable_doh',
            'get_enable_system_proxy',
            'get_enable_dr2',
            'get_enable_py',
            'get_enable_php',
            'get_enable_cat',
            'get_enable_old_config',
            'get_enable_rule_name',
            'get_spark_ai_authKey',
            'get_deepseek_apiKey',
            'get_sparkBotObject',
            'get_now_ai',
            'get_allow_forward',
            'get_show_curl',
            'get_show_req',
            'get_link_url',
            'get_enable_link_data',
            'get_enable_link_push',
            'get_enable_link_jar',
            'get_cat_sub_code',
            'get_must_sub_code',
            'get_mg_hz',
            'get_PROXY_AUTH',
            'get_enable_self_jx',
        ];
        if (cookie_sets.includes(action) && value) {
            try {
                const obj = JSON.parse(value);
                const auth_code = obj.auth_code;
                const cookie = obj.cookie;
                if (!auth_code || !cookie) {
                    return '入库授权码或cookie值不允许为空!'
                }
                const COOKIE_AUTH_CODE = _ENV.COOKIE_AUTH_CODE || 'drpys';
                if (auth_code !== COOKIE_AUTH_CODE) {
                    return `您输入的入库授权码【${auth_code}】不正确`
                }
                if (action === 'sparkBotObject') {
                    try {
                        ENV.set(action, cookie, 1);
                        return `设置成功!已成功设置环境变量【${action}】的值为:${cookie}`;
                    } catch (e) {
                        return `设置失败!发送了错误:${e.message}`;
                    }
                } else {
                    ENV.set(action, cookie);
                    return `设置成功!已成功设置环境变量【${action}】的值为:${cookie}`;
                }
            } catch (e) {
                return '发生错误：' + e.message;
            }
        }
        if (get_cookie_sets.includes(action) && value) {
            try {
                const obj = JSON.parse(value);
                const auth_code = obj.auth_code;
                if (!auth_code) {
                    return '入库授权码不允许为空!'
                }
                const COOKIE_AUTH_CODE = _ENV.COOKIE_AUTH_CODE || 'drpys';
                if (auth_code !== COOKIE_AUTH_CODE) {
                    return `您输入的入库授权码【${auth_code}】不正确`
                }
                const key = action.replace('get_', '');
                const cookie = ENV.get(key);
                return JSON.stringify({
                    action: {
                        actionId: action + '_value',
                        id: 'cookie',
                        type: 'input',
                        title: key,
                        tip: `你想查看的:${key}`,
                        value: typeof cookie === 'string' ? cookie : JSON.stringify(cookie),
                        msg: '此弹窗是动态设置的参数，可用于动态返回原设置值等场景'
                    }
                });
            } catch (e) {
                return '发生错误：' + e.message;
            }
        }
        if (action === 'link_data' && value) {
            try {
                const obj = JSON.parse(value);
                const auth_code = obj.auth_code;
                if (!auth_code) {
                    return '入库授权码不允许为空!'
                }
                const COOKIE_AUTH_CODE = _ENV.COOKIE_AUTH_CODE || 'drpys';
                if (auth_code !== COOKIE_AUTH_CODE) {
                    return `您输入的入库授权码【${auth_code}】不正确`
                }
                const link_url = ENV.get('link_url');
                let data = await request(link_url);
                pathLib.writeFile('./settings/link_data.json', data);
                return '挂载数据已更新，请前往查看确保无问题';
            } catch (e) {
                return '发生错误：' + e.message;
            }
        }
        if (action === 'get_link_data' && value) {
            try {
                const obj = JSON.parse(value);
                const auth_code = obj.auth_code;
                if (!auth_code) {
                    return '入库授权码不允许为空!'
                }
                const COOKIE_AUTH_CODE = _ENV.COOKIE_AUTH_CODE || 'drpys';
                if (auth_code !== COOKIE_AUTH_CODE) {
                    return `您输入的入库授权码【${auth_code}】不正确`
                }
                let data = pathLib.readFile('./settings/link_data.json');
                let sites = [];
                try {
                    sites = JSON.parse(data).sites.filter(site => site.type = 4);
                } catch (e) {
                }
                sites = JSON.stringify(sites);
                // log(sites);
                return JSON.stringify({
                    action: {
                        actionId: action + '_value',
                        id: 'link_data',
                        type: 'input',
                        title: '已挂载的数据',
                        tip: `你想查看的挂载数据`,
                        value: 'link_data.json',
                        width: 680,
                        height: 800,
                        msgType: 'long_text',
                        msg: sites
                    }
                });
            } catch (e) {
                return '发生错误：' + e.message;
            }
        }
        if (action === '查看夸克cookie') {
            return {action: getInput('get_quark_cookie', '查看夸克 cookie', urljoin(publicUrl, './images/icon_cookie/夸克.webp')).vod_id};
        }
        if (action === '设置夸克cookie') {
            return {action: genMultiInput('quark_cookie', '设置夸克 cookie', null).vod_id};
        }

        return '动作：' + action + '\n数据：' + value;
    },

};

function getVerify(actionId, title, desc, img) {
    return {
        vod_id: JSON.stringify({
            actionId: actionId,
            type: 'multiInput',
            title: title,
            width: 640,
            msg: desc || '通过action配置的多项输入',
            input: [
                {
                    id: 'verify',
                    name: title,
                    tip: `请输入${title}内容`,
                    value: ''
                }
            ]
        }),
        vod_name: title,
        vod_tag: 'action',
        vod_pic: img || 'https://pic.qisuidc.cn/s/2024/10/23/6718c212f1fdd.webp',
    }
}

function genMultiInput(actionId, title, desc, img) {
    return {
        vod_id: JSON.stringify({
            actionId: actionId,
            type: 'multiInput',
            title: title,
            width: 640,
            msg: desc || '通过action配置的多项输入',
            input: [
                {
                    id: 'auth_code',
                    name: '入库授权码',
                    tip: '请输入.env中配置的入库授权码',
                    value: ''
                },
                {
                    id: 'cookie',
                    name: title,
                    tip: `请输入${title}内容`,
                    value: ''
                }
            ]
        }),
        vod_name: title,
        vod_tag: 'action',
        vod_pic: img || 'https://pic.qisuidc.cn/s/2024/10/23/6718c212f1fdd.webp',
    }
}

function getInput(actionId, title, img, desc) {
    return {
        vod_id: JSON.stringify({
            actionId: actionId,
            id: 'auth_code',
            type: 'input',
            title: '入库授权码',
            tip: '请输入.env中配置的入库授权码',
            value: '',
            msg: desc || '查看已设置的cookie需要授权码',
            // imageUrl: img || 'https://pic.imgdb.cn/item/667ce9f4d9c307b7e9f9d052.webp',
            imageUrl: img || 'https://pic.qisuidc.cn/s/2024/10/23/6718c212f1fdd.webp',
            imageHeight: 200,
            imageType: 'card_pic_3',
        }),
        vod_name: title,
        vod_tag: 'action',
        vod_pic: img || 'https://pic.qisuidc.cn/s/2024/10/23/6718c212f1fdd.webp',
    }
}

function parseSaveCookie(key, value) {
    let cookie_obj = COOKIE.parse(value);
    let cookie_str = value;

    if (['quark_cookie', 'uc_cookie'].includes(key)) {
        // log(cookie_obj);
        cookie_str = COOKIE.stringify({
            __pus: cookie_obj.__pus || '',
            __puus: cookie_obj.__puus || '',
        });
        log('入库的cookie:', cookie_str);
    }
    // 调用 ENV.set 设置环境变量
    ENV.set(key, cookie_str);
}


function arrayBufferToBase64(buffer) {
    // 将 ArrayBuffer 转为 Uint8Array（字节数组）
    const bytes = new Uint8Array(buffer);
    // 将每个字节转为字符，拼接成字符串（需确保二进制安全）
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    // 用 btoa 将二进制字符串转为 Base64（btoa 支持单字节字符串）
    return btoa(binary);
}

async function _getQRCode(httpUrl, url) {
    let arrayBufferData = await axios({
        url: httpUrl,
        method: "POST",
        data: {
            url: url,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.61 Chrome/126.0.6478.61 Not/A)Brand/8  Safari/537.36',
            },
            responseType: 'arraybuffer'
        }
    });
    let base64Images = arrayBufferToBase64(arrayBufferData.data.data.data)
    return 'data:image/png;base64,' + base64Images;
}