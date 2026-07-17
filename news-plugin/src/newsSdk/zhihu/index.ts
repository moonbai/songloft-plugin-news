import httpFetch from '../request';
import type { NewsItem, CategoryItem } from '../../types';
import type { NewsListResult, NewsDetailResult, NewsSearchResult, PlatformModule } from '../types';

function normalizeItem(item: any): NewsItem {
  const target = item.target || {};
  const hotText = item.detail_text || '';
  const hotMatch = hotText.match(/(\d+)/);
  return {
    id: String(target.id || item.id || ''),
    title: String(target.title || ''),
    url: target.url
      ? String(target.url).replace('api.zhihu.com/questions', 'www.zhihu.com/question')
      : '',
    source: 'zhihu',
    sourceName: '知乎热榜',
    author: target.author?.name || '',
    publishTime: Number(target.created || Date.now() / 1000) * 1000,
    summary: String(target.excerpt || ''),
    cover: '',
    hot: hotMatch ? Number(hotMatch[1]) : 0,
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
    return {
      news: {
        id,
        title: '',
        url: `https://www.zhihu.com/question/${id}`,
        source: 'zhihu',
        sourceName: '知乎',
        publishTime: Date.now(),
      },
    };
  },
};

const newsSearch = {
  async search(keyword: string, page: number, limit: number): Promise<NewsSearchResult> {
    return { news: [], total: 0 };
  },
};

const hotboard = {
  async boards() {
    return [{ id: 'hot', name: '知乎热榜', source: 'zhihu' }];
  },
  async list(id: string, page: number, limit: number): Promise<NewsListResult> {
    const url = `https://api.zhihu.com/topstory/hot-list?limit=${limit}`;
    const resp = await httpFetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 10000,
    });
    const data = resp.body as any;
    const list = (data?.data as any[]) || [];
    const news = list.map(normalizeItem);
    return { news, hasMore: false };
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
