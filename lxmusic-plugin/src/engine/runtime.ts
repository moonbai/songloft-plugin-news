import type { LxSource } from './types';
import { LX_PRELUDE_JS } from './lx_prelude';

export interface SourceRuntimeOptions {
  id: string;
  name: string;
}

export interface DispatchResult {
  id: string;
  result?: unknown;
  error?: string;
}

export class SourceRuntime {
  private envName: string;
  private id: string;
  private name: string;
  private sources: LxSource[] = [];
  private successCalls = 0;
  private totalCalls = 0;
  private inited = false;
  private rawScript = '';

  constructor(options: SourceRuntimeOptions) {
    this.id = options.id;
    this.name = options.name;
    // 环境名只能用安全字符
    this.envName = 'lx_' + this.id.replace(/[^a-zA-Z0-9_]/g, (c) => '_' + c.charCodeAt(0).toString(16));
  }

  getEnvName(): string {
    return this.envName;
  }

  getId(): string {
    return this.id;
  }

  getName(): string {
    return this.name;
  }

  getSources(): LxSource[] {
    return this.sources;
  }

  getPlatforms(): string[] {
    const platforms = new Set<string>();
    for (const source of this.sources) {
      if (source.name) {
        platforms.add(source.name);
      }
    }
    return Array.from(platforms);
  }

  isInited(): boolean {
    return this.inited;
  }

  getStats(): { successCalls: number; totalCalls: number } {
    return {
      successCalls: this.successCalls,
      totalCalls: this.totalCalls
    };
  }

  async init(rawScript: string): Promise<boolean> {
    this.rawScript = rawScript;
    
    try {
      // 创建子 VM，注入 prelude
      await songloft.jsenv.create(this.envName, LX_PRELUDE_JS);
      
      // 注入脚本信息 (rawScript 必须是真实源码)
      await songloft.jsenv.execute(this.envName, `
        lx._sourceId = '${this.id}';
        globalThis.lx.currentScriptInfo = {
          name: '${this.name.replace(/'/g, "\\'")}',
          version: '1.0.0',
          rawScript: ${JSON.stringify(rawScript)}
        };
      `);

      // 执行用户脚本，等待 inited 事件
      const result = await songloft.jsenv.executeWait(
        this.envName,
        rawScript,
        30000,
        ['lx_event']
      );

      const eventData = this.parseEventResult(result);
      if (eventData?.eventName === 'inited') {
        const data = eventData.data as Record<string, unknown>;
        this.sources = (data?.sources as LxSource[]) || [];
        this.inited = true;
        songloft.log.info(`Source ${this.name} initialized with platforms: ${this.getPlatforms().join(', ')}`);
        return true;
      }

      songloft.log.warn(`Source ${this.name} did not emit inited event`);
      this.destroy();
      return false;
    } catch (error) {
      songloft.log.error(`Failed to initialize source ${this.name}:`, error);
      this.destroy();
      return false;
    }
  }

  private parseEventResult(result: unknown): { eventName: string; data: unknown } | null {
    if (!result) return null;
    try {
      if (typeof result === 'string') {
        const parsed = JSON.parse(result);
        if (parsed && parsed.eventName) {
          return parsed;
        }
      } else if (typeof result === 'object') {
        const obj = result as Record<string, unknown>;
        if (obj.eventName) {
          return obj as { eventName: string; data: unknown };
        }
      }
    } catch {
      // ignore
    }
    return null;
  }

  async getMusicUrl(source: string, musicInfo: Record<string, unknown>, quality: string): Promise<string | null> {
    if (!this.inited) return null;
    
    this.totalCalls++;
    
    try {
      const reqId = 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      
      const dispatchData = {
        source,
        action: 'musicUrl',
        info: { musicInfo, type: quality }
      };
      const dispatchCode = `lx._dispatch('${reqId}', 'request', ${JSON.stringify(dispatchData)});`;

      const result = await songloft.jsenv.executeWait(
        this.envName,
        dispatchCode,
        18000,
        ['lx_dispatch_result']
      );

      const dispatchResult = this.parseDispatchResult(result);
      if (dispatchResult && dispatchResult.id === reqId) {
        if (dispatchResult.error) {
          songloft.log.warn(`Source ${this.name} dispatch error:`, dispatchResult.error);
          return null;
        }
        
        const url = this.extractUrl(dispatchResult.result);
        if (url) {
          this.successCalls++;
          return url;
        }
      }
    } catch (error) {
      songloft.log.error(`Source ${this.name} getMusicUrl error:`, error);
    }
    
    return null;
  }

  private parseDispatchResult(result: unknown): DispatchResult | null {
    if (!result) return null;
    try {
      if (typeof result === 'string') {
        const parsed = JSON.parse(result);
        if (parsed && typeof parsed.id === 'string') {
          return parsed as DispatchResult;
        }
      } else if (typeof result === 'object') {
        const obj = result as Record<string, unknown>;
        if (typeof obj.id === 'string') {
          return obj as unknown as DispatchResult;
        }
      }
    } catch {
      // ignore
    }
    return null;
  }

  private extractUrl(result: unknown): string | null {
    if (typeof result === 'string' && result) {
      return result;
    }
    if (result && typeof result === 'object') {
      const obj = result as Record<string, unknown>;
      if (typeof obj.url === 'string' && obj.url) {
        return obj.url;
      }
    }
    return null;
  }

  destroy(): void {
    try {
      songloft.jsenv.destroy(this.envName);
    } catch {
      // ignore
    }
    this.inited = false;
    this.sources = [];
  }
}