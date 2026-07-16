// 公共类型定义

export interface SongInfo {
  name: string;
  singer: string;
  album?: string;
  duration?: number;
  musicId?: string;
  songmid?: string;
  hash?: string;
  copyrightId?: string;
  albumId?: string;
  albumMid?: string;
  strMediaMid?: string;
  cover?: string;
  platform: string;
}

export interface SourceData {
  platform: string;
  quality: string;
  songInfo: SongInfo;
}

export interface CustomSource {
  id: string;
  name: string;
  version?: string;
  author?: string;
  description?: string;
  script: string;
  enabled: boolean;
  createTime: number;
  updateTime: number;
}

export interface LyricData {
  lyric: string;
}

export interface HttpFetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string | Uint8Array | Record<string, unknown>;
  form?: Record<string, string>;
  timeout?: number;
}

export interface HttpFetchResult {
  statusCode: number;
  statusMessage?: string;
  headers: Record<string, string>;
  body: any;
}

export interface LxSource {
  name: string;
  type?: string;
  actions?: string[];
  qualitys?: string[];
}