// main.ts - 新闻资讯插件主入口
// 生命周期: onInit / onDeinit / onHTTPRequest

import { createRouter, jsonResponse, parseQuery } from '@songloft/plugin-sdk';
import type { HTTPRequest, HTTPResponse, RouteHandler } from '@songloft/plugin-sdk';
import { RuntimeManager } from './engine';
import { SourceManager } from './source';
import { sources, platformModules } from './newsSdk/facade';
import { createSearchHandlers, createNewsHandlers, createPlayerHandlers } from './handlers';
import { hostSearchHandler, hostMusicUrlHandler } from './handlers/host';
import { getAggregatedHotboard } from './aggregate';

let router: ReturnType<typeof createRouter> | null = null;
let runtimeManager: RuntimeManager | null = null;
let sourceManager: SourceManager | null = null;

// 平台 ID 到名称的映射（聚合热搜用）
const SOURCE_NAMES: Record<string, string> = {
  baidu: '百度',
  weibo: '微博',
  zhihu: '知乎',
  wangyi: '网易',
  toutiao: '头条',
  '36kr': '36氪',
  pengpai: '澎湃',
  ithome: 'IT之家',
  huxiu: '虎嗅',
  sspai: '少数派',
  juejin: '掘金',
};

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

  // 搜索（前端用 /api/news/search，宿主用 /api/search）
  const searchHandlers = createSearchHandlers();
  router.post('/api/news/search', searchHandlers.search);
  router.get('/api/sources', searchHandlers.getSources);

  // 新闻列表/详情/热榜
  const newsHandlers = createNewsHandlers(runtimeManager!);
  router.get('/api/news/categories', newsHandlers.getCategories);
  router.get('/api/news/list', newsHandlers.getList);
  router.get('/api/news/detail', newsHandlers.getDetail);
  router.get('/api/news/hotboard', newsHandlers.getHotboard);
  router.get('/api/news/boards', newsHandlers.getBoards);

  // source 管理（已移除自定义脚本导入功能）

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
  router.post('/api/player/register-song', playerHandlers.registerSong);
  router.post('/api/player/register-batch', playerHandlers.registerBatch);
  router.get('/api/player/tts-stream', playerHandlers.ttsStream);

  // TTS 音频接口 - 百度TTS已失效（返回502 "Not verified user"），
  // 此端点保留以兼容旧前端调用，但返回明确错误。
  // 前端应直接使用浏览器原生 speechSynthesis 进行朗读。
  router.get('/api/player/tts-audio', async (req) => {
    const query = parseQuery(req.query);
    const text = String(query.text || '');
    if (!text) return jsonResponse({ code: 400, msg: 'text is required' }, 400);
    return jsonResponse({
      code: 502,
      msg: 'Online TTS service is no longer available, please use browser speechSynthesis',
    }, 502);
  });

  // 歌单列表（参考电台插件，前端通过 P.apiGet 调用）
  router.get('/api/playlists', async () => {
    const playlists = await songloft.playlists.list();
    const radioPlaylists = playlists.filter((p: any) => p.type === 'radio');
    return jsonResponse({ playlists: radioPlaylists });
  });

  // 创建歌单
  router.post('/api/playlists', async (req) => {
    try {
      const body = JSON.parse(req.body as unknown as string);
      const name = String(body.name || '新闻资讯');
      const type = (body.type as 'normal' | 'radio') || 'radio';
      const playlist = await songloft.playlists.create({ name, type });
      return jsonResponse({ playlist });
    } catch (e) {
      return jsonResponse({ error: (e as Error).message }, 500);
    }
  });

  // 设置接口（参考电台插件）
  router.get('/api/settings', async () => {
    const lastPlaylistId = (await songloft.storage.get('last_playlist_id')) as number | null;
    return jsonResponse({ last_playlist_id: lastPlaylistId ?? 2 });
  });

  router.post('/api/settings', async (req) => {
    try {
      const body = JSON.parse(req.body as unknown as string);
      if (body.last_playlist_id !== undefined) {
        await songloft.storage.set('last_playlist_id', body.last_playlist_id);
      }
    } catch {
      return jsonResponse({ error: '请求体格式错误' }, 400);
    }
    return jsonResponse({ ok: true });
  });

  // 宿主原生搜索 + 播放 URL 解析（官方推荐接入方式）
  // 宿主搜索框输入关键词 → POST /api/search
  // 宿主播放时回调 → POST /api/music/url
  router.post('/api/search', hostSearchHandler);
  router.post('/api/music/url', hostMusicUrlHandler);

  // 聚合接口 - 多平台热榜聚合（去重 + 归一化排序，带 TTL 缓存）
  router.get('/api/aggregate/hotboard', async (req) => {
    try {
      const query = parseQuery(req.query);
      const limit = Number(query.limit) || 50;
      const category = String(query.category || 'all');
      const data = await getAggregatedHotboard(limit, normalizeTitle, SOURCE_NAMES, category);
      return jsonResponse({ code: 0, msg: 'success', data });
    } catch (e) {
      songloft.log.error('aggregate/hotboard error: ' + (e as Error).message);
      return jsonResponse({ code: 500, msg: 'Failed: ' + (e as Error).message }, 500);
    }
  });

  router.get('/api/health', () => {
    return jsonResponse({
      code: 0,
      msg: 'OK',
      data: {
        sources: sources.length,
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
      songloft.log.error('news plugin: storage init failed, continuing without stored sources: ' + (e as Error).message);
    }

    // 异步加载启用的 source 脚本（不阻塞 onInit 返回）
    void sourceManager.loadAllEnabled().catch((e) => {
      songloft.log.error('news plugin: failed to load enabled sources: ' + (e as Error).message);
    });

    songloft.log.info('news plugin: initialized');
  } catch (error) {
    songloft.log.error('news plugin: failed to initialize: ' + (error as Error).message);
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
    songloft.log.error('news plugin: failed to deinitialize: ' + (error as Error).message);
  }
};

;(globalThis as any).onHTTPRequest = async function (req: HTTPRequest): Promise<HTTPResponse> {
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

    // 从完整路径中提取插件内部路径
    // 宿主转发请求时路径格式可能为:
    //   /api/v1/jsplugin/{entryPath}/api/...  (主 API 前缀)
    //   /jsplugin/{entryPath}/api/...         (简化前缀)
    //   /api/...                              (已去除前缀)
    // 统一用 lastIndexOf('/api/') 提取最后的 /api/... 部分
    let internalPath = req.path.split('?')[0];
    const apiIdx = internalPath.lastIndexOf('/api/');
    if (apiIdx > 0) {
      internalPath = internalPath.slice(apiIdx);
    }

    songloft.log.info('news plugin: ' + req.method + ' ' + req.path + ' -> ' + internalPath);

    const routedReq: HTTPRequest = {
      ...req,
      path: internalPath,
    };

    const result = await router!.handle(routedReq);

    if (result) {
      return result;
    }

    return jsonResponse({ code: 404, msg: 'Not Found', data: null }, 404);
  } catch (e) {
    songloft.log.error('news plugin: HTTP request error: ' + (e as Error).message);
    return jsonResponse({ code: 500, msg: 'Internal Server Error: ' + (e as Error).message, data: null }, 500);
  }
};
