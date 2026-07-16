import { createRouter, jsonResponse } from '@songloft/plugin-sdk';
import { RuntimeManager } from './engine';
import { SourceManager } from './source';
import { sources } from './newsSdk/facade';
import { createSearchHandlers, createNewsHandlers, createSourceHandlers, createPlayerHandlers } from './handlers';

let router: ReturnType<typeof createRouter>;
let runtimeManager: RuntimeManager;
let sourceManager: SourceManager;

function initRouter() {
  router = createRouter();

  // 搜索
  const searchHandlers = createSearchHandlers();
  router.post('/api/search', searchHandlers.search);
  router.get('/api/sources', searchHandlers.getSources);

  // 新闻列表/详情/热榜
  const newsHandlers = createNewsHandlers(runtimeManager);
  router.get('/api/news/categories', newsHandlers.getCategories);
  router.get('/api/news/list', newsHandlers.getList);
  router.get('/api/news/detail', newsHandlers.getDetail);
  router.get('/api/news/hotboard', newsHandlers.getHotboard);
  router.get('/api/news/boards', newsHandlers.getBoards);

  // source 管理
  const sourceHandlers = createSourceHandlers(sourceManager);
  router.get('/api/custom-sources', sourceHandlers.getSources);
  router.post('/api/custom-sources/import', sourceHandlers.importSource);
  router.post('/api/custom-sources/import-url', sourceHandlers.importSourceUrl);
  router.put('/api/custom-sources/toggle', sourceHandlers.toggleSource);
  router.delete('/api/custom-sources', sourceHandlers.deleteSource);
  router.post('/api/custom-sources/reload', sourceHandlers.reloadSources);
  router.get('/api/custom-sources/export', sourceHandlers.exportSources);

  // 播放器
  const playerHandlers = createPlayerHandlers();
  router.post('/api/player/resolve', playerHandlers.resolve);
  router.post('/api/player/playlist/add', playerHandlers.addToPlaylist);
  router.delete('/api/player/playlist/remove', playerHandlers.removeFromPlaylist);
  router.get('/api/player/playlist', playerHandlers.getPlaylists);
  router.delete('/api/player/playlist/clear', playerHandlers.clearPlaylist);
  router.get('/api/player/tts-config', playerHandlers.getTtsConfig);
  router.post('/api/player/tts-config', playerHandlers.setTtsConfig);
  router.get('/api/player/playable', playerHandlers.getPlayableNews);

  // 聚合接口 - 同时获取多个源的热榜
  router.get('/api/aggregate/hotboard', async (req) => {
    try {
      const request = req as any;
      const limit = Number(request.query?.limit) || 10;
      
      const platforms = ['baidu', 'zhihu', 'toutiao', 'pengpai', 'wangyi'];
      const promises = platforms.map(async (source) => {
        try {
          const result = await runtimeManager.fetchNewsList(source, 'hot', 1, limit);
          return { source, news: result.news };
        } catch (e) {
          return { source, news: [], error: String(e) };
        }
      });
      
      const results = await Promise.all(promises);
      return jsonResponse({ code: 0, msg: 'success', data: results });
    } catch (e) {
      return jsonResponse({ code: 500, msg: 'Failed: ' + (e as Error).message }, 500);
    }
  });

  router.get('/api/health', () => {
    return jsonResponse({ code: 0, msg: 'OK', data: { sources: sources.length, customSources: sourceManager.list().length } });
  });
}

;(globalThis as any).onInit = async function () {
  try {
    songloft.log.info('Initializing news plugin');
    
    runtimeManager = new RuntimeManager();
    sourceManager = new SourceManager(runtimeManager);
    
    await sourceManager.init();
    
    initRouter();
    
    setTimeout(() => {
      sourceManager.loadAllEnabled().catch(e => {
        songloft.log.error('Failed to load enabled sources:', e);
      });
    }, 100);
    
    songloft.log.info('news plugin initialized');
  } catch (error) {
    songloft.log.error('Failed to initialize news plugin:', error);
  }
};

;(globalThis as any).onDeinit = function () {
  try {
    songloft.log.info('Deinitializing news plugin');
    
    if (runtimeManager) {
      runtimeManager.clear();
    }
    
    songloft.log.info('news plugin deinitialized');
  } catch (error) {
    songloft.log.error('Failed to deinitialize news plugin:', error);
  }
};

;(globalThis as any).onHTTPRequest = function (req: unknown) {
  try {
    const request = req as Record<string, unknown>;
    const method = String(request.method || 'GET').toUpperCase();
    const path = String(request.path || '');
    
    songloft.log.info(`HTTP request: ${method} ${path}`);
    
    const result = router.handle(req);
    
    if (result) {
      return result;
    }
    
    return jsonResponse({ code: 404, msg: 'Not Found' }, 404);
  } catch (error) {
    songloft.log.error('HTTP request error:', error);
    return jsonResponse({ code: 500, msg: 'Internal Server Error' }, 500);
  }
};
