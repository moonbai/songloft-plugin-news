// 平台模块接口定义

import type { NewsItem, CategoryItem, HotBoardItem } from '../types';

export interface NewsListResult {
  news: NewsItem[];
  total?: number;
  hasMore?: boolean;
}

export interface NewsDetailResult {
  news: NewsItem;
  content?: string;
}

export interface NewsSearchResult {
  news: NewsItem[];
  total?: number;
}

export interface PlatformModule {
  id: string;
  name: string;
  newsList: {
    list(category: string, page: number, limit: number): Promise<NewsListResult>;
    categories(): Promise<CategoryItem[]>;
  };
  newsDetail: {
    detail(id: string): Promise<NewsDetailResult | null>;
  };
  newsSearch: {
    search(keyword: string, page: number, limit: number): Promise<NewsSearchResult>;
  };
  hotboard: {
    boards(): Promise<HotBoardItem[]>;
    list(id: string, page: number, limit: number): Promise<NewsListResult>;
  };
}
