// 单个 source 脚本的运行时
import prelude from './lx_prelude';
import type { LxSource, ParsedScript } from './types';

export interface RuntimeOptions {
  name: string;
  script: string;
  onError?: (err: Error) => void;
}

export class SourceRuntime {
  name: string;
  script: string;
  inited: boolean = false;
  sources: LxSource[] = [];
  private eventBuffer: Array<{ eventName?: string; id?: string; data?: unknown; error?: string }> = [];

  constructor(options: RuntimeOptions) {
    this.name = options.name;
    this.script = options.script;
  }

  async init(): Promise<boolean> {
    try {
      songloft.jsenv.create(this.envName);
      
      // 注入 prelude（lx 全局对象）
      songloft.jsenv.executeWait(this.envName, prelude, 5000, []);
      
      // 注入 channel 函数
      songloft.jsenv.injectFunction(this.envName, 'lx_event', (...args: unknown[]) => {
        this.handleEvent(args[0] as string);
      });

      // 执行用户脚本
      const rawScript = this.wrapScript(this.script);
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

  /**
   * 调用用户脚本中注册的请求处理函数
   */
  async dispatchRequest(dispatchData: { source: string; action: string; info: Record<string, unknown> }): Promise<unknown> {
    if (!this.inited) {
      throw new Error(`Source ${this.name} not initialized`);
    }
    
    try {
      const reqId = 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      const dispatchCode = `lx._dispatch('${reqId}', 'request', ${JSON.stringify(dispatchData)});`;

      const result = songloft.jsenv.executeWait(
        this.envName,
        dispatchCode,
        18000,
        ['lx_event']
      );

      const dispatchResult = this.parseDispatchResult(result);
      if (dispatchResult && dispatchResult.id === reqId) {
        if (dispatchResult.error) {
          throw new Error(dispatchResult.error);
        }
        return dispatchResult.data;
      }

      throw new Error('No response from source script');
    } catch (error) {
      songloft.log.error(`Source ${this.name} dispatch failed:`, error);
      throw error;
    }
  }

  /**
   * 获取运行时支持的所有平台 ID
   */
  getPlatforms(): string[] {
    const platforms = new Set<string>();
    for (const source of this.sources) {
      if (source.platforms) {
        for (const p of source.platforms) {
          platforms.add(p);
        }
      }
      platforms.add(source.id);
    }
    return Array.from(platforms);
  }

  destroy() {
    try {
      songloft.jsenv.destroy(this.envName);
    } catch (e) {
      // ignore
    }
    this.inited = false;
  }

  private get envName(): string {
    return `news_source_${this.name}`;
  }

  private handleEvent(data: string) {
    try {
      const parsed = JSON.parse(data);
      this.eventBuffer.push(parsed);
    } catch (e) {
      songloft.log.warn(`Source ${this.name} event parse error:`, e);
    }
  }

  private parseEventResult(result: unknown): { eventName?: string; id?: string; data?: unknown; error?: string } | null {
    if (Array.isArray(result) && result.length > 0) {
      return result[0] as { eventName?: string; id?: string; data?: unknown; error?: string };
    }
    if (result && typeof result === 'object') {
      return result as { eventName?: string; id?: string; data?: unknown; error?: string };
    }
    return null;
  }

  private parseDispatchResult(result: unknown): { id?: string; data?: unknown; error?: string } | null {
    if (Array.isArray(result) && result.length > 0) {
      return result[0] as { id?: string; data?: unknown; error?: string };
    }
    if (result && typeof result === 'object') {
      return result as { id?: string; data?: unknown; error?: string };
    }
    return null;
  }

  private wrapScript(script: string): string {
    // 在脚本末尾自动调用 notifyInited
    return script + '\n;lx.notifyInited();';
  }
}

/**
 * 解析 JSDoc 风格元数据
 */
export function parseScriptMetadata(script: string): ParsedScript {
  const sources: LxSource[] = [];
  const regex = /\/\*\*\s*\*\s*@name\s+([^\n]+)\s*\*\s*@version\s+([^\n]+)\s*\*\s*@author\s+([^\n]+)\s*\*\s*@description\s+([^\n]+)\s*\*\s*@id\s+([^\n]+)\s*\*\s*@platforms\s+([^\n]+)\s*\*\//g;
  
  let match;
  while ((match = regex.exec(script)) !== null) {
    sources.push({
      id: match[5].trim(),
      name: match[1].trim(),
      version: match[2].trim(),
      author: match[3].trim(),
      description: match[4].trim(),
      platforms: match[6].split(',').map(s => s.trim()),
    });
  }

  return { sources, rawScript: script };
}
