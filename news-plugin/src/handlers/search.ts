// 搜索处理
import { sources, platformModules } from '../newsSdk/facade';
import { successResponse, errorResponse, badRequestResponse, parseJsonBody } from './response';
import type { NewsItem } from '../types';

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
        
        // 如果是 all，则并行查询所有平台
        if (source_id === 'all') {
          const promises = sources
            .filter(s => platformModules[s.id])
            .map(async (s) => {
              try {
                const result = await platformModules[s.id].newsSearch.search(keyword, 1, 5);
                return result.news;
              } catch (e) {
                return [];
              }
            });
          
          const results = await Promise.all(promises);
          const allNews: NewsItem[] = [];
          for (const arr of results) {
            allNews.push(...arr);
          }
          
          return successResponse({
            results: allNews.slice(0, page_size),
            total: allNews.length,
          });
        }
        
        const module = platformModules[source_id];
        if (!module) return badRequestResponse('Unknown source');
        
        const result = await module.newsSearch.search(keyword, page, page_size);
        
        return successResponse({
          results: result.news,
          total: result.total,
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
