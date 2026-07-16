"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNewsHandlers = createNewsHandlers;
// 新闻列表/详情处理
const facade_1 = require("../newsSdk/facade");
const response_1 = require("./response");
function createNewsHandlers(runtimeManager) {
    return {
        /**
         * 获取分类列表
         */
        async getCategories(req) {
            try {
                const request = req;
                const source_id = String(request.query?.source_id || 'toutiao');
                const module = facade_1.platformModules[source_id];
                if (!module)
                    return (0, response_1.badRequestResponse)('Unknown source');
                const categories = await module.newsList.categories();
                return (0, response_1.successResponse)({ categories });
            }
            catch (e) {
                return (0, response_1.errorResponse)('Failed to get categories: ' + e.message);
            }
        },
        /**
         * 获取新闻列表
         */
        async getList(req) {
            try {
                const request = req;
                const source_id = String(request.query?.source_id || 'toutiao');
                const category = String(request.query?.category || '');
                const page = Number(request.query?.page) || 1;
                const limit = Number(request.query?.limit) || 20;
                const result = await runtimeManager.fetchNewsList(source_id, category, page, limit);
                return (0, response_1.successResponse)(result);
            }
            catch (e) {
                return (0, response_1.errorResponse)('Failed to get list: ' + e.message);
            }
        },
        /**
         * 获取新闻详情
         */
        async getDetail(req) {
            try {
                const request = req;
                const source_id = String(request.query?.source_id || 'toutiao');
                const id = String(request.query?.id || '');
                if (!id)
                    return (0, response_1.badRequestResponse)('id is required');
                const result = await runtimeManager.fetchNewsDetail(source_id, id);
                if (!result)
                    return (0, response_1.errorResponse)('News not found', 404);
                return (0, response_1.successResponse)(result);
            }
            catch (e) {
                return (0, response_1.errorResponse)('Failed to get detail: ' + e.message);
            }
        },
        /**
         * 获取热榜
         */
        async getHotboard(req) {
            try {
                const request = req;
                const source_id = String(request.query?.source_id || 'baidu');
                const board_id = String(request.query?.board_id || 'hot');
                const page = Number(request.query?.page) || 1;
                const limit = Number(request.query?.limit) || 30;
                const module = facade_1.platformModules[source_id];
                if (!module)
                    return (0, response_1.badRequestResponse)('Unknown source');
                const result = await module.hotboard.list(board_id, page, limit);
                return (0, response_1.successResponse)(result);
            }
            catch (e) {
                return (0, response_1.errorResponse)('Failed to get hotboard: ' + e.message);
            }
        },
        /**
         * 获取热榜列表
         */
        async getBoards(req) {
            try {
                const request = req;
                const source_id = String(request.query?.source_id || 'toutiao');
                const module = facade_1.platformModules[source_id];
                if (!module)
                    return (0, response_1.badRequestResponse)('Unknown source');
                const boards = await module.hotboard.boards();
                return (0, response_1.successResponse)({ boards });
            }
            catch (e) {
                return (0, response_1.errorResponse)('Failed to get boards: ' + e.message);
            }
        },
    };
}
