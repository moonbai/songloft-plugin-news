import httpFetch from '../request';
import type { NewsItem, CategoryItem } from '../../types';
import type { NewsListResult, NewsDetailResult, NewsSearchResult, PlatformModule } from '../types';
import { parseRssXml, parseRssDate, parseDuration } from '../../utils/xml';

const RSS_URL = 'https://www.people.com.cn/rss/audio.xml';
const SOURCE_ID = 'people';
const SOURCE_NAME = '人民日报';
const COVER_URL = 'https://www.people.com.cn/img/1000/2025/01/01/peoplelogo.png';

let cache: { list: NewsItem[]; expire: number } | null = null;
const CACHE_TTL = 6 * 3600 * 1000;

function normalize(item: any, index: number): NewsItem {
  const id = `people-${index}-${item.pubDate ? parseRssDate(item.pubDate) : Date.now()}`;
  const duration = parseDuration(item.duration || '');
  return {
    id,
    title: item.title,
    url: item.link || 'https://www.people.com.cn/',
    source: SOURCE_ID,
    sourceName: SOURCE_NAME,
    category: '有声播报',
    author: '人民日报',
    publishTime: parseRssDate(item.pubDate),
    summary: item.description,
    cover: item.image || COVER_URL,
    hot: 0,
    audioUrl: item.audioUrl,
    audioDuration: duration,
    ttsEnabled: false,
  };
}

async function fetchRss(): Promise<NewsItem[]> {
  const now = Date.now();
  if (cache && cache.expire > now) {
    return cache.list;
  }

  const resp = await httpFetch(RSS_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Songloft/1.0)',
    },
  });

  const xml = resp.raw as string;
  const rssItems = parseRssXml(xml);
  const list = rssItems.map((item, i) => normalize(item, i));

  cache = { list, expire: now + CACHE_TTL };
  return list;
}

const newsList = {
  async list(category: string, page: number, limit: number): Promise<NewsListResult> {
    const all = await fetchRss();
    const start = (page - 1) * limit;
    return {
      news: all.slice(start, start + limit),
      hasMore: start + limit < all.length,
    };
  },
  async categories(): Promise<CategoryItem[]> {
    return [
      { id: 'news', name: '热点短讯', source: SOURCE_ID },
    ];
  },
};

const newsDetail = {
  async detail(id: string): Promise<NewsDetailResult | null> {
    const all = await fetchRss();
    const item = all.find(n => n.id === id);
    if (!item) return null;
    return {
      news: item,
      content: item.summary,
    };
  },
};

const newsSearch = {
  async search(keyword: string, page: number, limit: number): Promise<NewsSearchResult> {
    const all = await fetchRss();
    const kw = keyword.toLowerCase();
    const matched = all.filter(n =>
      n.title.toLowerCase().includes(kw) ||
      n.summary.toLowerCase().includes(kw)
    );
    const start = (page - 1) * limit;
    return {
      news: matched.slice(start, start + limit),
      total: matched.length,
    };
  },
};

const hotboard = {
  async boards() {
    return [
      { id: 'news', name: '人民日报有声', source: SOURCE_ID },
    ];
  },
  async list(id: string, page: number, limit: number): Promise<NewsListResult> {
    return newsList.list(id, page, limit);
  },
};

const peopleModule: PlatformModule = {
  id: SOURCE_ID,
  name: SOURCE_NAME,
  newsList,
  newsDetail,
  newsSearch,
  hotboard,
};

export default peopleModule;
