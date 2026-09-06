# drpyS接口文档

本文档基于 Fastify 实现整理，适合国内开发人员快速对接。

## 1. 接口概览

| 接口名称       | 请求方式       | 地址示例               |
|------------|------------|--------------------|
| 模块数据接口(T4) | GET / POST | `/api/:module`     |
| 模块代理接口     | GET        | `/proxy/:module/*` |
| 解析接口       | GET        | `/parse/:jx`       |

---

## 2. 接口详情

### 2.1 模块数据接口(T4)

- **URL**：`/api/:module`
- **请求方式**：`GET` / `POST`
- **鉴权**：需要 `validatePwd` 验证（通过请求参数如?pwd=dzyyds）
- **Content-Type**：
    - `application/json`
    - `application/x-www-form-urlencoded`

#### 路径参数

| 参数名    | 类型     | 必填 | 说明                    |
|--------|--------|----|-----------------------|
| module | string | 是  | 自定义源文件名称，例如 `腾云驾雾[官]` |

#### 请求参数（query 或 body）

以下参数根据业务逻辑不同，**只需传递需要的字段**：

| 参数名     | 类型     | 说明                                     |
|---------|--------|----------------------------------------|
| play    | string | 播放链接标识                                 |
| flag    | string | 播放标志（配合 `play` 使用）                     |
| ac      | string | 动作类型，可配合 `t`、`ids`、`action` 等字段        |
| t       | string | 分类 ID（配合 `ac` 使用）                      |
| ids     | string | 详情 ID（逗号分隔）                            |
| action  | string | 执行动作名称                                 |
| value   | string | 执行动作值                                  |
| wd      | string | 搜索关键字                                  |
| quick   | number | 搜索模式（0 普通，1 快速）                        |
| refresh | any    | 强制刷新初始化                                |
| filter  | number | 是否开启筛选（默认 1）                           |
| pg      | number | 页码，默认 1                                |
| ext     | string | Base64 编码的 JSON 筛选参数                   |
| extend  | string | 扩展参数（直接字符串,根据/config路由对应sites的ext属性传递） |
| do      | string | 自定义源适配器，默认ds，可不传                       |

#### 功能分支

接口会根据传参进入不同逻辑：

1. **播放**：`play` 存在 → 调用 `play` 方法
2. **分类**：`ac`、`t` 存在 → 调用 `cate` (ac=list)
3. **详情**：`ac`、`ids` 存在 → 调用 `detail` (ac=detail)
4. **动作**：`ac`、`action` 存在 → 调用 `action` (ac=action)
5. **搜索**：`wd` 存在 → 调用 `search`
6. **刷新**：`refresh` 存在 → 调用 `init`
7. **默认**：返回 `home` + `homeVod` 数据

#### 返回示例

```json
{
  "type": "影视",
  "class": [
    {
      "type_id": "1",
      "type_name": "电影"
    },
    {
      "type_id": "2",
      "type_name": "电视剧"
    }
  ],
  "filters": {},
  "list": [
    {
      "vod_id": "123",
      "vod_name": "示例视频",
      "vod_pic": "http://example.com/img.jpg",
      "vod_remarks": "更新至第1集"
    }
  ]
}
```

[更多T4接口说明参考](./t4api.md)

---

### 2.2 模块代理接口

- **URL**：`/proxy/:module/*`
- **请求方式**：`GET`
- **功能**：转发/代理模块相关资源（可处理 Range 请求，支持流媒体）
- **路径参数**：
  | 参数名 | 类型 | 必填 | 说明 |
  | ------- | ------ | ---- | ---- |
  | module | string | 是 | 模块名称 |
  | * | string | 是 | 代理的目标路径 |

- **查询参数**：与 `/api/:module` 相似，额外支持 `extend`
- **返回值**：
    - 可能是二进制文件（图片、视频等）
    - 可能是 JSON / 文本
    - 可能 302 重定向到 `/mediaProxy` 流代理地址

#### 返回示例（JSON）

```json
{
  "code": 200,
  "msg": "成功",
  "data": "内容"
}
```

---

### 2.3 解析接口

- **URL**：`/parse/:jx`
- **请求方式**：`GET`
- **功能**：调用解析脚本解析传入链接（支持跳转、JSON 输出）
- **路径参数**：
  | 参数名 | 类型 | 必填 | 说明 |
  | ------ | ------ | ---- | ---- |
  | jx | string | 是 | 解析脚本名称（对应 `.js` 文件） |

- **查询参数**：
  | 参数名 | 类型 | 必填 | 说明 |
  | ------ | ------ | ---- | ---- |
  | url | string | 是 | 待解析的链接 |
  | extend | string | 否 | 扩展参数 |

- **返回值**：
    - `code`：200 成功，404 失败
    - `msg`：提示信息
    - `url`：解析后的地址
    - `cost`：解析耗时（毫秒）

#### 返回示例（成功）

```json
{
  "code": 200,
  "url": "http://example.com/play.m3u8",
  "msg": "jx1解析成功",
  "cost": 123
}
```

#### 返回示例（失败）

```json
{
  "code": 404,
  "url": "http://example.com",
  "msg": "jx1解析失败",
  "cost": 120
}
```

---

## 3. 错误返回格式

```json
{
  "error": "错误描述信息"
}
```

- 常见错误：
    - `Module xxx not found`：模块不存在
    - `解析 xxx not found`：解析脚本不存在
    - `Failed to process module`：模块执行出错
    - `Failed to proxy module`：代理执行出错

---

## 4. 开发注意事项

1. 所有模块和解析脚本必须存在于 `jsDir` / `jxDir` 对应目录下。
2. 访问 `/api/:module` 接口时需通过 `validatePwd` 验证。
3. `ext` 参数必须是 **Base64 编码的 JSON 字符串**，否则会报“筛选参数错误”。
4. 流媒体内容可能会通过 `/mediaProxy` 重定向处理。
5. 建议在请求时加上 `pg` 参数避免默认第一页。

---

## 5. 验证码识别代理（captcha-bypass 插件）

drpys 内置对插件市场 `captcha-bypass`（ddddocr 验证码识别服务）的透明代理。**按插件名判定可用性**（不探测端口）：插件已安装且运行正常时代理可用，否则返回 503 及原因；转发目标端口从插件 `env.PORT` 动态读取（缺省 7788）。

源只需请求 drpys 主服务的**相同端口与路径**，无需感知插件端口：

| 接口 | 请求方式 | 说明 |
|----|----|----|
| `/captcha/ocr` | POST | OCR 文字/算术识别，body：`{"type":"text\|math","bg":"<base64 dataURL / 图片URL>"}` |
| `/captcha/detect` | POST | 目标检测（滑块缺口），`{"type":"detect\|match","bg":"…"[,"thumb":"…"]}` |
| `/captcha/rotate` | POST | 旋转验证码，`{"type":"single\|nox\|tiktok","bg":"…"[,"thumb":"…"]}` |
| `/captcha/slide` | POST | 滑块验证码，`{"type":"match\|comparison","thumb":"…","bg":"…"}` |
| `/captcha/health` | GET | 透传插件健康检查 |
| `/captcha/status` | GET | drpys 本地探测：`{ok, installed, running, port}`，失败时附 `message` |

- 图片支持 Base64（dataURL）、图片 URL、multipart/form-data 文件三种形式。
- 响应为插件原样 JSON：`{"code":0,"data":{"code":"识别结果"},"msg":"success"}`。
- 插件未安装/未运行时：`503 {"code":-1,"msg":"插件 captcha-bypass 未运行，请到后台管理-插件管理启动"}`。
