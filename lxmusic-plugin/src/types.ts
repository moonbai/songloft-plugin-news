export interface SongInfo {
  name: string;
  singer: string;
  album?: string;
  duration?: number;
  musicId?: string;
  songmid?: string;
  hash?: string;
  copyrightId?: string;
  strMediaMid?: string;
  albumMid?: string;
  platform: string;
  [key: string]: unknown;
}

export interface SearchResultItem {
  title: string;
  artist: string;
  album: string;
  duration: number;
  cover_url: string;
  source_data: SourceData;
}

export interface SourceData {
  platform: string;
  quality: string;
  songInfo: SongInfo;
}

export interface LyricData {
  lyric: string;
  tlyric?: string;
}

export interface SourceMeta {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  homepage?: string;
  enabled: boolean;
  loading: boolean;
  platforms: string[];
  rawScript: string;
  successCalls: number;
  totalCalls: number;
}

export interface LxSource {
  name: string;
  type: string;
  actions: string[];
  qualitys: string[];
}

export interface HttpFetchResult {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
}

export interface HttpFetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  form?: Record<string, string>;
  formData?: Record<string, string | Blob>;
  timeout?: number;
  url?: string;
}

export interface MusicUrlResult {
  url: string;
  headers?: Record<string, string>;
}

export interface PlaylistItem {
  id: string;
  name: string;
  cover?: string;
  description?: string;
  playCount?: number;
  trackCount?: number;
}

export interface LeaderboardItem {
  id: string;
  name: string;
  cover?: string;
  description?: string;
}
