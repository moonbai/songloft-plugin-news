"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPlayerHandlers = createPlayerHandlers;
// 播放器 HTTP 处理
const facade_1 = require("../newsSdk/facade");
const response_1 = require("./response");
const player_1 = require("../player");
function createPlayerHandlers() {
    return {
        /**
         * 解析新闻的播放信息（包含 audioUrl、是否支持 TTS 等）
         */
        async resolve(req) {
            try {
                const request = req;
                const body = request.body;
                if (!body)
                    return (0, response_1.badRequestResponse)('No body');
                const text = new TextDecoder().decode(body);
                const parsed = JSON.parse(text);
                const news = parsed.news;
                const enableTts = parsed.enableTts !== false;
                if (!news)
                    return (0, response_1.badRequestResponse)('news is required');
                const module = facade_1.platformModules[news.source];
                let audioUrl = news.audioUrl;
                let audioDuration = news.audioDuration;
                let content = news.content;
                // 如果没有 audioUrl 但有详情，先获取详情
                if (!audioUrl && module && !news.content) {
                    try {
                        const detail = await module.newsDetail.detail(news.id);
                        if (detail) {
                            audioUrl = detail.news.audioUrl;
                            audioDuration = detail.news.audioDuration;
                            content = detail.content;
                        }
                    }
                    catch (e) {
                        // 忽略
                    }
                }
                const ttsScript = enableTts ? (0, player_1.buildTtsScript)(news, content) : null;
                return (0, response_1.successResponse)({
                    news: { ...news, audioUrl, audioDuration, content },
                    audioUrl: audioUrl || null,
                    audioDuration: audioDuration || 0,
                    hasAudio: !!audioUrl,
                    ttsScript,
                    ttsEnabled: enableTts,
                });
            }
            catch (e) {
                return (0, response_1.errorResponse)('Resolve failed: ' + e.message);
            }
        },
        /**
         * 添加到播放列表
         */
        async addToPlaylist(req) {
            try {
                const request = req;
                const body = request.body;
                if (!body)
                    return (0, response_1.badRequestResponse)('No body');
                const text = new TextDecoder().decode(body);
                const parsed = JSON.parse(text);
                const news = parsed.news;
                const listName = String(parsed.listName || 'default');
                if (!news)
                    return (0, response_1.badRequestResponse)('news is required');
                const item = {
                    id: news.id,
                    title: news.title,
                    source: news.source,
                    sourceName: news.sourceName,
                    url: news.url,
                    cover: news.cover,
                    audioUrl: news.audioUrl,
                    audioDuration: news.audioDuration,
                    summary: news.summary,
                    publishTime: news.publishTime,
                    addTime: Date.now(),
                };
                const success = (0, player_1.addToPlaylist)(item, listName);
                return (0, response_1.successResponse)({ success, message: success ? '已添加' : '已在列表中' });
            }
            catch (e) {
                return (0, response_1.errorResponse)('Add failed: ' + e.message);
            }
        },
        /**
         * 从播放列表移除
         */
        async removeFromPlaylist(req) {
            try {
                const request = req;
                const query = request.query || {};
                const id = String(query.id || '');
                const source = String(query.source || '');
                const listName = String(query.listName || 'default');
                if (!id || !source)
                    return (0, response_1.badRequestResponse)('id and source are required');
                const success = (0, player_1.removeFromPlaylist)(id, source, listName);
                return (0, response_1.successResponse)({ success });
            }
            catch (e) {
                return (0, response_1.errorResponse)('Remove failed: ' + e.message);
            }
        },
        /**
         * 获取播放列表
         */
        async getPlaylists(req) {
            try {
                const request = req;
                const listName = String(request.query?.listName || 'default');
                const all = (0, player_1.getPlaylists)();
                const list = all.find(p => p.name === listName) || { name: listName, items: [] };
                return (0, response_1.successResponse)(list);
            }
            catch (e) {
                return (0, response_1.errorResponse)('Get list failed: ' + e.message);
            }
        },
        /**
         * 清空播放列表
         */
        async clearPlaylist(req) {
            try {
                const request = req;
                const listName = String(request.query?.listName || 'default');
                (0, player_1.clearPlaylist)(listName);
                return (0, response_1.successResponse)({ success: true });
            }
            catch (e) {
                return (0, response_1.errorResponse)('Clear failed: ' + e.message);
            }
        },
        /**
         * 获取 TTS 配置
         */
        async getTtsConfig(req) {
            try {
                const config = (0, player_1.getTtsConfig)();
                return (0, response_1.successResponse)(config);
            }
            catch (e) {
                return (0, response_1.errorResponse)('Get TTS config failed');
            }
        },
        /**
         * 保存 TTS 配置
         */
        async setTtsConfig(req) {
            try {
                const request = req;
                const body = request.body;
                if (!body)
                    return (0, response_1.badRequestResponse)('No body');
                const text = new TextDecoder().decode(body);
                const config = JSON.parse(text);
                (0, player_1.setTtsConfig)(config);
                return (0, response_1.successResponse)({ success: true });
            }
            catch (e) {
                return (0, response_1.errorResponse)('Save TTS config failed');
            }
        },
        /**
         * 一键获取"可播放新闻"列表
         * 合并所有平台的新闻，按发布时间倒序，标记每个是否可播放
         */
        async getPlayableNews(req) {
            try {
                const request = req;
                const limit = Number(request.query?.limit) || 30;
                const platforms = ['ximalaya', 'dedao', 'toutiao', 'wangyi', 'pengpai'];
                const promises = platforms.map(async (sourceId) => {
                    try {
                        const module = facade_1.platformModules[sourceId];
                        if (!module)
                            return { source: sourceId, news: [] };
                        const result = await module.newsList.list('', 1, Math.ceil(limit / platforms.length));
                        return { source: sourceId, news: result.news };
                    }
                    catch (e) {
                        return { source: sourceId, news: [] };
                    }
                });
                const results = await Promise.all(promises);
                const allNews = [];
                for (const r of results) {
                    for (const n of r.news) {
                        allNews.push({
                            ...n,
                            hasAudio: !!n.audioUrl,
                            canTts: n.ttsEnabled !== false,
                        });
                    }
                }
                // 按发布时间倒序
                allNews.sort((a, b) => b.publishTime - a.publishTime);
                return (0, response_1.successResponse)({
                    news: allNews.slice(0, limit),
                    total: allNews.length,
                });
            }
            catch (e) {
                return (0, response_1.errorResponse)('Get playable failed: ' + e.message);
            }
        },
    };
}
