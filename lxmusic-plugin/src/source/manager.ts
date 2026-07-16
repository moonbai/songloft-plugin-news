// source/manager.ts - SourceManager
// 音源导入/删除/启用禁用/持久化

import type { RuntimeManager } from '../engine';
import { SourceStorage } from './storage';
import { parseScriptMetadata, slugify, parseZip, parseMultipart } from './parser';
import type { ImportedSource, BatchImportState, ImportResult } from './types';

export class SourceManager {
  private sources: Map<string, ImportedSource> = new Map();
  private storage: SourceStorage;
  private batchState: BatchImportState = {
    loading: false,
    batchCurrentId: null,
    batchPendingIds: [],
    totalToLoad: 0,
    totalLoaded: 0,
    totalFailed: 0,
  };

  constructor() {
    this.storage = new SourceStorage();
  }

  /** 异步初始化:从存储加载已保存的音源 */
  async init(): Promise<void> {
    const index = await this.storage.loadIndex();
    for (const source of index) {
      this.sources.set(source.id, source);
    }
    songloft.log.info(`SourceManager: loaded ${index.length} sources from storage`);
  }

  /** 列出所有音源 */
  list(): ImportedSource[] {
    return Array.from(this.sources.values());
  }

  /** 获取单个音源 */
  get(id: string): ImportedSource | undefined {
    return this.sources.get(id);
  }

  /** 导入单个 JS 脚本 */
  async importJs(name: string, script: string): Promise<ImportedSource> {
    // 解析元数据
    const meta = parseScriptMetadata(script, name);

    // 生成 id (slug,保留中文,重名加 _2)
    const baseSlug = slugify(meta.name);
    let id = baseSlug;
    let suffix = 2;
    while (this.sources.has(id)) {
      // 同名先删旧
      await this.delete(id);
    }

    const source: ImportedSource = {
      id,
      name: meta.name,
      version: meta.version,
      description: meta.description,
      author: meta.author,
      homepage: meta.homepage,
      script,
      enabled: false,
      importedAt: Date.now(),
    };

    this.sources.set(id, source);
    await this.storage.saveScript(id, script);
    await this.storage.saveIndex(this.list());

    songloft.log.info(`Imported source: ${source.name} (id=${id})`);
    return source;
  }

  /** 从 URL 导入 */
  async importFromUrl(url: string): Promise<ImportedSource> {
    const resp = await fetch(url);
    const text = await resp.text();

    // 从 URL 提取文件名
    const urlParts = url.split('/');
    const filename = urlParts[urlParts.length - 1] || 'imported';
    const name = filename.replace(/\.js$/i, '');

    return this.importJs(name, text);
  }

  /** 从 multipart 导入 (支持 .js 和 .zip) */
  async importMultipart(body: Uint8Array, contentType: string): Promise<ImportedSource[]> {
    const { files } = parseMultipart(body, contentType);
    const results: ImportedSource[] = [];

    for (const file of files) {
      if (file.filename.toLowerCase().endsWith('.js')) {
        const name = file.filename.replace(/\.js$/i, '');
        const source = await this.importJs(name, file.content);
        results.push(source);
      } else if (file.filename.toLowerCase().endsWith('.zip')) {
        // ZIP 批量导入
        const entries = parseZip(file.content);
        for (const entry of entries) {
          const name = entry.filename.split('/').pop()?.replace(/\.js$/i, '') || 'imported';
          const source = await this.importJs(name, entry.content);
          results.push(source);
        }
      }
    }

    return results;
  }

  /** 删除音源 */
  async delete(id: string): Promise<boolean> {
    const source = this.sources.get(id);
    if (!source) return false;

    this.sources.delete(id);
    await this.storage.deleteScript(id);
    await this.storage.saveIndex(this.list());

    songloft.log.info(`Deleted source: ${source.name} (id=${id})`);
    return true;
  }

  /** 设置启用状态 */
  setEnabled(id: string, enabled: boolean): void {
    const source = this.sources.get(id);
    if (source) {
      source.enabled = enabled;
      this.storage.saveIndex(this.list());
    }
  }

  /** 加载已启用的音源到 RuntimeManager */
  async loadAllEnabled(runtimeManager: RuntimeManager): Promise<void> {
    const enabled = this.list().filter(s => s.enabled);
    for (const source of enabled) {
      try {
        const success = await runtimeManager.loadSource(source.id, source.name, source.script);
        if (!success) {
          songloft.log.warn(`Failed to load enabled source: ${source.name}`);
        }
      } catch (e) {
        songloft.log.error(`Error loading source ${source.name}: ${(e as Error).message}`);
      }
    }
  }

  /** 批量异步加载音源 (先持久化为 enabled=false,后台逐个加载) */
  async batchImportAndLoad(
    items: Array<{ name: string; script: string }>,
    runtimeManager: RuntimeManager,
  ): Promise<ImportedSource[]> {
    const imported: ImportedSource[] = [];

    // 先全部以 enabled=false 持久化
    for (const item of items) {
      try {
        const source = await this.importJs(item.name, item.script);
        imported.push(source);
      } catch (e) {
        songloft.log.error(`Failed to import ${item.name}: ${(e as Error).message}`);
      }
    }

    // 设置批量加载状态
    this.batchState = {
      loading: true,
      batchCurrentId: null,
      batchPendingIds: imported.map(s => s.id),
      totalToLoad: imported.length,
      totalLoaded: 0,
      totalFailed: 0,
    };

    // 后台 setTimeout 链逐个加载
    this.loadBatchSequentially(imported, runtimeManager);

    return imported;
  }

  /** 后台逐个加载 */
  private loadBatchSequentially(sources: ImportedSource[], runtimeManager: RuntimeManager): void {
    if (sources.length === 0) {
      this.batchState.loading = false;
      return;
    }

    const source = sources[0];
    this.batchState.batchCurrentId = source.id;

    setTimeout(async () => {
      try {
        const success = await runtimeManager.loadSource(source.id, source.name, source.script);
        if (success) {
          this.setEnabled(source.id, true);
          this.batchState.totalLoaded++;
          songloft.log.info(`Batch loaded: ${source.name}`);
        } else {
          this.batchState.totalFailed++;
          songloft.log.warn(`Batch failed: ${source.name}`);
        }
      } catch (e) {
        this.batchState.totalFailed++;
        songloft.log.error(`Batch error loading ${source.name}: ${(e as Error).message}`);
      }

      this.batchState.batchPendingIds = this.batchState.batchPendingIds.filter(id => id !== source.id);
      this.batchState.batchCurrentId = null;

      // 继续下一个 (间隔 1000ms 让出 env 锁)
      setTimeout(() => {
        this.loadBatchSequentially(sources.slice(1), runtimeManager);
      }, 1000);
    }, 100);
  }

  /** 获取批量导入状态 */
  getBatchState(): BatchImportState {
    return { ...this.batchState };
  }

  /** 重新加载所有音源 */
  async reloadAll(runtimeManager: RuntimeManager): Promise<void> {
    await runtimeManager.clear();
    await this.loadAllEnabled(runtimeManager);
  }
}
