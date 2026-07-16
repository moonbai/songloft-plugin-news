// musicSdk/request.ts - HTTP 适配层
// 用沙箱 fetch 重写 lxserver 的 httpFetch (needle),保持签名一致
// httpFetch(url, options) => { promise, cancelHttp }
// promise resolve { statusCode, headers, body } — body 自动 JSON.parse

interface HttpFetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  form?: Record<string, string>;
  formData?: Record<string, unknown>;
  timeout?: number;
  json?: boolean;
  isProxy?: boolean;
}

interface HttpFetchResult {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
}

interface HttpFetchReturn {
  promise: Promise<HttpFetchResult>;
  cancelHttp: () => void;
}

const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Accept-Encoding': 'gzip, deflate',
  'Connection': 'keep-alive',
};

export function httpFetch(url: string, options: HttpFetchOptions = {}): HttpFetchReturn {
  const controller = new AbortController();
  let timer: number | undefined;

  const promise = new Promise<HttpFetchResult>((resolve, reject) => {
    const method = (options.method || 'GET').toUpperCase();
    const headers: Record<string, string> = { ...DEFAULT_HEADERS, ...(options.headers || {}) };

    let bodyData: Uint8Array | string | undefined;

    if (options.form) {
      // form 对象 urlencode
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(options.form)) {
        params.append(k, String(v));
      }
      bodyData = params.toString();
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    } else if (options.formData) {
      // formData 对象 — 简单 urlencode (不做 multipart)
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(options.formData)) {
        params.append(k, String(v));
      }
      bodyData = params.toString();
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    } else if (options.body !== undefined && options.body !== null) {
      if (typeof options.body === 'string') {
        bodyData = options.body;
      } else {
        bodyData = JSON.stringify(options.body);
        headers['Content-Type'] = 'application/json';
      }
    }

    // timeout
    if (options.timeout) {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error('Request timeout'));
      }, options.timeout) as unknown as number;
    }

    fetch(url, {
      method,
      headers,
      body: bodyData as BodyInit | undefined,
      signal: controller.signal,
    }).then(async (resp) => {
      if (timer) clearTimeout(timer);

      const respHeaders: Record<string, string> = {};
      resp.headers.forEach((value, key) => {
        respHeaders[key.toLowerCase()] = value;
      });

      // 读取 body 文本
      const text = await resp.text();
      let parsedBody: unknown = text;

      // 自动 JSON.parse
      if (text) {
        const ct = respHeaders['content-type'] || '';
        const isJson = ct.includes('application/json') || ct.includes('text/json') || options.json;
        if (isJson || (text.trim().startsWith('{') || text.trim().startsWith('['))) {
          try {
            parsedBody = JSON.parse(text);
          } catch {
            parsedBody = text;
          }
        }
      }

      resolve({
        statusCode: resp.status,
        headers: respHeaders,
        body: parsedBody,
      });
    }).catch((err) => {
      if (timer) clearTimeout(timer);
      reject(err);
    });
  });

  const cancelHttp = () => {
    try {
      controller.abort();
    } catch {
      // ignore
    }
  };

  return { promise, cancelHttp };
}

/** 简化版:直接 await 拿到 result */
export async function httpFetchAsync(url: string, options?: HttpFetchOptions): Promise<HttpFetchResult> {
  const { promise } = httpFetch(url, options);
  return promise;
}
