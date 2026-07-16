// main.ts - 主入口
// 生命周期: onInit / onDeinit / onHTTPRequest
import { createRouter, createSearchHandler, createMusicUrlHandler, jsonResponse, } from './@songloft/plugin-sdk';
import { RuntimeManager } from './engine';
import { SourceManager } from './source';
import { platformModules, sources } from './musicSdk/facade';
import { success, error, badRequest } from './handlers/response';
import { songlistTags, songlistList, songlistDetail, songlistSearch, songlistSorts, } from './handlers/songlist';
import { leaderboardBoards, leaderboardList } from './handlers/leaderboard';
import { createDirectMusicUrlHandler, createDirectLyricHandler } from './handlers/direct';
import { importSongToLibrary, makeDedupKey, makeLyricUrl } from './utils/http';
let router;
let runtimeManager;
let sourceManager;
// ============ 主程序契约: resolveUrl & fallbackSearch ============
async function resolveUrl(source_data) {
    const data = source_data;
    if (!data || !data.songInfo)
        return null;
    const { songInfo, quality } = data;
    const result = await runtimeManager.getMusicUrl(songInfo, quality || 'standard');
    if (result) {
        return { url: result.url, headers: result.headers };
    }
    return null;
}
async function fallbackSearch(hint) {
    if (!hint.enabled)
        return null;
    const title = hint.title || '';
    const artist = hint.artist || '';
    if (!title)
        return null;
    const keyword = title + (artist ? ' ' + artist : '');
    for (const source of sources) {
        const mod = platformModules[source.id];
        if (!mod)
            continue;
        try {
            const result = await mod.musicSearch.search(keyword, 1, 1);
            if (result.songs.length > 0) {
                return {
                    source_data: {
                        platform: source.id,
                        quality: 'standard',
                        songInfo: result.songs[0],
                    },
                };
            }
        }
        catch {
            // continue next platform
        }
    }
    return null;
}
// ============ 路由初始化 ============
function initRouter() {
    router = createRouter();
    // --- 主程序契约端点 ---
    // POST /api/search — createSearchHandler
    router.post('/api/search', createSearchHandler({
        async search(params) {
            const mod = platformModules[params.source_id || 'kw'];
            if (!mod)
                return { results: [] };
            try {
                const result = await mod.musicSearch.search(params.keyword, params.page, params.page_size);
                return {
                    results: result.songs.map(song => ({
                        title: song.name,
                        artist: song.singer,
                        album: song.album || '',
                        duration: song.duration || 0,
                        cover_url: song.cover || '',
                        source_data: {
                            platform: song.platform,
                            quality: params.quality || 'standard',
                            songInfo: song,
                        },
                    })),
                };
            }
            catch (e) {
                songloft.log.error('Search failed:', e);
                return { results: [] };
            }
        },
    }));
    // POST /api/music/url — createMusicUrlHandler
    router.post('/api/music/url', createMusicUrlHandler({
        resolveUrl,
        fallbackSearch,
    }));
    // --- 三合一: 搜索+匹配+解析 ---
    router.post('/api/search/topone', async (req) => {
        try {
            if (!req.body)
                return badRequest('No body');
            const text = new TextDecoder().decode(req.body);
            const parsed = JSON.parse(text);
            const keyword = String(parsed.keyword || '');
            const sourceId = String(parsed.source_id || 'kw');
            const quality = String(parsed.quality || 'standard');
            if (!keyword)
                return badRequest('keyword is required');
            const mod = platformModules[sourceId];
            if (!mod)
                return badRequest('Unknown source');
            const searchResult = await mod.musicSearch.search(keyword, 1, 1);
            if (searchResult.songs.length === 0) {
                return error('No song found', 404);
            }
            const song = searchResult.songs[0];
            let url = null;
            if (runtimeManager.hasSources()) {
                const result = await runtimeManager.getMusicUrl(song, quality);
                url = result?.url || null;
            }
            return success({
                song: {
                    title: song.name,
                    artist: song.singer,
                    album: song.album || '',
                    duration: song.duration || 0,
                    cover_url: song.cover || '',
                    source_data: {
                        platform: song.platform,
                        quality,
                        songInfo: song,
                    },
                },
                url,
            });
        }
        catch (e) {
            return error('Failed: ' + e.message);
        }
    });
    // --- 导入歌曲到库 ---
    router.post('/api/songs/import', async (req) => {
        try {
            if (!req.body)
                return badRequest('No body');
            const text = new TextDecoder().decode(req.body);
            const parsed = JSON.parse(text);
            const songs = parsed.songs || [];
            const results = [];
            for (const song of songs) {
                try {
                    const sourceData = song.source_data;
                    if (!sourceData) {
                        results.push({ success: false, error: 'No source_data' });
                        continue;
                    }
                    const songInfo = sourceData.songInfo;
                    const dedupKey = makeDedupKey(sourceData.platform, songInfo);
                    // 歌词:拼 direct/lyric URL,客户端拉取时代理回本插件
                    const lyricUrl = await makeLyricUrl(sourceData.platform, songInfo);
                    const data = await importSongToLibrary({
                        title: song.title || songInfo.name,
                        artist: song.artist || songInfo.singer,
                        album: song.album || songInfo.album || '',
                        cover_url: song.cover_url || songInfo.cover || '',
                        duration: song.duration || songInfo.duration || 0,
                        source_data: sourceData,
                        dedup_key: dedupKey,
                        lyric_source: 'url',
                        lyric: lyricUrl,
                    });
                    results.push({ success: true, data });
                }
                catch (e) {
                    results.push({ success: false, error: e.message });
                }
            }
            return success(results);
        }
        catch (e) {
            return error('Failed: ' + e.message);
        }
    });
    // --- 音源管理 ---
    router.get('/api/sources', () => {
        try {
            const customSources = sourceManager.list();
            const loadedSources = runtimeManager.listSources();
            const batchState = sourceManager.getBatchState();
            return success({
                builtIn: sources,
                custom: customSources,
                loaded: loadedSources,
                hasSources: runtimeManager.hasSources(),
                loading: batchState.loading,
                batch_current_id: batchState.batchCurrentId,
                batch_pending_ids: batchState.batchPendingIds,
            });
        }
        catch (e) {
            return error('Failed: ' + e.message);
        }
    });
    router.post('/api/sources/import', async (req) => {
        try {
            if (!req.body)
                return badRequest('No body');
            const contentType = req.headers['content-type'] || '';
            if (contentType.includes('multipart/form-data')) {
                // multipart 导入 (支持 .js 和 .zip)
                const imported = await sourceManager.importMultipart(req.body, contentType);
                return success(imported);
            }
            // JSON 导入
            const text = new TextDecoder().decode(req.body);
            const parsed = JSON.parse(text);
            const name = String(parsed.name || 'imported');
            const content = String(parsed.content || '');
            if (!content)
                return badRequest('content is required');
            const source = await sourceManager.importJs(name, content);
            return success(source);
        }
        catch (e) {
            return error('Failed: ' + e.message);
        }
    });
    router.post('/api/sources/import-url', async (req) => {
        try {
            if (!req.body)
                return badRequest('No body');
            const text = new TextDecoder().decode(req.body);
            const parsed = JSON.parse(text);
            const url = String(parsed.url || '');
            if (!url)
                return badRequest('url is required');
            const source = await sourceManager.importFromUrl(url);
            return success(source);
        }
        catch (e) {
            return error('Failed: ' + e.message);
        }
    });
    router.delete('/api/sources', async (req) => {
        try {
            const id = req.query?.id;
            if (!id)
                return badRequest('id is required');
            const ok = await sourceManager.delete(id);
            if (ok)
                runtimeManager.unloadSource(id);
            return success({ success: ok });
        }
        catch (e) {
            return error('Failed: ' + e.message);
        }
    });
    router.put('/api/sources/toggle', async (req) => {
        try {
            if (!req.body)
                return badRequest('No body');
            const text = new TextDecoder().decode(req.body);
            const parsed = JSON.parse(text);
            const id = String(parsed.id || '');
            const enabled = Boolean(parsed.enabled);
            const source = sourceManager.get(id);
            if (!source)
                return error('Not found', 404);
            sourceManager.setEnabled(id, enabled);
            if (enabled) {
                // 异步加载
                setTimeout(async () => {
                    try {
                        await runtimeManager.loadSource(id, source.name, source.script);
                    }
                    catch (e) {
                        songloft.log.error('Failed to load source:', e);
                    }
                }, 100);
            }
            else {
                runtimeManager.unloadSource(id);
            }
            return success(null);
        }
        catch (e) {
            return error('Failed: ' + e.message);
        }
    });
    router.post('/api/sources/reload', async () => {
        try {
            await sourceManager.reloadAll(runtimeManager);
            return success(null);
        }
        catch (e) {
            return error('Failed: ' + e.message);
        }
    });
    // --- 歌单浏览 ---
    router.get('/api/songlist/tags', songlistTags);
    router.get('/api/songlist/list', songlistList);
    router.get('/api/songlist/detail', songlistDetail);
    router.get('/api/songlist/search', songlistSearch);
    router.get('/api/songlist/sorts', songlistSorts);
    // --- 排行榜 ---
    router.get('/api/leaderboard/boards', leaderboardBoards);
    router.get('/api/leaderboard/list', leaderboardList);
    // --- Direct ---
    router.post('/api/direct/music/url', createDirectMusicUrlHandler(runtimeManager));
    router.get('/api/direct/lyric', createDirectLyricHandler());
    // --- 健康检查 ---
    router.get('/api/health', () => {
        return success({
            sources: sources.length,
            customSources: sourceManager.list().length,
            loadedSources: runtimeManager.getSourceCount(),
        });
    });
}
// ============ 生命周期导出 ============
;
globalThis.onInit = async function () {
    try {
        songloft.log.info('lxmusic plugin: initializing...');
        runtimeManager = new RuntimeManager();
        sourceManager = new SourceManager();
        await sourceManager.init();
        initRouter();
        // 后台加载已启用的音源
        setTimeout(() => {
            sourceManager.loadAllEnabled(runtimeManager).catch((e) => {
                songloft.log.error('Failed to load enabled sources:', e);
            });
        }, 100);
        songloft.log.info('lxmusic plugin: initialized');
    }
    catch (e) {
        songloft.log.error('lxmusic plugin: init failed:', e);
    }
};
;
globalThis.onDeinit = function () {
    try {
        songloft.log.info('lxmusic plugin: deinitializing...');
        if (runtimeManager) {
            runtimeManager.clear().catch((e) => {
                songloft.log.error('Failed to clear runtime manager:', e);
            });
        }
        songloft.log.info('lxmusic plugin: deinitialized');
    }
    catch (e) {
        songloft.log.error('lxmusic plugin: deinit failed:', e);
    }
};
;
globalThis.onHTTPRequest = function (req) {
    // ⚠️ 必须永远返回合法 HTTPResponse,不能返回 undefined
    try {
        if (!router) {
            return jsonResponse({ code: 503, msg: 'Plugin not initialized', data: null }, 503);
        }
        const result = router.handle(req);
        if (result) {
            return result;
        }
        // 404
        return jsonResponse({ code: 404, msg: 'Not Found', data: null }, 404);
    }
    catch (e) {
        songloft.log.error('HTTP request error:', e);
        return jsonResponse({ code: 500, msg: 'Internal Server Error', data: null }, 500);
    }
};
