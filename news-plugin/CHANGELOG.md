# 更新日志

## v1.4.0 (2026-07-21)

### 重大修复 - 全面解决播放问题

#### 核心问题
- **所有新闻都不能播放**：由于所有新闻源都是文字源，且 Flutter WebView 可能不支持 speechSynthesis API，导致 TTS 朗读完全失效

#### 解决方案 - 集成 Edge TTS（微软在线 TTS）

##### 前端 (app.js)
- 新增 `EdgeTTSClient` 类：通过 WebSocket 连接微软 Edge TTS 服务，生成高质量中文语音
- **双重 TTS 策略**：优先使用浏览器原生 speechSynthesis，失败时自动降级到 Edge TTS
- 支持语音参数配置：语速、音调、音量同步应用到 Edge TTS
- 自动清理 Blob URL，避免内存泄漏

##### 后端
- 新增 `src/player/edgeTts.ts`：Edge TTS 后端客户端，支持 WebSocket 通信和音频缓存
- 新增 `GET /api/player/tts-stream`：TTS 音频流接口，实时生成 MP3 音频并返回
- 支持 LRU 缓存（最多 20 条），避免重复生成相同文本的音频

##### 宿主原生播放器支持
- **`hostMusicUrlHandler`**：TTS 新闻不再报错，而是返回插件内 TTS 音频流 URL
- **`newsToSongInput`**：TTS 新闻的 url 字段指向 `/api/player/tts-stream`，通过 `songloft.songs.create` 创建的歌曲可直接播放
- **fallbackSearch**：支持按标题在各平台搜索 TTS 新闻作为备选

##### 其他改进
- TTS 文本长度限制从 200 字提升到 500 字，播放更完整
- 估算时长最少 10 秒，避免过短导致显示异常
- 批量导入歌单时不再过滤无音频的新闻（TTS 新闻现在也能播放）

## v1.3.4 (2026-07-18)

### 新增 - 接入宿主原生歌曲库（方案 A）

#### 后端
- **plugin.json** 新增 `songs.write` 权限
- **POST /api/player/register-song**：单条新闻音频注册为宿主 Song（自动去重，dedupKey=`{source}:{id}`）
- **POST /api/player/register-batch**：批量注册可播放新闻，自动跳过无 audioUrl 的条目
- 复用官方 `songloft.songs.create()`，返回 songId + 可播放 URL

#### 前端
- 新闻列表项新增「⭐ 加入歌单」按钮（仅有音频的新闻显示）
- 播放列表面板同步支持「加入歌单」操作
- 注册中显示 loading 状态，成功后置为「✓ 已加入歌单」
- 按钮配色：橙色（warning）区分于播放/朗读/添加按钮

#### TTS 浏览器兼容性优化
- 新增 `_ttsAvailable()` / `_waitForVoices()` 检测浏览器 TTS 能力
  （部分 WebView 有 SpeechSynthesis API 但无可用语音）
- 播放决策：无 TTS 时自动降级到音频播放或提示查看正文
- UI 自适应：不支持 TTS 时不渲染朗读按钮，避免误导
- 统一 `_playTts` / `_loadTtsConfig` / `_saveTtsConfig` 使用 `api()`

## v1.3.0 (2026-07-18)

### 重大重构 - 对齐官方 SDK

#### 改进
- **改用官方 @songloft/plugin-sdk**：删除本地 SDK 副本（src/@songloft/plugin-sdk/）和手写 globals.d.ts，统一使用官方 SDK 提供的 `createRouter` / `jsonResponse` / `parseQuery` 和全局类型声明
- **去掉 storage 双重序列化**：`songloft.storage` 已自动 JSON 序列化，移除手写 `JSON.stringify`/`JSON.parse`，直接存取对象（player/storage.ts、source/storage.ts）
- **crypto 签名对齐官方**：子 VM 的 `aesEncrypt` / `aesDecrypt` 参数顺序从 `(data, key, iv, mode)` 改为官方的 `(buffer, mode, key, iv)`，新增 `sha1` / `sha256Bytes` / `rc4` 方法
- **HTTP 请求类型修正**：所有 handler 去掉 `req as any`，使用官方 `HTTPRequest` 类型；`req.query` 是原始字符串，统一用 `parseQuery` 解析
- **生命周期修复**：`onInit` 中用 `void sourceManager.loadAllEnabled().catch(...)` 替代 `setTimeout(..., 100)`，避免阻塞初始化
- **日志调用修正**：官方 `log.error` 只接受单个 string 参数，所有 `log.error('msg:', e)` 改为 `log.error('msg: ' + e.message)`

#### 新增
- **聚合热搜 TTL 缓存**：抽取到独立 aggregate.ts 模块，60s 缓存避免每次请求全量抓取 9 个平台
- **URL 导入安全防护**：source/manager.ts 仅允许 https://，禁止 localhost / 内网地址 / .local 域名（防 SSRF）
- **ZIP DEFLATE 支持**：source/parser.ts 使用宿主 `__go_raw_inflate` 解压 DEFLATE 压缩的 ZIP 条目，并加 50MB zip-bomb 防护
- **前端 API 桥接**：app.js 优先使用宿主 `window.SongloftPlugin`（自动带 access_token + 503 重试），无宿主时回退裸 fetch
- **CSS 主题适配**：style.css 使用 `--md-*` 宿主主题变量，自动适配亮/暗主题

#### 清理
- 删除 runtime.ts 中的死代码（空 handleEvent 方法、重复的 parseScriptMetadata 函数）
- 业务 helper（parseJsonBody、successResponse 等）从 SDK 副本迁移到 utils/http.ts

## v1.2.3 (2026-07-18)

### 修复
- **聚合热搜显示**：修复聚合模式下前端渲染逻辑，正确处理后端 `{ news: [...], bySource: [...] }` 返回格式
- **来源名称显示**：聚合热搜结果添加 `sourceName` / `sourceNames` 字段，显示多来源名称

### 新增
- **脚本示例**：脚本管理界面添加可折叠的自定义解析脚本示例模板

## v1.2.2 (2026-07-18)

### 新增
- **聚合热搜去重+归一化排序**：跨平台标题去重（归一化标题后比较，相同话题合并），平台内热度归一化（各平台 hot 值除以该平台最大值得到 0-100 的 hotLevel），多平台加成（同一话题在 N 个平台同时上榜，热度乘以 (1 + 0.15*(N-1))）

### 改进
- **聚合热搜恢复多平台**：从单数据源（百度）恢复为全部 9 个平台并行聚合
- **仓库独立**：仓库仅保留新闻资讯插件，仓库名改为 songloft-plugin-news
- **README 重写**：更新为单插件仓库的说明文档
- **CI 优化**：Release 名称和说明更新为单插件命名

## v1.2.1 (2026-07-17)

### 修复
- **聚合热榜为空**：修复聚合热榜接口错误调用 `newsList.list('hot')` 导致数据为空的问题，改用 `hotboard.list` 直接获取热榜数据
- **可用平台调整**：聚合热榜改为只包含已验证可用的平台（百度热搜、知乎热榜、网易头条）

## v1.2.0 (2026-07-17)

### 修复
- **知乎热榜**：改用 `api.zhihu.com/topstory/hot-list` 接口（无需认证），返回 30 条热榜数据
- **网易新闻热榜**：修复 JSONP 解析，改用 `3g.163.com` 移动端接口，返回 10 条头条新闻
- **搜索功能**：改为从百度/知乎/网易热榜数据中做本地关键词过滤（标题、摘要、作者三个维度）

### 说明
- 微博、36氪、今日头条、澎湃等平台因反爬/认证限制暂时不可用
- 可用数据源：百度热搜（51条）、知乎热榜（30条）、网易头条（10条）

## v1.1.1 (2026-07-17)

### 修复
- **搜索 400 错误**：修复前端 `api()` 函数双重 JSON.stringify 导致请求体解析失败的问题

## v1.1.0 (2026-07-17)

### 修复
- **401 Unauthorized**：在 plugin.json 中添加 `publicPaths: ["/api"]`，绕过宿主全局 JWT 认证

### 前端
- GET 请求不再设置 `Content-Type`，避免触发预检请求

## v1.0.9 (2026-07-17)

### 修复
- **初始化解耦**：router 创建不再依赖 storage 初始化，storage 失败不影响核心功能
- **懒加载兜底**：onHTTPRequest 在 router 为空时同步创建，防止 onInit 未完成时所有请求失败
- **body 类型兼容**：parseJsonBody 同时处理 string 和 Uint8Array，兼容 QuickJS 宿主可能的 body 格式

## v1.0.8 (2026-07-17)

### 修复
- 查询参数解析兼容字符串和对象格式
- Headers 兼容 forEach 和 entries 两种遍历方式
- 修复 onInit 竞态条件，确保初始化完成后再处理请求
- 添加默认 User-Agent 请求头

## v1.0.0 ~ v1.0.7

- 初始版本发布
- 基础新闻聚合功能
- 多平台热榜支持
- 音频播放和 TTS 支持
