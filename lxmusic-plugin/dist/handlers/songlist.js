"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSongListHandlers = createSongListHandlers;
const facade_1 = require("../musicSdk/facade");
const response_1 = require("./response");
const platformModules = { kw: facade_1.kw, kg: facade_1.kg, tx: facade_1.tx, wy: facade_1.wy, mg: facade_1.mg };
function createSongListHandlers() {
    return {
        async getTags(req) {
            try {
                const query = req.query;
                const source_id = query.source_id || 'kw';
                const module = platformModules[source_id];
                if (!module)
                    return (0, response_1.badRequestResponse)('Unknown source');
                const result = await module.songList.tags();
                return (0, response_1.successResponse)(result);
            }
            catch (e) {
                return (0, response_1.errorResponse)('Failed to get tags');
            }
        },
        async getList(req) {
            try {
                const query = req.query;
                const source_id = query.source_id || 'kw';
                const tag = query.tag || '';
                const page = Number(query.page) || 1;
                const limit = Number(query.limit) || 20;
                const module = platformModules[source_id];
                if (!module)
                    return (0, response_1.badRequestResponse)('Unknown source');
                const result = await module.songList.list(tag, page, limit);
                return (0, response_1.successResponse)(result);
            }
            catch (e) {
                return (0, response_1.errorResponse)('Failed to get song list');
            }
        },
        async getDetail(req) {
            try {
                const query = req.query;
                const source_id = query.source_id || 'kw';
                const id = query.id;
                if (!id)
                    return (0, response_1.badRequestResponse)('ID is required');
                const module = platformModules[source_id];
                if (!module)
                    return (0, response_1.badRequestResponse)('Unknown source');
                const result = await module.songList.detail(id);
                return (0, response_1.successResponse)(result);
            }
            catch (e) {
                return (0, response_1.errorResponse)('Failed to get song list detail');
            }
        },
        async search(req) {
            try {
                const query = req.query;
                const source_id = query.source_id || 'kw';
                const keyword = query.keyword;
                const page = Number(query.page) || 1;
                const limit = Number(query.limit) || 20;
                if (!keyword)
                    return (0, response_1.badRequestResponse)('Keyword is required');
                const module = platformModules[source_id];
                if (!module)
                    return (0, response_1.badRequestResponse)('Unknown source');
                const result = await module.songList.search(keyword, page, limit);
                return (0, response_1.successResponse)(result);
            }
            catch (e) {
                return (0, response_1.errorResponse)('Failed to search song list');
            }
        },
        async getSorts(req) {
            try {
                const query = req.query;
                const source_id = query.source_id || 'kw';
                const module = platformModules[source_id];
                if (!module)
                    return (0, response_1.badRequestResponse)('Unknown source');
                const result = await module.songList.sorts();
                return (0, response_1.successResponse)(result);
            }
            catch (e) {
                return (0, response_1.errorResponse)('Failed to get sorts');
            }
        },
    };
}
