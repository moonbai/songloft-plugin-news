"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const request_1 = __importDefault(require("../request"));
function normalizeSong(song) {
    return {
        name: String(song.name || song.songName || ''),
        singer: String(song.singer || song.artist || song.albumArtist || ''),
        album: String(song.album || song.albumName || ''),
        duration: Number(song.duration || song.interval || 0),
        musicId: String(song.musicId || song.songId || song.id || ''),
        songmid: String(song.songmid || song.musicId || song.songId || ''),
        hash: String(song.hash || ''),
        platform: 'wy',
    };
}
const musicSearch = {
    async search(keyword, page, limit) {
        const url = `http://music.163.com/api/search/get/web?csrf_token=&type=1&s=${encodeURIComponent(keyword)}&offset=${(page - 1) * limit}&limit=${limit}`;
        const { body } = await (0, request_1.default)(url).promise;
        const data = body;
        const songs = (data.result?.songs || []).map(normalizeSong);
        return { songs, total: Number(data.result?.songCount || songs.length) };
    },
};
async function getLyric(songInfo) {
    const musicId = songInfo.musicId || songInfo.songmid;
    if (!musicId)
        return null;
    const url = `http://music.163.com/api/song/lyric?id=${musicId}&lv=-1&kv=-1&tv=-1`;
    const { body } = await (0, request_1.default)(url).promise;
    const data = body;
    if (data && typeof data === 'object') {
        return {
            lyric: String(data.lrc?.lyric || ''),
        };
    }
    return null;
}
const songList = {
    async tags() {
        return [];
    },
    async list(tag, page, limit) {
        return { playlists: [] };
    },
    async detail(id) {
        const url = `http://music.163.com/api/playlist/detail?id=${id}`;
        const { body } = await (0, request_1.default)(url).promise;
        const data = body;
        const songs = (data.result?.tracks || []).map(normalizeSong);
        return { songs };
    },
    async search(keyword, page, limit) {
        return { playlists: [] };
    },
    async sorts() {
        return [];
    },
};
const leaderboard = {
    async boards() {
        return { boards: [] };
    },
    async list(id, page, limit) {
        return { songs: [] };
    },
};
const wy = {
    musicSearch,
    getLyric,
    songList,
    leaderboard,
};
exports.default = wy;
