# Songloft 新闻资讯插件

> **⚠️ 温馨提示**
>
> 本项目使用 AI 构建，主要是为了确认 AI 在项目开发方面的能力。为了快速调试，每次变动都会生成全新的开发版，过程会伴随着各种不可用的调试，请各位知晓。

多平台新闻资讯聚合插件，支持内置 9 大平台热搜 + 自定义解析脚本 + 音频播放 / TTS 朗读双模式。

## 平台支持

| 平台 | 热搜 | 列表 | 详情 | 音频 |
|------|:----:|:----:|:----:|:----:|
| 百度 | ✅ | ✅ | ✅ | - |
| 微博 | ✅ | ✅ | ✅ | ✅ |
| 知乎 | ✅ | ✅ | ✅ | - |
| 网易 | ✅ | ✅ | ✅ | - |
| 头条 | ✅ | ✅ | ✅ | - |
| 36氪 | ✅ | ✅ | ✅ | - |
| 澎湃 | ✅ | ✅ | ✅ | - |
| 喜马拉雅 | ✅ | ✅ | ✅ | ✅ |
| 得到 | ✅ | ✅ | ✅ | ✅ |

## 技术栈

- **运行时**：Songloft JS 插件系统（基于 Skynet Actor 模型 + QuickJS 沙箱）
- **官方 SDK**：`@songloft/plugin-sdk`（路由 / HTTP / storage / crypto / 全局类型）
- **构建工具**：`@songloft/plugin-builder`（打包为 `.jsplugin.zip` + hash 校验）
- **语言**：TypeScript 5
- **前端**：原生 HTML/CSS/JS（使用宿主 `--md-*` 主题变量适配亮/暗主题）

## 项目结构

```
news-plugin/
├── plugin.json              # 插件清单（CI 自动回写 hash）
├── src/
│   ├── main.ts              # 生命周期 + 路由注册
│   ├── aggregate.ts         # 聚合热搜（去重+归一化+TTL 缓存）
│   ├── handlers/            # HTTP handler
│   │   ├── news.ts          # 列表/详情/热榜
│   │   ├── search.ts        # 关键词搜索
│   │   ├── source.ts        # 自定义源管理
│   │   ├── player.ts        # 播放/TTS
│   │   └── response.ts      # 统一响应封装
│   ├── newsSdk/             # 9 个平台抓取实现
│   ├── source/              # 自定义解析脚本管理
│   ├── engine/              # 自定义脚本运行时（子 VM）
│   ├── player/              # 播放列表 + TTS 脚本
│   └── utils/http.ts        # 业务 helper
└── static/                  # 前端资源
    ├── index.html
    ├── css/style.css        # --md-* 主题变量
    └── js/app.js            # 前端逻辑
```

## 关键设计

### 路由前缀处理

宿主转发请求时完整路径为 `/api/v1/jsplugin/{entryPath}/api/...`，插件需在 `onHTTPRequest` 中去掉 `/api/v1/jsplugin/news` 前缀后再交给官方 `createRouter` 匹配。

### storage 自动序列化

官方 `songloft.storage` 自动 JSON 序列化，可直接存对象/数组。本项目为兼容旧数据（曾手动 `JSON.stringify` 存字符串），读取时做了双格式兼容：

```typescript
const raw = await songloft.storage.get(KEY);
const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
```

### 聚合热搜

- 跨平台去重：标题归一化后比较，相同话题合并
- 平台内热度归一化：各平台 hot 值除以该平台最大值得到 0-100 的 hotLevel
- 多平台加成：同一话题在 N 个平台同时上榜，热度乘以 `(1 + 0.15*(N-1))`
- 60s TTL 缓存，避免每次请求全量抓取 9 个平台

### 子 VM 安全

自定义解析脚本运行在独立 QuickJS 子 VM 中：
- `songloft.jsenv.execute()` 隔离执行
- crypto 接口对齐官方签名：`aesEncrypt(buffer, mode, key, iv)`
- ZIP 导入支持 DEFLATE 解压（宿主 `__go_raw_inflate`）+ 50MB zip-bomb 防护
- URL 导入 https-only + 禁内网地址（防 SSRF）

## 开发

```bash
# 安装依赖
npm install

# 构建
npm run build

# 验证
npm run validate

# 开发模式
npm run dev
```

构建产物：`dist/news.jsplugin.zip`，在 Songloft 中通过 URL 或本地导入安装。

## 官方 SDK 能力使用情况

本项目已使用官方 SDK 提供的：

- `createRouter` / `jsonResponse` / `parseQuery` — HTTP 路由与解析
- `songloft.storage` — 数据持久化（播放列表、TTS 配置、自定义源）
- `songloft.jsenv` — 子 VM 运行自定义解析脚本
- `songloft.log` — 日志（注意：只接受单个 string 参数）
- `songloft.songs.create()` — 把新闻音频注册为宿主歌曲库的 Song（方案 A，需 `songs.write` 权限）
- 全局类型声明（`HTTPRequest` / `HTTPResponse` / `Songloft` 等）

**尚未使用但官方已提供的扩展能力**（后续可按需接入）：

- `songloft.playlists.*` — 操作宿主原生歌单（创建/添加歌曲/移除等）
- `songloft.events.onPlayEvent()` — 订阅播放事件
- `createMusicUrlHandler()` — 标准化音乐 URL 解析 handler
- `songloft.plugin.getFileUrl()` — 获取文件可访问 URL

## CI/CD

仓库内置 GitHub Actions（`.github/workflows/release.yml`）：

- push 到 `main` 自动构建并发布 Release
- 版本号从最新 git tag 自动递增（格式 `vX.Y.Z`）
- 自动回写 `entryHash` / `zipHash` 到 `plugin.json`

## License

MIT
