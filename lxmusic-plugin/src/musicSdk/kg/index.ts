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
    platform: 'kg',
  };
}

const musicSearch = {
  async search(keyword: string, page: number, limit: number): Promise<MusicSearchResult> {
    const url = `http://searchapi.kugou.com/v3/search/song?keyword=${encodeURIComponent(keyword)}&page=${page}&pagesize=${limit}&format=json`;
    const { body } = await httpFetch(url).promise;
    const data = body as Record<string, unknown>;
    const songs = ((data.data as Record<string, unknown>)?.lists as any[] || []).map(normalizeSong);
    return { songs, total: Number((data.data as Record<string, unknown>)?.total || songs.length) };
  },
};

async function getLyric(songInfo: SongInfo): Promise<LyricData | null> {
  const musicId = songInfo.musicId || songInfo.songmid;
  if (!musicId) return null;
  
  const url = `http://lyrics.kugou.com/lyrics?musicid=${musicId}`;
  const { body } = await httpFetch(url).promise;
  const data = body as Record<string, unknown>;
  
  if (data && typeof data === 'object') {
    return {
      lyric: String(data.lyric || data.data || ''),
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
    const url = `http://www.kugou.com/yy/html/special.html?id=${id}`;
    const { body } = await httpFetch(url).promise;
    return { songs: [] };
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

const kg: PlatformModule = {
  musicSearch,
  getLyric,
  songList,
  leaderboard,
};

export default kg;
