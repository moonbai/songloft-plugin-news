// HTTP 请求封装 — 使用全局 fetch (QuickJS polyfill)
// 参照 lxmusic 插件的稳定实现

export interface HttpResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: any;
  raw: string;
}

const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Connection': 'keep-alive',
};

function httpFetch(url: string, options: {
  method?: string;
  headers?: Record<string, string>;
  body?: string | Uint8Array;
  timeout?: number;
  json?: boolean;
} = {}): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const method = (options.method || 'GET').toUpperCase();
    const headers: Record<string, string> = { ...DEFAULT_HEADERS, ...(options.headers || {}) };
    const body = options.body as BodyInit | undefined;
    const timeout = options.timeout || 15000;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
      reject(new Error('Request timeout'));
    }, timeout) as unknown as number;

    fetch(url, { method, headers, body, signal: controller.signal }).then(async (resp) => {
      clearTimeout(timer);

      const respHeaders: Record<string, string> = {};
      try {
        const hdr = resp.headers as any;
        if (typeof hdr.forEach === 'function') {
          hdr.forEach((value: string, key: string) => {
            respHeaders[key.toLowerCase()] = value;
          });
        } else if (typeof hdr.entries === 'function') {
          for (const [key, value] of hdr.entries()) {
            respHeaders[key.toLowerCase()] = value;
          }
        }
      } catch {
        // ignore header parse errors
      }

      const text = await resp.text();
      let bodyData: any = text;

      if (text) {
        const ct = respHeaders['content-type'] || '';
        const isJson = ct.includes('application/json') || ct.includes('text/json') || options.json;
        if (isJson) {
          try {
            bodyData = JSON.parse(text);
          } catch {
            bodyData = text;
          }
        } else {
          const trimmed = text.trim();
          if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try {
              bodyData = JSON.parse(trimmed);
            } catch {
              bodyData = text;
            }
          }
        }
      }

      resolve({
        statusCode: resp.status,
        headers: respHeaders,
        body: bodyData,
        raw: text,
      });
    }).catch((err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

export default httpFetch;
