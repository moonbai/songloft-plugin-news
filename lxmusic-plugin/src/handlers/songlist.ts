import { kw, kg, tx, wy, mg } from '../musicSdk/facade';
import { successResponse, errorResponse, badRequestResponse } from './response';

const platformModules: Record<string, any> = { kw, kg, tx, wy, mg };

export function createSongListHandlers() {
  return {
    async getTags(req: unknown) {
      try {
        const query = (req as Record<string, unknown>).query as Record<string, string>;
        const source_id = query.source_id || 'kw';
        
        const module = platformModules[source_id];
        if (!module) return badRequestResponse('Unknown source');
        
        const result = await module.songList.tags();
        return successResponse(result);
      } catch (e) {
        return errorResponse('Failed to get tags');
      }
    },

    async getList(req: unknown) {
      try {
        const query = (req as Record<string, unknown>).query as Record<string, string>;
        const source_id = query.source_id || 'kw';
        const tag = query.tag || '';
        const page = Number(query.page) || 1;
        const limit = Number(query.limit) || 20;
        
        const module = platformModules[source_id];
        if (!module) return badRequestResponse('Unknown source');
        
        const result = await module.songList.list(tag, page, limit);
        return successResponse(result);
      } catch (e) {
        return errorResponse('Failed to get song list');
      }
    },

    async getDetail(req: unknown) {
      try {
        const query = (req as Record<string, unknown>).query as Record<string, string>;
        const source_id = query.source_id || 'kw';
        const id = query.id;
        
        if (!id) return badRequestResponse('ID is required');
        
        const module = platformModules[source_id];
        if (!module) return badRequestResponse('Unknown source');
        
        const result = await module.songList.detail(id);
        return successResponse(result);
      } catch (e) {
        return errorResponse('Failed to get song list detail');
      }
    },

    async search(req: unknown) {
      try {
        const query = (req as Record<string, unknown>).query as Record<string, string>;
        const source_id = query.source_id || 'kw';
        const keyword = query.keyword;
        const page = Number(query.page) || 1;
        const limit = Number(query.limit) || 20;
        
        if (!keyword) return badRequestResponse('Keyword is required');
        
        const module = platformModules[source_id];
        if (!module) return badRequestResponse('Unknown source');
        
        const result = await module.songList.search(keyword, page, limit);
        return successResponse(result);
      } catch (e) {
        return errorResponse('Failed to search song list');
      }
    },

    async getSorts(req: unknown) {
      try {
        const query = (req as Record<string, unknown>).query as Record<string, string>;
        const source_id = query.source_id || 'kw';
        
        const module = platformModules[source_id];
        if (!module) return badRequestResponse('Unknown source');
        
        const result = await module.songList.sorts();
        return successResponse(result);
      } catch (e) {
        return errorResponse('Failed to get sorts');
      }
    },
  };
}
