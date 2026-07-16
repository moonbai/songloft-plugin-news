// 音源管理处理器

import { SourceManager } from '../source';
import { successResponse, errorResponse } from './response';

export function createSourceHandlers(sourceManager: SourceManager) {
  return {
    async getSources(req: unknown) {
      try {
        const sources = sourceManager.list();
        return successResponse({ sources });
      } catch (e) {
        return errorResponse('Failed to get sources');
      }
    },

    async importSource(req: unknown) {
      try {
        const r = req as any;
        const body = r.body as Uint8Array | null;
        if (!body) return errorResponse('No body', 400);
        
        const text = new TextDecoder().decode(body);
        const parsed = JSON.parse(text) as Record<string, unknown>;
        const name = String(parsed.name || 'imported');
        const content = String(parsed.content || '');
        
        if (!content) return errorResponse('content required', 400);
        
        const source = sourceManager.importJs(name, content);
        return successResponse({ source });
      } catch (e) {
        return errorResponse('Import failed: ' + (e as Error).message);
      }
    },

    async importSourceUrl(req: unknown) {
      try {
        const r = req as any;
        const body = r.body as Uint8Array | null;
        if (!body) return errorResponse('No body', 400);
        
        const text = new TextDecoder().decode(body);
        const parsed = JSON.parse(text) as Record<string, unknown>;
        const url = String(parsed.url);
        
        if (!url) return errorResponse('url required', 400);
        
        const result = await sourceManager.importFromUrl(url);
        return successResponse({ sources: Array.isArray(result) ? result : [result] });
      } catch (e) {
        return errorResponse('Import from URL failed: ' + (e as Error).message);
      }
    },

    async deleteSource(req: unknown) {
      try {
        const r = req as any;
        const query = r.query as Record<string, string>;
        const id = query.id;
        
        if (!id) return errorResponse('id required', 400);
        
        const success = sourceManager.delete(id);
        return successResponse({ success });
      } catch (e) {
        return errorResponse('Delete failed');
      }
    },

    async toggleSource(req: unknown) {
      try {
        const r = req as any;
        const body = r.body as Uint8Array | null;
        if (!body) return errorResponse('No body', 400);
        
        const text = new TextDecoder().decode(body);
        const parsed = JSON.parse(text) as Record<string, unknown>;
        const id = String(parsed.id);
        const enabled = Boolean(parsed.enabled);
        
        const success = sourceManager.setEnabled(id, enabled);
        return successResponse({ success });
      } catch (e) {
        return errorResponse('Toggle failed');
      }
    },

    async reloadSources(req: unknown) {
      try {
        await sourceManager.reloadAll(sourceManager as any);
        return successResponse({ success: true });
      } catch (e) {
        return errorResponse('Reload failed');
      }
    },
  };
}