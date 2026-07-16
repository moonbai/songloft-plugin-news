"use strict";
// 本地类型定义，替代 @songloft/plugin-sdk
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRouter = createRouter;
exports.jsonResponse = jsonResponse;
exports.errorResponse = errorResponse;
exports.successResponse = successResponse;
exports.badRequestResponse = badRequestResponse;
exports.createSearchHandler = createSearchHandler;
exports.createNewsDetailHandler = createNewsDetailHandler;
function createRouter() {
    const routes = [];
    const compilePath = (path) => {
        const paramNames = [];
        const regexStr = path.replace(/:[a-zA-Z_][a-zA-Z0-9_]*/g, (match) => {
            paramNames.push(match.slice(1));
            return '([^/]+)';
        });
        const isPattern = path.includes(':');
        return {
            pattern: new RegExp('^' + regexStr + '$'),
            paramNames,
            isPattern,
        };
    };
    const matchRoute = (method, path) => {
        for (const route of routes) {
            if (route.method !== method && route.method !== 'ALL')
                continue;
            if (route.isPattern && route.pattern) {
                const match = path.match(route.pattern);
                if (match) {
                    const params = {};
                    if (route.paramNames) {
                        route.paramNames.forEach((name, i) => {
                            params[name] = decodeURIComponent(match[i + 1]);
                        });
                    }
                    return { handler: route.handler, params };
                }
            }
            else if (route.path === path) {
                return { handler: route.handler, params: {} };
            }
        }
        return null;
    };
    return {
        get(path, handler) {
            const { pattern, paramNames, isPattern } = compilePath(path);
            routes.push({ method: 'GET', path, handler, isPattern, pattern, paramNames });
        },
        post(path, handler) {
            const { pattern, paramNames, isPattern } = compilePath(path);
            routes.push({ method: 'POST', path, handler, isPattern, pattern, paramNames });
        },
        put(path, handler) {
            const { pattern, paramNames, isPattern } = compilePath(path);
            routes.push({ method: 'PUT', path, handler, isPattern, pattern, paramNames });
        },
        delete(path, handler) {
            const { pattern, paramNames, isPattern } = compilePath(path);
            routes.push({ method: 'DELETE', path, handler, isPattern, pattern, paramNames });
        },
        handle(req) {
            const r = req;
            const method = String(r.method || 'GET').toUpperCase();
            const path = String(r.path || '');
            const matched = matchRoute(method, path);
            if (matched) {
                const request = {
                    method,
                    path,
                    query: r.query || {},
                    headers: r.headers || {},
                    body: r.body || null,
                };
                const params = matched.params;
                request.query = { ...request.query, ...params };
                const result = matched.handler(request);
                if (result instanceof Promise) {
                    return result;
                }
                return result;
            }
            return null;
        },
    };
}
function jsonResponse(data, status = 200) {
    return {
        status,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    };
}
function errorResponse(msg, status = 500) {
    return jsonResponse({ code: status, msg }, status);
}
function successResponse(data) {
    return jsonResponse({ code: 0, msg: 'success', data });
}
function badRequestResponse(msg) {
    return errorResponse(msg, 400);
}
function createSearchHandler(opts) {
    return async (req) => {
        try {
            const body = req.body;
            if (!body) {
                const params = req.query;
                const result = await opts.search({
                    keyword: params.keyword || '',
                    source_id: params.source_id,
                    page: Number(params.page) || 1,
                    page_size: Number(params.page_size) || 20,
                });
                return successResponse(result);
            }
            const text = typeof body === 'string' ? body : new TextDecoder().decode(body);
            const parsed = JSON.parse(text);
            const result = await opts.search({
                keyword: String(parsed.keyword || ''),
                source_id: parsed.source_id,
                page: Number(parsed.page) || 1,
                page_size: Number(parsed.page_size) || 20,
            });
            return successResponse(result);
        }
        catch (e) {
            return errorResponse('Search failed: ' + e.message);
        }
    };
}
function createNewsDetailHandler(opts) {
    return async (req) => {
        try {
            const source = String(req.query.source_id || req.query.source || '');
            const id = String(req.query.id || '');
            if (!id)
                return errorResponse('id is required', 400);
            const result = await opts.getDetail(source, id);
            return successResponse(result);
        }
        catch (e) {
            return errorResponse('Get detail failed: ' + e.message);
        }
    };
}
