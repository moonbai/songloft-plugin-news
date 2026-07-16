export function createRouter() {
    const routes = [];
    return {
        get(path, handler) {
            routes.push({ method: 'GET', path, handler });
        },
        post(path, handler) {
            routes.push({ method: 'POST', path, handler });
        },
        put(path, handler) {
            routes.push({ method: 'PUT', path, handler });
        },
        delete(path, handler) {
            routes.push({ method: 'DELETE', path, handler });
        },
        handle(req) {
            const request = req;
            const route = routes.find(r => r.method === request.method && r.path === request.path);
            if (route) {
                return route.handler(request);
            }
            return undefined;
        },
    };
}
export function createSearchHandler(options) {
    return async (req) => {
        try {
            const body = req.body ? Array.from(req.body).map(b => String.fromCharCode(b)).join('') : '{}';
            const params = JSON.parse(body);
            const result = await options.search(params);
            return jsonResponse(result);
        }
        catch {
            return jsonResponse({ results: [] });
        }
    };
}
export function createMusicUrlHandler(options) {
    return async (req) => {
        try {
            const body = req.body ? Array.from(req.body).map(b => String.fromCharCode(b)).join('') : '{}';
            const params = JSON.parse(body);
            const urlResult = await options.resolveUrl(params.source_data);
            if (urlResult) {
                return jsonResponse(urlResult);
            }
            if (options.fallbackSearch && params.fallback_hint?.enabled) {
                const fallback = await options.fallbackSearch(params.fallback_hint);
                if (fallback) {
                    return jsonResponse({ fallback_match: fallback });
                }
            }
            return jsonResponse({ error: 'No URL found' }, 404);
        }
        catch {
            return jsonResponse({ error: 'Internal error' }, 500);
        }
    };
}
export function jsonResponse(body, status = 200) {
    const json = typeof body === 'string' ? body : JSON.stringify(body);
    return {
        statusCode: status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: new Uint8Array(json.split('').map(c => c.charCodeAt(0))),
    };
}
export function parseQuery(q) {
    const result = {};
    const pairs = q.split('&');
    for (const pair of pairs) {
        const [key, value] = pair.split('=');
        if (key) {
            result[key] = value ? decodeURIComponent(value) : '';
        }
    }
    return result;
}
