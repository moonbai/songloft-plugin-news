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
        platform: 'tx',
    };
}
const musicSearch = {
    async search(keyword, page, limit) {
        const url = `https://c.y.qq.com/soso/fcgi-bin/client_search_cp?w=${encodeURIComponent(keyword)}&p=${page}&n=${limit}&format=json`;
        const { body } = await (0, request_1.default)(url).promise;
        const data = body;
        const songs = (data.data?.song || []).map(normalizeSong);
        return { songs, total: Number(data.data?.totalnum || songs.length) };
    },
};
async function getLyric(songInfo) {
    const songmid = songInfo.songmid || songInfo.musicId;
    if (!songmid)
        return null;
    const url = `https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?songmid=${songmid}&format=json`;
    const { body } = await (0, request_1.default)(url).promise;
    const data = body;
    if (data && typeof data === 'object') {
        return {
            lyric: String(data.lyric || data.data || ''),
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
        const url = `https://c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg?type=1&json=1&utf8=1&onlysong=0&disstid=${id}`;
        const { body } = await (0, request_1.default)(url).promise;
        const data = body;
        const songs = ((data.cdlist || [])[0]?.songlist || []).map(normalizeSong);
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
const tx = {
    musicSearch,
    getLyric,
    songList,
    leaderboard,
};
exports.default = tx;
