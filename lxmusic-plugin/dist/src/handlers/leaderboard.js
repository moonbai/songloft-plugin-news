import { kw, kg, tx, wy, mg } from '../musicSdk/facade';
import { successResponse, errorResponse, badRequestResponse } from './response';
const platformModules = { kw, kg, tx, wy, mg };
export function createLeaderboardHandlers() {
    return {
        async getBoards(req) {
            try {
                const query = req.query;
                const source_id = query.source_id || 'kw';
                const module = platformModules[source_id];
                if (!module)
                    return badRequestResponse('Unknown source');
                const result = await module.leaderboard.boards();
                return successResponse(result);
            }
            catch (e) {
                return errorResponse('Failed to get leaderboards');
            }
        },
        async getList(req) {
            try {
                const query = req.query;
                const source_id = query.source_id || 'kw';
                const id = query.id;
                const page = Number(query.page) || 1;
                const limit = Number(query.limit) || 20;
                if (!id)
                    return badRequestResponse('ID is required');
                const module = platformModules[source_id];
                if (!module)
                    return badRequestResponse('Unknown source');
                const result = await module.leaderboard.list(id, page, limit);
                return successResponse(result);
            }
            catch (e) {
                return errorResponse('Failed to get leaderboard list');
            }
        },
    };
}
