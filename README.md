# Songloft 插件集合

Songloft 平台插件合集，使用 GitHub Actions 自动构建发布。

## 插件列表

### 🎵 lxmusic-plugin

多平台音乐搜索与播放插件。

- 支持平台：酷我、酷狗、腾讯（QQ）、网易、咪咕
- 双机制架构：musicSdk 元数据 + LX Music 引擎播放 URL 解析
- 自定义音源脚本导入（支持 LX Music 格式）
- 歌单管理、排行榜浏览
- 歌词获取

### 📰 news-plugin

新闻资讯聚合与音频播放插件。

- 支持平台：今日头条、澎湃新闻、网易新闻、百度热搜、知乎热榜、喜马拉雅、得到
- 音频播放（喜马拉雅、得到）
- TTS 语音朗读，支持任意新闻
- 播放队列管理
- 自定义解析脚本导入

## 安装方式

### 方式一：下载安装

前往 [Releases](https://github.com/moonbai/songloft-plugins/releases) 下载对应的 `.jsplugin.zip` 文件，在 Songloft 中手动导入。

### 方式二：URL 安装

在 Songloft 中通过 Release 资源链接直接安装。

## 本地开发

每个插件目录下均有独立的 `package.json`：

```bash
# 构建 lxmusic 插件
cd lxmusic-plugin && npm install && npm run build

# 构建 news 插件
cd news-plugin && npm install && npm run build
```

构建产物位于各插件的 `dist/` 目录下，文件格式为 `.jsplugin.zip`。

### 验证

```bash
cd lxmusic-plugin && npm run validate
cd news-plugin && npm run validate
```

## CI/CD

推送到 `main` 分支后，GitHub Actions 会自动：

1. 发现所有插件目录
2. 并行构建并验证
3. 自动递增版本号（语义化版本，patch +1）
4. 发布 Release 并上传 `.jsplugin.zip` 产物

也可在 Actions 页面手动触发构建，支持自定义版本号。

## 目录结构

```
songloft-plugins/
├── .github/workflows/
│   └── release.yml          # CI 构建发布流程
├── lxmusic-plugin/          # 音乐插件
│   ├── src/                 # TypeScript 源码
│   ├── static/              # 前端静态资源
│   ├── plugin.json          # 插件清单
│   └── package.json
├── news-plugin/             # 新闻插件
│   ├── src/                 # TypeScript 源码
│   ├── static/              # 前端静态资源
│   ├── plugin.json          # 插件清单
│   └── package.json
└── README.md
```

## 技术栈

- 运行环境：QuickJS 沙箱
- 构建工具：`@songloft/plugin-builder`
- 前端打包：esbuild
- 语言：TypeScript

## 许可证

MIT
