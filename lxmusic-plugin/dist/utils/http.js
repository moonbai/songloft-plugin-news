// utils/http.ts - 调宿主 API 辅助
/** 调用宿主 API */
export async function callHostAPI(path, options = {}) {
    const hostUrl = await songloft.plugin.getHostUrl();
    const token = await songloft.plugin.getToken();
    const headers = {
        'Authorization': 'Bearer ' + token,
        ...options.headers,
    };
    let bodyData;
    if (options.body !== undefined && options.body !== null) {
        bodyData = JSON.stringify(options.body);
        headers['Content-Type'] = 'application/json';
    }
    const resp = await fetch(hostUrl + path, {
        method: options.method || 'GET',
        headers,
        body: bodyData,
    });
    const text = await resp.text();
    let data = text;
    try {
        data = JSON.parse(text);
    }
    catch {
        // keep text
    }
    return { status: resp.status, data };
}
/** 导入歌曲到库 */
export async function importSongToLibrary(song) {
    const result = await callHostAPI('/api/v1/songs/remote', {
        method: 'POST',
        body: {
            title: song.title,
            artist: song.artist,
            album: song.album || '',
            cover_url: song.cover_url || '',
            duration: song.duration || 0,
            plugin_entry_path: 'lxmusic',
            source_data: JSON.stringify(song.source_data),
            dedup_key: song.dedup_key || '',
            lyric_source: song.lyric_source || '',
            lyric: song.lyric || '',
        },
    });
    return result.data;
}
/** 生成去重 key */
export function makeDedupKey(platform, songInfo) {
    const id = songInfo.songmid || songInfo.musicId || songInfo.hash || songInfo.copyrightId;
    if (!id)
        return '';
    return `${platform}:${id}`;
}
/** 构造歌词 URL */
export async function makeLyricUrl(platform, songInfo) {
    const hostUrl = await songloft.plugin.getHostUrl();
    const musicId = songInfo.musicId || songInfo.songmid || '';
    const songmid = songInfo.songmid || songInfo.musicId || '';
    return `${hostUrl}/api/v1/jsplugin/lxmusic/api/direct/lyric?source_id=${encodeURIComponent(platform)}&musicId=${encodeURIComponent(String(musicId))}&songmid=${encodeURIComponent(String(songmid))}`;
}
