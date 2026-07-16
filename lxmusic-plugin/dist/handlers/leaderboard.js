// handlers/leaderboard.ts - 排行榜
import { platformModules } from '../musicSdk/facade';
import { success, error, badRequest } from './response';
/** 排行榜列表 */
export const leaderboardBoards = async (req) => {
    try {
        const q = req.query || {};
        const sourceId = q.source_id || 'kw';
        const mod = platformModules[sourceId];
        if (!mod?.leaderboard?.boards)
            return badRequest('Unknown source or boards not supported');
        const boards = await mod.leaderboard.boards();
        return success(boards);
    }
    catch (e) {
        return error('Failed to get boards: ' + e.message);
    }
};
/** 排行榜歌曲列表 */
export const leaderboardList = async (req) => {
    try {
        const q = req.query || {};
        const sourceId = q.source_id || 'kw';
        const id = q.id;
        const page = Number(q.page) || 1;
        const limit = Number(q.limit) || 20;
        if (!id)
            return badRequest('id is required');
        const mod = platformModules[sourceId];
        if (!mod?.leaderboard?.list)
            return badRequest('Unknown source or list not supported');
        const result = await mod.leaderboard.list(id, page, limit);
        return success(result);
    }
    catch (e) {
        return error('Failed to get leaderboard list: ' + e.message);
    }
};
