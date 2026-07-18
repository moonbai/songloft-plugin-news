import httpFetch from '../request';
import type { NewsItem, CategoryItem } from '../../types';
import type { NewsListResult, NewsDetailResult, NewsSearchResult, PlatformModule } from '../types';

function normalizeItem(item: any): NewsItem {
  return {
    id: String(item.id || item.aid || ''),
    title: String(item.title || ''),
    url: String(item.url || `https://sspai.com/post/${item.id || item.aid}`),
    source: 'sspai',
    sourceName: '少数派',
    author: String(item.author || item.author_name || ''),
    publishTime: Number(item.released_time || item.publishTime || Date.now()) * 1000,
    summary: String(item.summary || item.description || ''),
    cover: String(item.cover || item.banner || ''),
    hot: Number(item.like_count || item.view_count || 0),
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
    const creatorMatch = itemXml.match(/<dc:creator><!\[CDATA\[([\s\S]*?)\]\]><\/dc:creator>/) || itemXml.match(/<dc:creator>([\s\S]*?)<\/dc:creator>/);
    
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
      author: creatorMatch ? creatorMatch[1].trim() : '',
      cover,
    });
  }
  
  return items;
}

const newsList = {
  async list(category: string, page: number, limit: number): Promise<NewsListResult> {
    const catMap: Record<string, string> = {
      'all': 'https://sspai.com/feed',
      'tech': 'https://sspai.com/feed',
      'app': 'https://sspai.com/feed',
      'life': 'https://sspai.com/feed',
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
        hot: Math.max(0, 600 - idx * 6),
      }));
      return { news, hasMore: start + limit < items.length };
    } catch (e) {
      songloft.log.error('sspai list error: ' + (e as Error).message);
      return { news: [], hasMore: false };
    }
  },

  async categories(): Promise<CategoryItem[]> {
    return [
      { id: 'all', name: '全部', source: 'sspai' },
      { id: 'tech', name: '科技', source: 'sspai' },
      { id: 'app', name: '应用', source: 'sspai' },
      { id: 'life', name: '生活', source: 'sspai' },
    ];
  },
};

const newsDetail = {
  async detail(id: string): Promise<NewsDetailResult | null> {
    const url = id && id.startsWith('http') ? id : `https://sspai.com/post/${id}`;
    try {
      const resp = await httpFetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      });
      const raw = resp.raw || String(resp.body || '');
      const titleMatch = raw.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
      const contentMatch = raw.match(/<div[^>]*class="[^"]*article-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
      const content = contentMatch ? contentMatch[1].replace(/<[^>]+>/g, '').trim() : '';
      return {
        news: {
          id,
          title: titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '',
          url,
          source: 'sspai',
          sourceName: '少数派',
          publishTime: Date.now(),
        },
        content: content.slice(0, 5000),
      };
    } catch (e) {
      songloft.log.error('sspai detail error: ' + (e as Error).message);
      return null;
    }
  },
};

const newsSearch = {
  async search(keyword: string, page: number, limit: number): Promise<NewsSearchResult> {
    try {
      const url = 'https://sspai.com/feed';
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
      songloft.log.error('sspai search error: ' + (e as Error).message);
      return { news: [], total: 0 };
    }
  },
};

const hotboard = {
  async boards() {
    return [{ id: 'hot', name: '少数派热榜', source: 'sspai' }];
  },
  async list(id: string, page: number, limit: number): Promise<NewsListResult> {
    try {
      const url = 'https://sspai.com/feed';
      const resp = await httpFetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      });
      const xml = resp.raw || String(resp.body || '');
      const items = parseRss(xml);
      const start = (page - 1) * limit;
      const pageItems = items.slice(start, start + limit);
      const news: NewsItem[] = pageItems.map((item, idx) => ({
        ...normalizeItem(item),
        hot: Math.max(0, 7000 - idx * 120),
      }));
      return { news, hasMore: false };
    } catch (e) {
      songloft.log.error('sspai hotboard error: ' + (e as Error).message);
      return { news: [], hasMore: false };
    }
  },
};

const sspai: PlatformModule = {
  id: 'sspai',
  name: '少数派',
  newsList,
  newsDetail,
  newsSearch,
  hotboard,
};

export default sspai;
