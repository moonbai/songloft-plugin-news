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
        platform: 'mg',
    };
}
const musicSearch = {
    async search(keyword, page, limit) {
        const url = `http://search.migu.cn/migu/remoting/scr_search_tag?keyword=${encodeURIComponent(keyword)}&type=2&pgc=${page}&rowc=${limit}&issubtitle=false`;
        const { body } = await (0, request_1.default)(url).promise;
        const data = body;
        const songs = (data.result?.songlist || []).map(normalizeSong);
        return { songs, total: Number(data.total || songs.length) };
    },
};
async function getLyric(songInfo) {
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
        return { songs: [] };
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
const mg = {
    musicSearch,
    getLyric,
    songList,
    leaderboard,
};
exports.default = mg;
