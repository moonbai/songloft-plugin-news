"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDirectHandlers = createDirectHandlers;
const facade_1 = require("../musicSdk/facade");
const response_1 = require("./response");
const platformModules = { kw: facade_1.kw, kg: facade_1.kg, tx: facade_1.tx, wy: facade_1.wy, mg: facade_1.mg };
function createDirectHandlers(runtimeManager) {
    return {
        async getMusicUrl(req) {
            try {
                const body = req.body;
                if (!body)
                    return (0, response_1.badRequestResponse)('No body provided');
                const content = Array.from(body).map(b => String.fromCharCode(b)).join('');
                const parsed = JSON.parse(content);
                const songInfo = parsed.songInfo;
                const quality = String(parsed.quality || 'standard');
                if (!songInfo || !songInfo.platform)
                    return (0, response_1.badRequestResponse)('songInfo is required');
                const url = await runtimeManager.getMusicUrl(songInfo, quality);
                if (url) {
                    return (0, response_1.successResponse)({ url });
                }
                else {
                    return (0, response_1.errorResponse)('Failed to get music URL');
                }
            }
            catch (e) {
                return (0, response_1.errorResponse)('Failed to get music URL');
            }
        },
        async getLyric(req) {
            try {
                const query = req.query;
                const source_id = query.source_id || 'kw';
                const musicId = query.musicId;
                const songmid = query.songmid;
                if (!musicId && !songmid)
                    return (0, response_1.badRequestResponse)('musicId or songmid is required');
                const module = platformModules[source_id];
                if (!module)
                    return (0, response_1.badRequestResponse)('Unknown source');
                const result = await module.getLyric({
                    platform: source_id,
                    musicId: musicId || songmid || '',
                    songmid: songmid || musicId || '',
                });
                if (result) {
                    return (0, response_1.successResponse)(result);
                }
                else {
                    return (0, response_1.successResponse)({ lyric: '' });
                }
            }
            catch (e) {
                return (0, response_1.errorResponse)('Failed to get lyric');
            }
        },
    };
}
