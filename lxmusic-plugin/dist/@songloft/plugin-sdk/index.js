// @songloft/plugin-sdk - 宿主契约 SDK (本地实现)
// 仅包含路由/响应/handler 工厂,不含音乐能力
export function createRouter() {
    const routes = [];
    const compilePath = (path) => {
        const paramNames = [];
        const regexStr = path.replace(/:[a-zA-Z_][a-zA-Z0-9_]*/g, (match) => {
            paramNames.push(match.slice(1));
            return '([^/]+)';
        });
        return {
            pattern: new RegExp('^' + regexStr + '$'),
            paramNames,
            isPattern: path.includes(':'),
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
                    route.paramNames?.forEach((name, i) => {
                        params[name] = decodeURIComponent(match[i + 1]);
                    });
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
        get(path, handler) { const c = compilePath(path); routes.push({ method: 'GET', path, handler, ...c }); },
        post(path, handler) { const c = compilePath(path); routes.push({ method: 'POST', path, handler, ...c }); },
        put(path, handler) { const c = compilePath(path); routes.push({ method: 'PUT', path, handler, ...c }); },
        delete(path, handler) { const c = compilePath(path); routes.push({ method: 'DELETE', path, handler, ...c }); },
        handle(req) {
            const r = req;
            const method = String(r.method || 'GET').toUpperCase();
            const path = String(r.path || '');
            const matched = matchRoute(method, path);
            if (!matched)
                return null;
            const request = {
                method,
                path,
                query: { ...(r.query || {}), ...matched.params },
                headers: r.headers || {},
                body: r.body || null,
            };
            return matched.handler(request);
        },
    };
}
export function jsonResponse(body, status = 200) {
    return {
        statusCode: status,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    };
}
export function parseQuery(q) {
    const result = {};
    if (!q)
        return result;
    const pairs = q.startsWith('?') ? q.slice(1).split('&') : q.split('&');
    for (const pair of pairs) {
        const [key, val] = pair.split('=');
        if (key)
            result[decodeURIComponent(key)] = decodeURIComponent(val || '');
    }
    return result;
}
export function createSearchHandler(opts) {
    return async (req) => {
        try {
            let params;
            if (req.body) {
                const text = typeof req.body === 'string' ? req.body : new TextDecoder().decode(req.body);
                const parsed = JSON.parse(text);
                params = {
                    keyword: String(parsed.keyword || ''),
                    source_id: String(parsed.source_id || 'kw'),
                    quality: String(parsed.quality || 'standard'),
                    page: Number(parsed.page) || 1,
                    page_size: Number(parsed.page_size) || 20,
                };
            }
            else {
                params = {
                    keyword: req.query.keyword || '',
                    source_id: req.query.source_id || 'kw',
                    quality: req.query.quality || 'standard',
                    page: Number(req.query.page) || 1,
                    page_size: Number(req.query.page_size) || 20,
                };
            }
            const result = await opts.search(params);
            // 主程序契约:返回裸 {results}
            return jsonResponse(result);
        }
        catch (e) {
            songloft.log.error('Search handler error:', e);
            return jsonResponse({ results: [] });
        }
    };
}
export function createMusicUrlHandler(opts) {
    return async (req) => {
        try {
            let source_data;
            let hint;
            if (req.body) {
                const text = typeof req.body === 'string' ? req.body : new TextDecoder().decode(req.body);
                const parsed = JSON.parse(text);
                source_data = parsed.source_data;
                hint = parsed.hint;
            }
            else {
                source_data = req.query.source_data ? JSON.parse(req.query.source_data) : null;
                hint = req.query.hint ? JSON.parse(req.query.hint) : undefined;
            }
            // 先尝试主源解析
            let result = await opts.resolveUrl(source_data);
            // 主源失败且启用 fallback 时跨平台搜索
            if (!result && hint && hint.enabled && opts.fallbackSearch) {
                const match = await opts.fallbackSearch(hint);
                if (match) {
                    result = await opts.resolveUrl(match.source_data);
                }
            }
            if (result) {
                // 主程序契约:返回裸 {url} 或 {url, headers}
                return jsonResponse(result);
            }
            return jsonResponse({ url: '' }, 404);
        }
        catch (e) {
            songloft.log.error('Music URL handler error:', e);
            return jsonResponse({ url: '' }, 500);
        }
    };
}
