// 单个 source 脚本的运行时
// 使用官方 songloft.jsenv API (async, __go_send 事件机制)
import lxNewsPrelude from './lx_prelude';
import type { LxSource, ParsedScript } from './types';

export interface RuntimeOptions {
  name: string;
  script: string;
  onError?: (err: Error) => void;
}

let reqIdCounter = 0;
function nextReqId(): string {
  reqIdCounter++;
  return 'req_' + Date.now() + '_' + reqIdCounter;
}

export class SourceRuntime {
  name: string;
  script: string;
  inited: boolean = false;
  sources: LxSource[] = [];
  private envName: string;

  constructor(options: RuntimeOptions) {
    this.name = options.name;
    this.script = options.script;
    this.envName = `news_source_${this.name}`;
  }

  async init(): Promise<boolean> {
    try {
      // 1. 创建子 VM,注入 prelude
      const created = await songloft.jsenv.create(this.envName, lxNewsPrelude);
      if (!created) {
        songloft.log.error(`Failed to create jsenv for ${this.name}`);
        return false;
      }

      // 2. 执行用户脚本 (注册 handlers)
      const execResult = await songloft.jsenv.execute(this.envName, this.script + '\n;lx.notifyInited();', 10000);
      if (!execResult.ok && execResult.error) {
        songloft.log.warn(`[${this.name}] Script execution warning: ${execResult.error}`);
      }

      // 3. 等待 inited 事件
      const waitResult = await songloft.jsenv.executeWait(
        this.envName,
        ';', // no-op, just wait for events
        30000,
        ['inited'],
      );

      if (!waitResult.ok) {
        songloft.log.error(`[${this.name}] Init failed: ${waitResult.error || 'timeout'}`);
        await this.destroy();
        return false;
      }

      // 解析 inited 事件数据
      let initedSources: LxSource[] = [];
      if (waitResult.events) {
        for (const evt of waitResult.events) {
          if (evt.name === 'inited') {
            const data = evt.data as { sources?: LxSource[] };
            initedSources = data?.sources || [];
            break;
          }
        }
      }

      if (initedSources.length === 0) {
        songloft.log.warn(`[${this.name}] No sources from inited event`);
        await this.destroy();
        return false;
      }

      this.sources = initedSources;
      this.inited = true;
      songloft.log.info(`[${this.name}] Initialized with platforms: ${this.getPlatforms().join(', ')}`);
      return true;
    } catch (error) {
      songloft.log.error(`Failed to initialize source ${this.name}:`, error);
      await this.destroy();
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

    const reqId = nextReqId();
    const dispatchCode = `lx._dispatch(${JSON.stringify(reqId)}, 'request', ${JSON.stringify(dispatchData)});`;

    const result = await songloft.jsenv.executeWait(
      this.envName,
      dispatchCode,
      18000,
      ['dispatchResult', 'dispatchError'],
    );

    if (!result.ok) {
      throw new Error(`Source ${this.name} dispatch failed: ${result.error || 'timeout'}`);
    }

    if (result.events) {
      for (const evt of result.events) {
        const evtData = evt.data as { id?: string; result?: unknown; error?: string };
        if (evt.name === 'dispatchResult' && evtData?.id === reqId) {
          return evtData.result;
        }
        if (evt.name === 'dispatchError' && evtData?.id === reqId) {
          throw new Error(evtData.error || 'Dispatch error');
        }
      }
    }

    throw new Error('No response from source script');
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

  async destroy(): Promise<void> {
    try {
      await songloft.jsenv.destroy(this.envName);
    } catch (e) {
      // ignore
    }
    this.inited = false;
  }

  private handleEvent(data: string) {
    // 不再需要,事件通过 __go_send → executeWait 的 events 返回
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
