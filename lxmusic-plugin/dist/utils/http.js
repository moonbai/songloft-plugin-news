"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.callHostAPI = callHostAPI;
exports.importSongToLibrary = importSongToLibrary;
exports.createPlaylist = createPlaylist;
exports.addSongToPlaylist = addSongToPlaylist;
async function callHostAPI(path, options = {}) {
    const hostUrl = await songloft.plugin.getHostUrl();
    const token = await songloft.plugin.getToken();
    const url = hostUrl + path;
    const fetchOptions = {
        method: options.method || 'GET',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json',
            ...options.headers,
        },
    };
    if (options.body) {
        fetchOptions.body = JSON.stringify(options.body);
    }
    const response = await fetch(url, fetchOptions);
    return response.json();
}
async function importSongToLibrary(song) {
    const dedupKey = generateDedupKey(song.source_data);
    return callHostAPI('/api/v1/songs/remote', {
        method: 'POST',
        body: {
            title: song.title,
            artist: song.artist,
            album: song.album,
            cover_url: song.cover_url,
            duration: song.duration,
            plugin_entry_path: 'lxmusic',
            source_data: JSON.stringify(song.source_data),
            dedup_key: dedupKey,
            lyric: song.lyric,
            lyric_source: song.lyric_source || 'url',
        },
    });
}
function generateDedupKey(sourceData) {
    const songInfo = sourceData.songInfo;
    const platform = sourceData.platform;
    if (songInfo) {
        if (songInfo.songmid)
            return `${platform}:${songInfo.songmid}`;
        if (songInfo.musicId)
            return `${platform}:${songInfo.musicId}`;
        if (songInfo.hash)
            return `${platform}:${songInfo.hash}`;
        if (songInfo.copyrightId)
            return `${platform}:${songInfo.copyrightId}`;
    }
    return '';
}
async function createPlaylist(name, description) {
    return callHostAPI('/api/v1/playlists', {
        method: 'POST',
        body: {
            name,
            description,
        },
    });
}
async function addSongToPlaylist(playlistId, songId) {
    return callHostAPI(`/api/v1/playlists/${playlistId}/songs`, {
        method: 'POST',
        body: {
            song_id: songId,
        },
    });
}
