// 通用 HTTP 工具 — 使用全局 fetch
export async function httpGet(url: string, headers: Record<string, string> = {}): Promise<unknown> {
  const resp = await fetch(url, { method: 'GET', headers });
  return await resp.text();
}

export async function httpGetJson(url: string, headers: Record<string, string> = {}): Promise<unknown> {
  const resp = await fetch(url, { method: 'GET', headers });
  const text = await resp.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    return text;
  }
}
