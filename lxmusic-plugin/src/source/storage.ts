// source/storage.ts - 音源持久化

import type { ImportedSource } from './types';

const INDEX_KEY = 'source_index';
const SCRIPT_PREFIX = 'source_script_';

export class SourceStorage {
  /** 加载索引 */
  async loadIndex(): Promise<ImportedSource[]> {
    try {
      const data = await songloft.storage.get(INDEX_KEY);
      if (!data) return [];
      return JSON.parse(data) as ImportedSource[];
    } catch {
      return [];
    }
  }

  /** 保存索引 */
  async saveIndex(sources: ImportedSource[]): Promise<void> {
    await songloft.storage.set(INDEX_KEY, JSON.stringify(sources));
  }

  /** 保存脚本 */
  async saveScript(id: string, script: string): Promise<void> {
    await songloft.storage.set(SCRIPT_PREFIX + id, script);
  }

  /** 加载脚本 */
  async loadScript(id: string): Promise<string | null> {
    return songloft.storage.get(SCRIPT_PREFIX + id);
  }

  /** 删除脚本 */
  async deleteScript(id: string): Promise<void> {
    await songloft.storage.delete(SCRIPT_PREFIX + id);
  }

  /** 删除所有 */
  async deleteAll(): Promise<void> {
    const keys = await songloft.storage.keys();
    for (const key of keys) {
      if (key === INDEX_KEY || key.startsWith(SCRIPT_PREFIX)) {
        await songloft.storage.delete(key);
      }
    }
  }
}
