import httpFetch from '../request';
import type { NewsItem, CategoryItem } from '../../types';
import type { NewsListResult, NewsDetailResult, NewsSearchResult, PlatformModule } from '../types';

function normalizeItem(item: any): NewsItem {
  return {
    id: String(item.id || item.target?.id || ''),
    title: String(item.title || item.target?.title_area?.text || ''),
    url: String(item.target?.link?.url || item.url || ''),
    source: 'zhihu',
    sourceName: '知乎热榜',
    author: item.target?.author?.name || '',
    publishTime: Number(item.create_time || item.target?.created_time || Date.now()) * 1000,
    summary: String(item.target?.excerpt_area?.text || item.detail_text || ''),
    cover: String(item.target?.image_area?.url || ''),
    hot: Number((String(item.detail_text || '').match(/\d+/)?.[0]) || 0),
  };
}

const newsList = {
  async list(category: string, page: number, limit: number): Promise<NewsListResult> {
    return hotboard.list('hot', page, limit);
  },

  async categories(): Promise<CategoryItem[]> {
    return [
      { id: 'hot', name: '知乎热榜', source: 'zhihu' },
    ];
  },
};

const newsDetail = {
  async detail(id: string): Promise<NewsDetailResult | null> {
    const url = `https://www.zhihu.com/question/${id}`;
    const resp = await httpFetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    return {
      news: {
        id,
        title: '',
        url,
        source: 'zhihu',
        sourceName: '知乎',
        publishTime: Date.now(),
      },
    };
  },
};

const newsSearch = {
  async search(keyword: string, page: number, limit: number): Promise<NewsSearchResult> {
    const url = `https://www.zhihu.com/api/v4/search_v3?t=general&q=${encodeURIComponent(keyword)}&offset=${(page - 1) * limit}&limit=${limit}`;
    const resp = await httpFetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    const data = resp.body as any;
    const news = ((data?.data as any[]) || []).map((item: any) => normalizeItem({
      id: item.object?.id,
      title: item.highlight?.title || item.object?.title,
      url: item.object?.url,
      target: item.object,
    }));
    return { news, total: news.length };
  },
};

const hotboard = {
  async boards() {
    return [{ id: 'hot', name: '知乎热榜', source: 'zhihu' }];
  },
  async list(id: string, page: number, limit: number): Promise<NewsListResult> {
    const url = `https://www.zhihu.com/api/v3/feed/topstory/hot-lists/total?limit=${limit}`;
    const resp = await httpFetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    const data = resp.body as any;
    const news = ((data?.data as any[]) || []).map(normalizeItem);
    return { news, hasMore: news.length >= limit };
  },
};

const zhihu: PlatformModule = {
  id: 'zhihu',
  name: '知乎热榜',
  newsList,
  newsDetail,
  newsSearch,
  hotboard,
};

export default zhihu;
