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
    platform: 'kw',
  };
}

const musicSearch = {
  async search(keyword: string, page: number, limit: number): Promise<MusicSearchResult> {
    const url = `http://search.kuwo.cn/r.s?all=${encodeURIComponent(keyword)}&ft=music&itemset=web_2013&clientver=1.1.1&pn=${page}&rn=${limit}&rformat=json&encoding=utf8`;
    const { body } = await httpFetch(url).promise;
    const data = body as Record<string, unknown>;
    const songs = (data.musiclist as any[] || []).map(normalizeSong);
    return { songs, total: Number(data.total || songs.length) };
  },
};

async function getLyric(songInfo: SongInfo): Promise<LyricData | null> {
  const musicId = songInfo.musicId || songInfo.songmid;
  if (!musicId) return null;
  
  const url = `http://lyrics.kuwo.cn/lyrics?musicId=${musicId}`;
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
    const url = `http://www.kuwo.cn/api/www/playlist/playListInfo?pid=${id}&pn=1&rn=1000`;
    const { body } = await httpFetch(url).promise;
    const data = body as Record<string, unknown>;
    const songs = ((data.data as Record<string, unknown>)?.musicList as any[] || []).map(normalizeSong);
    return { songs };
  },
  async search(keyword: string, page: number, limit: number): Promise<PlaylistResult> {
    const url = `http://www.kuwo.cn/api/www/playlist/searchPlayList?key=${encodeURIComponent(keyword)}&pn=${page}&rn=${limit}`;
    const { body } = await httpFetch(url).promise;
    const data = body as Record<string, unknown>;
    const playlists = ((data.data as Record<string, unknown>)?.list as any[] || []).map((p: any) => {
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
  async sorts(): Promise<unknown> {
    return [];
  },
};

const leaderboard = {
  async boards(): Promise<LeaderboardResult> {
    const url = 'http://www.kuwo.cn/api/www/bang/bangList?pn=1&rn=30';
    const { body } = await httpFetch(url).promise;
    const data = body as Record<string, unknown>;
    const boards = ((data.data as Record<string, unknown>)?.list as any[] || []).map((b: any) => {
      return {
        id: String(b.id || ''),
        name: String(b.name || ''),
        cover: String(b.img || ''),
      };
    });
    return { boards };
  },
  async list(id: string, page: number, limit: number): Promise<{ songs: SongInfo[] }> {
    const url = `http://www.kuwo.cn/api/www/bang/bangInfo?bangId=${id}&pn=${page}&rn=${limit}`;
    const { body } = await httpFetch(url).promise;
    const data = body as Record<string, unknown>;
    const songs = ((data.data as Record<string, unknown>)?.musicList as any[] || []).map(normalizeSong);
    return { songs };
  },
};

const kw: PlatformModule = {
  musicSearch,
  getLyric,
  songList,
  leaderboard,
};

export default kw;
