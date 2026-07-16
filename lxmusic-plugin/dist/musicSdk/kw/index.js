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
        platform: 'kw',
    };
}
const musicSearch = {
    async search(keyword, page, limit) {
        const url = `http://search.kuwo.cn/r.s?all=${encodeURIComponent(keyword)}&ft=music&itemset=web_2013&clientver=1.1.1&pn=${page}&rn=${limit}&rformat=json&encoding=utf8`;
        const { body } = await (0, request_1.default)(url).promise;
        const data = body;
        const songs = (data.musiclist || []).map(normalizeSong);
        return { songs, total: Number(data.total || songs.length) };
    },
};
async function getLyric(songInfo) {
    const musicId = songInfo.musicId || songInfo.songmid;
    if (!musicId)
        return null;
    const url = `http://lyrics.kuwo.cn/lyrics?musicId=${musicId}`;
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
        const url = `http://www.kuwo.cn/api/www/playlist/playListInfo?pid=${id}&pn=1&rn=1000`;
        const { body } = await (0, request_1.default)(url).promise;
        const data = body;
        const songs = (data.data?.musicList || []).map(normalizeSong);
        return { songs };
    },
    async search(keyword, page, limit) {
        const url = `http://www.kuwo.cn/api/www/playlist/searchPlayList?key=${encodeURIComponent(keyword)}&pn=${page}&rn=${limit}`;
        const { body } = await (0, request_1.default)(url).promise;
        const data = body;
        const playlists = (data.data?.list || []).map((p) => {
            return {
                id: String(p.id || ''),
                name: String(p.name || ''),
                cover: String(p.img || ''),
                description: String(p.desc || ''),
                playCount: Number(p.playCount || 0),
                trackCount: Number(p.musicCount || 0),
            };
        });
        return { playlists };
    },
    async sorts() {
        return [];
    },
};
const leaderboard = {
    async boards() {
        const url = 'http://www.kuwo.cn/api/www/bang/bangList?pn=1&rn=30';
        const { body } = await (0, request_1.default)(url).promise;
        const data = body;
        const boards = (data.data?.list || []).map((b) => {
            return {
                id: String(b.id || ''),
                name: String(b.name || ''),
                cover: String(b.img || ''),
            };
        });
        return { boards };
    },
    async list(id, page, limit) {
        const url = `http://www.kuwo.cn/api/www/bang/bangInfo?bangId=${id}&pn=${page}&rn=${limit}`;
        const { body } = await (0, request_1.default)(url).promise;
        const data = body;
        const songs = (data.data?.musicList || []).map(normalizeSong);
        return { songs };
    },
};
const kw = {
    musicSearch,
    getLyric,
    songList,
    leaderboard,
};
exports.default = kw;
