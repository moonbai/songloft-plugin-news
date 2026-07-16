"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// 喜马拉雅 - 音频新闻
const request_1 = __importDefault(require("../request"));
function normalizeTrack(track) {
    return {
        id: String(track.id || track.trackId || ''),
        title: String(track.title || track.name || ''),
        url: String(track.url || track.playUrl || `https://www.ximalaya.com/sound/${track.id}`),
        source: 'ximalaya',
        sourceName: '喜马拉雅',
        category: track.category || track.categoryTitle || '',
        author: track.nickname || track.anchorName || track.announcer || '',
        publishTime: Number(track.createdAt || track.updateTime || track.publishTime || Date.now()),
        summary: String(track.intro || track.description || track.summary || ''),
        cover: String(track.coverLarge || track.coverMiddle || track.coverSmall || track.cover || ''),
        hot: Number(track.playCount || track.playsCount || 0),
        audioUrl: String(track.playUrlAacv224 || track.playUrlAacv164 || track.playUrl || track.src || ''),
        audioDuration: Number(track.duration || 0),
        ttsEnabled: false,
    };
}
const newsList = {
    async list(category, page, limit) {
        // 使用喜马拉雅的"资讯"分类 ID: 14
        const url = `https://www.ximalaya.com/revision/getRankTrackList?categoryId=${category || '14'}&rankType=2&pageNum=${page}&pageSize=${limit}`;
        const resp = await (0, request_1.default)(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://www.ximalaya.com/',
            },
        });
        const data = resp.body;
        const news = (data?.data?.tracks || []).map(normalizeTrack);
        return { news, hasMore: news.length >= limit };
    },
    async categories() {
        return [
            { id: '14', name: '资讯', source: 'ximalaya' },
            { id: '11', name: '娱乐', source: 'ximalaya' },
            { id: '12', name: '音乐', source: 'ximalaya' },
            { id: '13', name: '生活', source: 'ximalaya' },
            { id: '16', name: '历史', source: 'ximalaya' },
            { id: '17', name: '人文', source: 'ximalaya' },
        ];
    },
};
const newsDetail = {
    async detail(id) {
        const url = `https://www.ximalaya.com/revision/track/simple?trackId=${id}`;
        const resp = await (0, request_1.default)(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        const data = resp.body;
        const track = data?.data || {};
        return {
            news: normalizeTrack(track),
            content: String(track.intro || ''),
        };
    },
};
const newsSearch = {
    async search(keyword, page, limit) {
        const url = `https://www.ximalaya.com/revision/search?kw=${encodeURIComponent(keyword)}&page=${page}&perPage=${limit}&scope=track`;
        const resp = await (0, request_1.default)(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        const data = resp.body;
        const tracks = (data?.data?.tracks || []);
        const news = tracks.map((t) => normalizeTrack(t.track || t));
        return { news, total: news.length };
    },
};
const hotboard = {
    async boards() {
        return [
            { id: '14', name: '资讯热榜', source: 'ximalaya' },
            { id: '11', name: '娱乐热榜', source: 'ximalaya' },
        ];
    },
    async list(id, page, limit) {
        return newsList.list(id, page, limit);
    },
};
const ximalaya = {
    id: 'ximalaya',
    name: '喜马拉雅',
    newsList,
    newsDetail,
    newsSearch,
    hotboard,
};
exports.default = ximalaya;
