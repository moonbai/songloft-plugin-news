// 搜索处理
import { parseQuery } from '@songloft/plugin-sdk';
import type { HTTPRequest } from '@songloft/plugin-sdk';
import { sources, platformModules } from '../newsSdk/facade';
import { successResponse, errorResponse, badRequestResponse, parseJsonBody } from './response';
import type { NewsItem } from '../types';

const HOTBOARD_SOURCES = ['baidu', 'zhihu', 'wangyi', 'weibo', '36kr', 'ithome', 'huxiu', 'sspai', 'juejin', 'toutiao', 'pengpai'];

async function loadHotboardNews(sourceId: string, limit: number): Promise<NewsItem[]> {
  const module = platformModules[sourceId];
  if (!module?.hotboard) return [];
  try {
    const boards = await module.hotboard.boards();
    if (boards.length === 0) return [];
    const result = await module.hotboard.list(boards[0].id, 1, limit);
    return result.news;
  } catch {
    return [];
  }
}

/**
 * 使用平台原生搜索接口搜索新闻
 * 如果平台不支持原生搜索或搜索失败，回退到热榜过滤
 */
async function searchNews(sourceId: string, keyword: string, limit: number): Promise<NewsItem[]> {
  const module = platformModules[sourceId];
  if (!module) return [];

  // 优先使用平台原生搜索
  if (module.newsSearch?.search) {
    try {
      const result = await module.newsSearch.search(keyword, 1, limit);
      if (result.news && result.news.length > 0) {
        return result.news;
      }
    } catch {
      // 搜索失败，回退到热榜过滤
    }
  }

  // 回退：从热榜中过滤
  return loadHotboardNews(sourceId, 50).then(news => filterByKeyword(news, keyword));
}

function filterByKeyword(items: NewsItem[], keyword: string): NewsItem[] {
  const kw = keyword.toLowerCase();
  return items.filter(item =>
    (item.title && item.title.toLowerCase().includes(kw)) ||
    (item.summary && item.summary.toLowerCase().includes(kw)) ||
    (item.author && item.author.toLowerCase().includes(kw))
  );
}

function normalizeHot(items: NewsItem[]): NewsItem[] {
  if (items.length === 0) return items;
  const maxHot = Math.max(...items.map(i => i.hot || 0));
  if (maxHot <= 0) return items.map(i => ({ ...i, hotLevel: 0 }));
  return items.map(i => {
    const ratio = (i.hot || 0) / maxHot;
    let hotLevel = 1;
    if (ratio >= 0.9) hotLevel = 5;
    else if (ratio >= 0.7) hotLevel = 4;
    else if (ratio >= 0.5) hotLevel = 3;
    else if (ratio >= 0.25) hotLevel = 2;
    else hotLevel = 1;
    return { ...i, hotLevel };
  });
}

export function createSearchHandlers() {
  return {
    async search(req: HTTPRequest) {
      try {
        const query = parseQuery(req.query);

        let keyword: string, source_id: string, page: number, page_size: number;

        if (req.body) {
          const parsed = parseJsonBody(req.body);
          keyword = String(parsed.keyword || '');
          source_id = String(parsed.source_id || 'all');
          page = Number(parsed.page) || 1;
          page_size = Number(parsed.page_size) || 20;
        } else {
          keyword = String(query.keyword || '');
          source_id = String(query.source_id || 'all');
          page = Number(query.page) || 1;
          page_size = Number(query.page_size) || 20;
        }

        if (!keyword) return badRequestResponse('Keyword is required');

        const sourceIds = source_id === 'all'
          ? HOTBOARD_SOURCES.filter(s => platformModules[s])
          : [source_id].filter(s => platformModules[s]);

        // 使用各平台的搜索功能，失败时回退到热榜过滤
        const promises = sourceIds.map(async (sid) => {
          const news = await searchNews(sid, keyword, 30);
          return normalizeHot(news);
        });

        const results = await Promise.all(promises);
        const allNews: NewsItem[] = [];
        for (const arr of results) {
          allNews.push(...arr);
        }

        allNews.sort((a, b) => ((b as any).hotLevel || 0) - ((a as any).hotLevel || 0));

        const start = (page - 1) * page_size;
        const pageData = allNews.slice(start, start + page_size);

        return successResponse({
          results: pageData,
          total: allNews.length,
        });
      } catch (e) {
        return errorResponse('Search failed: ' + (e as Error).message);
      }
    },

    async getSources(req: HTTPRequest) {
      try {
        return successResponse(sources);
      } catch (e) {
        return errorResponse('Failed to get sources');
      }
    },
  };
}
