// 搜索处理
import { sources, platformModules } from '../newsSdk/facade';
import { successResponse, errorResponse, badRequestResponse } from './response';
export function createSearchHandlers() {
    return {
        async search(req) {
            try {
                const request = req;
                const body = request.body;
                const params = request.query || {};
                let keyword, source_id, page, page_size;
                if (body) {
                    const text = new TextDecoder().decode(body);
                    const parsed = JSON.parse(text);
                    keyword = String(parsed.keyword || '');
                    source_id = String(parsed.source_id || 'all');
                    page = Number(parsed.page) || 1;
                    page_size = Number(parsed.page_size) || 20;
                }
                else {
                    keyword = String(params.keyword || '');
                    source_id = String(params.source_id || 'all');
                    page = Number(params.page) || 1;
                    page_size = Number(params.page_size) || 20;
                }
                if (!keyword)
                    return badRequestResponse('Keyword is required');
                // 如果是 all，则并行查询所有平台
                if (source_id === 'all') {
                    const promises = sources
                        .filter(s => platformModules[s.id])
                        .map(async (s) => {
                        try {
                            const result = await platformModules[s.id].newsSearch.search(keyword, 1, 5);
                            return result.news;
                        }
                        catch (e) {
                            return [];
                        }
                    });
                    const results = await Promise.all(promises);
                    const allNews = [];
                    for (const arr of results) {
                        allNews.push(...arr);
                    }
                    return successResponse({
                        results: allNews.slice(0, page_size),
                        total: allNews.length,
                    });
                }
                const module = platformModules[source_id];
                if (!module)
                    return badRequestResponse('Unknown source');
                const result = await module.newsSearch.search(keyword, page, page_size);
                return successResponse({
                    results: result.news,
                    total: result.total,
                });
            }
            catch (e) {
                return errorResponse('Search failed: ' + e.message);
            }
        },
        async getSources(req) {
            try {
                return successResponse(sources);
            }
            catch (e) {
                return errorResponse('Failed to get sources');
            }
        },
    };
}
