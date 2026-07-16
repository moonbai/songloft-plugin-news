// handlers/songlist.ts - 歌单浏览 (转发 musicSdk)
import { platformModules } from '../musicSdk/facade';
import { success, error, badRequest } from './response';
function getQuery(req) {
    return req.query || {};
}
/** 歌单标签 */
export const songlistTags = async (req) => {
    try {
        const q = getQuery(req);
        const sourceId = q.source_id || 'kw';
        const mod = platformModules[sourceId];
        if (!mod?.songList?.tags)
            return badRequest('Unknown source or tags not supported');
        const tags = await mod.songList.tags();
        return success(tags);
    }
    catch (e) {
        return error('Failed to get tags: ' + e.message);
    }
};
/** 歌单列表 */
export const songlistList = async (req) => {
    try {
        const q = getQuery(req);
        const sourceId = q.source_id || 'kw';
        const tag = q.tag || '';
        const page = Number(q.page) || 1;
        const limit = Number(q.limit) || 20;
        const mod = platformModules[sourceId];
        if (!mod?.songList?.list)
            return badRequest('Unknown source or list not supported');
        const result = await mod.songList.list(tag, page, limit);
        return success(result);
    }
    catch (e) {
        return error('Failed to get songlist: ' + e.message);
    }
};
/** 歌单详情 */
export const songlistDetail = async (req) => {
    try {
        const q = getQuery(req);
        const sourceId = q.source_id || 'kw';
        const id = q.id;
        const page = Number(q.page) || 1;
        if (!id)
            return badRequest('id is required');
        const mod = platformModules[sourceId];
        if (!mod?.songList?.detail)
            return badRequest('Unknown source or detail not supported');
        const result = await mod.songList.detail(id, page);
        return success(result);
    }
    catch (e) {
        return error('Failed to get detail: ' + e.message);
    }
};
/** 歌单搜索 */
export const songlistSearch = async (req) => {
    try {
        const q = getQuery(req);
        const sourceId = q.source_id || 'kw';
        const keyword = q.keyword || '';
        const page = Number(q.page) || 1;
        const limit = Number(q.limit) || 20;
        if (!keyword)
            return badRequest('keyword is required');
        const mod = platformModules[sourceId];
        if (!mod?.songList?.search)
            return badRequest('Unknown source or search not supported');
        const result = await mod.songList.search(keyword, page, limit);
        return success(result);
    }
    catch (e) {
        return error('Failed to search songlist: ' + e.message);
    }
};
/** 歌单分类 */
export const songlistSorts = async (req) => {
    try {
        const q = getQuery(req);
        const sourceId = q.source_id || 'kw';
        const mod = platformModules[sourceId];
        if (!mod?.songList?.sorts)
            return badRequest('Unknown source or sorts not supported');
        const sorts = await mod.songList.sorts();
        return success(sorts);
    }
    catch (e) {
        return error('Failed to get sorts: ' + e.message);
    }
};
