// 新闻列表/详情处理
import { parseQuery } from '@songloft/plugin-sdk';
import type { HTTPRequest } from '@songloft/plugin-sdk';
import { platformModules } from '../newsSdk/facade';
import { successResponse, errorResponse, badRequestResponse } from './response';
import type { RuntimeManager } from '../engine';

export function createNewsHandlers(runtimeManager: RuntimeManager) {
  return {
    /**
     * 获取分类列表
     */
    async getCategories(req: HTTPRequest) {
      try {
        const query = parseQuery(req.query);
        const source_id = String(query.source_id || 'toutiao');

        const module = platformModules[source_id];
        if (!module) return badRequestResponse('Unknown source');

        const categories = await module.newsList.categories();
        return successResponse({ categories });
      } catch (e) {
        return errorResponse('Failed to get categories: ' + (e as Error).message);
      }
    },

    /**
     * 获取新闻列表
     */
    async getList(req: HTTPRequest) {
      try {
        const query = parseQuery(req.query);
        const source_id = String(query.source_id || 'toutiao');
        const category = String(query.category || '');
        const page = Number(query.page) || 1;
        const limit = Number(query.limit) || 20;

        const result = await runtimeManager.fetchNewsList(source_id, category, page, limit);
        return successResponse(result);
      } catch (e) {
        return errorResponse('Failed to get list: ' + (e as Error).message);
      }
    },

    /**
     * 获取新闻详情
     */
    async getDetail(req: HTTPRequest) {
      try {
        const query = parseQuery(req.query);
        const source_id = String(query.source_id || 'toutiao');
        const id = String(query.id || '');

        if (!id) return badRequestResponse('id is required');

        const result = await runtimeManager.fetchNewsDetail(source_id, id);
        if (!result) return errorResponse('News not found', 404);
        return successResponse(result);
      } catch (e) {
        return errorResponse('Failed to get detail: ' + (e as Error).message);
      }
    },

    /**
     * 获取热榜
     */
    async getHotboard(req: HTTPRequest) {
      try {
        const query = parseQuery(req.query);
        const source_id = String(query.source_id || 'baidu');
        const board_id = String(query.board_id || 'hot');
        const page = Number(query.page) || 1;
        const limit = Number(query.limit) || 30;

        const module = platformModules[source_id];
        if (!module) return badRequestResponse('Unknown source');

        const result = await module.hotboard.list(board_id, page, limit);
        return successResponse(result);
      } catch (e) {
        return errorResponse('Failed to get hotboard: ' + (e as Error).message);
      }
    },

    /**
     * 获取热榜列表
     */
    async getBoards(req: HTTPRequest) {
      try {
        const query = parseQuery(req.query);
        const source_id = String(query.source_id || 'toutiao');

        const module = platformModules[source_id];
        if (!module) return badRequestResponse('Unknown source');

        const boards = await module.hotboard.boards();
        return successResponse({ boards });
      } catch (e) {
        return errorResponse('Failed to get boards: ' + (e as Error).message);
      }
    },
  };
}
