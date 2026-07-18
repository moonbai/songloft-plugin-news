import httpFetch from '../request';
import type { NewsItem, CategoryItem } from '../../types';
import type { NewsListResult, NewsDetailResult, NewsSearchResult, PlatformModule } from '../types';

function normalizeItem(item: any): NewsItem {
  return {
    id: String(item.id || item.article_id || ''),
    title: String(item.title || item.article_info?.title || ''),
    url: String(item.url || `https://juejin.cn/post/${item.article_id || item.id}`),
    source: 'juejin',
    sourceName: '掘金',
    author: String(item.author || item.author_user_info?.user_name || ''),
    publishTime: Number(item.ctime || item.publishTime || Date.now()) * 1000,
    summary: String(item.summary || item.article_info?.brief_content || ''),
    cover: String(item.cover || item.article_info?.cover_image || ''),
    hot: Number(item.view_count || item.article_info?.view_count || 0),
  };
}

const newsList = {
  async list(category: string, page: number, limit: number): Promise<NewsListResult> {
    const categoryMap: Record<string, string> = {
      'all': '',
      'frontend': '6809637767543259144',
      'backend': '6809637769959178254',
      'android': '6809635626661445640',
      'ios': '6809635626879549454',
      'ai': '6809637773935378440',
    };
    const cateId = categoryMap[category] || '';
    
    try {
      const url = 'https://api.juejin.cn/recommend_api/v1/article/recommend_cate_feed';
      const resp = await httpFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        body: JSON.stringify({
          id_type: 2,
          sort_type: 200,
          cate_id: cateId,
          cursor: String((page - 1) * limit),
          limit: limit,
        }),
      });
      const data = resp.body as any;
      const items = (data?.data || []) as any[];
      const news: NewsItem[] = items.map(item => ({
        id: item.article_id,
        title: item.article_info?.title || '',
        url: `https://juejin.cn/post/${item.article_id}`,
        source: 'juejin',
        sourceName: '掘金',
        author: item.author_user_info?.user_name || '',
        publishTime: Number(item.article_info?.ctime || 0) * 1000,
        summary: item.article_info?.brief_content || '',
        cover: item.article_info?.cover_image || '',
        hot: item.article_info?.view_count || 0,
      }));
      return { news, hasMore: items.length >= limit };
    } catch (e) {
      songloft.log.error('juejin list error: ' + (e as Error).message);
      return { news: [], hasMore: false };
    }
  },

  async categories(): Promise<CategoryItem[]> {
    return [
      { id: 'all', name: '推荐', source: 'juejin' },
      { id: 'frontend', name: '前端', source: 'juejin' },
      { id: 'backend', name: '后端', source: 'juejin' },
      { id: 'android', name: 'Android', source: 'juejin' },
      { id: 'ios', name: 'iOS', source: 'juejin' },
      { id: 'ai', name: '人工智能', source: 'juejin' },
    ];
  },
};

const newsDetail = {
  async detail(id: string): Promise<NewsDetailResult | null> {
    const url = `https://juejin.cn/post/${id}`;
    try {
      const resp = await httpFetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      });
      const raw = resp.raw || String(resp.body || '');
      const titleMatch = raw.match(/<title>([\s\S]*?)<\/title>/);
      const contentMatch = raw.match(/<div[^>]*class="[^"]*article-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
      const content = contentMatch ? contentMatch[1].replace(/<[^>]+>/g, '').trim() : '';
      return {
        news: {
          id,
          title: titleMatch ? titleMatch[1].replace(/\s*-\s*掘金.*$/, '').trim() : '',
          url,
          source: 'juejin',
          sourceName: '掘金',
          publishTime: Date.now(),
        },
        content: content.slice(0, 5000),
      };
    } catch (e) {
      songloft.log.error('juejin detail error: ' + (e as Error).message);
      return null;
    }
  },
};

const newsSearch = {
  async search(keyword: string, page: number, limit: number): Promise<NewsSearchResult> {
    try {
      const url = 'https://api.juejin.cn/search_api/v1/search';
      const resp = await httpFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        body: JSON.stringify({
          keyword,
          id_type: 0,
          cursor: String((page - 1) * limit),
          limit: limit,
          search_type: 0,
          version: 1,
        }),
      });
      const data = resp.body as any;
      const items = (data?.data || []) as any[];
      const news = items.map(item => ({
        id: item.result_model?.article_id || item.id,
        title: item.result_model?.title || item.title || '',
        url: `https://juejin.cn/post/${item.result_model?.article_id || item.id}`,
        source: 'juejin',
        sourceName: '掘金',
        author: item.result_model?.author_user_info?.user_name || '',
        publishTime: Number(item.result_model?.ctime || 0) * 1000,
        summary: item.result_model?.brief_content || '',
        cover: item.result_model?.cover_image || '',
        hot: item.result_model?.view_count || 0,
      }));
      return { news: news.slice(0, limit), total: news.length };
    } catch (e) {
      songloft.log.error('juejin search error: ' + (e as Error).message);
      return { news: [], total: 0 };
    }
  },
};

const hotboard = {
  async boards() {
    return [
      { id: 'hot', name: '掘金热榜', source: 'juejin' },
    ];
  },
  async list(id: string, page: number, limit: number): Promise<NewsListResult> {
    try {
      const url = 'https://api.juejin.cn/content_api/v1/content/article_rank';
      const resp = await httpFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        body: JSON.stringify({
          category_id: '1',
          cursor: '0',
          limit: limit,
        }),
      });
      const data = resp.body as any;
      const items = (data?.data || []) as any[];
      const news: NewsItem[] = items.map(item => ({
        id: item.content_id || item.article_id,
        title: item.content?.title || item.article_info?.title || '',
        url: `https://juejin.cn/post/${item.content_id || item.article_id}`,
        source: 'juejin',
        sourceName: '掘金',
        author: item.author?.name || item.author_user_info?.user_name || '',
        publishTime: Number(item.content?.ctime || 0) * 1000,
        summary: item.content?.brief_content || '',
        cover: item.content?.cover_image || '',
        hot: item.content_counter?.hot_rank || item.hot_rank || 0,
      }));
      return { news: news.slice(0, limit), hasMore: false };
    } catch (e) {
      songloft.log.error('juejin hotboard error: ' + (e as Error).message);
      return { news: [], hasMore: false };
    }
  },
};

const juejin: PlatformModule = {
  id: 'juejin',
  name: '掘金',
  newsList,
  newsDetail,
  newsSearch,
  hotboard,
};

export default juejin;
