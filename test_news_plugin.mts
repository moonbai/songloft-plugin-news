// 端到端测试 news 插件 onHTTPRequest
// 模拟 QuickJS 宿主环境

(globalThis as any).songloft = {
  log: { info: () => {}, warn: () => {}, error: (...args: any[]) => console.error('LOG:', ...args) },
  storage: {
    _data: new Map<string, string>(),
    async get(k: string) { return this._data.get(k) || null; },
    async set(k: string, v: string) { this._data.set(k, v); },
    async delete(k: string) { this._data.delete(k); },
    async keys() { return Array.from(this._data.keys()); },
  },
  plugin: { info: { entryPath: 'news', version: '1.0.0' } },
  jsenv: {
    async create() { return true; },
    async execute() { return { ok: true, events: [] }; },
    async executeWait() { return { ok: true, events: [] }; },
    async destroy() {},
  },
};

async function main() {
  // 导入插件入口
  await import('./news-plugin/src/main.ts');
  console.log('Module loaded');

  // 等待 onInit
  console.log('Calling onInit...');
  await (globalThis as any).onInit();
  console.log('onInit done');

  // 测试 1: GET /api/news/hotboard (query 为字符串, 官方 SDK 格式)
  console.log('\n=== Test 1: GET /api/news/hotboard (query=string) ===');
  const req1 = {
    method: 'GET',
    path: '/api/news/hotboard',
    query: 'source_id=baidu&limit=10',
    headers: {},
    body: null,
  };
  try {
    const resp = await (globalThis as any).onHTTPRequest(req1);
    const body = typeof resp.body === 'string' ? resp.body : new TextDecoder().decode(resp.body);
    console.log('Status:', resp.statusCode);
    console.log('Body:', body.slice(0, 500));
  } catch (e: any) {
    console.error('ERROR:', e.message, e.stack);
  }

  // 测试 2: GET /api/health
  console.log('\n=== Test 2: GET /api/health ===');
  try {
    const resp = await (globalThis as any).onHTTPRequest({
      method: 'GET', path: '/api/health', query: '', headers: {}, body: null,
    });
    const body = typeof resp.body === 'string' ? resp.body : new TextDecoder().decode(resp.body);
    console.log('Status:', resp.statusCode);
    console.log('Body:', body);
  } catch (e: any) {
    console.error('ERROR:', e.message);
  }

  // 测试 3: POST /api/search (body 为 Uint8Array)
  console.log('\n=== Test 3: POST /api/search ===');
  const bodyStr = JSON.stringify({ keyword: 'test', source_id: 'baidu', page: 1, page_size: 5 });
  const body = new TextEncoder().encode(bodyStr);
  try {
    const resp = await (globalThis as any).onHTTPRequest({
      method: 'POST', path: '/api/search', query: '', headers: {}, body,
    });
    const respBody = typeof resp.body === 'string' ? resp.body : new TextDecoder().decode(resp.body);
    console.log('Status:', resp.statusCode);
    console.log('Body:', respBody.slice(0, 500));
  } catch (e: any) {
    console.error('ERROR:', e.message);
  }
}

main().catch(e => console.error('Fatal:', e));
