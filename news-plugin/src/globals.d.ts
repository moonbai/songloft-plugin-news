// 全局类型声明

interface HttpRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string | Uint8Array;
  timeout?: number;
}

interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: Uint8Array | string;
}

declare const songloft: {
  log: {
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
    debug: (...args: unknown[]) => void;
  };
  storage: {
    get: (key: string) => string | null;
    set: (key: string, value: string) => void;
    remove: (key: string) => void;
  };
  http: {
    fetch: (url: string, options?: HttpRequestOptions) => Promise<HttpResponse>;
  };
  jsenv: {
    create: (name: string) => void;
    destroy: (name: string) => void;
    executeWait: (name: string, code: string, timeout?: number, returnChannels?: string[]) => unknown;
    injectGlobal: (name: string, key: string, value: unknown) => void;
    injectFunction: (name: string, key: string, fn: (...args: unknown[]) => unknown) => void;
  };
  ui: {
    toast: (msg: string, type?: 'info' | 'success' | 'error') => void;
    navigate: (path: string) => void;
  };
};

declare const globalThis: {
  onInit?: () => Promise<void> | void;
  onDeinit?: () => void;
  onHTTPRequest?: (req: unknown) => unknown;
  [key: string]: unknown;
};
