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
    platform: 'mg',
  };
}

const musicSearch = {
  async search(keyword: string, page: number, limit: number): Promise<MusicSearchResult> {
    const url = `http://search.migu.cn/migu/remoting/scr_search_tag?keyword=${encodeURIComponent(keyword)}&type=2&pgc=${page}&rowc=${limit}&issubtitle=false`;
    const { body } = await httpFetch(url).promise;
    const data = body as Record<string, unknown>;
    const songs = ((data.result as Record<string, unknown>)?.songlist as any[] || []).map(normalizeSong);
    return { songs, total: Number(data.total || songs.length) };
  },
};

async function getLyric(songInfo: SongInfo): Promise<LyricData | null> {
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

const mg: PlatformModule = {
  musicSearch,
  getLyric,
  songList,
  leaderboard,
};

export default mg;
