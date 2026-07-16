# Songloft Plugins

A collection of plugins for Songloft.

## Plugins

### 🎵 lxmusic-plugin
Multi-platform music search and playback plugin.
- Supports: Kuwo, Kugou, Tencent, NetEase, Migu
- Custom source scripts (LX Music engine)
- Playlist management
- Leaderboards

### 📰 news-plugin
News aggregation and audio playback plugin.
- Supports: Toutiao, Pengpai, NetEase News, Baidu Hot Search, Zhihu Hot, Ximalaya, Dedao
- Audio playback (Ximalaya, Dedao)
- TTS text-to-speech for any news
- Playback queue management

## Installation

1. Build each plugin: `npm run build`
2. Install the generated `.jsplugin.zip` file in Songloft

## Development

Each plugin has its own `package.json`:
```bash
cd lxmusic-plugin && npm install && npm run build
cd news-plugin && npm install && npm run build
```

## License

MIT
