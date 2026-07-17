import httpFetch from '../request';
import type { NewsItem, CategoryItem } from '../../types';
import type { NewsListResult, NewsDetailResult, NewsSearchResult, PlatformModule } from '../types';

function normalizeItem(item: any): NewsItem {
  return {
    id: String(item.word || item.id || ''),
    title: String(item.word || item.note || item.title || ''),
    url: String(item.url || `https://s.weibo.com/weibo?q=${encodeURIComponent(item.word || '')}`),
    source: 'weibo',
    sourceName: '微博热搜',
    author: '微博',
    publishTime: Date.now(),
    summary: String(item.note || ''),
    cover: '',
    hot: Number(item.raw_hot || item.num || item.hot || 0),
  };
}

const newsList = {
  async list(category: string, page: number, limit: number): Promise<NewsListResult> {
    return hotboard.list('hot', page, limit);
  },

  async categories(): Promise<CategoryItem[]> {
    return [{ id: 'hot', name: '微博热搜', source: 'weibo' }];
  },
};

const newsDetail = {
  async detail(id: string): Promise<NewsDetailResult | null> {
    return {
      news: {
        id,
        title: id,
        url: `https://s.weibo.com/weibo?q=${encodeURIComponent(id)}`,
        source: 'weibo',
        sourceName: '微博热搜',
        publishTime: Date.now(),
      },
    };
  },
};

const newsSearch = {
  async search(keyword: string, page: number, limit: number): Promise<NewsSearchResult> {
    // 微博搜索使用移动端接口
    const url = `https://m.weibo.cn/api/container/getIndex?containerid=100103type%3D1%26q%3D${encodeURIComponent(keyword)}&page_type=searchall&page=${page}`;
    const resp = await httpFetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_0 like Mac OS X)' },
    });
    const data = resp.body as any;
    const cards = (data?.data?.cards as any[]) || [];
    const news: NewsItem[] = [];
    for (const card of cards) {
      if (card.card_group) {
        for (const item of card.card_group) {
          if (item.mblog) {
            news.push({
              id: String(item.mblog.id || ''),
              title: String(item.mblog.text || '').replace(/<[^>]+>/g, '').slice(0, 100),
              url: `https://m.weibo.cn/detail/${item.mblog.id}`,
              source: 'weibo',
              sourceName: '微博',
              author: item.mblog.user?.screen_name || '',
              publishTime: Number(item.mblog.created_at ? new Date(item.mblog.created_at).getTime() : Date.now()),
              summary: String(item.mblog.text || '').replace(/<[^>]+>/g, '').slice(0, 200),
            });
          }
        }
      } else if (card.mblog) {
        news.push({
          id: String(card.mblog.id || ''),
          title: String(card.mblog.text || '').replace(/<[^>]+>/g, '').slice(0, 100),
          url: `https://m.weibo.cn/detail/${card.mblog.id}`,
          source: 'weibo',
          sourceName: '微博',
          author: card.mblog.user?.screen_name || '',
          publishTime: Number(card.mblog.created_at ? new Date(card.mblog.created_at).getTime() : Date.now()),
          summary: String(card.mblog.text || '').replace(/<[^>]+>/g, '').slice(0, 200),
        });
      }
    }
    return { news: news.slice(0, limit), total: news.length };
  },
};

const hotboard = {
  async boards() {
    return [{ id: 'hot', name: '微博热搜', source: 'weibo' }];
  },
  async list(id: string, page: number, limit: number): Promise<NewsListResult> {
    // 微博热搜移动端接口
    const url = 'https://m.weibo.cn/api/container/getIndex?containerid=106003type%3D25%26t%3D3%26disable_hot%3D1%26filter_type%3Drealtimehot';
    const resp = await httpFetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_0 like Mac OS X)' },
    });
    const data = resp.body as any;
    const cards = (data?.data?.cards as any[]) || [];
    const news: NewsItem[] = [];
    for (const card of cards) {
      const cardGroup = card.card_group || [];
      for (const item of cardGroup) {
        if (item.itemid && item.desc) {
          news.push(normalizeItem({
            word: item.desc,
            num: item.desc_extr,
            url: item.scheme,
          }));
        }
      }
    }
    return { news: news.slice(0, limit), hasMore: false };
  },
};

const weibo: PlatformModule = {
  id: 'weibo',
  name: '微博热搜',
  newsList,
  newsDetail,
  newsSearch,
  hotboard,
};

export default weibo;
