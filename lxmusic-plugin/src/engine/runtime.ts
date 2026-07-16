import type { SourceRuntimeOptions, LxSource, DispatchResult } from './types';
import { LX_PRELUDE_JS } from './lx_prelude';

export class SourceRuntime {
  private envName: string;
  private id: string;
  private name: string;
  private sources: LxSource[] = [];
  private successCalls = 0;
  private totalCalls = 0;
  private inited = false;

  constructor(options: SourceRuntimeOptions) {
    this.id = options.id;
    this.name = options.name;
    this.envName = 'lx_source_' + this.id.replace(/[^a-zA-Z0-9_]/g, '_');
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
    return [...new Set(this.sources.map(s => s.name))];
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
    try {
      songloft.jsenv.create(this.envName, LX_PRELUDE_JS);
      
      songloft.jsenv.execute(this.envName, `
        lx._sourceId = '${this.id}';
        globalThis.lx.currentScriptInfo = {
          name: '${this.name}',
          version: '1.0.0',
          rawScript: ${JSON.stringify(rawScript)}
        };
      `);

      const result = songloft.jsenv.executeWait(
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
    try {
      const str = String(result);
      const parsed = JSON.parse(str);
      if (parsed && parsed.eventName) {
        return parsed;
      }
    } catch {
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

      const result = songloft.jsenv.executeWait(
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
    try {
      const str = String(result);
      const parsed = JSON.parse(str);
      if (parsed && typeof parsed.id === 'string') {
        return parsed;
      }
    } catch {
    }
    return null;
  }

  private extractUrl(result: unknown): string | null {
    if (typeof result === 'string') {
      return result;
    }
    if (result && typeof result === 'object' && typeof (result as Record<string, unknown>).url === 'string') {
      return String((result as Record<string, unknown>).url);
    }
    return null;
  }

  destroy(): void {
    try {
      songloft.jsenv.destroy(this.envName);
    } catch {
    }
    this.inited = false;
    this.sources = [];
  }
}
