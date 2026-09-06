# CCTV H5E 解密插件移植方案（基于 letr007/CCTVVideoDownloader 分析）

> 状态：**已实施**（2026-08-31，插件市场已上架 `cctv-h5e` 1.0.0）。
> 上游仓库已 clone 到 `logs/CCTVVideoDownloader`（分析用，不入库）。
>
> 实施结果与 §9 决策点对照：
> 1. 路线：**用户选定方案 A（3 端二进制）**——win-x64（MSVC /MT 静态 279KB）、linux-x64/arm64（zig cc musl 全静态 ~465KB）。CLI 做了最小扩展（算法未动）：`--stream`（stdin→stdout，免临时文件）、`--init-new-mode`（跨分片状态兜底）、stderr 机器可读行 `H5E new_mode=<0|1> nals=<N>`。GPLv3 合规：插件包内附带 LICENSE 与修改版源码 `source/cctv_h5e_decrypt.hpp`。
> 2. 形态：node 服务插件（binaries 三平台 + index.js HTTP 壳，端口 7796）。
> 3. 已附带 `/resolve?guid=` 端点（getHttpVideoInfo.do → hls_h5e_url，含 enc2 CDN 归一）。
> 4. 已交付 demo 源 `spider/js/央视频.js`（栏目列表 + proxy 转发插件 + lazy 播放），并已上架插件市场。
>
> 实测关键事实（含设计假设修正）：
> - cntv CDN 按 UA 放行，**必须带 `User-Agent: Lavf/60.10.100`**（上游同款伪装），浏览器 UA 403；
> - hls_h5e_url 在 getHttpVideoInfo.do 响应的 **`manifest` 子对象**（hls_h5e_url → hls_enc_url → hls_enc2_url 兜底，enc2 域名归一 drm.cntv.vod.dnsv1.com）；
> - **每个 h5e 分片自带 type25 使能 NAL**（实测 4 个分片均 new_mode=1），per-分片独立解密成立，跨分片状态通常无需维护；
> - 解密产物经 ffmpeg 全片解码零错误（h264 720p + aac），对拍 fixture 锁定 sha256（tests/unit/cctv-h5e-plugin.test.js）；
> - 客户端可达性：源 proxy 承接对外门面（主服务端口），插件仅 127.0.0.1 通信，m3u8 重写行带 base 回流主服务 `/proxy/<模块>/?do=h5e&u=`（注意 `/proxy/:module/*` 通配段必须有落点，尾部斜杠必需）；
> - 附带修复：全局 `CATE_EXCLUDE` 默认表含「新闻」误杀正常分类（drpyCustom.js），已移除该词；市场卡片 `platformSupported` 判定增强支持 `platform-arch` 键（pluginMarketController.js）。

## 10. v1.1.0 增补：频道直播（cdrm）解密

tv.cctv.com 直播页（`/live/cctvX/`）的视频流与点播同属 h5e 加密家族，但走 **classic TEA 模式**（无 type25 使能 NAL），同一解密器自动适配，实测 ffmpeg 解码零错误。取流链路（逆向 `liveplayer.js` 与央视大全[官]源印证）：

```
auth-key = `${time}-${number}-${md5(channel+time+number+SECRET)}`   // SECRET=a4220a71b31746908fa3e7fdd7a6852a
GET https://vdnx.live.cntv.cn/api/v3/vdn/live?channel=<ch>&vn=1   // header: auth-key
  → manifest.hls_cdrm（master m3u8，CDN 每次下发可能不同厂商：kcdnvip/volcfcdn/bdydns/myqcloud/wscdns/myalicdn）
  → variant 选档两种形态：独立文件 `..._pd|td|ud|hd|md.m3u8` 或 `index.m3u8?BR=td`
  → media m3u8 滚动列表（无 EXT-X-KEY，分片为 NAL 层 classic 加密）
```

要点与坑：
- 老接口 `vdn.live.cntv.cn/api2/live.do` 现仅下发音频+封面（video_protect=3），视频流必须走 v3 接口 + auth-key；
- 直播分片视频 PID 实测稳定 0x100，插件仍做了 PES stream_id 扫描自适应（`detectVideoPid`）；
- 解密有效性对照：同内容加密态 ffmpeg 解码 122 条错误 → 解密态仅剩直播头部跨分片参考帧缺失（`Reference N >= N`，播放器等首帧 IDR 后正常，非解密问题）；
- 单分片解码偶见 `Reference` 类错误属直播切片不从 IDR 起切的固有现象，连续播放（等关键帧）即恢复；
- 央视频 App（yangshipin.cn）的直播走 CMG 专有加密（`hls.cmg.js` wasm 播放器，EXT-X-KEY 密钥下发型），与本插件体系不同，不支持。
- **卫视频道不可加**（2026-08-31 实测）：cntv v3 接口可查到卫视 channel（全拼：anhui/guangdong/dongfang/shenzhen 等 20+ 个均 ack=yes 且下发 hls_cdrm），但 CDN 上流已全部废弃（master 404 或 master 在而 media 变体 404）；卫视实际直播只存在于 yangshipin 的 CMG 加密体系（需逆向 ckey 签名 + hls.cmg.js，独立大工程且在线密钥形态下离线解密器思路不成立），勿再尝试为卫视扩展本插件。

## 1. 结论先行

- 上游是 C++17 + Qt 的「央视频下载器」，1.4 万行；**真正有价值的只有 1 个文件**：`src/core/src/crypto/cctv_h5e_decrypt.hpp`（724 行，单头文件、零依赖、无网络、纯算法）。
- 它实现了 tv.cctv.com `hls_h5e` 加密 TS → 标准 MPEG-TS 的完整解密：TEA-16 + 自定义 GF(2) G 变换 + EPB 对齐 + PES 重组。**密钥内嵌在 NAL 头部字节里，不需要外部取 key、不需要账号/签名**，解密是自包含的流式纯函数。
- 输出 TS **字节数与输入完全一致**（188 对齐不变，PES 缩短被 adaptation-field stuffing 吸收），解密后可直接被任意播放器播放——这正是「解密成正常的 ts」的需求本体。
- 外围（Qt GUI、cctv-dl 浏览/下载编排、ffmpeg remux→MP4、TS 合并）全部与需求无关，按约定裁剪。
- **本机已验证**：该头文件用 VS2017 BuildTools 一行命令编译出 275KB 独立 CLI（`logs/h5e_decrypt.exe`，仅分析/对拍用），证明「3 端二进制」路线技术上畅通。

## 2. 上游仓库结构速览

```
src/core/src/crypto/cctv_h5e_decrypt.hpp   ← 核心（724 行 header-only，含 C ABI 与 CLI 入口）
src/core/src/decryptworker.cpp             ← 调用 decrypt_ts_inplace 的文件级封装（Qt，弃）
src/core/src/parse/contentresolver.cpp     ← 播放地址解析（有价值的小部分，见 §4）
src/core/src/apiservice.cpp                ← cntv 栏目/专辑/单集浏览 API（源侧才需要，插件不需要）
src/cli|src/gui|concatworker|libavremuxer|tsmerger|downloadengine…  ← 外围，全部裁剪
```

## 3. H5E 加密原理（移植 spec 摘要）

加密发生在 **H.264 NAL 层**（不是标准 HLS AES-128），仅针对视频 PID（默认 0x100）的 PES 载荷：

- **模式切换**：NAL type 25（`nal[0]&0x1f==25 && nal[2]==0x01 && nal[3]==0x09`）为「新模式使能」标记；未使能时走 classic 模式。
- **classic 模式**（type1/5）：TEA-16 解密，key = `nal+16` 起的 16 字节，密文块起点 32、步长 80。
- **新模式 type5**（IDR 片）：TEA-16，key = `nal+5`，步长 F5 闭合式 = `BASE[key_le32 % 6] | key[idx]`，BASE={160,192,224,256,288,320}；块起点 64。
- **新模式 type1**（非 IDR 片）：自定义 G 变换（GF(2) 线性反馈 + 由 NAL 头 3 字节推导的 16 步 flip 掩码，覆盖 01a8xx / 61exxx / slice-header 三族），步长 F1（同 F5 公式、key 取 `nal+1`，缺省 511），块起点 64、4 字节块。
- **EPB 处理**：网格索引按 RBSP 跳过竞争字节（00 00 03）定位；解密后删除 EPB 的 0x03。
- **TS 重组**：解密让 PES 变短 → 按需扩展 adaptation-field stuffing 补齐 → 写回原 188 字节包位。**全程原地、输入输出等长**。
- 会话状态仅 1 个 bool（new_mode），**无密钥协商、无外部 I/O**。

上游自述「No WASM, no VMP bytecode, no network」，且为闭合公式实现（无需查找表）——**JS 移植没有任何障碍**。

## 4. 播放地址链路（源侧需要，插件可选附带）

```
https://vdn.apps.cntv.cn/api/getHttpVideoInfo.do?pid=<guid>
  → JSON: hls_url（明文）/ hls_h5e_url（加密）
  → hls_h5e_url 的 main.m3u8 替换为 <清晰度>.m3u8（如 2000.m3u8）
  → 分片 *.ts 为 H5E 加密 → 解密 → 标准 TS
```

这部分是普通 HTTP + JSON/m3u8 文本处理，drpyS 源本来就会写；**不属于解密核心**，插件是否附带由形态决定（见 §6）。

## 5. 移植路线对比

| 维度 | 方案 A：3 端二进制 CLI | 方案 B：纯 JS 移植（推荐） |
|---|---|---|
| 算法保真 | 与上游 100% 一致，上游更新只换二进制 | 手工移植，靠对拍测试保证一致 |
| 产物 | win-x64 / linux-x64 / linux-arm64 各一份 exe | 1 个 ~400-500 行 JS 文件 |
| 跨平台 | 需 CI 交叉编译（上游 ci.yml 是 Qt 全量构建，需另搭） | win/linux/arm/docker/vercel 直接跑 |
| 调用模型 | 每分片 spawn 子进程（或改造 CLI 成 stdin/stdout 流协议） | 函数调用，天然流式，可挂进 proxy 管道 |
| 分发体积 | ~300KB×3，走插件市场二进制分发 | 零二进制 |
| 与 drpyS 生态 | 二进制插件规范（captcha-bypass 380MB 的前车之鉴） | node 服务插件 / proxy 模块，纯 JS 无新依赖 |
| 性能 | 原生快 | TEA 16 轮位运算 + 稀疏网格（每 MB 数千块），微秒级/块，足够 |

**推荐 B**，理由：解密是「密钥内嵌、无状态、闭合公式」的纯算法，JS 移植风险低；drpyS 场景是**在线流式代理**（拉分片→解密→回给播放器），不是下载后转码，子进程模型反而别扭；且符合 AGENTS.md「新依赖/新产物多平台优先纯 JS」与最小改动原则。方案 A 保留为备选：若对拍中发现算法描述有歧义（G 变换 flip 掩码是逆向拟合产物，上游注释也承认 GF(2)-fitted），可退回「直接用上游二进制」保真。

方案 C（动态库 + node FFI）已排除：node-ffi-napi 多平台维护差，AGENTS.md 明确规避。

## 6. 插件设计主线（按方案 B）

**形态**：node 服务插件（与 lxserver 同款规范），插件市场分发，名字暂定 `cctv-h5e`。

**端点**（插件起 HTTP 服务，走 pluginManager 既有端口管理）：

- `GET /decrypt/ts?url=<加密ts url>` —— 服务端拉取加密分片 → 解密 → 回标准 TS（二进制透传）。
- `GET /decrypt/m3u8?url=<h5e m3u8 url>` —— 拉 m3u8，把其中的 ts 行重写为 `/decrypt/ts?url=...` 绝对地址后返回。源只需把 `hls_h5e_url` 换成本端点，播放器全程无感。
- 可选附带 `GET /resolve?guid=<guid>` —— 封装 getHttpVideoInfo.do → 返回解密 m3u8 直链，简化源侧对接。

**源侧对接**：cctv 源在 play() 里把 hls_h5e_url 包成插件端点即可；插件与源解耦，任何拿到 h5e 地址的源都能用。

**工作区约定**：解密核心独立成一个纯逻辑模块（无 IO），HTTP 壳薄封装；不引入任何新 npm 依赖（HTTP 用 node 原生 fetch，Buffer 处理原生）。

## 7. 裁剪清单（明确不做）

- Qt GUI、cctv-dl CLI 浏览/下载编排、多线程下载器
- ffmpeg remux → MP4（播放器直吃 TS）、TS 合并器
- cntv 栏目/专辑/看点浏览 API（源侧自己写）
- MP4 封装、媒体容器校验、ffmpeg mini 构建脚本

## 8. 验证方案

1. **对拍基准**：上游 CLI 已在本地编译（`logs/h5e_decrypt.exe`）；linux 端可在 CI 用同法编译。
2. **真实样本**：从 tv.cctv.com 走 §4 链路抓 1 个 h5e 播放列表，下载 2-3 个分片（覆盖 IDR/非 IDR/EPB 场景）存入 `tests/fixtures/`。
3. **一致性断言**：移植 JS 解密输出与上游 exe 输出 **sha256 逐字节一致**（node:test，零依赖框架）。
4. **端到端**：插件装进本地 5757，用 cctv 源（或 resolve 端点）在播放器拉流验证可播。

## 9. 待拍板决策点

1. **路线**：方案 B（纯 JS 移植，推荐）还是方案 A（3 端二进制，你最初预设）？
2. 插件形态：node 服务插件（推荐）——如选 A 则为二进制插件。
3. 是否附带 `resolve` 地址解析端点（源侧对接更省事）。
4. 是否同步发一个配套的 cctv demo 源，还是只交付解密插件（源你自己写/已有）。
