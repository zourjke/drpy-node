## API列表(一部分，逐步完善)

### admin（需 Basic Auth，详见 [admin_api.md](./admin_api.md)）

- 插件管理 [/api/admin/plugins](./admin_api.md)
- 插件运行时启停与状态 [/api/admin/plugins/status](./admin_api.md)、[/api/admin/plugins/start](./admin_api.md)、[/api/admin/plugins/stop](./admin_api.md)、[/api/admin/plugins/restart](./admin_api.md)
- 插件市场 [/api/admin/market/list](./admin_api.md)、[/api/admin/market/install](./admin_api.md)、[/api/admin/market/update](./admin_api.md)、[/api/admin/market/uninstall](./admin_api.md)、[/api/admin/market/sources](./admin_api.md)

### ds

- 获取定时任务列表 [/tasks](/tasks)
- 立即执行全部任务 [/execute-now/:taskName](/execute-now/)
- 立即执行钉钉消息任务 [/execute-now/dingtalk_test](/execute-now/dingtalk_test)
- 立即执行企业微信消息任务 [/execute-now/wechat_test](/execute-now/wechat_test)
- 立即执行吾爱论坛签到任务 [/execute-now/52pojie_sign](/execute-now/52pojie_sign) | [说明](./cron/52pojie_sign.md)
- 获取指定任务信息 [/tasks/:taskName](/tasks/)

### hipy

- 检查python环境 [/health](/health)

### 验证码识别代理（captcha-bypass 插件，详见 [apidoc.md](./apidoc.md)）

- 验证码 OCR 识别(post) [/captcha/ocr](/captcha/ocr)
- 滑块缺口/旋转/滑块识别(post) [/captcha/detect](/captcha/detect)、[/captcha/rotate](/captcha/rotate)、[/captcha/slide](/captcha/slide)
- 插件健康透传(get) [/captcha/health](/captcha/health)
- 代理状态探测(get) [/captcha/status](/captcha/status)

### 自定义插件

#### 智能剪切板

- 读取当前剪切板数据(get) [/clipboard/read](/clipboard/read)
- 往剪切板写数据(post) [/clipboard/add](/clipboard/add)
- 清空剪切板数据(post) [/clipboard/clear](/clipboard/clear)