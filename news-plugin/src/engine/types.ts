// 引擎类型定义

export interface LxSource {
  id: string;
  name: string;
  version?: string;
  author?: string;
  description?: string;
  baseUrl?: string;
  platforms?: string[];
}

export interface ParsedScript {
  sources: LxSource[];
  rawScript: string;
}
