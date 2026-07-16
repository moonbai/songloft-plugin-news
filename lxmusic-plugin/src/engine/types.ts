// engine/types.ts - 引擎类型定义

/** 音源脚本元数据 */
export interface ScriptInfo {
  name: string;
  version?: string;
  description?: string;
  author?: string;
  homepage?: string;
  rawScript: string;
}

/** 音源支持的平台信息 (从 inited 事件获取) */
export interface SourcePlatformInfo {
  name: string;
  type: string;
  actions: string[];
  qualitys: string[];
}

/** inited 事件返回的 sources 结构 */
export interface InitedSources {
  [platform: string]: SourcePlatformInfo;
}

/** URL 解析请求结果 */
export interface UrlResolveResult {
  url: string;
  headers?: Record<string, string>;
}

/** 运行时状态 */
export type RuntimeStatus = 'idle' | 'loading' | 'ready' | 'error' | 'destroyed';

/** SourceRuntime 初始化结果 */
export interface RuntimeInitResult {
  success: boolean;
  sources?: InitedSources;
  error?: string;
}

/** 已加载音源信息(对外暴露) */
export interface LoadedSourceInfo {
  id: string;
  name: string;
  status: RuntimeStatus;
  platforms: string[];
  successCalls: number;
  totalCalls: number;
}
