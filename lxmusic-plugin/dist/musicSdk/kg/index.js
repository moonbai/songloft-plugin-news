import httpFetch from '../request';
function normalizeSong(song) {
    return {
        name: String(song.name || song.songName || ''),
        singer: String(song.singer || song.artist || song.albumArtist || ''),
        album: String(song.album || song.albumName || ''),
        duration: Number(song.duration || song.interval || 0),
        musicId: String(song.musicId || song.songId || song.id || ''),
        songmid: String(song.songmid || song.musicId || song.songId || ''),
        hash: String(song.hash || ''),
        platform: 'kg',
    };
}
const musicSearch = {
    async search(keyword, page, limit) {
        const url = `http://searchapi.kugou.com/v3/search/song?keyword=${encodeURIComponent(keyword)}&page=${page}&pagesize=${limit}&format=json`;
        const { body } = await httpFetch(url).promise;
        const data = body;
        const songs = (data.data?.lists || []).map(normalizeSong);
        return { songs, total: Number(data.data?.total || songs.length) };
    },
};
async function getLyric(songInfo) {
    const musicId = songInfo.musicId || songInfo.songmid;
    if (!musicId)
        return null;
    const url = `http://lyrics.kugou.com/lyrics?musicid=${musicId}`;
    const { body } = await httpFetch(url).promise;
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
        const url = `http://www.kugou.com/yy/html/special.html?id=${id}`;
        const { body } = await httpFetch(url).promise;
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
const kg = {
    musicSearch,
    getLyric,
    songList,
    leaderboard,
};
export default kg;
