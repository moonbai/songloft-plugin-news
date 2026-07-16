import { successResponse, errorResponse, badRequestResponse } from './response';
export function createSourceHandlers(sourceManager) {
    return {
        /**
         * 获取所有 source
         */
        async getSources(req) {
            try {
                const sources = sourceManager.list().map(s => ({
                    id: s.id,
                    name: s.name,
                    version: s.version,
                    author: s.author,
                    description: s.description,
                    platforms: s.platforms,
                    enabled: s.enabled,
                    createTime: s.createTime,
                    updateTime: s.updateTime,
                }));
                return successResponse({ sources });
            }
            catch (e) {
                return errorResponse('Failed to get sources');
            }
        },
        /**
         * 导入 JS source
         */
        async importSource(req) {
            try {
                const request = req;
                const body = request.body;
                if (!body)
                    return badRequestResponse('No body provided');
                const text = new TextDecoder().decode(body);
                const parsed = JSON.parse(text);
                const name = String(parsed.name || 'imported_source');
                const content = String(parsed.content || '');
                if (!content)
                    return badRequestResponse('content is required');
                const source = sourceManager.importJs(name, content);
                return successResponse({ source });
            }
            catch (e) {
                return errorResponse('Failed to import source: ' + e.message);
            }
        },
        /**
         * 从 URL 导入
         */
        async importSourceUrl(req) {
            try {
                const request = req;
                const body = request.body;
                if (!body)
                    return badRequestResponse('No body provided');
                const text = new TextDecoder().decode(body);
                const parsed = JSON.parse(text);
                const url = String(parsed.url || '');
                if (!url)
                    return badRequestResponse('url is required');
                const result = await sourceManager.importFromUrl(url);
                return successResponse({ sources: Array.isArray(result) ? result : [result] });
            }
            catch (e) {
                return errorResponse('Failed to import from URL: ' + e.message);
            }
        },
        /**
         * 切换启用状态
         */
        async toggleSource(req) {
            try {
                const request = req;
                const body = request.body;
                if (!body)
                    return badRequestResponse('No body provided');
                const text = new TextDecoder().decode(body);
                const parsed = JSON.parse(text);
                const id = String(parsed.id || '');
                const enabled = Boolean(parsed.enabled);
                if (!id)
                    return badRequestResponse('id is required');
                const success = sourceManager.setEnabled(id, enabled);
                if (!success)
                    return errorResponse('Source not found', 404);
                return successResponse({ success: true });
            }
            catch (e) {
                return errorResponse('Failed to toggle source');
            }
        },
        /**
         * 删除 source
         */
        async deleteSource(req) {
            try {
                const request = req;
                const query = request.query || {};
                const id = String(query.id || '');
                if (!id)
                    return badRequestResponse('id is required');
                const success = sourceManager.delete(id);
                if (!success)
                    return errorResponse('Source not found', 404);
                return successResponse({ success: true });
            }
            catch (e) {
                return errorResponse('Failed to delete source');
            }
        },
        /**
         * 重新加载所有 source
         */
        async reloadSources(req) {
            try {
                await sourceManager.reloadAll();
                return successResponse({ success: true });
            }
            catch (e) {
                return errorResponse('Failed to reload sources');
            }
        },
        /**
         * 导出 source 配置
         */
        async exportSources(req) {
            try {
                const config = sourceManager.exportConfig();
                return successResponse({ sources: config });
            }
            catch (e) {
                return errorResponse('Failed to export sources');
            }
        },
    };
}
