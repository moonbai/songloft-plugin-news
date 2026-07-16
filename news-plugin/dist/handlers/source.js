"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSourceHandlers = createSourceHandlers;
const response_1 = require("./response");
function createSourceHandlers(sourceManager) {
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
                return (0, response_1.successResponse)({ sources });
            }
            catch (e) {
                return (0, response_1.errorResponse)('Failed to get sources');
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
                    return (0, response_1.badRequestResponse)('No body provided');
                const text = new TextDecoder().decode(body);
                const parsed = JSON.parse(text);
                const name = String(parsed.name || 'imported_source');
                const content = String(parsed.content || '');
                if (!content)
                    return (0, response_1.badRequestResponse)('content is required');
                const source = sourceManager.importJs(name, content);
                return (0, response_1.successResponse)({ source });
            }
            catch (e) {
                return (0, response_1.errorResponse)('Failed to import source: ' + e.message);
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
                    return (0, response_1.badRequestResponse)('No body provided');
                const text = new TextDecoder().decode(body);
                const parsed = JSON.parse(text);
                const url = String(parsed.url || '');
                if (!url)
                    return (0, response_1.badRequestResponse)('url is required');
                const result = await sourceManager.importFromUrl(url);
                return (0, response_1.successResponse)({ sources: Array.isArray(result) ? result : [result] });
            }
            catch (e) {
                return (0, response_1.errorResponse)('Failed to import from URL: ' + e.message);
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
                    return (0, response_1.badRequestResponse)('No body provided');
                const text = new TextDecoder().decode(body);
                const parsed = JSON.parse(text);
                const id = String(parsed.id || '');
                const enabled = Boolean(parsed.enabled);
                if (!id)
                    return (0, response_1.badRequestResponse)('id is required');
                const success = sourceManager.setEnabled(id, enabled);
                if (!success)
                    return (0, response_1.errorResponse)('Source not found', 404);
                return (0, response_1.successResponse)({ success: true });
            }
            catch (e) {
                return (0, response_1.errorResponse)('Failed to toggle source');
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
                    return (0, response_1.badRequestResponse)('id is required');
                const success = sourceManager.delete(id);
                if (!success)
                    return (0, response_1.errorResponse)('Source not found', 404);
                return (0, response_1.successResponse)({ success: true });
            }
            catch (e) {
                return (0, response_1.errorResponse)('Failed to delete source');
            }
        },
        /**
         * 重新加载所有 source
         */
        async reloadSources(req) {
            try {
                await sourceManager.reloadAll();
                return (0, response_1.successResponse)({ success: true });
            }
            catch (e) {
                return (0, response_1.errorResponse)('Failed to reload sources');
            }
        },
        /**
         * 导出 source 配置
         */
        async exportSources(req) {
            try {
                const config = sourceManager.exportConfig();
                return (0, response_1.successResponse)({ sources: config });
            }
            catch (e) {
                return (0, response_1.errorResponse)('Failed to export sources');
            }
        },
    };
}
