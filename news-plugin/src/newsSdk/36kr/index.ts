import httpFetch from '../request';
import type { NewsItem, CategoryItem } from '../../types';
import type { NewsListResult, NewsDetailResult, NewsSearchResult, PlatformModule } from '../types';

function normalizeItem(item: any): NewsItem {
  return {
    id: String(item.itemid || item.id || ''),
    title: String(item.title || item.widget_title || ''),
    url: String(item.url || `https://36kr.com/p/${item.itemid || item.id}`),
    source: '36kr',
    sourceName: '36氪',
    author: String(item.author?.name || item.source || ''),
    publishTime: Number(item.published_at || item.publishTime || Date.now()),
    summary: String(item.summary || item.widget_title || ''),
    cover: String(item.cover || item.image_url || ''),
    hot: Number(item.comment_count || 0),
  };
}

const newsList = {
  async list(category: string, page: number, limit: number): Promise<NewsListResult> {
    // 36氪信息流接口
    const url = `https://gateway.36kr.com/api/missive/flow/feed/v2/?from=web&b_id=${page * 20}&limit=${limit}&partner_id=wap`;
    const resp = await httpFetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    const data = resp.body as any;
    const items = (data?.data?.data?.feedList as any[]) || [];
    const news: NewsItem[] = items.map(normalizeItem);
    return { news, hasMore: news.length >= limit };
  },

  async categories(): Promise<CategoryItem[]> {
    return [
      { id: 'recommend', name: '推荐', source: '36kr' },
      { id: 'hot', name: '热门', source: '36kr' },
    ];
  },
};

const newsDetail = {
  async detail(id: string): Promise<NewsDetailResult | null> {
    const url = `https://36kr.com/p/${id}`;
    const resp = await httpFetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    const raw = resp.raw || String(resp.body || '');
    const titleMatch = raw.match(/"title":"([^"]+)"/);
    return {
      news: {
        id,
        title: titleMatch ? titleMatch[1] : '',
        url,
        source: '36kr',
        sourceName: '36氪',
        publishTime: Date.now(),
      },
      content: raw.replace(/<[^>]+>/g, '').trim().slice(0, 5000),
    };
  },
};

const newsSearch = {
  async search(keyword: string, page: number, limit: number): Promise<NewsSearchResult> {
    const url = `https://gateway.36kr.com/api/seek/query?from=web&per=${limit}&page=${page}&keyword=${encodeURIComponent(keyword)}`;
    const resp = await httpFetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    const data = resp.body as any;
    const items = (data?.data?.searchResult?.data as any[]) || [];
    const news = items.map(normalizeItem);
    return { news: news.slice(0, limit), total: news.length };
  },
};

const hotboard = {
  async boards() {
    return [{ id: 'hot', name: '36氪热榜', source: '36kr' }];
  },
  async list(id: string, page: number, limit: number): Promise<NewsListResult> {
    // 36氪热榜接口
    const url = 'https://gateway.36kr.com/api/missive/flow/rank/hot';
    const resp = await httpFetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    const data = resp.body as any;
    const items = (data?.data?.data?.topList as any[]) || [];
    const news = items.map(normalizeItem);
    return { news: news.slice(0, limit), hasMore: false };
  },
};

const kr36: PlatformModule = {
  id: '36kr',
  name: '36氪',
  newsList,
  newsDetail,
  newsSearch,
  hotboard,
};

export default kr36;
