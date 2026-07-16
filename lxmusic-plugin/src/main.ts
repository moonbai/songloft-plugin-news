import { createRouter, createSearchHandler, createMusicUrlHandler, jsonResponse } from '@songloft/plugin-sdk';
import { RuntimeManager } from './engine';
import { SourceManager } from './source';
import { sources, kw, kg, tx, wy, mg } from './musicSdk/facade';
import type { SongInfo, SourceData } from './types';
import { importSongToLibrary, createPlaylist, addSongToPlaylist } from './utils/http';
import { createSourceHandlers, createSongListHandlers, createLeaderboardHandlers, createDirectHandlers } from './handlers';

const platformModules: Record<string, any> = { kw, kg, tx, wy, mg };

let router: ReturnType<typeof createRouter>;
let runtimeManager: RuntimeManager;
let sourceManager: SourceManager;

async function resolveMusicUrl(source_data: unknown): Promise<{ url: string; headers?: Record<string, string> } | null> {
  const data = source_data as SourceData;
  const { songInfo, quality } = data;
  const url = await runtimeManager.getMusicUrl(songInfo, quality);
  
  if (url) {
    return { url };
  }
  
  return null;
}

async function fallbackSearch(hint: unknown): Promise<unknown> {
  const h = hint as Record<string, unknown>;
  if (!h.enabled) return null;
  
  const title = String(h.title || '');
  const artist = String(h.artist || '');
  
  if (!title) return null;
  
  for (const source of sources) {
    try {
      const module = platformModules[source.id];
      if (!module) continue;
      
      const result = await module.musicSearch.search(title + ' ' + artist, 1, 1);
      const songs = result.songs as SongInfo[];
      
      if (songs.length > 0) {
        return {
          platform: source.id,
          quality: 'standard',
          songInfo: songs[0],
        };
      }
    } catch {
    }
  }
  
  return null;
}

function initRouter() {
  router = createRouter();

  router.post('/api/search', createSearchHandler({
    async search(params) {
      const { keyword, source_id, quality, page, page_size } = params;
      
      const module = platformModules[source_id || 'kw'];
      if (!module) {
        return { results: [] };
      }
      
      const result = await module.musicSearch.search(keyword, page || 1, page_size || 20);
      const songs = result.songs as SongInfo[];
      
      return {
        results: songs.map(song => ({
          title: song.name,
          artist: song.singer,
          album: song.album || '',
          duration: song.duration || 0,
          cover_url: '',
          source_data: {
            platform: song.platform,
            quality: quality || 'standard',
            songInfo: song,
          },
        })),
      };
    },
  }));

  router.post('/api/music/url', createMusicUrlHandler({
    resolveUrl: resolveMusicUrl,
    fallbackSearch: fallbackSearch,
  }));

  router.post('/api/search/topone', async (req) => {
    try {
      const request = req as unknown as Record<string, unknown>;
      const body = request.body as Uint8Array | null;
      if (!body) {
        return jsonResponse({ code: 400, msg: 'No body provided' }, 400);
      }
      
      const content = Array.from(body).map(b => String.fromCharCode(b)).join('');
      const parsed = JSON.parse(content) as Record<string, unknown>;
      
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
      const url = await runtimeManager.getMusicUrl(song, quality);
      
      return jsonResponse({
        code: 0,
        msg: 'success',
        data: {
          song: {
            title: song.name,
            artist: song.singer,
            album: song.album || '',
            duration: song.duration || 0,
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
      return jsonResponse({ code: 500, msg: 'Failed' }, 500);
    }
  });

  router.post('/api/songs/import', async (req) => {
    try {
      const request = req as unknown as Record<string, unknown>;
      const body = request.body as Uint8Array | null;
      if (!body) {
        return jsonResponse({ code: 400, msg: 'No body provided' }, 400);
      }
      
      const content = Array.from(body).map(b => String.fromCharCode(b)).join('');
      const parsed = JSON.parse(content) as Record<string, unknown>;
      const songs = parsed.songs as any[] || [];
      
      const results = [];
      for (const song of songs) {
        try {
          const result = await importSongToLibrary(song);
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

  const sourceHandlers = createSourceHandlers(sourceManager);
  router.get('/api/sources', sourceHandlers.getSources);
  router.post('/api/sources/import', sourceHandlers.importSource);
  router.post('/api/sources/import-url', sourceHandlers.importSourceUrl);
  router.delete('/api/sources', sourceHandlers.deleteSource);
  router.put('/api/sources/toggle', sourceHandlers.toggleSource);
  router.post('/api/sources/reload', sourceHandlers.reloadSources);

  const songListHandlers = createSongListHandlers();
  router.get('/api/songlist/tags', songListHandlers.getTags);
  router.get('/api/songlist/list', songListHandlers.getList);
  router.get('/api/songlist/detail', songListHandlers.getDetail);
  router.get('/api/songlist/search', songListHandlers.search);
  router.get('/api/songlist/sorts', songListHandlers.getSorts);

  const leaderboardHandlers = createLeaderboardHandlers();
  router.get('/api/leaderboard/boards', leaderboardHandlers.getBoards);
  router.get('/api/leaderboard/list', leaderboardHandlers.getList);

  const directHandlers = createDirectHandlers(runtimeManager);
  router.post('/api/direct/music/url', directHandlers.getMusicUrl);
  router.get('/api/direct/lyric', directHandlers.getLyric);

  router.get('/api/playlists/create', async (req) => {
    try {
      const request = req as unknown as Record<string, unknown>;
      const query = request.query as Record<string, string>;
      const name = query.name;
      const description = query.description;
      
      if (!name) {
        return jsonResponse({ code: 400, msg: 'Name is required' }, 400);
      }
      
      const result = await createPlaylist(name, description);
      return jsonResponse({ code: 0, msg: 'success', data: result });
    } catch (e) {
      return jsonResponse({ code: 500, msg: 'Failed' }, 500);
    }
  });

  router.post('/api/playlists/:id/songs', async (req) => {
    try {
      const request = req as unknown as Record<string, unknown>;
      const path = String(request.path || '');
      const id = path.split('/')[2];
      
      const body = request.body as Uint8Array | null;
      if (!body) {
        return jsonResponse({ code: 400, msg: 'No body provided' }, 400);
      }
      
      const content = Array.from(body).map(b => String.fromCharCode(b)).join('');
      const parsed = JSON.parse(content) as Record<string, unknown>;
      const songId = String(parsed.song_id || '');
      
      const result = await addSongToPlaylist(id, songId);
      return jsonResponse({ code: 0, msg: 'success', data: result });
    } catch (e) {
      return jsonResponse({ code: 500, msg: 'Failed' }, 500);
    }
  });

  router.get('/api/health', () => {
    return jsonResponse({ code: 0, msg: 'OK' });
  });
}

;(globalThis as any).onInit = async function () {
  try {
    songloft.log.info('Initializing lxmusic plugin');
    
    runtimeManager = new RuntimeManager();
    sourceManager = new SourceManager(runtimeManager);
    
    await sourceManager.init();
    
    initRouter();
    
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
