import { sources, kw, kg, tx, wy, mg } from '../musicSdk/facade';
import type { SongInfo } from '../types';
import { successResponse, errorResponse, badRequestResponse } from './response';

const platformModules: Record<string, any> = { kw, kg, tx, wy, mg };

export function createSearchHandlers() {
  return {
    async search(req: unknown) {
      try {
        const body = (req as Record<string, unknown>).body as Uint8Array | null;
        if (!body) return badRequestResponse('No body provided');
        
        const content = Array.from(body).map(b => String.fromCharCode(b)).join('');
        const parsed = JSON.parse(content) as Record<string, unknown>;
        
        const keyword = String(parsed.keyword);
        const source_id = String(parsed.source_id || 'kw');
        const page = Number(parsed.page) || 1;
        const page_size = Number(parsed.page_size) || 20;
        
        if (!keyword) return badRequestResponse('Keyword is required');
        
        const module = platformModules[source_id];
        if (!module) return badRequestResponse('Unknown source');
        
        const result = await module.musicSearch.search(keyword, page, page_size);
        
        const songs = result.songs as SongInfo[];
        
        const searchResults = songs.map(song => ({
          title: song.name,
          artist: song.singer,
          album: song.album || '',
          duration: song.duration || 0,
          cover_url: '',
          source_data: {
            platform: song.platform,
            quality: 'standard',
            songInfo: song,
          },
        }));
        
        return successResponse({
          results: searchResults,
          total: result.total || searchResults.length,
        });
      } catch (e) {
        return errorResponse('Search failed');
      }
    },

    async getSources(req: unknown) {
      try {
        return successResponse(sources);
      } catch (e) {
        return errorResponse('Failed to get sources');
      }
    },
  };
}
