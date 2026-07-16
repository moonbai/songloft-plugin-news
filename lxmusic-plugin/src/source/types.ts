// source/types.ts - 音源管理类型

/** 音源脚本元数据 (从 JSDoc 头解析) */
export interface SourceMetadata {
  name: string;
  version?: string;
  description?: string;
  author?: string;
  homepage?: string;
}

/** 已导入的音源 */
export interface ImportedSource {
  id: string;
  name: string;
  version?: string;
  description?: string;
  author?: string;
  homepage?: string;
  script: string;
  enabled: boolean;
  importedAt: number;
}

/** ZIP 解析出的文件 */
export interface ZipEntry {
  filename: string;
  content: string; // utf8 文本
}

/** 批量导入状态 */
export interface BatchImportState {
  loading: boolean;
  batchCurrentId: string | null;
  batchPendingIds: string[];
  totalToLoad: number;
  totalLoaded: number;
  totalFailed: number;
}

/** 导入结果 */
export interface ImportResult {
  source: ImportedSource;
  success: boolean;
  error?: string;
}
