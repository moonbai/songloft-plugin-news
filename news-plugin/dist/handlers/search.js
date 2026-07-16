"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSearchHandlers = createSearchHandlers;
// 搜索处理
const facade_1 = require("../newsSdk/facade");
const response_1 = require("./response");
function createSearchHandlers() {
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
                    return (0, response_1.badRequestResponse)('Keyword is required');
                // 如果是 all，则并行查询所有平台
                if (source_id === 'all') {
                    const promises = facade_1.sources
                        .filter(s => facade_1.platformModules[s.id])
                        .map(async (s) => {
                        try {
                            const result = await facade_1.platformModules[s.id].newsSearch.search(keyword, 1, 5);
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
                    return (0, response_1.successResponse)({
                        results: allNews.slice(0, page_size),
                        total: allNews.length,
                    });
                }
                const module = facade_1.platformModules[source_id];
                if (!module)
                    return (0, response_1.badRequestResponse)('Unknown source');
                const result = await module.newsSearch.search(keyword, page, page_size);
                return (0, response_1.successResponse)({
                    results: result.news,
                    total: result.total,
                });
            }
            catch (e) {
                return (0, response_1.errorResponse)('Search failed: ' + e.message);
            }
        },
        async getSources(req) {
            try {
                return (0, response_1.successResponse)(facade_1.sources);
            }
            catch (e) {
                return (0, response_1.errorResponse)('Failed to get sources');
            }
        },
    };
}
