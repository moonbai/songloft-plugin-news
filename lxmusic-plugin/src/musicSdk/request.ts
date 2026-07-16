import type { HttpFetchResult, HttpFetchOptions } from '../types';

function urlEncodeForm(form: Record<string, string>): string {
  return Object.keys(form)
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(form[key])}`)
    .join('&');
}

function buildBody(options: HttpFetchOptions): string | undefined {
  if (options.body) {
    if (typeof options.body === 'string') {
      return options.body;
    }
    return JSON.stringify(options.body);
  }
  if (options.form) {
    return urlEncodeForm(options.form);
  }
  return undefined;
}

function buildHeaders(options: HttpFetchOptions): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    ...options.headers,
  };

  if (options.form && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
  }
  if (options.body && typeof options.body !== 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  return headers;
}

export function httpFetch(url: string, options: HttpFetchOptions = {}): {
  promise: Promise<HttpFetchResult>;
  cancelHttp: () => void;
} {
  const abortController = new AbortController();
  const timeout = options.timeout || 10000;
  
  const timeoutId = setTimeout(() => {
    abortController.abort();
  }, timeout);

  const promise = (async () => {
    try {
      const body = buildBody(options);
      const headers = buildHeaders(options);
      
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers,
        body,
        signal: abortController.signal,
      });

      clearTimeout(timeoutId);

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      let responseBody: unknown;
      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.includes('application/json')) {
        try {
          responseBody = await response.json();
        } catch {
          responseBody = await response.text();
        }
      } else {
        responseBody = await response.text();
      }

      return {
        statusCode: response.status,
        headers: responseHeaders,
        body: responseBody,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  })();

  return {
    promise,
    cancelHttp: () => abortController.abort(),
  };
}

export default httpFetch;
