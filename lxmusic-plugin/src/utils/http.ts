// utils/http.ts - 调宿主 API 辅助

/** 调用宿主 API */
export async function callHostAPI(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
): Promise<{ status: number; data: unknown }> {
  const hostUrl = await songloft.plugin.getHostUrl();
  const token = await songloft.plugin.getToken();

  const headers: Record<string, string> = {
    'Authorization': 'Bearer ' + token,
    ...options.headers,
  };

  let bodyData: string | undefined;
  if (options.body !== undefined && options.body !== null) {
    bodyData = JSON.stringify(options.body);
    headers['Content-Type'] = 'application/json';
  }

  const resp = await fetch(hostUrl + path, {
    method: options.method || 'GET',
    headers,
    body: bodyData as BodyInit | undefined,
  });

  const text = await resp.text();
  let data: unknown = text;
  try {
    data = JSON.parse(text);
  } catch {
    // keep text
  }

  return { status: resp.status, data };
}

/** 导入歌曲到库 */
export async function importSongToLibrary(song: {
  title: string;
  artist: string;
  album?: string;
  cover_url?: string;
  duration?: number;
  source_data: unknown;
  dedup_key?: string;
  lyric_source?: string;
  lyric?: string;
}): Promise<unknown> {
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
export function makeDedupKey(platform: string, songInfo: Record<string, unknown>): string {
  const id = songInfo.songmid || songInfo.musicId || songInfo.hash || songInfo.copyrightId;
  if (!id) return '';
  return `${platform}:${id}`;
}

/** 构造歌词 URL */
export async function makeLyricUrl(platform: string, songInfo: Record<string, unknown>): Promise<string> {
  const hostUrl = await songloft.plugin.getHostUrl();
  const musicId = songInfo.musicId || songInfo.songmid || '';
  const songmid = songInfo.songmid || songInfo.musicId || '';
  return `${hostUrl}/api/v1/jsplugin/lxmusic/api/direct/lyric?source_id=${encodeURIComponent(platform)}&musicId=${encodeURIComponent(String(musicId))}&songmid=${encodeURIComponent(String(songmid))}`;
}

/* ============ 歌单管理 (通过 songloft.playlists 桥接) ============ */

/** 获取宿主歌单列表 */
export async function listPlaylists(): Promise<unknown> {
  return await songloft.playlists.list({});
}

/** 创建新歌单 */
export async function createPlaylist(name: string, cover?: string): Promise<unknown> {
  return await songloft.playlists.create({ name, cover: cover || '' });
}

/** 批量添加歌曲到歌单 */
export async function addSongsToPlaylist(playlistId: string, songIds: string[]): Promise<unknown> {
  return await songloft.playlists.addSongs(playlistId, songIds);
}

/** 更新歌单信息 (用于补充封面) */
export async function updatePlaylist(playlistId: string, data: Record<string, unknown>): Promise<unknown> {
  return await songloft.playlists.update(playlistId, data);
}
