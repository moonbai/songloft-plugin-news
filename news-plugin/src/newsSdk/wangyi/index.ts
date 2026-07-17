import httpFetch from '../request';
import type { NewsItem, CategoryItem } from '../../types';
import type { NewsListResult, NewsDetailResult, NewsSearchResult, PlatformModule } from '../types';

function normalizeArticle(article: any): NewsItem {
  return {
    id: String(article.docid || article.id || article.sketchid || ''),
    title: String(article.title || ''),
    url: String(article.url || article.shareurl || `https://www.163.com/news/article/${article.docid}.html`),
    source: 'wangyi',
    sourceName: '网易新闻',
    category: article.channelname || article.category || '',
    author: article.source || article.mediaName || '',
    publishTime: new Date(article.ptime || Date.now()).getTime(),
    summary: String(article.digest || article.summary || ''),
    cover: String(article.imgsrc || article.bigimg || ''),
    hot: Number(article.commentCount || article.replyCount || 0),
  };
}

function parseJsonp(raw: string): any[] {
  if (!raw) return [];
  const match = raw.match(/artiList\((.+)\)/s);
  if (!match) return [];
  try {
    const obj = JSON.parse(match[1]);
    const keys = Object.keys(obj);
    if (keys.length > 0) return obj[keys[0]] || [];
    return [];
  } catch {
    return [];
  }
}

const newsList = {
  async list(category: string, page: number, limit: number): Promise<NewsListResult> {
    const cat = category || 'BBM54PGAwangning';
    const start = (page - 1) * limit;
    const url = `https://3g.163.com/touch/reconstruct/article/list/${cat}/${start}-${limit}.html`;
    const resp = await httpFetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
      },
      timeout: 10000,
    });
    const raw = resp.raw || String(resp.body || '');
    const data = parseJsonp(raw);
    const news = data.map(normalizeArticle);
    return { news, hasMore: news.length >= limit };
  },

  async categories(): Promise<CategoryItem[]> {
    return [
      { id: 'BBM54PGAwangning', name: '头条', source: 'wangyi' },
      { id: 'BA8BG6DGwangning', name: '娱乐', source: 'wangyi' },
      { id: 'BA8BG6DKwangning', name: '体育', source: 'wangyi' },
      { id: 'BA8D4A3Rwangning', name: '财经', source: 'wangyi' },
      { id: 'BAI67OGGwangning', name: '科技', source: 'wangyi' },
    ];
  },
};

const newsDetail = {
  async detail(id: string): Promise<NewsDetailResult | null> {
    return {
      news: {
        id,
        title: '',
        url: `https://www.163.com/news/article/${id}.html`,
        source: 'wangyi',
        sourceName: '网易新闻',
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
    return [{ id: 'hot', name: '网易热榜', source: 'wangyi' }];
  },
  async list(id: string, page: number, limit: number): Promise<NewsListResult> {
    return newsList.list('BBM54PGAwangning', page, limit);
  },
};

const wangyi: PlatformModule = {
  id: 'wangyi',
  name: '网易新闻',
  newsList,
  newsDetail,
  newsSearch,
  hotboard,
};

export default wangyi;
