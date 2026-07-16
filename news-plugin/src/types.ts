// 公共类型定义

export interface NewsItem {
  id: string;
  title: string;
  url: string;
  source: string;
  sourceName: string;
  category?: string;
  author?: string;
  publishTime: number;
  summary?: string;
  cover?: string;
  hot?: number;
  content?: string;
  /** 音频播放地址（如果有） */
  audioUrl?: string;
  /** 音频时长（秒） */
  audioDuration?: number;
  /** 是否支持 TTS 朗读 */
  ttsEnabled?: boolean;
}

export interface CategoryItem {
  id: string;
  name: string;
  source: string;
}

export interface HotBoardItem {
  id: string;
  name: string;
  source: string;
  cover?: string;
}

export interface NewsSource {
  id: string;
  name: string;
  baseUrl?: string;
  enabled: boolean;
}

export interface SearchParams {
  keyword: string;
  source_id?: string;
  page?: number;
  page_size?: number;
}

export interface ListParams {
  source_id?: string;
  category?: string;
  page?: number;
  limit?: number;
}

export interface SourceData {
  source: string;
  action: 'newsList' | 'newsDetail' | 'newsSearch';
  info: Record<string, unknown>;
}
