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

    // 先检查 content-type
    const contentType = resp.headers['Content-Type'] || resp.headers['content-type'] || '';
    if (contentType.includes('application/json')) {
      try { body = JSON.parse(text); } catch (e) { body = text; }
    } else {
      // content-type 不是 JSON 时，仍尝试自动解析（很多 API 返回 JSON 但 content-type 不对）
      const trimmed = text.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try { body = JSON.parse(trimmed); } catch (e) { body = text; }
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
