# 环境变量 .env参数说明

| 参数键                       | 参数说明                           | 参数示例                                                              |
|---------------------------|--------------------------------|-------------------------------------------------------------------|
| LOG_WITH_FILE             | 日志输出到本地文件                      | 0:输出到控制台 1:输出到本地文件                                                |
| ENABLE_TASKER             | 启用定时任务                         | 0:启用 1:禁用                                                         |
| TASKER_INTERVAL           | 定时任务间隔毫秒                       | 已弃用                                                               |
| FORCE_HEADER              | 强制生成文件头，每次访问都重新生成              | 0:关闭 1:开启  (仅在第一次批量生成文件头启用此选项)                                    |
| DR2_API_TYPE              | drpy2本地t3接口文件                  | 0:使用本项目的drpy-core-lite 1:使用壳子内置assets                             |
| LOG_LEVEL                 | 日志级别                           | info/error                                                        |
| COOKIE_AUTH_CODE          | 设置中心入库授权码                      | drpys                                                             |
| API_AUTH_NAME             | basic认证账号，访问ds首页需要登录,猫爪使用必必须配置 | admin                                                             |
| API_AUTH_CODE             | basic认证密码，访问ds首页需要登录,猫爪使用必必须配置 | drpys                                                             |
| API_PWD                   | T4接口密码和T3文件访问密码，如果不配置就是公开文件和接口 | dzyyds                                                            |
| EPG_URL                   | epg直播信息链接                      | https://iptv.xxxx.cn/epgphp/index.php?ch={name}&date={date}       |
| LOGO_URL                  | 直播频道logo链接                     | https://live.xxxx.top/logo/{name}.png                             |
| MAX_TASK                  | 批量任务最大并发数,小鸡请设置低于2             | 8                                                                 |
| dingding_webhook          | 钉钉webhook推送定时任务消息链接            | https://oapi.dingtalk.com/robot/send?access_token=${access_token} |
| wechat_webhook            | 企业微信webhook推送定时任务消息链接          |                                                                   |
| tx_news_guonei_api_key    | 国内新闻每日定时任务推送KEY                | 去这里申请 https://www.tianapi.com/apiview/4                           |
| cookie_52pojie            | 吾爱破解定时签到cookie                 | 暂时无法实现定时签到                                                        |
| QQ_EMAIL                  | qq邮箱定时任务推送账号                   |                                                                   |
| QQ_SMTP_AUTH_CODE         | qq邮箱定时任务推送授权码                  |                                                                   |
| CAT_DEBUG                 | 调试猫源                           | 0/1: 开启esm模式 2: base64模式，存在相对依赖无法使用问题                             |
| PYTHON_PATH               | 本地python真实环境路径                 | D:\Program Files\Python312                                        |
| VIRTUAL_ENV               | 本地python虚拟环境路径                 | 同上，差别在于虚拟环境会自动拼scripts路径下的python.exe,跟真实环境二选一                     |
| daemonMode                | 守护进程版本                         | 0: 旗舰版 1:轻量版                                                      |
| DS_REQ_LIB                | ds/cat 默认req实现                 | 0:fetch 1:axios  （已知模式1为前面版本默认功能，但是后面发现某些场景无法获取源码，新写了模式0，不保证完全兼容） |
| PHP_PATH                  | 本地PHP可执行文件路径                  | php (全局) 或 /usr/bin/php8.3 (指定路径)                                |
| CLIPBOARD_MAX_SIZE        | 单次文本传输最大体积 默认100KB             | 102400                                                            |
| CLIPBOARD_SECURITY_CODE   | 剪切板接口请求头安全码                    | drpys                                                             |
| CLIPBOARD_ALLOWED_CHARSET | 允许字符集，默认utf-8                  | utf-8                                                             |
| CLIPBOARD_MAX_READ_SIZE   | 最大可读取问文本体积，默认2mb               | 2048000                                                           |
| API_TIMEOUT               | 默认API超时时间                      | 20                                                                |
| API_ACTION_TIMEOUT        | action接口专用超时时间                 | 60                                                                |
| BRIDGE_TIMEOUT             | python桥接单次请求超时毫秒(Node侧bridge与守护进程共用)   | 30000                                                             |
| BRIDGE_PACKET_MAX          | python桥接单包上限字节(Node侧默认10MB,守护进程旗舰版60MB/轻量版10MB) | 10485760                                                    |
| MAX_TEXT_SIZE             | 设置最大文本大小(剪切板插件)                | 0.1 * 1024 * 1024                                                 |
| MAX_IMAGE_SIZE            | 设置最大图片大小(图片插件)                 | 0.5 * 1024 * 1024                                                 |

# 用户自定义配置 (config/env.json)

该文件位于 `config/env.json`，存储用户自定义的运行时配置。

| 参数键 | 参数说明 | 备注 |
| :--- | :--- | :--- |
| enable_php | 是否开启 PHP 源支持 | 0:关闭 1:开启(本地执行T4,需环境) 2:开启(远程加载T3,免环境) |
| api_pwd | 全局接口访问密码 | 访问敏感接口或文件时需要 |
| thread | 爬虫并发数 | 建议设置在 4-8 之间 |
| unified_proxy_self_redirect | 全能代理对「自身链接」的处理模式 | 0:回环转发（默认，兼容不跟随 302 的壳子） 1:302 重定向（零转发开销，单层代理链） |
| quark_cookie | 夸克网盘 Cookie | 观看夸克网盘资源需要 |
| uc_cookie | UC 网盘 Cookie | 观看 UC 网盘资源需要 |
| ali_token | 阿里云盘 Token | 观看阿里云盘资源需要 |
| deepseek_apiKey | DeepSeek API Key | AI 搜索/对话功能需要 |
| kimi_apiKey | Kimi API Key | AI 搜索/对话功能需要 |
| bili_cookie | Bilibili Cookie | B站相关资源需要 |
| play_proxy_mode | 播放代理模式 | 0:直接播放 1:代理播放 |

## 环境搭建指南

### 1. PHP 环境搭建 (推荐)

本项目支持 PHP 爬虫源（`spider/php/*.php`），需要本地安装 PHP 环境。

#### Linux (Ubuntu/Debian)

推荐使用 PPA 安装 PHP 8.3+：

```bash
# 1. 添加 PPA 源
sudo apt install software-properties-common -y
sudo add-apt-repository ppa:ondrej/php -y
sudo apt update

# 2. 安装 PHP 8.3 及常用扩展 (drpy 爬虫需要 curl, mbstring, xml, mysql 等)
sudo apt install php8.3-cli php8.3-curl php8.3-mbstring php8.3-xml php8.3-mysql -y

# 3. 验证安装
php -v
```

#### Windows

1. 下载 PHP 8.3+ NTS 版本 (推荐)。
2. 解压到 `C:\php` 等目录。
3. 将解压目录添加到系统 `Path` 环境变量中。
4. 修改 `php.ini`，开启 `extension=curl`, `mbstring`, `openssl` 等扩展。

### 2. 7-Zip 工具安装 (可选)

部分功能可能依赖 7z 进行解压操作。

#### Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install p7zip-full -y
```

验证安装：
```bash
7z
```
