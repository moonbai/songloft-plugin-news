import { kw, kg, tx, wy, mg } from '../musicSdk/facade';
import { successResponse, errorResponse, badRequestResponse } from './response';
const platformModules = { kw, kg, tx, wy, mg };
export function createDirectHandlers(runtimeManager) {
    return {
        async getMusicUrl(req) {
            try {
                const body = req.body;
                if (!body)
                    return badRequestResponse('No body provided');
                const content = Array.from(body).map(b => String.fromCharCode(b)).join('');
                const parsed = JSON.parse(content);
                const songInfo = parsed.songInfo;
                const quality = String(parsed.quality || 'standard');
                if (!songInfo || !songInfo.platform)
                    return badRequestResponse('songInfo is required');
                const url = await runtimeManager.getMusicUrl(songInfo, quality);
                if (url) {
                    return successResponse({ url });
                }
                else {
                    return errorResponse('Failed to get music URL');
                }
            }
            catch (e) {
                return errorResponse('Failed to get music URL');
            }
        },
        async getLyric(req) {
            try {
                const query = req.query;
                const source_id = query.source_id || 'kw';
                const musicId = query.musicId;
                const songmid = query.songmid;
                if (!musicId && !songmid)
                    return badRequestResponse('musicId or songmid is required');
                const module = platformModules[source_id];
                if (!module)
                    return badRequestResponse('Unknown source');
                const result = await module.getLyric({
                    platform: source_id,
                    musicId: musicId || songmid || '',
                    songmid: songmid || musicId || '',
                });
                if (result) {
                    return successResponse(result);
                }
                else {
                    return successResponse({ lyric: '' });
                }
            }
            catch (e) {
                return errorResponse('Failed to get lyric');
            }
        },
    };
}
