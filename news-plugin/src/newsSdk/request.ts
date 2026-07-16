// HTTP 请求封装

export interface HttpResponse {
  status: number;
  body: any;
  raw: string;
}

function httpFetch(url: string, options: {
  method?: string;
  headers?: Record<string, string>;
  body?: string | Uint8Array;
  timeout?: number;
} = {}): Promise<HttpResponse> {
  return (async () => {
    const resp = await songloft.http.fetch(url, {
      method: options.method || 'GET',
      headers: options.headers || {},
      body: options.body,
      timeout: options.timeout || 15000,
    });

    const text = typeof resp.body === 'string' ? resp.body : new TextDecoder().decode(resp.body as Uint8Array);
    let body: any = text;
    const contentType = resp.headers['Content-Type'] || resp.headers['content-type'] || '';
    if (contentType.includes('application/json')) {
      try {
        body = JSON.parse(text);
      } catch (e) {
        body = text;
      }
    }

    return {
      status: resp.status,
      body,
      raw: text,
    };
  })();
}

export default httpFetch;
