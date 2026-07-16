"use strict";
// 音源管理处理器
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSourceHandlers = createSourceHandlers;
const response_1 = require("./response");
function createSourceHandlers(sourceManager) {
    return {
        async getSources(req) {
            try {
                const sources = sourceManager.list();
                return (0, response_1.successResponse)({ sources });
            }
            catch (e) {
                return (0, response_1.errorResponse)('Failed to get sources');
            }
        },
        async importSource(req) {
            try {
                const r = req;
                const body = r.body;
                if (!body)
                    return (0, response_1.errorResponse)('No body', 400);
                const text = new TextDecoder().decode(body);
                const parsed = JSON.parse(text);
                const name = String(parsed.name || 'imported');
                const content = String(parsed.content || '');
                if (!content)
                    return (0, response_1.errorResponse)('content required', 400);
                const source = sourceManager.importJs(name, content);
                return (0, response_1.successResponse)({ source });
            }
            catch (e) {
                return (0, response_1.errorResponse)('Import failed: ' + e.message);
            }
        },
        async importSourceUrl(req) {
            try {
                const r = req;
                const body = r.body;
                if (!body)
                    return (0, response_1.errorResponse)('No body', 400);
                const text = new TextDecoder().decode(body);
                const parsed = JSON.parse(text);
                const url = String(parsed.url);
                if (!url)
                    return (0, response_1.errorResponse)('url required', 400);
                const result = await sourceManager.importFromUrl(url);
                return (0, response_1.successResponse)({ sources: Array.isArray(result) ? result : [result] });
            }
            catch (e) {
                return (0, response_1.errorResponse)('Import from URL failed: ' + e.message);
            }
        },
        async deleteSource(req) {
            try {
                const r = req;
                const query = r.query;
                const id = query.id;
                if (!id)
                    return (0, response_1.errorResponse)('id required', 400);
                const success = sourceManager.delete(id);
                return (0, response_1.successResponse)({ success });
            }
            catch (e) {
                return (0, response_1.errorResponse)('Delete failed');
            }
        },
        async toggleSource(req) {
            try {
                const r = req;
                const body = r.body;
                if (!body)
                    return (0, response_1.errorResponse)('No body', 400);
                const text = new TextDecoder().decode(body);
                const parsed = JSON.parse(text);
                const id = String(parsed.id);
                const enabled = Boolean(parsed.enabled);
                const success = sourceManager.setEnabled(id, enabled);
                return (0, response_1.successResponse)({ success });
            }
            catch (e) {
                return (0, response_1.errorResponse)('Toggle failed');
            }
        },
        async reloadSources(req) {
            try {
                await sourceManager.reloadAll(sourceManager);
                return (0, response_1.successResponse)({ success: true });
            }
            catch (e) {
                return (0, response_1.errorResponse)('Reload failed');
            }
        },
    };
}
