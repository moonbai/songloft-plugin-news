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
  body: Uint8Array;
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

interface Router {
  get(path: string, handler: (req: HTTPRequest) => HTTPResponse | Promise<HTTPResponse>): void;
  post(path: string, handler: (req: HTTPRequest) => HTTPResponse | Promise<HTTPResponse>): void;
  put(path: string, handler: (req: HTTPRequest) => HTTPResponse | Promise<HTTPResponse>): void;
  delete(path: string, handler: (req: HTTPRequest) => HTTPResponse | Promise<HTTPResponse>): void;
  handle(req: unknown): HTTPResponse | Promise<HTTPResponse> | undefined;
}

export function createRouter(): Router {
  const routes: Array<{
    method: string;
    path: string;
    handler: (req: HTTPRequest) => HTTPResponse | Promise<HTTPResponse>;
  }> = [];

  return {
    get(path: string, handler: (req: HTTPRequest) => HTTPResponse | Promise<HTTPResponse>) {
      routes.push({ method: 'GET', path, handler });
    },
    post(path: string, handler: (req: HTTPRequest) => HTTPResponse | Promise<HTTPResponse>) {
      routes.push({ method: 'POST', path, handler });
    },
    put(path: string, handler: (req: HTTPRequest) => HTTPResponse | Promise<HTTPResponse>) {
      routes.push({ method: 'PUT', path, handler });
    },
    delete(path: string, handler: (req: HTTPRequest) => HTTPResponse | Promise<HTTPResponse>) {
      routes.push({ method: 'DELETE', path, handler });
    },
    handle(req: unknown): HTTPResponse | Promise<HTTPResponse> | undefined {
      const request = req as HTTPRequest;
      const route = routes.find(r => r.method === request.method && r.path === request.path);
      if (route) {
        return route.handler(request);
      }
      return undefined;
    },
  };
}

export function createSearchHandler(options: {
  search: (params: { keyword: string; source_id?: string; quality?: string; page?: number; page_size?: number }) => Promise<{ results: SearchResultItem[] }>;
}) {
  return async (req: HTTPRequest) => {
    try {
      const body = req.body ? Array.from(req.body).map(b => String.fromCharCode(b)).join('') : '{}';
      const params = JSON.parse(body);
      const result = await options.search(params);
      return jsonResponse(result);
    } catch {
      return jsonResponse({ results: [] });
    }
  };
}

export function createMusicUrlHandler(options: {
  resolveUrl: (source_data: unknown) => Promise<{ url: string; headers?: Record<string, string> } | null>;
  fallbackSearch?: (hint: MusicUrlFallbackHint) => Promise<unknown | null>;
}) {
  return async (req: HTTPRequest) => {
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
    } catch {
      return jsonResponse({ error: 'Internal error' }, 500);
    }
  };
}

export function jsonResponse(body: unknown, status: number = 200): HTTPResponse {
  const json = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: new Uint8Array(json.split('').map(c => c.charCodeAt(0))),
  };
}

export function parseQuery(q: string): Record<string, string> {
  const result: Record<string, string> = {};
  const pairs = q.split('&');
  for (const pair of pairs) {
    const [key, value] = pair.split('=');
    if (key) {
      result[key] = value ? decodeURIComponent(value) : '';
    }
  }
  return result;
}
