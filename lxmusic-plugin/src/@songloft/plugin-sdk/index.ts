// @songloft/plugin-sdk - 宿主契约 SDK (本地实现)
// 仅包含路由/响应/handler 工厂,不含音乐能力

export interface HTTPRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: Uint8Array | null;
  query: Record<string, string>;
}

export interface HTTPResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: Uint8Array | string;
}

export type RouteHandler = (req: HTTPRequest) => HTTPResponse | Promise<HTTPResponse> | null;

export interface Router {
  get(path: string, handler: RouteHandler): void;
  post(path: string, handler: RouteHandler): void;
  put(path: string, handler: RouteHandler): void;
  delete(path: string, handler: RouteHandler): void;
  handle(req: unknown): HTTPResponse | Promise<HTTPResponse> | null;
}

export interface SearchResultItem {
  title: string;
  artist: string;
  album: string;
  duration: number;
  cover_url: string;
  source_data: unknown;
}

export interface MusicUrlFallbackHint {
  enabled: boolean;
  title: string;
  artist: string;
}

export interface FallbackMatch {
  source_data: unknown;
}

interface RouteEntry {
  method: string;
  path: string;
  handler: RouteHandler;
  isPattern: boolean;
  pattern?: RegExp;
  paramNames?: string[];
}

export function createRouter(): Router {
  const routes: RouteEntry[] = [];

  const compilePath = (path: string) => {
    const paramNames: string[] = [];
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

  const matchRoute = (method: string, path: string) => {
    for (const route of routes) {
      if (route.method !== method && route.method !== 'ALL') continue;
      if (route.isPattern && route.pattern) {
        const match = path.match(route.pattern);
        if (match) {
          const params: Record<string, string> = {};
          route.paramNames?.forEach((name, i) => {
            params[name] = decodeURIComponent(match[i + 1]);
          });
          return { handler: route.handler, params };
        }
      } else if (route.path === path) {
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
      const r = req as Record<string, unknown>;
      const method = String(r.method || 'GET').toUpperCase();
      const path = String(r.path || '');
      const matched = matchRoute(method, path);
      if (!matched) return null;
      const request: HTTPRequest = {
        method,
        path,
        query: { ...((r.query as Record<string, string>) || {}), ...matched.params },
        headers: (r.headers as Record<string, string>) || {},
        body: (r.body as Uint8Array) || null,
      };
      return matched.handler(request);
    },
  };
}

export function jsonResponse(body: unknown, status = 200): HTTPResponse {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export function parseQuery(q: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!q) return result;
  const pairs = q.startsWith('?') ? q.slice(1).split('&') : q.split('&');
  for (const pair of pairs) {
    const [key, val] = pair.split('=');
    if (key) result[decodeURIComponent(key)] = decodeURIComponent(val || '');
  }
  return result;
}

// --- 主程序集成契约 handler 工厂 ---

export interface SearchParams {
  keyword: string;
  source_id: string;
  quality?: string;
  page: number;
  page_size: number;
}

export function createSearchHandler(opts: {
  search: (params: SearchParams) => Promise<{ results: SearchResultItem[] }>;
}): RouteHandler {
  return async (req) => {
    try {
      let params: SearchParams;
      if (req.body) {
        const text = typeof req.body === 'string' ? req.body : new TextDecoder().decode(req.body);
        const parsed = JSON.parse(text) as Record<string, unknown>;
        params = {
          keyword: String(parsed.keyword || ''),
          source_id: String(parsed.source_id || 'kw'),
          quality: String(parsed.quality || 'standard'),
          page: Number(parsed.page) || 1,
          page_size: Number(parsed.page_size) || 20,
        };
      } else {
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
    } catch (e) {
      songloft.log.error('Search handler error:', e);
      return jsonResponse({ results: [] });
    }
  };
}

export function createMusicUrlHandler(opts: {
  resolveUrl: (source_data: unknown) => Promise<{ url: string; headers?: Record<string, string> } | null>;
  fallbackSearch?: (hint: MusicUrlFallbackHint) => Promise<FallbackMatch | null>;
}): RouteHandler {
  return async (req) => {
    try {
      let source_data: unknown;
      let hint: MusicUrlFallbackHint | undefined;

      if (req.body) {
        const text = typeof req.body === 'string' ? req.body : new TextDecoder().decode(req.body);
        const parsed = JSON.parse(text) as Record<string, unknown>;
        source_data = parsed.source_data;
        hint = parsed.hint as MusicUrlFallbackHint | undefined;
      } else {
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
    } catch (e) {
      songloft.log.error('Music URL handler error:', e);
      return jsonResponse({ url: '' }, 500);
    }
  };
}
