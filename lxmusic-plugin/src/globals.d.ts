// globals.d.ts - 全局类型声明 (无 export, 使声明成为全局)

// ============ 宿主 songloft 桥接 ============
interface SongloftLog {
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

interface SongloftStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

interface SongloftPlugin {
  getToken(): Promise<string>;
  getHostUrl(): Promise<string>;
  getFileUrl(path: string): Promise<string>;
}

interface SongloftSongs {
  get(id: string): Promise<unknown>;
  list(params?: unknown): Promise<unknown>;
  create(data: unknown): Promise<unknown>;
  update(id: string, data: unknown): Promise<unknown>;
  delete(id: string): Promise<unknown>;
}

interface SongloftPlaylists {
  get(id: string): Promise<unknown>;
  list(params?: unknown): Promise<unknown>;
  create(data: unknown): Promise<unknown>;
  update(id: string, data: unknown): Promise<unknown>;
  delete(id: string): Promise<unknown>;
  addSongs(id: string, songs: unknown[]): Promise<unknown>;
  removeSongs(id: string, songIds: string[]): Promise<unknown>;
}

interface JsevnCall {
  name: string;
  code: string;
  timeoutMs: number;
  waitEvents: string[];
}

interface JsevnExecuteResult {
  ok: boolean;
  error?: string;
  events?: Array<{ name: string; data: unknown }>;
  result?: unknown;
}

interface SongloftJsenv {
  create(name: string, initCode: string): Promise<boolean>;
  execute(name: string, code: string, timeoutMs: number): Promise<JsevnExecuteResult>;
  executeWait(name: string, code: string, timeoutMs: number, waitEvents: string[]): Promise<JsevnExecuteResult>;
  executeParallel(calls: JsevnCall[], maxConcurrent: number): Promise<JsevnExecuteResult[]>;
  destroy(name: string): Promise<void>;
}

interface Songloft {
  log: SongloftLog;
  storage: SongloftStorage;
  plugin: SongloftPlugin;
  songs: SongloftSongs;
  playlists: SongloftPlaylists;
  jsenv: SongloftJsenv;
}

// ============ 宿主 polyfill: crypto ============
interface HostCrypto {
  md5(data: string): string;
  aesEncrypt(data: string, key: string, iv?: string, mode?: string): string;
  aesDecrypt(data: string, key: string, iv?: string, mode?: string): string;
  rsaEncrypt(data: string, publicKey: string): string;
  randomBytes(length: number): string; // hex
}

// ============ 宿主 polyfill: zlib ============
interface HostZlib {
  inflate(data: Uint8Array | string): Uint8Array;
  deflate(data: Uint8Array | string): Uint8Array;
}

// ============ 宿主注入的全局函数 ============
declare function __go_send(eventName: string, dataJSON: string): void;
declare function __go_raw_inflate(hexData: string): string;

// ============ 全局变量声明 ============
declare var songloft: Songloft;
declare var crypto: HostCrypto;
declare var zlib: HostZlib;
declare var Buffer: {
  from(data: string | ArrayLike<number>, encoding?: string): Uint8Array & {
    toString(encoding?: string): string;
    slice(start?: number, end?: number): Uint8Array & { toString(encoding?: string): string };
    length: number;
    [index: number]: number;
  };
  alloc(size: number, fill?: number): Uint8Array & { toString(encoding?: string): string };
  concat(list: Uint8Array[]): Uint8Array & { toString(encoding?: string): string };
};

// setTimeout 已有标准声明,但确保 QuickJS 可用
declare function setTimeout(callback: () => void, delay?: number): number;
declare function clearTimeout(id: number): void;
