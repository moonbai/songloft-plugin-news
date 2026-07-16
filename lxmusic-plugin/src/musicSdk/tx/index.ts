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
    platform: 'tx',
  };
}

const musicSearch = {
  async search(keyword: string, page: number, limit: number): Promise<MusicSearchResult> {
    const url = `https://c.y.qq.com/soso/fcgi-bin/client_search_cp?w=${encodeURIComponent(keyword)}&p=${page}&n=${limit}&format=json`;
    const { body } = await httpFetch(url).promise;
    const data = body as Record<string, unknown>;
    const songs = ((data.data as Record<string, unknown>)?.song as any[] || []).map(normalizeSong);
    return { songs, total: Number((data.data as Record<string, unknown>)?.totalnum || songs.length) };
  },
};

async function getLyric(songInfo: SongInfo): Promise<LyricData | null> {
  const songmid = songInfo.songmid || songInfo.musicId;
  if (!songmid) return null;
  
  const url = `https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?songmid=${songmid}&format=json`;
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
    const url = `https://c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg?type=1&json=1&utf8=1&onlysong=0&disstid=${id}`;
    const { body } = await httpFetch(url).promise;
    const data = body as Record<string, unknown>;
    const songs = ((data.cdlist as any[] || [])[0]?.songlist as any[] || []).map(normalizeSong);
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

const tx: PlatformModule = {
  musicSearch,
  getLyric,
  songList,
  leaderboard,
};

export default tx;
