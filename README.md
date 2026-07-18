# Songloft 新闻资讯插件

> **⚠️ 温馨提示**
>
> 本项目使用 AI 构建，主要是为了确认 AI 在项目开发方面的能力。为了快速调试，每次变动都会生成全新的开发版，过程会伴随着各种不可用的调试，请各位知晓。

Songloft 平台的新闻资讯聚合插件，支持多平台热榜浏览、音频播放和 TTS 语音朗读。

## 功能特性

### 多平台热榜聚合

- **9 大平台**：百度热搜、微博热搜、知乎热榜、网易新闻、今日头条、36氪、澎湃新闻、喜马拉雅、得到
- **聚合热搜**：跨平台去重 + 热度归一化排序，综合展示全网最热话题
- **多平台加成**：同一话题在多个平台同时上榜时给予热度加成

### 新闻浏览与搜索

- 按平台浏览新闻列表和分类
- 全文搜索（从热榜数据中本地过滤）
- 新闻详情查看

### 音频播放

- 喜马拉雅、得到等平台的原生音频播放
- TTS 语音朗读：支持任意新闻内容的语音合成（自动检测浏览器 TTS 能力，无语音时降级到音频/查看正文）
- 播放队列管理
- **接入宿主原生播放体系**（官方推荐方式）：
  - `POST /api/search` — 宿主搜索框输入关键词时回调，返回可播放新闻列表
  - `POST /api/music/url` — 宿主播放时回调，返回真实音频 URL（可选带 Referer 等 headers）
  - 用户在宿主原生搜索框搜"新闻"或具体关键词，可直接用宿主播放器播放，无需进插件页面
  - 同时保留 `POST /api/player/register-song`（基于 `songloft.songs.create()`）作为补充

### 自定义解析脚本

- 支持导入 LX Music 格式的自定义音源脚本
- 支持单文件 `.js` 和批量 `.zip` 导入
- 脚本在独立 QuickJS 子沙箱中运行，安全隔离

## 安装方式

### 方式一：URL 安装（推荐）

在 Songloft 中通过插件更新地址直接安装：

```
https://github.com/moonbai/songloft-plugin-news/raw/main/news-plugin/plugin.json
```

### 方式二：下载安装

前往 [Releases](https://github.com/moonbai/songloft-plugin-news/releases) 下载最新的 `news.jsplugin.zip` 文件，在 Songloft 中手动导入。

## 本地开发

### 环境要求

- Node.js 20+
- npm

### 构建

```bash
cd news-plugin
npm install
npm run build
```

构建产物位于 `dist/` 目录下，文件格式为 `.jsplugin.zip`。

### 验证

```bash
npm run validate
```

## CI/CD

推送到 `main` 分支后，GitHub Actions 会自动：

1. 发现插件目录
2. 构建并验证
3. 自动递增版本号（语义化版本，patch +1）
4. 发布 Release 并上传 `.jsplugin.zip` 产物
5. Release Notes 自动包含 CHANGELOG.md 更新履历

也可在 Actions 页面手动触发构建，支持自定义版本号。

## 目录结构

```
songloft-plugin-news/
├── .github/
│   └── workflows/
│       └── release.yml          # CI 构建发布流程
├── news-plugin/                 # 新闻资讯插件
│   ├── src/
│   │   ├── main.ts              # 插件主入口
│   │   ├── newsSdk/             # 各平台新闻 SDK
│   │   │   ├── baidu/           # 百度热搜
│   │   │   ├── weibo/           # 微博热搜
│   │   │   ├── zhihu/           # 知乎热榜
│   │   │   ├── wangyi/          # 网易新闻
│   │   │   ├── toutiao/         # 今日头条
│   │   │   ├── 36kr/            # 36氪
│   │   │   ├── pengpai/         # 澎湃新闻
│   │   │   ├── ximalaya/        # 喜马拉雅
│   │   │   ├── dedao/           # 得到
│   │   │   ├── facade.ts        # 平台统一入口
│   │   │   └── request.ts       # HTTP 请求封装
│   │   ├── engine/              # 自定义音源引擎
│   │   ├── handlers/            # HTTP 路由处理器
│   │   ├── player/              # 播放器与 TTS
│   │   └── source/              # 音源管理
│   ├── static/                  # 前端静态资源
│   ├── CHANGELOG.md             # 更新日志
│   ├── plugin.json              # 插件清单
│   └── package.json
└── README.md
```

## 技术栈

- **运行环境**：Songloft JS 插件系统（Skynet Actor + QuickJS 沙箱）
- **官方 SDK**：`@songloft/plugin-sdk`（路由 / HTTP / storage / crypto / songs / jsenv）
- **构建工具**：`@songloft/plugin-builder`
- **语言**：TypeScript 5
- **前端**：原生 HTML/CSS/JS（使用宿主 `--md-*` 主题变量适配亮/暗主题）

## 更新日志

详见 [CHANGELOG.md](news-plugin/CHANGELOG.md)。

## 免责声明

本插件仅供个人学习研究使用，禁止商用。各平台新闻内容的版权归原作者所有，用户须自行清除产生的版权数据。

## 许可证

MIT
