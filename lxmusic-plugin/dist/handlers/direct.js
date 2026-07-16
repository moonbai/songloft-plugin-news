// handlers/direct.ts - Direct 端点
import { platformModules } from '../musicSdk/facade';
import { success, error, badRequest } from './response';
/** POST /api/direct/music/url — 直接解析 URL */
export function createDirectMusicUrlHandler(runtimeManager) {
    return async (req) => {
        try {
            if (!req.body)
                return badRequest('No body');
            const text = new TextDecoder().decode(req.body);
            const parsed = JSON.parse(text);
            const songInfo = parsed.songInfo;
            const quality = String(parsed.quality || 'standard');
            if (!songInfo || !songInfo.platform)
                return badRequest('songInfo is required');
            const result = await runtimeManager.getMusicUrl(songInfo, quality);
            if (result) {
                return success({ url: result.url, headers: result.headers || {} });
            }
            return error('No URL resolved', 404);
        }
        catch (e) {
            return error('Failed: ' + e.message);
        }
    };
}
/** GET /api/direct/lyric — 获取歌词 */
export function createDirectLyricHandler() {
    return async (req) => {
        try {
            const q = req.query || {};
            const sourceId = q.source_id || 'kw';
            const musicId = q.musicId;
            const songmid = q.songmid;
            if (!musicId && !songmid)
                return badRequest('musicId or songmid is required');
            const mod = platformModules[sourceId];
            if (!mod)
                return badRequest('Unknown source');
            const songInfo = {
                platform: sourceId,
                name: '',
                singer: '',
                musicId: musicId || songmid || '',
                songmid: songmid || musicId || '',
            };
            const result = await mod.getLyric(songInfo);
            if (result) {
                return success(result);
            }
            return success({ lyric: '' });
        }
        catch (e) {
            return error('Failed: ' + e.message);
        }
    };
}
