// 本地类型定义，替代 @songloft/plugin-sdk

export interface HTTPRequest {
  method: string;
  path: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  body: Uint8Array | null;
}

export interface HTTPResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: Uint8Array | string;
}

export type RouteHandler = (req: HTTPRequest) => HTTPResponse | Promise<HTTPResponse> | null;

export interface Router {
  get: (path: string, handler: RouteHandler) => void;
  post: (path: string, handler: RouteHandler) => void;
  put: (path: string, handler: RouteHandler) => void;
  delete: (path: string, handler: RouteHandler) => void;
  handle: (req: unknown) => HTTPResponse | Promise<HTTPResponse> | null;
}

export function createRouter(): Router {
  const routes: Array<{ method: string; path: string; handler: RouteHandler; isPattern: boolean; pattern?: RegExp; paramNames?: string[] }> = [];

  const compilePath = (path: string): { pattern: RegExp; paramNames: string[]; isPattern: boolean } => {
    const paramNames: string[] = [];
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

  const matchRoute = (method: string, path: string): { handler: RouteHandler; params: Record<string, string> } | null => {
    for (const route of routes) {
      if (route.method !== method && route.method !== 'ALL') continue;
      if (route.isPattern && route.pattern) {
        const match = path.match(route.pattern);
        if (match) {
          const params: Record<string, string> = {};
          if (route.paramNames) {
            route.paramNames.forEach((name, i) => {
              params[name] = decodeURIComponent(match[i + 1]);
            });
          }
          return { handler: route.handler, params };
        }
      } else if (route.path === path) {
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
      const r = req as Record<string, unknown>;
      const method = String(r.method || 'GET').toUpperCase();
      let path = String(r.path || '');
      // 确保 path 不含 query string
      const qIdx = path.indexOf('?');
      if (qIdx >= 0) path = path.slice(0, qIdx);
      const matched = matchRoute(method, path);
      if (matched) {
        const request: HTTPRequest = {
          method,
          path,
          query: (r.query as Record<string, string>) || {},
          headers: (r.headers as Record<string, string>) || {},
          body: (r.body as Uint8Array) || null,
        };
        const params = matched.params;
        request.query = { ...request.query, ...params };
        const result = matched.handler(request);
        if (result instanceof Promise) {
          return result as Promise<HTTPResponse>;
        }
        return result;
      }
      return null;
    },
  };
}

export function jsonResponse(data: unknown, status = 200): HTTPResponse {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  };
}

export function errorResponse(msg: string, status = 500): HTTPResponse {
  return jsonResponse({ code: status, msg }, status);
}

export function successResponse(data: unknown): HTTPResponse {
  return jsonResponse({ code: 0, msg: 'success', data });
}

export function badRequestResponse(msg: string): HTTPResponse {
  return errorResponse(msg, 400);
}

export interface SearchParams {
  keyword: string;
  source_id?: string;
  page?: number;
  page_size?: number;
}

export interface SearchResult {
  results: unknown[];
}

export function createSearchHandler(opts: { search: (params: SearchParams) => Promise<SearchResult> }): RouteHandler {
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
      const parsed = JSON.parse(text) as Record<string, unknown>;
      const result = await opts.search({
        keyword: String(parsed.keyword || ''),
        source_id: parsed.source_id as string | undefined,
        page: Number(parsed.page) || 1,
        page_size: Number(parsed.page_size) || 20,
      });
      return successResponse(result);
    } catch (e) {
      return errorResponse('Search failed: ' + (e as Error).message);
    }
  };
}

export function createNewsDetailHandler(opts: { getDetail: (source: string, id: string) => Promise<unknown> }): RouteHandler {
  return async (req) => {
    try {
      const source = String(req.query.source_id || req.query.source || '');
      const id = String(req.query.id || '');
      if (!id) return errorResponse('id is required', 400);
      const result = await opts.getDetail(source, id);
      return successResponse(result);
    } catch (e) {
      return errorResponse('Get detail failed: ' + (e as Error).message);
    }
  };
}
