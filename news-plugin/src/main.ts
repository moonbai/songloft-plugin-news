// main.ts - 新闻资讯插件主入口
// 生命周期: onInit / onDeinit / onHTTPRequest

import { createRouter, jsonResponse } from './@songloft/plugin-sdk';
import { RuntimeManager } from './engine';
import { SourceManager } from './source';
import { sources, platformModules } from './newsSdk/facade';
import { createSearchHandlers, createNewsHandlers, createSourceHandlers, createPlayerHandlers } from './handlers';

let router: ReturnType<typeof createRouter> | null = null;
let runtimeManager: RuntimeManager | null = null;
let sourceManager: SourceManager | null = null;

/**
 * 标题归一化：用于跨平台去重
 * 去除空格、标点、特殊符号，转小写，取前 50 字符
 */
function normalizeTitle(title: string): string {
  return String(title || '')
    .toLowerCase()
    .replace(/[\s\u3000\x00-\x1f!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~「」『』【】（）()《》〈〉“”‘’''…—\-–·.,!?;:'"]/g, '')
    .slice(0, 50);
}

function setupRouter(): void {
  router = createRouter();

  // 搜索
  const searchHandlers = createSearchHandlers();
  router.post('/api/search', searchHandlers.search);
  router.get('/api/sources', searchHandlers.getSources);

  // 新闻列表/详情/热榜
  const newsHandlers = createNewsHandlers(runtimeManager!);
  router.get('/api/news/categories', newsHandlers.getCategories);
  router.get('/api/news/list', newsHandlers.getList);
  router.get('/api/news/detail', newsHandlers.getDetail);
  router.get('/api/news/hotboard', newsHandlers.getHotboard);
  router.get('/api/news/boards', newsHandlers.getBoards);

  // source 管理
  const sourceHandlers = createSourceHandlers(sourceManager!);
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

  // 聚合接口 - 多平台热榜聚合（去重 + 归一化排序）
  router.get('/api/aggregate/hotboard', async (req) => {
    try {
      const limit = Number(req.query.limit) || 10;
      const perPlatformLimit = Math.max(limit, 20); // 每个平台多取一些用于去重后仍有足够数据
      // 所有支持 hotboard 的平台
      const platforms = ['baidu', 'weibo', 'zhihu', 'wangyi', 'toutiao', '36kr', 'pengpai', 'ximalaya', 'dedao'];

      const promises = platforms.map(async (source) => {
        try {
          const module = platformModules[source];
          if (!module?.hotboard) return { source, news: [] };
          const boards = await module.hotboard.boards();
          if (!boards || boards.length === 0) return { source, news: [] };
          const result = await module.hotboard.list(boards[0].id, 1, perPlatformLimit);
          const news = result.news || [];
          // 平台内归一化：按 hot 值在该平台内的百分位计算 hotLevel (0-100)
          const maxHot = news.reduce((mx: number, n: any) => Math.max(mx, Number(n.hot || 0)), 0);
          const normalized = news.map((n: any) => ({
            ...n,
            hotLevel: maxHot > 0 ? Math.round((Number(n.hot || 0) / maxHot) * 100) : 0,
            sources: [source],
          }));
          return { source, news: normalized };
        } catch (e) {
          songloft.log.error('aggregate/hotboard: ' + source + ' failed: ' + (e as Error).message);
          return { source, news: [], error: String(e) };
        }
      });

      const results = await Promise.all(promises);

      // 合并所有平台的新闻
      const allNews: any[] = [];
      const dedupMap = new Map<string, any>();

      for (const { source, news } of results) {
        for (const item of news) {
          if (!item.title) continue;
          // 标题去重：归一化后比较（去空格、转小写、去标点）
          const key = normalizeTitle(item.title);
          if (!key) continue;

          const existing = dedupMap.get(key);
          if (existing) {
            // 已存在：合并来源，取最高 hotLevel，热度叠加
            existing.sources.push(source);
            existing.hotLevel = Math.max(existing.hotLevel, item.hotLevel);
            existing.hotCount = (existing.hotCount || 1) + 1;
            // 保留信息更完整的一条（有摘要/封面的优先）
            if ((!existing.summary && item.summary) || (!existing.cover && item.cover)) {
              existing.summary = existing.summary || item.summary;
              existing.cover = existing.cover || item.cover;
              existing.url = existing.url || item.url;
            }
          } else {
            dedupMap.set(key, { ...item, hotCount: 1 });
          }
        }
      }

      // 转数组，计算综合热度：hotLevel * (1 + 0.15 * (hotCount-1))
      // 多平台同时上榜说明热度高，给予加成
      const merged = Array.from(dedupMap.values()).map((item: any) => {
        const multiSourceBonus = 1 + 0.15 * (item.hotCount - 1);
        return {
          ...item,
          combinedHot: Math.round(item.hotLevel * multiSourceBonus),
        };
      });

      // 按综合热度降序
      merged.sort((a, b) => b.combinedHot - a.combinedHot);

      // 截取 limit 条
      const top = merged.slice(0, limit);

      songloft.log.info('aggregate/hotboard: merged=' + merged.length + ' top=' + top.length);
      return jsonResponse({ code: 0, msg: 'success', data: { news: top, bySource: results } });
    } catch (e) {
      songloft.log.error('aggregate/hotboard error:', e);
      return jsonResponse({ code: 500, msg: 'Failed: ' + (e as Error).message }, 500);
    }
  });

  router.get('/api/health', () => {
    return jsonResponse({
      code: 0,
      msg: 'OK',
      data: {
        sources: sources.length,
        customSources: sourceManager ? sourceManager.list().length : 0,
      },
    });
  });
}

// ============ 生命周期导出 ============

;(globalThis as any).onInit = async function (): Promise<void> {
  try {
    songloft.log.info('news plugin: initializing...');

    // 先创建核心对象和 router，不依赖 storage
    runtimeManager = new RuntimeManager();
    sourceManager = new SourceManager(runtimeManager);
    setupRouter();

    songloft.log.info('news plugin: router ready');

    // 异步加载已存储的 source（失败不影响核心功能）
    try {
      await sourceManager.init();
      songloft.log.info('news plugin: storage loaded');
    } catch (e) {
      songloft.log.error('news plugin: storage init failed, continuing without stored sources:', e);
    }

    // 异步加载启用的 source 脚本
    setTimeout(() => {
      try {
        if (sourceManager) {
          sourceManager.loadAllEnabled().catch((e) => {
            songloft.log.error('news plugin: failed to load enabled sources:', e);
          });
        }
      } catch (e) {
        songloft.log.error('news plugin: loadAllEnabled error:', e);
      }
    }, 100);

    songloft.log.info('news plugin: initialized');
  } catch (error) {
    songloft.log.error('news plugin: failed to initialize:', error);
  }
};

;(globalThis as any).onDeinit = async function (): Promise<void> {
  try {
    songloft.log.info('news plugin: deinitializing...');
    if (runtimeManager) {
      await runtimeManager.clear();
      runtimeManager = null;
    }
    sourceManager = null;
    router = null;
    songloft.log.info('news plugin: deinitialized');
  } catch (error) {
    songloft.log.error('news plugin: failed to deinitialize:', error);
  }
};

;(globalThis as any).onHTTPRequest = async function (req: unknown): Promise<unknown> {
  // ⚠️ 必须永远返回合法 HTTPResponse，不能返回 undefined
  try {
    // 如果 router 尚未初始化（onInit 还没跑完），尝试同步初始化
    if (!router) {
      songloft.log.info('news plugin: lazy init on first request');
      // 同步创建 router（不依赖 storage）
      if (!runtimeManager) runtimeManager = new RuntimeManager();
      if (!sourceManager) sourceManager = new SourceManager(runtimeManager);
      setupRouter();
    }

    // 去掉 query string
    const r = req as Record<string, unknown>;
    const fullPath = String(r.path || '');
    const path = fullPath.split('?')[0];
    const routedReq = { ...r, path };

    const result = await router!.handle(routedReq);

    if (result) {
      return result;
    }

    return jsonResponse({ code: 404, msg: 'Not Found', data: null }, 404);
  } catch (e) {
    songloft.log.error('news plugin: HTTP request error:', e);
    return jsonResponse({ code: 500, msg: 'Internal Server Error: ' + (e as Error).message, data: null }, 500);
  }
};
