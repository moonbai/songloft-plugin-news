// 搜索处理
import { sources, platformModules } from '../newsSdk/facade';
import { successResponse, errorResponse, badRequestResponse, parseJsonBody } from './response';
import type { NewsItem } from '../types';

const HOTBOARD_SOURCES = ['baidu', 'zhihu', 'wangyi'];

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

function filterByKeyword(items: NewsItem[], keyword: string): NewsItem[] {
  const kw = keyword.toLowerCase();
  return items.filter(item =>
    (item.title && item.title.toLowerCase().includes(kw)) ||
    (item.summary && item.summary.toLowerCase().includes(kw)) ||
    (item.author && item.author.toLowerCase().includes(kw))
  );
}

export function createSearchHandlers() {
  return {
    async search(req: unknown) {
      try {
        const request = req as any;
        const params = request.query || {};

        let keyword: string, source_id: string, page: number, page_size: number;

        if (request.body) {
          const parsed = parseJsonBody(request.body);
          keyword = String(parsed.keyword || '');
          source_id = String(parsed.source_id || 'all');
          page = Number(parsed.page) || 1;
          page_size = Number(parsed.page_size) || 20;
        } else {
          keyword = String(params.keyword || '');
          source_id = String(params.source_id || 'all');
          page = Number(params.page) || 1;
          page_size = Number(params.page_size) || 20;
        }

        if (!keyword) return badRequestResponse('Keyword is required');

        const sourceIds = source_id === 'all'
          ? HOTBOARD_SOURCES.filter(s => platformModules[s])
          : [source_id].filter(s => platformModules[s]);

        const promises = sourceIds.map(async (sid) => {
          const news = await loadHotboardNews(sid, 50);
          return filterByKeyword(news, keyword);
        });

        const results = await Promise.all(promises);
        const allNews: NewsItem[] = [];
        for (const arr of results) {
          allNews.push(...arr);
        }

        allNews.sort((a, b) => (b.hot || 0) - (a.hot || 0));

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

    async getSources(req: unknown) {
      try {
        return successResponse(sources);
      } catch (e) {
        return errorResponse('Failed to get sources');
      }
    },
  };
}
