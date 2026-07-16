// 全局类型声明 - 不要添加 export 语句

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
  };
  storage: {
    get: (key: string) => string | null;
    set: (key: string, value: string) => void;
    delete: (key: string) => void;
    keys: () => string[];
  };
  http: {
    fetch: (url: string, options?: HttpRequestOptions) => Promise<HttpResponse>;
  };
  jsenv: {
    create: (name: string, initCode?: string) => Promise<void>;
    execute: (name: string, code: string, timeout?: number) => Promise<unknown>;
    executeWait: (name: string, code: string, timeout?: number, waitChannels?: string[]) => Promise<unknown>;
    executeParallel: (calls: Array<{ envName: string; code: string; timeout?: number; waitChannels?: string[] }>, maxConcurrent?: number) => Promise<unknown[]>;
    destroy: (name: string) => Promise<void>;
  };
  plugin: {
    getToken: () => Promise<string>;
    getHostUrl: () => Promise<string>;
    getFileUrl: (path: string) => Promise<string>;
  };
};

// 宿主提供的 crypto polyfill（非标准 Web Crypto API）
interface HostCrypto {
  md5: (data: string) => string;
  aesEncrypt: (data: string, key: string, iv: string) => string;
  rsaEncrypt: (data: string, publicKey: string) => string;
  randomBytes: (n: number) => Uint8Array;
}

declare const crypto: HostCrypto;

declare const setTimeout: (fn: () => void, ms: number) => unknown;
declare const fetch: (url: string, options?: HttpRequestOptions) => Promise<HttpResponse>;
declare const __go_raw_inflate: (hex: string) => string;
declare const Buffer: {
  from(data: string | Uint8Array, encoding?: string): Uint8Array;
  isBuffer(obj: unknown): boolean;
};
declare const zlib: {
  inflate?: (data: Uint8Array) => Uint8Array;
  deflate?: (data: Uint8Array) => Uint8Array;
};