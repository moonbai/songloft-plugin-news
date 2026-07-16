// types.ts - 内部类型定义

/** 平台 ID */
export type Platform = 'kw' | 'kg' | 'tx' | 'wy' | 'mg';

/** 歌曲信息(平台特有字段保留,供机制 B 解析) */
export interface SongInfo {
  platform: Platform;
  name: string;
  singer: string;
  album?: string;
  duration?: number;
  cover?: string;
  // 平台特有 ID 字段(小写驼峰,防御性容忍首字母大写)
  musicId?: string;
  songmid?: string;
  hash?: string;
  copyrightId?: string;
  strMediaMid?: string;
  albumMid?: string;
  songId?: string;
  albumId?: string;
  [key: string]: unknown; // 允许平台特有扩展字段
}

/** source_data - 对主程序不透明,本插件内部用 */
export interface SourceData {
  platform: Platform;
  quality: string;
  songInfo: SongInfo;
}

/** 歌词结果 */
export interface LyricResult {
  lyric: string;
  tlyric?: string; // 翻译歌词
  lxlyric?: string; // 罗马音歌词
}

/** 歌单项 */
export interface SongListItem {
  id: string;
  name: string;
  cover?: string;
  author?: string;
  playCount?: string;
  total?: number;
  [key: string]: unknown;
}

/** 歌单详情 */
export interface SongListDetail {
  info: {
    id: string;
    name: string;
    cover?: string;
    author?: string;
    desc?: string;
    total?: number;
  };
  list: SongInfo[];
}

/** 排行榜项 */
export interface LeaderboardItem {
  id: string;
  name: string;
  cover?: string;
  [key: string]: unknown;
}

/** 搜索结果 */
export interface SearchResult {
  songs: SongInfo[];
  total: number;
  source: Platform;
}

/** 音源解析结果 */
export interface MusicUrlResult {
  url: string;
  headers?: Record<string, string>;
}

/** 质量 ID */
export type Quality = 'standard' | 'higher' | 'exhigh' | 'lossless' | 'hires' | 'flac' | '320k' | '128k';

/** 平台搜索方法 */
export interface PlatformSearch {
  search(keyword: string, page: number, limit: number): Promise<SearchResult>;
}

/** 平台歌词方法 */
export interface PlatformLyric {
  getLyric(songInfo: SongInfo): Promise<LyricResult | null>;
}

/** 平台歌单方法 */
export interface PlatformSongList {
  tags?(): Promise<unknown>;
  list(tag: string, page: number, limit: number): Promise<{ list: SongListItem[]; total: number }>;
  detail(id: string, page: number): Promise<SongListDetail>;
  search?(keyword: string, page: number, limit: number): Promise<{ list: SongListItem[]; total: number }>;
  sorts?(): Promise<unknown>;
}

/** 平台排行榜方法 */
export interface PlatformLeaderboard {
  boards(): Promise<LeaderboardItem[]>;
  list(id: string, page: number, limit: number): Promise<{ list: SongInfo[]; total: number }>;
}

/** 平台模块 */
export interface PlatformModule {
  musicSearch: PlatformSearch;
  getLyric(songInfo: SongInfo): Promise<LyricResult | null>;
  songList?: PlatformSongList;
  leaderboard?: PlatformLeaderboard;
}

/** 平台源信息 */
export interface SourceInfo {
  id: Platform;
  name: string;
}
