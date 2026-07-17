// HTTP 请求封装 — 使用全局 fetch (QuickJS polyfill)

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
    const method = options.method || 'GET';
    const headers = options.headers || {};
    const body = options.body as BodyInit | undefined;

    const resp = await fetch(url, { method, headers, body });

    const text = await resp.text();
    let bodyData: any = text;

    // 先检查 content-type
    const respHeaders: Record<string, string> = {};
    resp.headers.forEach((val: string, key: string) => {
      respHeaders[key.toLowerCase()] = val;
    });
    const contentType = respHeaders['content-type'] || '';
    if (contentType.includes('application/json')) {
      try { bodyData = JSON.parse(text); } catch (e) { bodyData = text; }
    } else {
      // content-type 不是 JSON 时，仍尝试自动解析（很多 API 返回 JSON 但 content-type 不对）
      const trimmed = text.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try { bodyData = JSON.parse(trimmed); } catch (e) { bodyData = text; }
      }
    }

    return {
      status: resp.status,
      body: bodyData,
      raw: text,
    };
  })();
}

export default httpFetch;
