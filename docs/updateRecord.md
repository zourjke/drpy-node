# drpyS更新记录

### 20260314

更新至V1.3.28

1. 合并zy佬在mcp服务上做的一些更新
2. 优化 drpyS内存开销，杜绝无限内存增长，实测 pm2运行的ds经历多轮源可用性测试后仍旧可以 长期低于 400mb内存占用
3. 优化本地bundle包几乎完美
4. 优化阿里和UC网盘解析
5. 处理了一些失效的源

### 20260301

更新至V1.3.27

1. 移除py源需要的`ujson`依赖，优化py源`资源管理.py`

### 20260228

更新至V1.3.26

1. `Emby[优].js` 改为传参源，可以从map.txt扩展其他emby资源站
2. cat源支持不带init方法
3. 新增一些听音乐源与短剧源与漫画源
4. 增加 py版本的资源管理源，支持管理安卓系统资源

### 20260225

更新至V1.3.25

1. 适配皮卡丘短剧模式
2. 修复vercel部署运行问题

### 20260214

更新至V1.3.24

1. 新增 `drpy-node-mcp` 方便AI维护本项目，不局限于写源
2. 新增 `drpy-node-bundle` 实现ds本地化免服务器运行

### 20260212

更新至V1.3.23

1. 支持 `doh`,自动识别系统代理，类似python的`requests`库。新增了相关的依赖文件
2. 增加了 `包子漫画` 等源

### 20260208

更新至V1.3.22

1. 增强海阔`跳过形式二级` 功能适配更多壳子，配置/首页分类接口会返回 `mergeList` 属性代表此源可以合并
2. 修改了支持合并属性的历史源，壳子适配后可以把一级列表数据合并后在详情页顺序播放
3. dr2 fast模式支持，需要爱佬修改版的so,加解密性能提升，补充缺失的文件 `public/dist/drpy-core-fast.min.js`,当
   `enable_dr2 = 2` 时走这个逻辑

写法说明:

1. ds/dr2 源里写了 `rule.二级 = '*'` 或者 `rule.mergeList = 1`,自动生成配置会自动处理
2. 所有源(不含php),文件头@header里有 `mergeList = 1` 或者 `more.mergeList = 1`

### 20260131

更新至V1.3.21

1. 更新一点文档和文件名称
2. 修复番茄动漫ds源在皮卡丘壳子上无法使用问题(
   BUG羊的壳子tid为链接时处理逻辑一团乱，http链接被篡改成https就算了，链接含有{{page}}变量竟然被篡改成1了)
3. 更新文档、生成配置类型，使php、py源也更兼容皮卡丘的漫画小说

### 20260127

更新至V1.3.20

重磅升级来了!!!

1. 支持了php适配器，支持自动加载php源，环境变量新增 `PHP_PATH=`,如果不指定默认则是'php',可以配置成自己的路径
2. 尝试启动加速，插件异步加载
3. 启动日志大幅精简，还你一个干净清爽的启动界面
4. 设置中心修改，支持启用/关闭 PHP的源

### 20260125

更新至V1.3.19

1. 合并了E佬修复&新增的源
2. 增加了PHP的T4源标准

### 20260118

更新至V1.3.18

1. 合并E佬修改的源，新增&修复源
2. 新增drpy2-fast壳依赖，需自行适配爱老so文件，取消不可用的dr2的t4模式，改为使用drpy2-fast本地依赖
3. 规范一些小说源的代码，确保统一返回了类型:'小说'
4. 修改了index.js中的start、stop函数确保有返回值，适配新版zy本地插件
5. 调整了部分内置解析  
   其它细节自测...

### 20260115

更新至V1.3.17

1. 新增一些源 & 修复一些源

### 20260113

更新至V1.3.16

1. 新增全局 `executeParse` 函数，ds/cat源可实现获取本地自建解析链接
2. 写源说明文档里增加了其它几种语言的 htmlParser实现，可供参考
3. 更新了部分源

### 20260112

更新至V1.3.15

新年第一次更新版本

1. 合并了TG出名人物'E佬' 提供的几十个DS、hipy、cat源
2. 优化websocket日志插件，显示可以不显示心跳日志，并且大量日志也不会造成屏幕一闪一闪亮晶晶了
3. 修复APP模板配置里的乱码

### 20251017

一生一世最强版

更新至V1.3.14

1. 升级drplayer支持斗鱼直播弹幕!实时弹幕(已知bug,关闭弹幕再开不行得刷新页面，没事一直开着就好)
2. 增加完美的实时日志机制
3. 给弹幕类ws协议开放额外的57575端口，写源需要把 `hostname` 换成 `wsName`

行了，进度可以打上100%了。

### 20251015

更新至V1.3.13

1. 尝试解决`原代服`造成的内存泄露问题
2. 更新drplayer

### 20251014

更新至V1.3.12

内置RSA极限优化

1. 将原本ds内置的 `RSA` 替换成一个更快的实现，一端json长文本解密从 `480ms` 减少到 `44ms`
2. 更新pyenv搭建说明

### 20251013

更新至V1.3.11

一个更激进的版本

1. 优化所有代理相关文件，尝试解决内存泄露问题
2. 修复drplayer播放时存在的各种奇葩问题。如代理切换消失、重复多次执行下一集

### 20251012

更新至V1.3.10

1. 支持 `hipy` 版 `emby`
2. 升级 `drplayer`，支持聚合搜索
3. 升级 `drplayer`，支持书画柜完整功能、下载器功能，完美下载小说并支持合并导出txt文件或加入书画柜

### 20251010

更新至V1.3.9

1. 引入2个ds可用的函数 `get_size` `toBeijingTime`
2. 优化ftp与webdav
3. 升级drplayer支持全局动作

### 20251008

更新至V1.3.8

1. 增加文件代理播放服务，支持 `m3u8` 及全部直链文件如`mp4` `mp3` `mkv`的代理访问
2. 更新drplayer,支持详情页完整push://协议(选集直接push://和免嗅探返回的push://)，修复详情返回后筛选消失的bug

### 20251007

更新至V1.3.7

1. 增加一个cat源 `爱玩音乐.js`,补齐缺失的 `lrcToSrt` `strExtract` 并注入到drpys沙箱环境和cat全局变量
2. 增加了 `ftp`,`webdav`协议支持和相关的源
3. 升级drplayer到最新版本，支持多级目录及ftp、webdav源

### 20250927

更新至V1.3.6

1. 引入SPA静态应用支持，drpys插件支持vue部署的静态应用
2. 增加一个 `drplayer` 插件

### 20250925

更新至V1.3.5

1. 修复 `DS_REQ_LIB=0` 时 req系列请求不能正确处理禁止重定向和超时问题
2. 修复 `cut` 逻辑错误导致的`番茄小说`二级无数据，增强字符串的`parseX`改用`JSON5`
3. 新增 `网盘` 模板源及map示例
4. 新收录了几个源
5. 增加 `mergeList` 属性，允许海阔跳过T4源的形式二级
6. 修复百度盘特殊路径(如含#)的选集解析与播放

### 20250919

更新至V1.3.4

1. 修复dr2，并移除了dr2目录下几个坏了的源
2. 增加可可影视和几个小说ds
3. 开发了一个脚本 `scripts/python/compare_source.py` 可以用来处理重复的js文件

### 20250918

更新至V1.3.3

1. 从js目录移除年久失修坏了的DS源
2. 从map移除坏了的hipy源
3. 项目全部代码完善注释
4. 参加屎山代码评测，得到一个较好的成绩。具体结果参见 [DS项目代码评估报告](codeCheckReport.md)

### 20250916

更新至V1.3.2

1. 完善ds源解析能力，常规方法 `分类` `首页` `二级` `搜索` `免嗅` 支持 `js:`语法和 `$js.toString(async () => {});` 构造器
2. 优化推送，`百度` 类盘缩短线路名称和选集按钮名称
3. 增加了一个 `日历时钟插件` 和 `完结撒花特效插件`
4. 增加了 py的 `哔哩` 源作为示例 (源文件变量混淆贼恶心，一通修改)
5. 总开发进度再次提升， 更接近 `100%`

### 20250914

更新至V1.3.1

1. 合并 `秋秋` 的百度盘解析逻辑，无需转存直接播放，直接原画多线程，工具命名为 `Baidu2`,已同步加入到推送工具里
2. 将 `百度盘[搜].js` 里的解析引擎更改为 `Baidu2` ，直接通过扫码插件得到的cookie可用
3. 修复两个hipy模块源
4. 源可用性检测工具增加进度条百分比回显和耗时统计
5. 增加源json配置编辑器插件
6. 修复`荐片`(换域名了)
7. 修复 `番茄小说` 宝盒因为缺少返回章节标题导致的不可看正文问题
8. 设置中心增加百度扫码
9. 新增图片储存插件(内存版，兼容vercel)
10. 紧急撤包，修复图片接口的安全性问题

### 20250913

更新至V1.2.30

1. cookie管理插件增加百度网盘扫码
2. 整理drpyS相关代码，细节拆分utils里的pan,为1.3版本做准备
3. 修复 `360影视` 返回的待解析链接去除 ?参数导致的优酷链接错误问题，以及相关的vodDeal函数
4. 重构drpyS代码，优化内存占用
5. 暴露 `base64Encode` `base64Decode` `gzip` `ungzip`  `atob`  `btoa` 等函数给cat源使用
6. 移除不再使用的 `views` 目录，把编解码工具移至插件目录
7. 减少内存占用，增加完善的html缓存和清理机制

### 20250911

更新至V1.2.29

1. 支持模板继承匹配，包括自动模板
2. 支持模板源搜索自动过验证
3. 修复首页和首页推荐接口多次请求问题
4. 删除已兼容为ds协议的dr2源

### 20250910

更新至V1.2.28

1. 升级drpyS 兼容drpy2的 二级*,二级object,一级class_parse字符串写法。
2. 把某些dr2源简单修改为ds源作为示例
3. 已修复 `pdfl` 函数逻辑错误
4. 修复并发解析逻辑错误
5. 支持drpy2模板继承源(自动除外)，待适配
6. 移除drpy2的t4适配器和一些不再需要的bug版本代码,不在计划dr2源提供T4服务，请尽快升级为ds协议

已知问题: 缺少drpy2搜索自动过验证功能

### 20250908

更新至V1.2.27

1. 尝试修复文件头写入可能导致清空原文件内容问题
2. 增加源可用性检测插件
3. 修复 `pinyin` 库调用方式
4. 所有DS接口支持跨域调用，增加更多可玩性，如网页直接调用ds的接口
5. 所有DS接口增加超时返回机制，确保不会出现接口假死现象(接口待机无限黑洞就是不返回数据)

### 20250907

更新至V1.2.26

1. 从源动力进货，顺带改个版本号，源动力域名已更换，点此访问[源动力](https://tvshare.cn/)
2. 优化通用网页脚本(油猴插件)

已知Bug: 没重启的情况下直接丢js文件进去，可能会产生文件头处理bug，被清空文件只剩下头  
本次更新没提升进度

### 20250905

更新至V1.2.25

1. 更新 `百度盘` 插件及相关资源
2. 增加几个ds源
3. 增加一个Hipy模板
4. 修复设置中心扫码类动作错误
5. 完善hipy测试用例文件: `base_test.py`
6. 全部T4本地代理接口传入`extend` 参数保证模板源可以正常代理
7. 修复猫爪兼容性问题，完美支持hipy t4
8. 制定新Hipy标准-所有模板类hipy源(即map.txt传参源)，重新规范所有hipy模板源代码。
   必须写下面代码，禁止直接定义类共享变量防止多个实例同时使用出问题,其他非模板源允许定义类共享变量:

```python
def __init__(self, query_params=None, t4_api=None):
    super().__init__(query_params=query_params, t4_api=t4_api)
    self.自定义变量 = {}
```

### 20250903

更新至V1.2.24

1. 新增 `智能剪切板管理` 插件
2. 优化首页界面的超链接布局
3. 修复 `robots.txt` `favicon.ico` 路由错误

### 20250902

更新至V1.2.23

1. 新增猫爪专属订阅码设置，默认为all,设置中心-接口挂载可以配置猫爪订阅码
2. 增加严格订阅码模式(启用此开关所有配置地址sub=没填或者不在已有订阅码中都无法访问，不启用则保持以前逻辑显示全部源)
3. ds源写法更新，支持 `推荐` `一级` `搜索` 按字符串快捷写法同dr2
4. 根目录 `plugin.example.js` 改名为 `.plugins.example.js`,`plugin.js` 改名为 `.plugins.js`,解决打包7z缺少plugin.js导致ds启动失败问题

### 20250901

更新至V1.2.22

1. 支持同名二进制插件多开
2. 文件头支持更多信息(作者、类型)
3. 合并更新二群 `ƪ(˘⌣˘)ʃ优雅` 提供的百度网盘播放插件，需要用户环境变量env.json里配置 "baidu_cookie": "百度ck",
   需要`BDUSS`,`STOKEN`,`ndut_fmt` 三个字段,测试源为 `多多[盘]`
4. 设置中心同步增加百度cookie设置

### 20250829

更新至V1.2.21

1. 完善二进制插件运行机制,linux上会自动处理权限问题
2. 合并老三写的安装卸载脚本

原本不想发新版的，但是这个代码也比较关键，勉为其难更新一下

### 20250825

更新至V1.2.20

1. 守护进程把`json` 换成 `ujson` 提高数据交互性能
2. 实验性修改 ds源的 `req` 实现，把`axios`底层请求库换成 `fetch`，解决一些请求网页源码出现的问题（七猫DS已复活）
3. 日志优化，减少lazy执行结果打印的文本长度
4. 新增环境变量参数说明文档 [DS项目环境变量说明](/docs/envdoc.md)
5. 守护进程启动时的空链接error降级为warning

特殊说明: 可以从 [这里](https://github.com/hjdhnx/drpy-node/releases/tag/binary-0825) 下载binary二进制解压到根目录。
安卓端termux可以直接用，宝盒和装逼壳等壳子需要用自定义插件方式运行(
目录注意改一下如binary1不然安termux方式用会导致无法启动服务)

### 20250824

更新至V1.2.19

1. 给hipy源写了一个测试示例,详见文件: `spider/py/base_test.py`,方便py写源时候本地调试
2. 修改了 `spider/py/base/requirements.txt` 添加必要的注释
3. 增强了脚本 `spider/py/core/kill_t4_daemon.sh` 的杀进程能力
4. 修复 `荐片`
5. 增加脚本 `autorun.ps1` `uninstall.sh`,方便ds运维
6. 设计了新的js版守护进程桥接程序 `spider/py/core/bridge.js`，同时让守护进程输入数据支持json协议，也许会大幅度提升hipy性能
7. 修改局域网地址获取逻辑，避免获取到vmware的虚拟网段

注意:本次更新新增了一个nodejs依赖 `pickleparser`，需要执行一次`yarn`命令

### 20250823

更新至V1.2.18

1. 优化python守护进程启动逻辑，无python环境的设备启动ds速度会有所提升
2. 修了ds的 `荐片` 和 `ikanbot`
3. 可以在配置里自行选择守护进程版本
4. 新增 `七猫小说[书]` 的hipy源，移除同名的ds源

注意事项:本次更新有新增python依赖，大家请注意装一下py依赖

### 20250822

更新至V1.2.17

1. 增加一堆 `hipy` 模板源 和相关APP模板
2. hipy spider 增加 `setCache` `getCache` 函数
3. map.txt 分隔符从 `@` 改为 `@@`
4. 优化hipy守护进程执行逻辑，改善性能、稳定性、内存管理

### 20250821

更新至V1.2.16

1. 增加一堆 `hipy` 源
2. 增加 `live2cms.json` 增加一条本代线路
3. 猫源解析引擎默认 0 和 1 都视为url模式，以前base64模式有Bug调整 `CAT_DEBUG=2` 开启
4. 完善hipy源和cat源的map传参机制，map里传参分发源，不用手写配置文件的ext
5. 修复 `猫爪` 软件不支持 源的ext为object对象的问题
6. 设置中心增加 `兼容性配置` 开关，目的是让配置带object的场景自动变成字符串用于兼容老旧的壳子

已知bug(待壳子适配):

1. 宝盒不支持ext直接传链接，即使是外网它也会去访问ext然后把源码丢给后续请求导致不正确(drpyHiker和装逼壳子正常)
2. drpyHiker不支持ext传递object类型，json层面没有进行object转json操作，导致后续接口请求用的 [object Object]

### 20250819

更新至V1.2.15

1. 通过信号监听机制保证linux的pm2管理能正常结束hipy的守护进程
2. 增加哔哩少儿
3. 增加 `风车动漫` cat源
4. 优化 `index.js` 代码结构，静态目录定义移动至 controllers中的 `static.js`

### 20250818

更新至V1.2.14

1. 修复 cat源内import assets库处理逻辑错误，推荐环境变量开启 `CAT_DEBUG=1`
2. 重构py源执行逻辑，确保代码健壮性和py执行性能最强。
3. 尝试修复 vercel没写文件权限导致的整个项目无法启动问题（vercel无法支持py源)
4. 修复两个py源

### 20250817

更新至V1.2.13

支持hipy源T4,参考[python环境](/docs/pyenv.md) 进行python依赖安装。
需要保证终端输入 `python` 能正常识别到即可(保证本地安装了python并且有环境变量)

1. 增加 `hipy` 适配器
2. 新增依赖 `python-shell` 需要手动安装
3. 统一libs接口 `cate` 改为 `category`
4. 修复了 定时任务 `execute-now` 接口返回数据错误
5. 目前py源的T4支持 ext扩展、getDependence依赖、以及 本地代理 和 动作，凑合能用，代码实现很狗屎。

### 20250815

更新至V1.2.12

关键更新说明: 前面版本不支持cat源内import其他依赖，相对路径都不支持更别说 assets开头的了。
此版本解决了，用法跟壳子一样，支持`assets://`（映射到spider/catLib） 和相对路径 `./` `../`开头的依赖

1. 修复 `番茄小说` 分类 by 二群 `ƪ(˘⌣˘)ʃ优雅`
2. 修复 `抖音弹幕直播` by 二群 `ƪ(˘⌣˘)ʃ优雅`
3. catvod猫源支持import assets开头依赖，ds非调试模式下已经补齐依赖。
4. 增加 `esm-register.mjs` 通过拦截import导入的esm模块，实现猫源的 `assets:` 导入识别，路径映射到 `spider/catLib`
5. 增加 cat源 `河南电视代理.js` 用于演示正确的猫源本代写法。action也支持。
6. 修复猫源T4首页推荐数据问题。

### 20250814

更新至V1.2.11

1. 定时任务 增加 `QQ邮箱` 的消息推送方式
2. `cat源` 增加调试模式，但是不支持 `getProxyUrl` 等方法，需要在环境变量.env文件里启用 `CAT_DEBUG=1`。
   详情参考 [猫源调试教程](/docs/catDebug.md)
3. `getProxyUrl` 换成 `getProxy`，兼容T3猫源使用壳子的本地代理,修复 `央视大全` 错误的本地代理获取
4. 修复`番茄小说` 的正文阅读和搜索。分类接口坏的没能力修。央视最新视频高清下载方案目前只有通过 [
   `CCTV-GO`](https://wwvy.lanzouo.com/ieEq533kiofe) 包含的 `cbox.exe` 本地解密，无法适配本项目。

### 20250813

更新至V1.2.10

1. 调整首页的文档超链接，定时任务从接口文档里抽出来，订阅过滤内的自动带pwd。文档 /docs 路由增加basic验证防止被盗用接口
2. 定时任务 /tasks路由返回信息的lastrun和nextrun显示优化，从UTC时间改成北京时间
3. 尝试支持cat源的本地代理功能，增加`getProxyUrl` 函数,T4增加 `ENV` 对象
4. 去除 `adapt` 属性 改为 `do` 属性

### 20250812

更新至V1.2.9

已知bug: cat源动态修改代码后如果没重启后端服务，修改的内容不生效(通过打日志看出来的，原因是esm模块缓存)  
因此代码里通过`?v=文件hash值` 绕过esm缓存机制，不确定会不会造成内存占用问题。  
定时任务脚本也存在类似问题，但是没做绕过，必须重启服务。

```javascript
const scriptUrl = `${pathToFileURL(filePath).href}?v=${fileHash}`;
```

1. py和猫源支持头信息处放ext扩展参数
2. cat猫源支持T4模式(需要设置中心enable_cat设置为2)
3. cat t4源支持使用 `req` `jsoup` 等对象，由于drpyS导入在前，理论上drpyS里所有globalThis暴露的变量都可以用

### 20250810

更新至V1.2.8

1. 引入 `cron` 依赖，支持定时执行执行 `scripts/cron` 下的脚本
2. 优化未含sub订阅码时自定义源排序不生效的问题
3. 完善两套实用定时任务 `可转债打新提醒` `国内每日新闻`，可根据配置开启消息通知

### 20250808

更新至V1.2.7

catvod源支持，更新部分源

1. 把月亮影视的底裤扒了，它的源配置为我所用 `采集2025静态.json`
   ，原链接为[moontv](https://github.com/LunaTechLab/MoonTV/blob/main/config.json)
2. spider/catvod目录新增原生js支持
3. 增加 & 修复源

### 20250805

更新至V1.2.6

由于上个版本实验性启用drpy2源t4风格接口，用户反馈极差，Bug难以修复，此版本弃用上版的drpy2解析逻辑

1. 移除原drpy2解析逻辑，预留解析libs，待后面实现
2. 优化代码风格，全局导入问题
3. 增加源

### 20250804

更新至V1.2.5

1. 修复 `央视大全.ds`
2. 新增 `爱看机器人`、`凤凰FM`、`天空影视` 等源
3. dr2接口模式增加 T4风格 by `涵晓`,实验性特性，存在同步接口性能问题，按需开启(设置中心把允许dr2值设置为2)
4. package.json 新增显式依赖项

### 20250801

更新至V1.2.4

1. 提供drpy-core轻量版，体积不到700kb
2. 删除多余的drpy2相关文件

### 20250729

更新至V1.2.3

1. drpy2接口增加 `buildQueryString` `TextEncoder` `TextDecoder` `WXXH` `WebAssembly`
2. drpy2 依赖库打包成一个 `drpy-core.js`

具体打包过程参考：[drpy2打包项目](https://github.com/hjdhnx/drpy-webpack)

### 20250728

更新至V1.2.2

1. 文件头增加 lang 属性，方便区分加密情况下这个源是哪张类型，`ds` `dr2` `hipy`
2. 修复日志输出到文件在轮转时乱创文件夹问题
3. drpyS 增加 `buildQueryString` 函数
4. 增加drpy2的api，相关文件路径在 `public/drpy2`

### 20250727

更新至V1.2.1

1. 移除过时的pinyin库(`pinyin` 库依赖的 `nodejieba` 跑路了)
2. 同步 `秋秋` 提供的代码，主要涉及新增了 `node-forge` 库，优化了几个网盘工具类
3. ds写源文档增加了对 `action` 交互动作的详细图片说明
4. 首页配置接口链接增加动态密码注入，设置密码的场景不需要手动改?pwd=
5. 配置文件生成的名称提供了选项，默认改回按文件名(可选按源里设置的名称)
6. 通过全局监听器解决了由于部分源 如 `番薯动漫` 内的异步错误导致的进程崩溃问题
7. 所有源增加文件头，用于后续加载过程快速生成配置,首次加载配置提速:`6500ms -> 120ms`
8. 修改对应的加解密函数支持带文件头的源解密
9. `getOriginalJs` 修改为异步函数

### 20250726

更新至V1.2.0

1. 目录结构调整，各个类型的源迁移到 spider目录
2. 新增对json目录的文件修改监听功能，使得json目录变化立即生效无需重启
3. 新增appGet系列模板
4. 新增py文件自动生成配置(hipy_t3)
5. 优化生成配置中的name，js优先取title,py取getName，最后取文件名
6. 重构ds源require函数，现在引入相对目录的_lib可以直接写require(./_lib_xxx.js)
7. 优化$函数的加载时点，更加规范，不再自调用
8. pathLib新增readLib函数，可用于读取dr2目录下的_lib文件，无需fs.readPath
9. 设置中心增加对PY源是否挂载的设置，默认挂载

### 20250310

更新至V1.1.23

1. 修复番茄小说
2. 新增2个源

### 20250227

更新至V1.1.22

1. 优化123网盘的逻辑和推送示例
2. 优化sqlite3库兼容装逼壳

### 20250226

更新至V1.1.21

1. 增加123网盘的逻辑和推送示例

### 20250225

更新至V1.1.20

1. UC整体逻辑修改，并在扫码插件增加了UC_TOKEN扫码逻辑
2. 数据库sqlite3优化，寻找另一个wasm实现的库平替了兼容性极差的sqlite3原生库

### 20250224

更新至V1.1.19

1. 修复 推送和所有网盘源涉及的UC播放问题，支持原代本和原代服务加速
2. 更新猫爪的 alist.js
3. 新增 `sqlite` `sqlite3` 依赖，在ds源里的异步方法里直接使用，示例:

```javascript
await database.startDb();
console.log('database:', database);
const db = database.db;
// 创建表
await db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    )
  `);

// 插入数据
await db.run('INSERT INTO users (name) VALUES (?)', ['Alice']);
await db.run('INSERT INTO users (name) VALUES (?)', ['Bob']);

// 查询数据
const users = await db.all('SELECT * FROM users');
console.log(users);

// 更新数据
await db.run('UPDATE users SET name = ? WHERE id = ?', ['Charlie', 1]);

// 查询更新后的数据
const updatedUsers = await db.all('SELECT * FROM users');
console.log(updatedUsers);

// 删除数据
await db.run('DELETE FROM users WHERE id = ?', [2]);

// 查询删除后的数据
const finalUsers = await db.all('SELECT * FROM users');
console.log(finalUsers);
await database.endDb();
```

### 20250211

更新至V1.1.18

1. 新增 `16wMv.js`
2. drpyS支持库升级，新增获取首字母拼音的函数 `getFirstLetter`

### 20250206

更新至V1.1.17

1. parses.conf增强，支持{{host}} 与 {{hostName}} 变量，可以配置同机器服务下的其他端口php解析
2. 设置中心新增解析 视频解析设置栏目，暂时可以设置 `芒果关解` 视频分辨率

### 20250123

更新至V1.1.16

1. 原代本增强，支持模式切换 `5575` 和 `7777`,原7777模式
   需要自己开mediaGo,新的默认模式采用不夜加速，装逼壳直接起飞，无需外挂服务(多个壳子同时用可能会端口冲突，待验证)
2. 设置中心-系统配置 增加 设置原代本类型，现在不设置就默认是不夜加速
3. 设置中心-接口挂载 增加设置允许挂载jar,默认关闭，设置为1可以使用挂载配置里的jar
4. 更换默认的epg地址
5. 新增源 `iptv.js`
6. 更新 `直播转点播[合].js` 支持配置文件自定义请求头
7. 修复 `金牌影院.js`、新增源动力出品的 `短剧库.js`
8. 修复ds猫视频不夜源 `黑木耳克隆|T4` 等一级筛选不讲规则返回的不是列表导致的兼容性问题
9. ds猫支持不夜多线程磁盘加速

### 20250122

更新至V1.1.15

1. ds源和dr2源增加装逼壳图标支持
2. 直转点加了一条记录
3. 打包7z脚本排除本地挂载的外部T4数据
4. ds猫源适配不讲规矩的不夜T4
5. 挂载数据默认值改为不启用
6. 修复移动盘播放问题
7. 不夜的推送不讲规矩，只支持get不支持post，需要壳适配。一级不讲规则，ac只能detail才有数据，list/videolist不行
8. 统一挨着修改网盘源，增加二级数据返回 vod_play_pan，按$$$分割的原始网盘链接，包括push也有效，方便海阔本地小程序播放
9. 增加 [源动力](https://sourcepower.top/source) 官方出品的`短剧库.js`
10. 设置中心推送视频去掉编码，交给壳子处理，防止双层编码导致的问题

### 20250121

更新至V1.1.14

1. 猫源ds在线配置支持接口密码
2. 修复移动网盘工具类(移动1可以，2和3还是不行)
3. 新增 [源动力](https://sourcepower.top/source) 官方出品的两个源 `麦田影院.js` `凡客TV.js`
4. 设置中心增加接口挂载功能，可以挂载hipy-t4和不夜t4(box在线配置)
5. 多线程播放加速新增 磁盘加速模式

### 20250120

更新至V1.1.13

1. 完善猫源ds在线配置

### 20250119

更新至V1.1.12

1. 支持猫源在线配置

使用教程:

- [点这里跳进去后复制地址](/config/index.js.md5)
- 回来后手动处理地址: 在http:// 中间插入授权验证，比如 admin:drpys@
- 举例: 你复制的地址： `http://127.0.0.1:5757/config/index.js.md5`
- 举例: 你手动处理后放猫里的的地址： `http://admin:drpys@127.0.0.1:5757/config/index.js.md5`

### 20250117

本次未更新版本

1. 新开项目，使ds源适用于新版猫影视 [猫爪catpwd](https://github.com/CatPawApp/CatPawOpen)

### 20250116

更新至V1.1.11

1. 更新天翼和移动网盘工具类
2. 新增哔哩大杂烩
3. 优化push_agent
4. 修复 雷鲸小站
5. 央视大全推荐页增加直播，卡卡的但是能凑合看

### 20250115

更新至V1.1.10

1. 重构天翼网盘工具类
2. 新增移动网盘工具类
3. 增加 `JSONbig` 和 `JsonBig` 来处理json解析文本中包括很长的整数值问题
4. 新增 nodejs依赖项 `crypto-js` `json-bigint`

### 20250114

更新至V1.1.9

1. dr2源接口api改为 `assets://js/lib/drpy2.js` 确保含有内置drpy2的壳子可以正常使用
2. 设置中心隐藏天翼cookie的设置功能，防止因为错误设置导致的封ip
3. 更新秋秋最新提供的天翼盘工具类和配套站
4. 增加了一些dr2的听书源
5. 修复&新增几个优质源
6. 设置中心推荐页面增加源内搜索动作示例

### 20250113

更新至V1.1.8

此版本包含重要更新，强烈推荐。以下是重点强调:

- drpy2 t3源已经非常成熟，道长将会很长时间内不再维护，以下简称dr2源。
- 海阔视界，zyplayer,easybox等软件积极适配，已经有成熟的内置dr2方案。
- 所以道长将dr2源与本项目融合，本项目不再提供dr2源的api请壳子使用内置dr2方案运行本项目含dr2源的配置订阅链接。
- 某些壳子不支持或者不想使用dr2源的用户可以在设置中心-系统配置-配置是否启用dr2源配置
- dr2源优势明显，至少5年内不会弃用。且少部分地方存在超越ds的优势(http2，玄学过cf等)，zy写此类源非常快，因此作为壳子内置的标准使用。
- dr2源新项目赋能：可以通过push://协议使用ds的推送方案，支持ds的订阅机制、排序、传参方案

1. 新增天翼网盘相关配置和解析逻辑及配套源
2. 支持挂载drpy的js自动生成t3配置并放置了几个示例源,固定目录在 `js_dr2`

### 20250112

今日无更新,但是做了一些相关技术性研究

1. `drpyInject.js` req系列函数支持拦截器打印转换的curl命令
2. 添加 `低端[盘].js` 尝试解决cf导致的获取源码错误问题以失败告终(
   py的requests也请求不到源码，我也很绝望,还研究了axios升级http2协议也没卵用，不知道是请求头哪儿的差异，dr2的js正常用，想不明白了)
3. 研究 `好乐影视.js` 不正常问题，发现请求到的源码里面都是一些location.href=的链接跳转，浏览器访问网站当然没问题，写成源一脸懵逼，没啥好办法。

### 20250111

更新至V1.1.7

1. 生成的订阅配置增加风景壁纸接口可供壳子切换
2. lazy传入的this指向里的input和MY_URL在非http链接的情况下取消自动url解码逻辑，应对特殊场景解码后加号丢失问题
3. 设置中心接入了新的AI：kimi,并全面升级所有AI都支持上下文连续对话，最多20条聊天记录
4. 连续对话增加快速输入新的对话
5. 新增 & 修复源
6. 优化 batchFetch 函数的性能开销
7. 新增 `小米盘搜[搜].js`
8. 统一给所有函数的this指针绑定HOST变量
9. 紧急修复了一个bug，影响全局的接口query解析

### 20250110

更新至V1.1.6

1. 更新 `虎斑[盘].js` 域名
2. `req` 底层请求函数优化，确保错误返回时可以取到返回的html内容
3. `火车太堵`原域名访问有cf验证了无法获取源码没法修了，现在更换一个域名
4. 修复示例代码 `360test.js` 运行错误
5. `moduleExt` 增加默认值为空字符串而不是 `undefined`
6. 不允许在源或者解析里写 `const axios = require('axios');` 会出现无法解决的问题
7. 增加一个密源
8. 尝试修复解析 `虾米.js` 以失败告终，解出来ip开头的地址还是无法播放
9. 增加 `config/parses.conf` 用于手动配置web解析和json解析
10. 更新所有网盘源的搜索，为套娃党的粗心擦屁股

已知bug:

1. 装逼壳搜索不支持传参源，采王系列无法获取结果，easybox正常

### 20250109

更新至V1.1.5

1. `.env` 增加 `MAX_TASK`参数，配置系统多任务数限制，默认不设置则为2，解决低端设备如arm盒子访问配置崩溃问题。高端设备实测发现设置为8比较快
2. 自建解析功能增强，支持自定义其他参数，增加两个示例解析
3. 抓取了一些采集源扩充采王，抓取方式，zy3.7版本运行以下代码

```javascript
var rule = {
    推荐: $js.toString(() => {
        let url = 'https://blog.ilol.top/p/zqgwes.html';
        let html = request(url);
        let tlist = pdfa(html, '.post-content&&h2');
        log(tlist)
        let alist = pdfa(html, '.post-content&&a:gt(0)');
        log(alist);

        VODS = [];

        for (let i in tlist) {
            VODS.push({
                name: pdfh(tlist[i], 'Text'),
                url: pdfh(alist[i], 'a&&href'),
            })
        }
        log(JSON.stringify(VODS))

    })
}
```

4. 增加源 `奇珍异兽[官].js`
5. 新增一个源 `hdmoli.js` 用于演示二级同时存在播放列表和网盘分享链接的写法

### 20250108

更新至V1.1.4

1. 修改 `fastify` 全局 `query` 解析行为，避免同一个参数出现多次被解析成列表，比如extend参数。
2. 主页增加版权说明和免责申明
3. 自然排序逻辑改成包含，用于支持模糊排序功能(v我50限定功能)
4. 设置中心全局动作新增 `推送`
5. ds源增加可用的全局函数 `batchExecute` 用法同海阔，配置生成逻辑改成 batchExecute 执行

### 20250107

更新至V1.1.3

1. 修复 `req` 系列函数获取源码由于没有请求头没有默认 `accept` 属性导致的某些网页获取的源码异常问题
2. 推送及各个网盘播放的夸克代理线程数绑定设置中心播放线程代理的值，默认为6
3. 修复js版打包7z脚本命令的日期不正确问题
4. 增加源 `秋霞电影网.js`
5. 增加源 `小米[盘].js` 用于演示 `push://` 推送写法
6. 推送源支持 `www.aliyundrive.com` 这种地址的拦截
7. lazy执行失败后自动执行嗅探机制调整,仅限于http开头的链接

`小米[盘].js` 使用说明:
海阔待改推送 增加编码 `encodeURIComponent`

```javascript
log(detail);
let state = post(s + 'action', {
    timeout: 2000,
    body: {
        do: 'push',
        url: encodeURIComponent(JSON.stringify(detail))
    },
    headers: {
        'User-Agent': MOBILE_UA
    },
});
```

装逼壳待改，接受海阔推送json数据时对url数据进行url解码。然后才是判断解析json  
push:// 选集无法播放，待改

### 20250106

更新至V1.1.2

1. 修复 `动漫巴士[漫].js`
2. 重写 `req` 方法，使之支持 `request` 使用时支持字符串解码功能,支持 `gbk`等类型的网站数据，与之对应的源 `九七电影网.js`
3. ds推送兼容装逼壳新增推送相关属性 `vod_play_flag` `vod_play_index` `vod_play_position`
4. 增加源 `光速[优].js`

### 20250105

更新至V1.1.1

1. 优化订阅过滤和青少年模式没处理采王这类自定义别名的情况
2. push_agent 推送json兼容依赖播放属性，已实现海阔drpyHiker的任意二级推送至装逼壳并依赖推送者进行解析播放，包括小说漫画
3. aes加密的源在初始化获取原始代码的时候发现获取的文本不完善，待排查问题，待解决，如皮皮虾。之前把aes加密函数放lazy里频繁出现这种问题
4. 闪电盘等几个网盘源的筛选数据有问题，尽我能力尝试修复
5. 更新安装文档
6. 增加新源 `播剧网.js`，`樱漫[漫].js` ，`皮皮虾[优].js`
7. 从源动力零元购进货了一批ds源并测试和修正代码
8. 哔哩直播搜索功能需要配置环境变量哔哩cookie，暂时从网页上复制后手动填写入库吧，扫码获取的那个cookie貌似不行
9. 增加哔哩影视
10. 抖音直播弹幕随机颜色，且使用Jinja2绑定服务地址，解决反代后不存在端口问题
11. 给静态目录插件中心挂载basic验证，防止非法绕过主页直接使用插件
12. 增加代理转发接口 `/req/被转发的完整地址`,可在设置中心开启或关闭

### 20250104

每30天等于1个月，版本号提升0.1，终于发布1.1版本了

更新至V1.1.0

1. 优化 `抖音直播弹幕[官].js` 在加载弹幕过程中奇怪的废弃用法报错问题
2. 增加 `采集之王[合].js` 与相对应的json文件和map文件
3. 优化本地包打包发布脚本，支持过滤密发布绿色版，以后群文件只传绿色版
4. 打包发布脚本同步新增js版的，可以不安装python环境也能使用了。

### 20250103

更新至V1.0.30

1. 增加 `抖音直播弹幕[官].js`
2. drpyS注入可用的全局函数 `WebSocket` `WebSocketServer` `zlib`
3. drpyS注入可用的this指针环境变量 `hostUrl`,不含协议头的主机地址
4. 抖音弹幕共享全局fastify接口的服务和端口
5. 增加新的依赖 `google-protobuf`
6. 首页推荐数据报错不再抛错，避免影响其他数据加载
7. `我的哔哩[官].js` 等传参源兼容装逼壳
8. 增加 `runMain` 异步函数，可以调用drpyS.js里的内容
9. 配置生成逻辑改成并发执行，可能某些场景会比较快
10. 增加直转点

### 20250102

更新至V1.0.29

1. 增加 `七猫小说.js`
2. 新增 `我的哔哩[官].js`,支持传参源，传参字典可自定义，文件在 `config/map.txt`,格式为 `接口名称@参数@别名`
3. 支持ipv6监听服务

### 20250101

更新至V1.0.28

元旦快乐

1. 设置AI功能回复优化，明确知道是哪个AI
2. basic授权机制调整，未配置 `.env` 文件的这两个属性任意一个时不启用此功能
3. 增加`玩偶哥哥[盘].js`,隔壁老三套娃自写，配套筛选

### 20241231

更新至V1.0.27

1. 设置中心优化，样式微调
2. 新增 `_lib.waf.js` 通用过长城雷池防火墙工具，与对应示例源 `团长资源[盘].js`
3. 优化 `多多[盘].js` 默认筛选不正确导致没数据问题
4. 新增源 `专享影视.js` `火车太堵.js`
5. 增加 `robots.txt` 防止被引擎收录
6. 服务启动增加打印nodejs版本号
7. 主页接口增加basic验证，请自己手动配置.env文件中的 `API_AUTH_NAME` 和 `API_AUTH_CODE`
8. 配置接口和源接口增加api授权，在.env文件中配置 `API_PWD = dzyyds`
9. AI工具集成到 `AIS` 对象里了
10. ENV环境变量get和set方法增加参数3:`isObject=1`,支持读写变量如果是字符串自动转为object对象
11. AI库完成讯飞星火智能体对接，可配置当前AI为3，新增依赖库 `ws`

### 20241230

更新至V1.0.26

1. 设置中心优化，样式适配装逼壳。并支持全局站源动作
2. 增加简繁体转换函数 `simplecc`,用法如下:  
   简体转繁体: `simplecc("发财了去植发", "s2t")`  
   繁体转简体: `simplecc("發財了去植髮", "t2s")`
3. 增加源相互调用功能,仅支持在源的特定函数里使用，示例:

```javascript
let {proxyUrl, getRule} = this;
const tx_rule = await getRule('腾云驾雾[官]');
if (tx_rule) {
    log(tx_rule.url);
    log(tx_rule.title);
    // log(JSON.stringify(tx_rule));
    let data1 = await tx_rule.callRuleFn('搜索', ['斗罗大陆'])
    log(data1);
    let data2 = await tx_rule.callRuleFn('一级', ['tv'])
    log(data2);
} else {
    log('没有这个原')
}
```

4. 增加讯飞星火AI对话交互动作,设置中心推荐栏可用。 源里可使用这个对象 `SparkAI`,调用示例:

```javascript
const sparkAI = new SparkAI({
    authKey: ENV.get('spark_ai_authKey'),
    baseURL: 'https://spark-api-open.xf-yun.com',
});
rule.askLock = 1;
try {
    replyContent = await sparkAI.ask(prompt, {temperature: 1.0});
} catch (error) {
    replyContent = error.message;
}
rule.askLock = 0;
```

### 20241229

更新至V1.0.25

1. 优化设置中心在海阔的样式，增加推送功能支持推送海阔数据示例
2. 优化 `push_agent.js` 增加默认图片，增加海阔推送数据识别
3. 从 `api.js` 文件中抽离出 `mediaProxy.js` 逻辑
4. 优化本地多线程流代理，尝试降低出现`403` 问题的频率
5. batchFetch也尝试增加 连接数代理降低网站连接超出后自动拒绝的概率
6. 后端 `httpUrl` 使用独立的 `_axios` 对象，避免跟系统内 `req` 所用对象冲突
7. 完成设置中心所有平台扫码功能

### 20241228

更新至V1.0.24

1. 本地代理支持多线程流代理，参考设置中心的本地代理测试。默认线程数为1，可以设置中心自行修改
2. 至臻盘新增 `原代服` `原代本` 两种画质，可选择启用代理播放功能
3. 更新了两个源
4. 夸克扫描功能优化，支持取消扫码
5. 设置中心图标优化，并支持推送番茄小说
6. 默认排序文件改为 `order_common.example.html` `order_yellow.example.html` 允许用户自己新建不带example的文件避免跟仓库冲突

### 20241227

更新至V1.0.23

1. 更新 `searchable` `filterable` `quickSearch` 默认全部为0
2. 优化网盘源二级失效资源处理
3. 新增 `push_agent.js` 推送专用源，支持 各大网盘，官链，直链，待嗅探，多列表等场景推送
4. 修复已有源三个属性没正确设置问题
5. 增加 `蜡笔[盘].js`
6. 设置中心支持推送
7. drpyS新增可用函数 `XMLHttpRequest` `_fetch`,由于`fetch`是drpy2内置函数等同于`request`,新增的`_fetch`
   是nodejs原生函数。示例:

```javascript
const xhr = new XMLHttpRequest();
log(xhr);
```

8. 环境this增加 `httpUrl`
9. 设置中心增加夸克扫码功能与真实可用的逻辑
10. action动作交互升级至最新标准，完美适配最新装逼壳

### 20241226

更新至V1.0.22

1. 更新网盘插件 `ali.js`,修正播放失败无法自动刷新cookie问题
2. 更新 `至臻[盘].js` 支持原画播放
3. 夸克支持原画播放，并优化夸克和uc自动刷新cookie逻辑
4. `random-http-ua.js` 优化 `instanceof Array` 改为 `Array.isArray` 解决传递option无法生成ua问题
5. drpyS源模块系统升级，支持使用`.cjs`的标准commonJS模块导入使用，运行读写文件等操作。示例`_lib.request.cjs`。谨慎使用，权限比较大
   在源里的示例用法:

```javascript
const fs = require('fs');
const path = require('path');
const absolutePath = path.resolve('./');
console.log(absolutePath);
const data = fs.readFileSync('./js/_360.js', 'utf8');
console.log(data);
const {getPublicIp1, getPublicIp2} = require('../js/_lib.request.cjs');
console.log('typeof getPublicIp1:', typeof getPublicIp1);
console.log('typeof getPublicIp2:', typeof getPublicIp2);
```

6. drpyS源初始化增加30秒超时返回机制(但不会中断后台任务，请确保代码不要含有死循环等操作)
7. 研究本地代理流但是没成功，代码保留了

### 20241225

更新至V1.0.21

1. drpyS t4接口升级，同时支持`GET` `POST form` `POST JSON`
2. drpyS 源增加阿里工具类 `Ali`
3. drpyS 源增加 `_ENV`，用于获取 `process.env`
4. drpyS 源所有函数的this变量内增加 `publicUrl`属性，可以用于获取本t4服务的公开文件目录，自行拼接静态文件
5. 订阅里增加 `?sub=all` 的订阅，支持默认的源排序规则
6. 增加源设置中心并置顶在订阅配置里，支持手动输入4种平台的cookie
7. 设置中心增加青少年设置的开关，设置值为1可以彻底隐藏带密的源，无视订阅
8. uc 和 夸克自动更新播放所需cookie
9. 引入一个新的依赖 `dayjs`

### 20241224

更新至V1.0.20

1. 环境变量 `/config/env.json` 不再提交到github
2. 修改规则内各个函数的this指向，使this可以获取到rule对象的属性，也能设置属性到rule上
3. 增加lives配置
4. 增加drpyS可用的全局函数 `rc4Encrypt` `rc4Decrypt` `rc4` `rc4_decode`
5. 增加随机ua生成函数 `randomUa.generateUa()`
6. 增加一个漫画源
7. batchFetch增加16个一组分组同步请求逻辑
8. tv订阅允许[盘]类源
9. 源不定义lazy默认表示嗅探选集链接
10. 增加 `player.json` 配置一些box所需的播放器参数

### 20241223

更新至V1.0.19

1. 更新部分源
2. 更新扫码入库代码,支持UC扫码入库可播`闪电优汐[盘]`

### 20241222

更新至V1.0.18

1. 修复`cookie管理工具`扫码获取夸克和UC的cookie不正确的问题，感谢 [@Hiram-Wong](https://github.com/Hiram-Wong)
2. `COOKIE.parse` 支持列表，修复 `COOKIE.stringify` 可以直接将obj转为正确的cookie字符串，区别于 `COOKIE.serialize` 方法
3. 夸克cookie入库自动清洗，只保留有效部分

### 20241221

更新至V1.0.17

1. 修复`req`函数在请求错误返回的content可能存在json情况的问题
2. 增加`ENV`对象。用于在实际过程中get和set设置系统环境变量如各种cookie
3. 完善Cookie管理器的扫码和输入后入库功能逻辑
4. 引入自然排序算法库解决生成的配置中源的顺序问题
5. 海阔排序问题需要使用nodejsi18n小程序
6. cookie入库自动去除\n
7. 支持网盘工具

### 20241220

更新至V1.0.16

注意事项:`axiosX` 用于请求返回的headers一般没有set-cookie或者是个字符串,因为它是esm实现
`axios` `req` `request` `fetch` 等node实现的函数返回headers才能获取到set-cookie

1. drpyS源增加可使用的函数`jsonToCookie` `cookieToJson` `axiosX`
2. 修复素白白搜索(若网站允许),修复番薯动漫
3. 增加 `COOKIE`对象，可以像`JSON`一样使用 `COOKIE.parse` `COOKIE.stringify`
4. 生成的源增加自然排序
5. 移除对海阔等环境的eval注入。最新版本的so已经支持eval了
6. 增加订阅码自定义排序功能

### 20241219

更新至V1.0.15

1. drpyS源增加可使用的函数`Buffer` `URLSearchParams`
2. 所有html页面头部加入drpyS-前缀
3. 新增番薯源
4. 新增几个订阅码

### 20241218

更新至V1.0.14

1. 增加drpyS源属性说明文档
2. 增加一些源
3. 增加dockerFile
4. 兼容vercel由于找不到readme.md无法生成主页的问题
5. 调整vip解密功能兼容vercel

### 20241217

更新至V1.0.13

1. 动态计算生成配置里的 `searchable` `filterable` `quickSearch` `cost`属性
2. 修复前面版本变更导致的 `getProxyUrl` 环境异常问题
3. 解析的object支持返回header:{"use-agent":"Mozilla/5.0"}
4. 解析返回object会自动添加code和msg(如果没手动指定)

### 20241216

更新至V1.0.12

1. fixAdM3u8Ai 去广告算法升级
2. 尝试增加扫码获取cookie网页插件。后期可以更新t4接口所需cookie

### 20241215

更新至V1.0.11

1. drpyS源pathLib对象增加readFile方法，支持读取data目录的指定文件，使用示例:

```javascript
const indexHtml = pathLib.readFile('./cntv/index.html');
```

2. 央视代理增加返回网页示例，用于平替cntvParser项目。关联首页的【央视点播解析工具】
3. 增加qs工具,drpyS源里可以直接使用，示例:

```javascript
log(qs.stringify({a: 1, b: 2}))
```

4. 在.env文件中加入 `LOG_WITH_FILE = 1` 可以使请求日志输出到文件，不配置则默认输出到控制台
5. 支持vercel部署，首页报错找不到readme.md无关大雅，能用就行,直接访问部署好的服务地址/config/1
6. 支持自定义解析。放在jx目录的js文件
7. 新增虾米解析，素白白等源，优化海阔eval机制
8. 解析支持$.import和$.require使用js目录下的lib
9. 增加python脚本用于打包发布本地版7z文件

### 20241213

更新至V1.0.10

1. axios变动，libs_drpy目录保留esm版axios,public目录保留全平台版axios。req封装采用node的axios。解决请求的set-cookie不正确问题
2. 增加异步导入模块功能$.import。支持远程模块(请务必保证模块的正确性，不然可能导致后端服务挂掉)
   用法示例,详见_fq3.js

```javascript
const {getIp} = await $.import('http://127.0.0.1:5757/public/ip.js');
var rule = {
    class_parse: async () => {
        log('ip:', await getIp());
    },
}
```

### 20241212

更新至V1.0.9

1. drpyS加解密工具增加文本大小限制，目前默认为100KB，防止垃圾大数据恶意攻击接口服务
2. 修复央视大全本地代理接口没有动态获取导致可能外网播放地址出现127开头内网地址无法播放的问题
3. 升级axios单文件版到1.7.9
4. 往libsSanbox注入eval函数(非直接注入，仅针对海阔，直接注入会用不了)
   ，暂时解决海阔不支持vm里执行eval的问题,但是问题来了，存在作用域问题不要轻易使用，暂时无法解决。(
   已检测此eval不可以逃逸vm和直接获取drpyS内的变量，勉强能用)
5. 尝试$.require支持网络导入远程js依赖，要求1s内的数据(千万不要导入自己服务的静态文件，会导致阻塞)

### 20241211

更新至V1.0.8

1. BatchFetch默认采用fastq实现，支持海阔，性能强劲
2. 海阔存在写源里不支持eval问题，单任务版也不行。后续尽量避免eval，多采用JSON或JSON5处理
3. 添加axios,URL,pathLib等函数给ds源使用，推荐只在_lib库里使用
4. 支持wasm使用。
5. 新增加字符串扩展方法join，用法同python
6. 完善满血版央视大全,超越hipy版cntv
7. 本地代理增加proxyPath注入至this变量

### 20241210

更新至V1.0.7

1. 新增drpyBatchFetch.js、用3种不同方式实现drpy的batchFetch批量请求函数
2. 引入hls-parser库用于解析处理m3u8等流媒体文件，在drpyS中提供全局对象hlsParser
3. 新增央视
4. 修复人人
5. 完善batchFetch的4种实现方案

### 20241209

更新至V1.0.6

1. 新增特性，可以不写class_parse属性(但是得确保class_name和class_url不然无法获取分类)
2. 增加腾云驾雾源,修正搜索只能一个结果的问题。
3. 新增batchFetch批量请求，给drpyS源提速！！！腾云驾雾源的二级请求已提速，几百个播放链接的动漫二级秒加载
4. 增加ptt[优],同样支持二级batchFetch
5. 海阔暂不支持源里执行eval,腾云驾雾二级访问不了，现在临时修改为

```javascript
QZOutputJson = JSON5.parse(ht.split('QZOutputJson=')[1].slice(0, -1));
```

6. 手写队列，兼容海阔nodejs单任务版不支持queque等三方模块的问题
7. 修复pdfh不含属性解析的情况下返回结果不是字符串问题与之影响的黑料源

### 20241208

更新至V1.0.5

1. 新增函数 getContentType、getMimeType，替代原docs.js里的用法，并注入给drpyS源使用
2. drpyS支持class_name,class_url,filter等属性了
3. 星芽短剧新增筛选
4. 新增源老白故事
5. 优化首页分类接口机制，支持在class_parse里返回list,然后推荐留空。
6. 推荐函数注入this变量
7. 兼容新版海阔多任务nodejs

### 20241207

更新至V1.0.4

1. 添加源【动漫巴士】
2. 修改headless-util.js
3. 增加hostJs异步函数，使用示例:
4. 优化会员解密功能
5. 优化访问日志输出到本地文件并自动轮转
6. 黑料源使用CryptoJSW提高图片解密速度
7. 优化yarn dev解决控制台日志乱码问题
8. 移植原drpy2的request、post、fetch、reqCookie、getCode、checkHtml、verifyCode等方法并改为异步
9. 增加原drpy2的同步函数 setItem、getItem、clearItem
10. 增加_lib.request.js依赖库，实现了 `requestHtml`和`requestJson`简单封装
11. 在常用一级、二级、搜索等函数里的this里增加jsp、pd、pdfa、pdfh确保指向的链接为当前this的MY_URL
12. 修复pd系列函数取不到属性的问题。新增xvideos源,重写黑料里不正确的pd用法,修复黑料的搜索

```javascript
var rule = {
    hostJs: async function () {
        let {HOST} = this;
        log('HOST:', HOST);
        return 'https://www.baidu.com';
    }
}
```

### 20241206

更新至V1.0.3

1. 完善图片代理相关函数与功能
2. 增加加密源的数据解析
3. crypto-js-wasm.js兼容海阔调用CryptoJSW对象
4. 更新金牌影视，本地代理修复播放问题
5. 暴露更多函数给drpyS源使用。如gzip、ungzip等等
6. 增加源加密功能
7. 根目录增加.nomedia规避手机相册识别ts文件为媒体图片问题
8. 修复金牌影视代理播放不支持海阔引擎的问题
9. 增加会员解密功能
10. 修复pupWebview没引入成功的问题
11. 修正加解密工具不适配移动端高度问题

### 20241205

更新至V1.0.2

1. 增加本地代理功能,示例参考_qq.js 用法:在源的各个js函数里(http://192.168.31.49:5757/api/_qq)

```javascript
let {getProxyUrl} = this;
let vod_url = getProxyUrl() + '&url=' + 'https://hls09.cntv.myhwcdn.cn/asp/hls/2000/0303000a/3/default/d9b0eaa065934f25abd193d391f731b6/2000.m3u8';
```

### 20241204

更新至V1.0.1

1. 引入crypto-js-wasm.js和使用文档
2. 增加docs接口可以查看文档md文件的html页面
3. 完成index.js接口剥离，保持主文件的干净。同时导出start和stop方法
4. 改进本地配置接口，增加外网可用配置。
5. 支持puppeteer,仅pc可用。如需使用请手动安装puppeteer库，然后drpyS的源里支持使用puppeteerHelper对象。
6. 添加favicon.ico
7. 引入全局CryptoJSW对象(海阔暂时会报错无法使用)
8. 增加本地代理功能，示例(跳转百度):

```javascript
var rule = {
    proxy_rule: async function (params) {
        // log(this);
        let {input, MY_URL} = this;
        log(`params:`, params);
        log(`input:${input}`);
        log(`MY_URL::${MY_URL}`);
        // return [404, 'text/plain', 'Not Found']
        return [302, 'text/html', '', {location: 'http://www.baidu.com'}]
    }
}
```

### 20241203

1. 新增misc工具类
2. 新增utils工具类
3. 更新atob、btoa函数逻辑
4. 导出pq函数
5. 增加模块系统,$.require和$.exports
6. 修复drpyS源筛选不生效问题
7. 增加局域网可访问接口
8. 打印所有req发出的请求
9. 增加主页的html
10. 番茄小说示例源增加导入模块的用法
11. 更新自动生成配置的接口，自动读取js目录下非_开头的文件视为源
12. 修正金牌影院js
