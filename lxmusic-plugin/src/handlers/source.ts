import type { SourceManager } from '../source';
import { successResponse, errorResponse, badRequestResponse } from './response';

export function createSourceHandlers(sourceManager: SourceManager) {
  return {
    async getSources(req: unknown) {
      try {
        const sources = sourceManager.getAll();
        const batchStatus = sourceManager.getBatchStatus();
        return successResponse({
          sources,
          batch_status: batchStatus,
        });
      } catch (e) {
        return errorResponse('Failed to get sources');
      }
    },

    async importSource(req: unknown) {
      try {
        const body = (req as Record<string, unknown>).body as Uint8Array | null;
        if (!body) return badRequestResponse('No body provided');
        
        const content = Array.from(body).map(b => String.fromCharCode(b)).join('');
        const files = content.match(/Content-Disposition: form-data; name="files"; filename="(.+?)"/);
        
        if (files) {
          const filename = files[1];
          if (filename.endsWith('.zip')) {
            const result = await sourceManager.importZip(content);
            return successResponse(result);
          } else if (filename.endsWith('.js')) {
            const result = await sourceManager.importScript(content, filename);
            return successResponse([result]);
          }
        }
        
        return badRequestResponse('Unsupported file type');
      } catch (e) {
        return errorResponse('Failed to import source');
      }
    },

    async importSourceUrl(req: unknown) {
      try {
        const body = (req as Record<string, unknown>).body as Uint8Array | null;
        if (!body) return badRequestResponse('No body provided');
        
        const content = Array.from(body).map(b => String.fromCharCode(b)).join('');
        const parsed = JSON.parse(content);
        const url = parsed.url;
        
        if (!url) return badRequestResponse('URL is required');
        
        const result = await sourceManager.importUrl(url);
        return successResponse(result);
      } catch (e) {
        return errorResponse('Failed to import source from URL');
      }
    },

    async deleteSource(req: unknown) {
      try {
        const query = (req as Record<string, unknown>).query as Record<string, string>;
        const id = query.id;
        
        if (!id) return badRequestResponse('ID is required');
        
        await sourceManager.remove(id);
        return successResponse(null, 'Deleted');
      } catch (e) {
        return errorResponse('Failed to delete source');
      }
    },

    async toggleSource(req: unknown) {
      try {
        const body = (req as Record<string, unknown>).body as Uint8Array | null;
        if (!body) return badRequestResponse('No body provided');
        
        const content = Array.from(body).map(b => String.fromCharCode(b)).join('');
        const parsed = JSON.parse(content);
        const id = parsed.id;
        
        if (!id) return badRequestResponse('ID is required');
        
        const enabled = await sourceManager.toggle(id);
        return successResponse({ enabled });
      } catch (e) {
        return errorResponse('Failed to toggle source');
      }
    },

    async reloadSources(req: unknown) {
      try {
        await sourceManager.reloadAll();
        return successResponse(null, 'Reloading');
      } catch (e) {
        return errorResponse('Failed to reload sources');
      }
    },
  };
}
