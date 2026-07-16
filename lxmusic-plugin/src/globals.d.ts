declare global {
  interface Crypto {
    md5(data: string | Uint8Array): string;
    aesEncrypt(data: string, key: string, iv?: string): string;
    rsaEncrypt(data: string, publicKey: string): string;
    randomBytes(length: number): Uint8Array;
    sha1(data: string | Uint8Array): string;
    sha256(data: string | Uint8Array): string;
    hmacSHA1(data: string, key: string): string;
    hmacSHA256(data: string, key: string): string;
  }

  interface Zlib {
    inflate(data: Uint8Array): Uint8Array;
    deflate(data: Uint8Array): Uint8Array;
    inflateRaw(data: Uint8Array): Uint8Array;
  }

  interface SongloftJSEnv {
    create(name: string, initCode: string): void;
    execute(name: string, code: string, timeoutMs?: number): void;
    executeWait(name: string, code: string, timeoutMs: number, waitEvents: string[]): unknown;
    executeParallel(calls: Array<{ name: string; code: string }>, maxConcurrent: number): unknown[];
    destroy(name: string): void;
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

  interface SongloftLog {
    info(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
    error(message: string, ...args: unknown[]): void;
  }

  interface Songloft {
    log: SongloftLog;
    storage: SongloftStorage;
    plugin: SongloftPlugin;
    jsenv: SongloftJSEnv;
    songs: {
      list(): Promise<unknown[]>;
      get(id: string): Promise<unknown | null>;
      create(data: unknown): Promise<unknown>;
      update(id: string, data: unknown): Promise<unknown>;
      delete(id: string): Promise<void>;
    };
    playlists: {
      list(): Promise<unknown[]>;
      get(id: string): Promise<unknown | null>;
      create(data: unknown): Promise<unknown>;
      update(id: string, data: unknown): Promise<unknown>;
      delete(id: string): Promise<void>;
      addSong(id: string, songId: string): Promise<void>;
      removeSong(id: string, songId: string): Promise<void>;
    };
  }

  const songloft: Songloft;
  const crypto: Crypto;
  const zlib: Zlib;

  function __go_send(name: string, data: string): void;
  function __go_raw_inflate(hex: string): string;
}

export {};
