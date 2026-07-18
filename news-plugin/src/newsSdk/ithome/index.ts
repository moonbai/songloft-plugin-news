import httpFetch from '../request';
import type { NewsItem, CategoryItem } from '../../types';
import type { NewsListResult, NewsDetailResult, NewsSearchResult, PlatformModule } from '../types';

function normalizeItem(item: any): NewsItem {
  return {
    id: String(item.id || item.guid || ''),
    title: String(item.title || ''),
    url: String(item.url || item.link || ''),
    source: 'ithome',
    sourceName: 'IT之家',
    author: String(item.author || item.source || ''),
    publishTime: Number(item.pubDate || item.publishTime || Date.now()),
    summary: String(item.description || item.summary || '').replace(/<[^>]+>/g, ''),
    cover: String(item.cover || item.image || ''),
    hot: Number(item.hot || item.views || 0),
  };
}

function parseRss(xml: string): any[] {
  const items: any[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  
  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const titleMatch = itemXml.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) || itemXml.match(/<title>([\s\S]*?)<\/title>/);
    const linkMatch = itemXml.match(/<link>([\s\S]*?)<\/link>/);
    const descMatch = itemXml.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) || itemXml.match(/<description>([\s\S]*?)<\/description>/);
    const pubDateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
    const guidMatch = itemXml.match(/<guid[^>]*>([\s\S]*?)<\/guid>/);
    const authorMatch = itemXml.match(/<author>([\s\S]*?)<\/author>/);
    
    let pubTime = Date.now();
    if (pubDateMatch) {
      const d = new Date(pubDateMatch[1].trim());
      if (!isNaN(d.getTime())) pubTime = d.getTime();
    }
    
    let cover = '';
    if (descMatch) {
      const imgMatch = descMatch[1].match(/<img[^>]+src="([^"]+)"/);
      if (imgMatch) cover = imgMatch[1];
    }
    
    const id = guidMatch ? guidMatch[1].trim() : (linkMatch ? linkMatch[1].trim() : '');
    
    items.push({
      id,
      title: titleMatch ? titleMatch[1].trim() : '',
      link: linkMatch ? linkMatch[1].trim() : '',
      description: descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim() : '',
      pubDate: pubTime,
      author: authorMatch ? authorMatch[1].trim() : '',
      cover,
    });
  }
  
  return items;
}

const newsList = {
  async list(category: string, page: number, limit: number): Promise<NewsListResult> {
    const catMap: Record<string, string> = {
      'all': 'https://www.ithome.com/rss/',
      'news': 'https://www.ithome.com/rss/',
      'it': 'https://www.ithome.com/rss/',
      'mobile': 'https://www.ithome.com/rss/',
    };
    const url = catMap[category] || catMap['all'];
    
    try {
      const resp = await httpFetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });
      const xml = resp.raw || String(resp.body || '');
      const items = parseRss(xml);
      const start = (page - 1) * limit;
      const pageItems = items.slice(start, start + limit);
      const news: NewsItem[] = pageItems.map((item, idx) => ({
        ...normalizeItem(item),
        hot: Math.max(0, 1000 - idx * 10),
      }));
      return { news, hasMore: start + limit < items.length };
    } catch (e) {
      songloft.log.error('ithome list error: ' + (e as Error).message);
      return { news: [], hasMore: false };
    }
  },

  async categories(): Promise<CategoryItem[]> {
    return [
      { id: 'all', name: '全部', source: 'ithome' },
      { id: 'news', name: '资讯', source: 'ithome' },
      { id: 'it', name: 'IT圈', source: 'ithome' },
    ];
  },
};

const newsDetail = {
  async detail(id: string): Promise<NewsDetailResult | null> {
    const url = id && id.startsWith('http') ? id : `https://www.ithome.com/0/${id}.htm`;
    try {
      const resp = await httpFetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      });
      const raw = resp.raw || String(resp.body || '');
      const titleMatch = raw.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
      const contentMatch = raw.match(/<div[^>]*class="[^"]*post-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
      const content = contentMatch ? contentMatch[1].replace(/<[^>]+>/g, '').trim() : '';
      return {
        news: {
          id,
          title: titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '',
          url,
          source: 'ithome',
          sourceName: 'IT之家',
          publishTime: Date.now(),
        },
        content: content.slice(0, 5000),
      };
    } catch (e) {
      songloft.log.error('ithome detail error: ' + (e as Error).message);
      return null;
    }
  },
};

const newsSearch = {
  async search(keyword: string, page: number, limit: number): Promise<NewsSearchResult> {
    try {
      const url = `https://www.ithome.com/rss/`;
      const resp = await httpFetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      });
      const xml = resp.raw || String(resp.body || '');
      const items = parseRss(xml);
      const kw = keyword.toLowerCase();
      const filtered = items.filter(item => 
        item.title.toLowerCase().includes(kw) || 
        item.description.toLowerCase().includes(kw)
      );
      const start = (page - 1) * limit;
      const news = filtered.slice(start, start + limit).map(normalizeItem);
      return { news, total: filtered.length };
    } catch (e) {
      songloft.log.error('ithome search error: ' + (e as Error).message);
      return { news: [], total: 0 };
    }
  },
};

const hotboard = {
  async boards() {
    return [{ id: 'hot', name: 'IT之家热榜', source: 'ithome' }];
  },
  async list(id: string, page: number, limit: number): Promise<NewsListResult> {
    try {
      const url = 'https://www.ithome.com/rss/';
      const resp = await httpFetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      });
      const xml = resp.raw || String(resp.body || '');
      const items = parseRss(xml);
      const start = (page - 1) * limit;
      const pageItems = items.slice(start, start + limit);
      const news: NewsItem[] = pageItems.map((item, idx) => ({
        ...normalizeItem(item),
        hot: Math.max(0, 10000 - idx * 200),
      }));
      return { news, hasMore: false };
    } catch (e) {
      songloft.log.error('ithome hotboard error: ' + (e as Error).message);
      return { news: [], hasMore: false };
    }
  },
};

const ithome: PlatformModule = {
  id: 'ithome',
  name: 'IT之家',
  newsList,
  newsDetail,
  newsSearch,
  hotboard,
};

export default ithome;
