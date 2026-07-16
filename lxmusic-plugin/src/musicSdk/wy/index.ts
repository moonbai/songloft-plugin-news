import httpFetch from '../request';
import type { SongInfo, LyricData } from '../../types';
import type { MusicSearchResult, PlaylistResult, LeaderboardResult, PlatformModule } from '../facade';

function normalizeSong(song: any): SongInfo {
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
  async search(keyword: string, page: number, limit: number): Promise<MusicSearchResult> {
    const url = `http://music.163.com/api/search/get/web?csrf_token=&type=1&s=${encodeURIComponent(keyword)}&offset=${(page - 1) * limit}&limit=${limit}`;
    const { body } = await httpFetch(url).promise;
    const data = body as Record<string, unknown>;
    const songs = ((data.result as Record<string, unknown>)?.songs as any[] || []).map(normalizeSong);
    return { songs, total: Number((data.result as Record<string, unknown>)?.songCount || songs.length) };
  },
};

async function getLyric(songInfo: SongInfo): Promise<LyricData | null> {
  const musicId = songInfo.musicId || songInfo.songmid;
  if (!musicId) return null;
  
  const url = `http://music.163.com/api/song/lyric?id=${musicId}&lv=-1&kv=-1&tv=-1`;
  const { body } = await httpFetch(url).promise;
  const data = body as Record<string, unknown>;
  
  if (data && typeof data === 'object') {
    return {
      lyric: String((data.lrc as Record<string, unknown>)?.lyric || ''),
    };
  }
  return null;
}

const songList = {
  async tags(): Promise<unknown> {
    return [];
  },
  async list(tag: string, page: number, limit: number): Promise<PlaylistResult> {
    return { playlists: [] };
  },
  async detail(id: string): Promise<{ songs: SongInfo[] }> {
    const url = `http://music.163.com/api/playlist/detail?id=${id}`;
    const { body } = await httpFetch(url).promise;
    const data = body as Record<string, unknown>;
    const songs = ((data.result as Record<string, unknown>)?.tracks as any[] || []).map(normalizeSong);
    return { songs };
  },
  async search(keyword: string, page: number, limit: number): Promise<PlaylistResult> {
    return { playlists: [] };
  },
  async sorts(): Promise<unknown> {
    return [];
  },
};

const leaderboard = {
  async boards(): Promise<LeaderboardResult> {
    return { boards: [] };
  },
  async list(id: string, page: number, limit: number): Promise<{ songs: SongInfo[] }> {
    return { songs: [] };
  },
};

const wy: PlatformModule = {
  musicSearch,
  getLyric,
  songList,
  leaderboard,
};

export default wy;
