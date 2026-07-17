import httpFetch from '../request';
import type { NewsItem, CategoryItem } from '../../types';
import type { NewsListResult, NewsDetailResult, NewsSearchResult, PlatformModule } from '../types';

function normalizeArticle(article: any): NewsItem {
  return {
    id: String(article.item_id || article.article_id || article.id || article.group_id || ''),
    title: String(article.title || article.name || ''),
    url: String(article.article_url || article.url || ''),
    source: 'toutiao',
    sourceName: '今日头条',
    category: article.category || '',
    author: article.source || article.media_name || '',
    publishTime: Number(article.publish_time || article.publishTime || article.behot_time || Date.now() / 1000) * 1000,
    summary: String(article.abstract || article.summary || article.content || ''),
    cover: String(article.article_genre_image || article.large_image_url || article.middle_image || article.image_url || ''),
    hot: Number(article.hot || article.comment_count || 0),
  };
}

const newsList = {
  async list(category: string, page: number, limit: number): Promise<NewsListResult> {
    const offset = (page - 1) * limit;
    const url = `https://www.toutiao.com/api/pc/list/feed?category=${category || '__all__'}&visit_user_id=&offset=${offset}&count=${limit}`;
    const resp = await httpFetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    const data = resp.body as any;
    const news = ((data?.data as any[]) || []).map(normalizeArticle);
    return { news, hasMore: news.length >= limit };
  },

  async categories(): Promise<CategoryItem[]> {
    return [
      { id: '__all__', name: '推荐', source: 'toutiao' },
      { id: 'news_hot', name: '热点', source: 'toutiao' },
      { id: 'news_society', name: '社会', source: 'toutiao' },
      { id: 'news_entertainment', name: '娱乐', source: 'toutiao' },
      { id: 'news_tech', name: '科技', source: 'toutiao' },
      { id: 'news_sports', name: '体育', source: 'toutiao' },
      { id: 'news_finance', name: '财经', source: 'toutiao' },
    ];
  },
};

const newsDetail = {
  async detail(id: string): Promise<NewsDetailResult | null> {
    const url = `https://www.toutiao.com/i${id}/`;
    const resp = await httpFetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    const raw = resp.raw || String(resp.body || '');
    const titleMatch = raw.match(/<title>([^<]+)<\/title>/);
    const title = titleMatch ? titleMatch[1] : '';
    return {
      news: {
        id,
        title,
        url,
        source: 'toutiao',
        sourceName: '今日头条',
        publishTime: Date.now(),
      },
      content: raw.replace(/<[^>]+>/g, '').trim().slice(0, 5000),
    };
  },
};

const newsSearch = {
  async search(keyword: string, page: number, limit: number): Promise<NewsSearchResult> {
    const offset = (page - 1) * limit;
    const url = `https://www.toutiao.com/search/keyword/?keyword=${encodeURIComponent(keyword)}&pd=information&action_type=search&offset=${offset}&count=${limit}`;
    const resp = await httpFetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    const data = resp.body as any;
    const news = ((data?.data as any[]) || []).map(normalizeArticle);
    return { news, total: news.length };
  },
};

const hotboard = {
  async boards() {
    return [{ id: 'hot', name: '今日热榜', source: 'toutiao' }];
  },
  async list(id: string, page: number, limit: number): Promise<NewsListResult> {
    return newsList.list('news_hot', page, limit);
  },
};

const toutiao: PlatformModule = {
  id: 'toutiao',
  name: '今日头条',
  newsList,
  newsDetail,
  newsSearch,
  hotboard,
};

export default toutiao;
