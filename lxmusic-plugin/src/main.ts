import { createRouter, jsonResponse, createSearchHandler, createMusicUrlHandler } from '@songloft/plugin-sdk';
import { RuntimeManager } from './engine';
import { SourceManager } from './source';
import { sources, kw, kg, tx, wy, mg } from './musicSdk/facade';
import type { SongInfo, SourceData } from './types';

const platformModules: Record<string, any> = { kw, kg, tx, wy, mg };

let router: ReturnType<typeof createRouter>;
let runtimeManager: RuntimeManager;
let sourceManager: SourceManager;

/**
 * 解析音乐 URL (机制 B)
 */
async function resolveMusicUrl(source_data: unknown): Promise<{ url: string; headers?: Record<string, string> } | null> {
  const data = source_data as SourceData;
  if (!data || !data.songInfo) return null;
  
  const { songInfo, quality } = data;
  
  // 尝试通过音源脚本解析
  const result = await runtimeManager.getMusicUrl(songInfo, quality || 'standard');
  
  if (result) {
    return { 
      url: result.url,
      headers: result.headers
    };
  }
  
  return null;
}

/**
 * 回退搜索 (主源失败时跨平台搜索)
 */
async function fallbackSearch(hint: unknown): Promise<unknown> {
  const h = hint as Record<string, unknown>;
  if (!h.enabled) return null;
  
  const title = String(h.title || '');
  const artist = String(h.artist || '');
  
  if (!title) return null;
  
  const keyword = title + ' ' + artist;
  
  // 跨平台搜索
  for (const source of sources) {
    const module = platformModules[source.id];
    if (!module) continue;
    
    try {
      const result = await module.musicSearch.search(keyword, 1, 1);
      const songs = result.songs as SongInfo[];
      
      if (songs.length > 0) {
        return {
          platform: source.id,
          quality: 'standard',
          songInfo: songs[0],
        };
      }
    } catch {
      // 继续下一个平台
    }
  }
  
  return null;
}

/**
 * 初始化路由
 */
function initRouter() {
  router = createRouter();

  // 主程序契约: POST /api/search
  router.post('/api/search', createSearchHandler({
    async search(params) {
      const { keyword, source_id, quality, page, page_size } = params;
      
      const module = platformModules[source_id || 'kw'];
      if (!module) {
        return { results: [] };
      }
      
      try {
        const result = await module.musicSearch.search(keyword, page || 1, page_size || 20);
        const songs = result.songs as SongInfo[];
        
        return {
          results: songs.map(song => ({
            title: song.name,
            artist: song.singer,
            album: song.album || '',
            duration: song.duration || 0,
            cover_url: song.cover || '',
            source_data: {
              platform: song.platform,
              quality: quality || 'standard',
              songInfo: song,
            },
          })),
        };
      } catch (e) {
        songloft.log.error('Search failed:', e);
        return { results: [] };
      }
    },
  }));

  // 主程序契约: POST /api/music/url
  router.post('/api/music/url', createMusicUrlHandler({
    resolveUrl: resolveMusicUrl,
    fallbackSearch: fallbackSearch,
  }));

  // 三合一: 搜索+匹配+解析
  router.post('/api/search/topone', async (req) => {
    try {
      const r = req as any;
      const body = r.body as Uint8Array | null;
      if (!body) {
        return jsonResponse({ code: 400, msg: 'No body provided' }, 400);
      }
      
      const text = new TextDecoder().decode(body);
      const parsed = JSON.parse(text) as Record<string, unknown>;
      
      const keyword = String(parsed.keyword);
      const source_id = String(parsed.source_id || 'kw');
      const quality = String(parsed.quality || 'standard');
      
      const module = platformModules[source_id];
      if (!module) {
        return jsonResponse({ code: 400, msg: 'Unknown source' }, 400);
      }
      
      const searchResult = await module.musicSearch.search(keyword, 1, 1);
      const songs = searchResult.songs as SongInfo[];
      
      if (songs.length === 0) {
        return jsonResponse({ code: 404, msg: 'No song found' }, 404);
      }
      
      const song = songs[0];
      
      // 尝试解析 URL
      let url: string | null = null;
      if (runtimeManager.hasSources()) {
        const result = await runtimeManager.getMusicUrl(song, quality);
        url = result?.url || null;
      }
      
      return jsonResponse({
        code: 0,
        msg: 'success',
        data: {
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
        },
      });
    } catch (e) {
      return jsonResponse({ code: 500, msg: 'Failed: ' + (e as Error).message }, 500);
    }
  });

  // 导入歌曲到库
  router.post('/api/songs/import', async (req) => {
    try {
      const r = req as any;
      const body = r.body as Uint8Array | null;
      if (!body) {
        return jsonResponse({ code: 400, msg: 'No body provided' }, 400);
      }
      
      const text = new TextDecoder().decode(body);
      const parsed = JSON.parse(text) as Record<string, unknown>;
      const songs = parsed.songs as any[] || [];
      
      const hostUrl = await songloft.plugin.getHostUrl();
      const token = await songloft.plugin.getToken();
      
      const results = [];
      for (const song of songs) {
        try {
          // 去重 key
          const si = song.source_data?.songInfo;
          const dedupKey = si ? 
            `${si.platform}:${si.songmid || si.musicId || si.hash || ''}` : 
            '';
          
          const resp = await fetch(hostUrl + '/api/v1/songs/remote', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + token,
            },
            body: JSON.stringify({
              title: song.title,
              artist: song.artist,
              album: song.album || '',
              cover_url: song.cover_url || '',
              duration: song.duration || 0,
              plugin_entry_path: 'lxmusic',
              source_data: JSON.stringify(song.source_data),
              dedup_key: dedupKey,
            }),
          });
          
          const result = await resp.json();
          results.push(result);
        } catch (e) {
          results.push({ error: (e as Error).message });
        }
      }
      
      return jsonResponse({ code: 0, msg: 'success', data: results });
    } catch (e) {
      return jsonResponse({ code: 500, msg: 'Failed' }, 500);
    }
  });

  // 音源管理
  router.get('/api/sources', async () => {
    try {
      const customSources = sourceManager.list();
      const loadedSources = runtimeManager.listSources();
      
      return jsonResponse({
        code: 0,
        msg: 'success',
        data: {
          builtIn: sources,
          custom: customSources,
          loaded: loadedSources,
          hasSources: runtimeManager.hasSources(),
        },
      });
    } catch (e) {
      return jsonResponse({ code: 500, msg: 'Failed' }, 500);
    }
  });

  router.post('/api/sources/import', async (req) => {
    try {
      const r = req as any;
      const body = r.body as Uint8Array | null;
      if (!body) return jsonResponse({ code: 400, msg: 'No body' }, 400);
      
      const text = new TextDecoder().decode(body);
      const parsed = JSON.parse(text) as Record<string, unknown>;
      const name = String(parsed.name || 'imported');
      const content = String(parsed.content || '');
      
      if (!content) return jsonResponse({ code: 400, msg: 'content required' }, 400);
      
      const source = sourceManager.importJs(name, content);
      return jsonResponse({ code: 0, msg: 'success', data: source });
    } catch (e) {
      return jsonResponse({ code: 500, msg: 'Failed: ' + (e as Error).message }, 500);
    }
  });

  router.post('/api/sources/import-url', async (req) => {
    try {
      const r = req as any;
      const body = r.body as Uint8Array | null;
      if (!body) return jsonResponse({ code: 400, msg: 'No body' }, 400);
      
      const text = new TextDecoder().decode(body);
      const parsed = JSON.parse(text) as Record<string, unknown>;
      const url = String(parsed.url);
      
      if (!url) return jsonResponse({ code: 400, msg: 'url required' }, 400);
      
      const result = await sourceManager.importFromUrl(url);
      return jsonResponse({ code: 0, msg: 'success', data: result });
    } catch (e) {
      return jsonResponse({ code: 500, msg: 'Failed: ' + (e as Error).message }, 500);
    }
  });

  router.delete('/api/sources', async (req) => {
    try {
      const r = req as any;
      const query = r.query as Record<string, string>;
      const id = query.id;
      
      if (!id) return jsonResponse({ code: 400, msg: 'id required' }, 400);
      
      const success = sourceManager.delete(id);
      if (success) {
        runtimeManager.unloadSource(id);
      }
      
      return jsonResponse({ code: 0, msg: 'success', data: { success } });
    } catch (e) {
      return jsonResponse({ code: 500, msg: 'Failed' }, 500);
    }
  });

  router.put('/api/sources/toggle', async (req) => {
    try {
      const r = req as any;
      const body = r.body as Uint8Array | null;
      if (!body) return jsonResponse({ code: 400, msg: 'No body' }, 400);
      
      const text = new TextDecoder().decode(body);
      const parsed = JSON.parse(text) as Record<string, unknown>;
      const id = String(parsed.id);
      const enabled = Boolean(parsed.enabled);
      
      const source = sourceManager.get(id);
      if (!source) return jsonResponse({ code: 404, msg: 'Not found' }, 404);
      
      sourceManager.setEnabled(id, enabled);
      
      if (enabled) {
        // 异步加载
        setTimeout(async () => {
          try {
            await runtimeManager.loadSource(id, source.name, source.script);
          } catch (e) {
            songloft.log.error('Failed to load source:', e);
          }
        }, 100);
      } else {
        runtimeManager.unloadSource(id);
      }
      
      return jsonResponse({ code: 0, msg: 'success' });
    } catch (e) {
      return jsonResponse({ code: 500, msg: 'Failed' }, 500);
    }
  });

  router.post('/api/sources/reload', async () => {
    try {
      await sourceManager.reloadAll(runtimeManager);
      return jsonResponse({ code: 0, msg: 'success' });
    } catch (e) {
      return jsonResponse({ code: 500, msg: 'Failed' }, 500);
    }
  });

  // 歌单
  router.get('/api/songlist/tags', async (req) => {
    try {
      const r = req as any;
      const query = r.query as Record<string, string>;
      const sourceId = query.source_id || 'kw';
      
      const module = platformModules[sourceId];
      if (!module) return jsonResponse({ code: 400, msg: 'Unknown source' }, 400);
      
      const tags = await module.songList.tags();
      return jsonResponse({ code: 0, msg: 'success', data: tags });
    } catch (e) {
      return jsonResponse({ code: 500, msg: 'Failed' }, 500);
    }
  });

  router.get('/api/songlist/list', async (req) => {
    try {
      const r = req as any;
      const query = r.query as Record<string, string>;
      const sourceId = query.source_id || 'kw';
      const tag = query.tag || '';
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 20;
      
      const module = platformModules[sourceId];
      if (!module) return jsonResponse({ code: 400, msg: 'Unknown source' }, 400);
      
      const result = await module.songList.list(tag, page, limit);
      return jsonResponse({ code: 0, msg: 'success', data: result });
    } catch (e) {
      return jsonResponse({ code: 500, msg: 'Failed' }, 500);
    }
  });

  router.get('/api/songlist/detail', async (req) => {
    try {
      const r = req as any;
      const query = r.query as Record<string, string>;
      const sourceId = query.source_id || 'kw';
      const id = query.id;
      
      if (!id) return jsonResponse({ code: 400, msg: 'id required' }, 400);
      
      const module = platformModules[sourceId];
      if (!module) return jsonResponse({ code: 400, msg: 'Unknown source' }, 400);
      
      const result = await module.songList.detail(id);
      return jsonResponse({ code: 0, msg: 'success', data: result });
    } catch (e) {
      return jsonResponse({ code: 500, msg: 'Failed' }, 500);
    }
  });

  // 排行榜
  router.get('/api/leaderboard/boards', async (req) => {
    try {
      const r = req as any;
      const query = r.query as Record<string, string>;
      const sourceId = query.source_id || 'kw';
      
      const module = platformModules[sourceId];
      if (!module) return jsonResponse({ code: 400, msg: 'Unknown source' }, 400);
      
      const boards = await module.leaderboard.boards();
      return jsonResponse({ code: 0, msg: 'success', data: boards });
    } catch (e) {
      return jsonResponse({ code: 500, msg: 'Failed' }, 500);
    }
  });

  router.get('/api/leaderboard/list', async (req) => {
    try {
      const r = req as any;
      const query = r.query as Record<string, string>;
      const sourceId = query.source_id || 'kw';
      const id = query.id;
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 20;
      
      if (!id) return jsonResponse({ code: 400, msg: 'id required' }, 400);
      
      const module = platformModules[sourceId];
      if (!module) return jsonResponse({ code: 400, msg: 'Unknown source' }, 400);
      
      const result = await module.leaderboard.list(id, page, limit);
      return jsonResponse({ code: 0, msg: 'success', data: result });
    } catch (e) {
      return jsonResponse({ code: 500, msg: 'Failed' }, 500);
    }
  });

  // Direct
  router.post('/api/direct/music/url', async (req) => {
    try {
      const r = req as any;
      const body = r.body as Uint8Array | null;
      if (!body) return jsonResponse({ code: 400, msg: 'No body' }, 400);
      
      const text = new TextDecoder().decode(body);
      const parsed = JSON.parse(text) as Record<string, unknown>;
      const songInfo = parsed.songInfo as SongInfo;
      const quality = String(parsed.quality || 'standard');
      
      if (!songInfo) return jsonResponse({ code: 400, msg: 'songInfo required' }, 400);
      
      const result = await runtimeManager.getMusicUrl(songInfo, quality);
      
      if (result) {
        return jsonResponse({ code: 0, msg: 'success', data: { url: result.url } });
      }
      
      return jsonResponse({ code: 404, msg: 'No URL resolved' }, 404);
    } catch (e) {
      return jsonResponse({ code: 500, msg: 'Failed' }, 500);
    }
  });

  router.get('/api/direct/lyric', async (req) => {
    try {
      const r = req as any;
      const query = r.query as Record<string, string>;
      const sourceId = query.source_id || 'kw';
      const musicId = query.musicId;
      const songmid = query.songmid;
      
      if (!musicId && !songmid) {
        return jsonResponse({ code: 400, msg: 'musicId or songmid required' }, 400);
      }
      
      const module = platformModules[sourceId];
      if (!module) return jsonResponse({ code: 400, msg: 'Unknown source' }, 400);
      
      const songInfo = {
        musicId: musicId || songmid || '',
        songmid: songmid || musicId || '',
        platform: sourceId,
      } as SongInfo;
      
      const result = await module.getLyric(songInfo);
      
      if (result) {
        return jsonResponse({ code: 0, msg: 'success', data: result });
      }
      
      return jsonResponse({ code: 0, msg: 'success', data: { lyric: '' } });
    } catch (e) {
      return jsonResponse({ code: 500, msg: 'Failed' }, 500);
    }
  });

  // 健康检查
  router.get('/api/health', () => {
    return jsonResponse({
      code: 0,
      msg: 'OK',
      data: {
        sources: sources.length,
        customSources: sourceManager.list().length,
        loadedSources: runtimeManager.getSourceCount(),
      },
    });
  });
}

// 生命周期导出
;(globalThis as any).onInit = async function () {
  try {
    songloft.log.info('Initializing lxmusic plugin');
    
    runtimeManager = new RuntimeManager();
    sourceManager = new SourceManager(runtimeManager);
    
    await sourceManager.init();
    
    initRouter();
    
    // 后台加载已启用的音源
    setTimeout(() => {
      sourceManager.loadAllEnabled().catch(e => {
        songloft.log.error('Failed to load enabled sources:', e);
      });
    }, 100);
    
    songloft.log.info('lxmusic plugin initialized');
  } catch (error) {
    songloft.log.error('Failed to initialize lxmusic plugin:', error);
  }
};

;(globalThis as any).onDeinit = function () {
  try {
    songloft.log.info('Deinitializing lxmusic plugin');
    
    if (runtimeManager) {
      runtimeManager.clear();
    }
    
    songloft.log.info('lxmusic plugin deinitialized');
  } catch (error) {
    songloft.log.error('Failed to deinitialize lxmusic plugin:', error);
  }
};

;(globalThis as any).onHTTPRequest = function (req: unknown) {
  try {
    const r = req as any;
    const method = String(r.method || 'GET').toUpperCase();
    const path = String(r.path || '');
    
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