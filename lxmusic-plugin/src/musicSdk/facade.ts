import type { SongInfo, LyricData } from '../types';

export interface MusicSearchResult {
  songs: SongInfo[];
  total?: number;
}

export interface PlaylistResult {
  playlists: Array<{
    id: string;
    name: string;
    cover?: string;
    description?: string;
    playCount?: number;
    trackCount?: number;
  }>;
}

export interface LeaderboardResult {
  boards: Array<{
    id: string;
    name: string;
    cover?: string;
    description?: string;
  }>;
}

export interface PlatformModule {
  musicSearch: {
    search: (keyword: string, page: number, limit: number) => Promise<MusicSearchResult>;
  };
  getLyric: (songInfo: SongInfo) => Promise<LyricData | null>;
  songList: {
    tags: () => Promise<unknown>;
    list: (tag: string, page: number, limit: number) => Promise<PlaylistResult>;
    detail: (id: string) => Promise<{ songs: SongInfo[] }>;
    search: (keyword: string, page: number, limit: number) => Promise<PlaylistResult>;
    sorts: () => Promise<unknown>;
  };
  leaderboard: {
    boards: () => Promise<LeaderboardResult>;
    list: (id: string, page: number, limit: number) => Promise<{ songs: SongInfo[] }>;
  };
}

export const sources = [
  { id: 'kw', name: '酷我音乐' },
  { id: 'kg', name: '酷狗音乐' },
  { id: 'tx', name: 'QQ音乐' },
  { id: 'wy', name: '网易云音乐' },
  { id: 'mg', name: '咪咕音乐' },
];

export { default as kw } from './kw/index';
export { default as kg } from './kg/index';
export { default as tx } from './tx/index';
export { default as wy } from './wy/index';
export { default as mg } from './mg/index';
