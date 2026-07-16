"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLeaderboardHandlers = createLeaderboardHandlers;
const facade_1 = require("../musicSdk/facade");
const response_1 = require("./response");
const platformModules = { kw: facade_1.kw, kg: facade_1.kg, tx: facade_1.tx, wy: facade_1.wy, mg: facade_1.mg };
function createLeaderboardHandlers() {
    return {
        async getBoards(req) {
            try {
                const query = req.query;
                const source_id = query.source_id || 'kw';
                const module = platformModules[source_id];
                if (!module)
                    return (0, response_1.badRequestResponse)('Unknown source');
                const result = await module.leaderboard.boards();
                return (0, response_1.successResponse)(result);
            }
            catch (e) {
                return (0, response_1.errorResponse)('Failed to get leaderboards');
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
                    return (0, response_1.badRequestResponse)('ID is required');
                const module = platformModules[source_id];
                if (!module)
                    return (0, response_1.badRequestResponse)('Unknown source');
                const result = await module.leaderboard.list(id, page, limit);
                return (0, response_1.successResponse)(result);
            }
            catch (e) {
                return (0, response_1.errorResponse)('Failed to get leaderboard list');
            }
        },
    };
}
