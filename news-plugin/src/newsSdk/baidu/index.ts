import httpFetch from '../request';
import type { NewsItem, CategoryItem } from '../../types';
import type { NewsListResult, NewsDetailResult, NewsSearchResult, PlatformModule } from '../types';

function normalizeItem(item: any): NewsItem {
  return {
    id: String(item.id || item.wordId || item.card_id || ''),
    title: String(item.word || item.title || item.desc || ''),
    url: String(item.url || item.link || `https://www.baidu.com/s?wd=${encodeURIComponent(item.word || item.title || '')}`),
    source: 'baidu',
    sourceName: '百度热搜',
    author: item.source || '',
    publishTime: Number(item.publishTime || item.createTime || Date.now()),
    summary: String(item.desc || ''),
    cover: String(item.img || ''),
    hot: Number(item.hotScore || item.score || item.hot || 0),
  };
}

const newsList = {
  async list(category: string, page: number, limit: number): Promise<NewsListResult> {
    const url = `https://top.baidu.com/board?tab=${encodeURIComponent(category || 'realtime')}`;
    const resp = await httpFetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    const raw = resp.raw || String(resp.body || '');
    const contentMatch = raw.match(/<!--s-data:({.+?})-->/);
    if (!contentMatch) return { news: [] };
    let data: any;
    try {
      data = JSON.parse(contentMatch[1]);
    } catch (e) {
      return { news: [] };
    }
    const cards = (data.data?.cards || []) as any[];
    const news: NewsItem[] = [];
    for (const card of cards) {
      if (card.content && Array.isArray(card.content)) {
        for (const item of card.content) {
          news.push(normalizeItem(item));
        }
      }
    }
    return { news, hasMore: false };
  },

  async categories(): Promise<CategoryItem[]> {
    return [
      { id: 'realtime', name: '实时热点', source: 'baidu' },
      { id: 'novel', name: '小说', source: 'baidu' },
      { id: 'movie', name: '电影', source: 'baidu' },
      { id: 'teleplay', name: '电视剧', source: 'baidu' },
      { id: 'car', name: '汽车', source: 'baidu' },
      { id: 'game', name: '游戏', source: 'baidu' },
    ];
  },
};

const newsDetail = {
  async detail(id: string): Promise<NewsDetailResult | null> {
    return {
      news: {
        id,
        title: '',
        url: '',
        source: 'baidu',
        sourceName: '百度热搜',
        publishTime: Date.now(),
      },
    };
  },
};

const newsSearch = {
  async search(keyword: string, page: number, limit: number): Promise<NewsSearchResult> {
    const url = `https://www.baidu.com/s?wd=${encodeURIComponent(keyword)}&rn=${limit}&pn=${(page - 1) * limit}`;
    const resp = await httpFetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    const raw = resp.raw || String(resp.body || '');
    const titleRegex = /<h3[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
    const news: NewsItem[] = [];
    let match;
    let count = 0;
    while ((match = titleRegex.exec(raw)) !== null && count < limit) {
      news.push({
        id: String(count),
        title: match[2],
        url: match[1],
        source: 'baidu',
        sourceName: '百度搜索',
        publishTime: Date.now(),
      });
      count++;
    }
    return { news, total: news.length };
  },
};

const hotboard = {
  async boards() {
    return [{ id: 'hot', name: '百度热搜', source: 'baidu' }];
  },
  async list(id: string, page: number, limit: number): Promise<NewsListResult> {
    return newsList.list('realtime', page, limit);
  },
};

const baidu: PlatformModule = {
  id: 'baidu',
  name: '百度热搜',
  newsList,
  newsDetail,
  newsSearch,
  hotboard,
};

export default baidu;
