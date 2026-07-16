import type { SourceMeta } from './types';
import { parseSourceScript, generateUniqueId, parseZipContent } from './parser';
import { getAllSources, saveSource, deleteSource, toggleSource } from './storage';
import { SourceRuntime, RuntimeManager } from '../engine';

export class SourceManager {
  private sources: Map<string, SourceMeta> = new Map();
  private runtimeManager: RuntimeManager;
  private batchPendingIds: string[] = [];
  private batchCurrentId: string | null = null;

  constructor(runtimeManager: RuntimeManager) {
    this.runtimeManager = runtimeManager;
  }

  async init(): Promise<void> {
    const storedSources = await getAllSources();
    for (const source of storedSources) {
      this.sources.set(source.id, source);
    }
  }

  getAll(): SourceMeta[] {
    return Array.from(this.sources.values());
  }

  get(id: string): SourceMeta | undefined {
    return this.sources.get(id);
  }

  async importScript(script: string, fileName?: string): Promise<SourceMeta> {
    const index = this.getAll().map(s => s.id);
    const meta = parseSourceScript(script, fileName);
    
    meta.id = generateUniqueId(meta.name, index);
    meta.enabled = false;
    meta.loading = false;
    
    await saveSource(meta);
    this.sources.set(meta.id, meta);
    
    return meta;
  }

  async importUrl(url: string): Promise<SourceMeta[]> {
    const result: SourceMeta[] = [];
    
    try {
      const response = await fetch(url);
      const content = await response.text();
      
      if (url.endsWith('.zip')) {
        const files = parseZipContent(content);
        for (const file of files) {
          try {
            const meta = await this.importScript(file.data, file.name);
            result.push(meta);
          } catch {
          }
        }
      } else {
        const meta = await this.importScript(content, url.split('/').pop());
        result.push(meta);
      }
    } catch {
    }
    
    return result;
  }

  async importZip(content: string): Promise<SourceMeta[]> {
    const result: SourceMeta[] = [];
    const files = parseZipContent(content);
    
    for (const file of files) {
      try {
        const meta = await this.importScript(file.data, file.name);
        result.push(meta);
      } catch {
      }
    }
    
    return result;
  }

  async remove(id: string): Promise<void> {
    this.runtimeManager.unregister(id);
    await deleteSource(id);
    this.sources.delete(id);
  }

  async enable(id: string): Promise<boolean> {
    const meta = this.sources.get(id);
    if (!meta) return false;
    
    if (meta.enabled) return true;
    
    meta.enabled = true;
    await saveSource(meta);
    
    return await this.loadSource(id);
  }

  async disable(id: string): Promise<void> {
    const meta = this.sources.get(id);
    if (!meta) return;
    
    meta.enabled = false;
    await toggleSource(id, false);
    
    this.runtimeManager.unregister(id);
  }

  async toggle(id: string): Promise<boolean> {
    const meta = this.sources.get(id);
    if (!meta) return false;
    
    if (meta.enabled) {
      await this.disable(id);
      return false;
    } else {
      return await this.enable(id);
    }
  }

  async loadSource(id: string): Promise<boolean> {
    const meta = this.sources.get(id);
    if (!meta || !meta.enabled) return false;
    
    meta.loading = true;
    
    try {
      const runtime = new SourceRuntime({
        id: meta.id,
        name: meta.name,
        rawScript: meta.rawScript,
      });
      
      const success = await runtime.init(meta.rawScript);
      
      if (success) {
        meta.platforms = runtime.getPlatforms();
        meta.loading = false;
        await saveSource(meta);
        this.runtimeManager.register(runtime);
        return true;
      } else {
        meta.loading = false;
        meta.enabled = false;
        await saveSource(meta);
        return false;
      }
    } catch {
      meta.loading = false;
      meta.enabled = false;
      await saveSource(meta);
      return false;
    }
  }

  async loadAllEnabled(): Promise<void> {
    const enabledSources = this.getAll().filter(s => s.enabled);
    
    this.batchPendingIds = enabledSources.map(s => s.id);
    this.batchCurrentId = null;
    
    for (const source of enabledSources) {
      this.batchCurrentId = source.id;
      await this.loadSource(source.id);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    this.batchCurrentId = null;
    this.batchPendingIds = [];
  }

  async reloadAll(): Promise<void> {
    this.runtimeManager.clear();
    
    for (const source of this.getAll()) {
      source.loading = false;
    }
    
    await this.loadAllEnabled();
  }

  getBatchStatus(): {
    loading: boolean;
    batch_current_id: string | null;
    batch_pending_ids: string[];
  } {
    return {
      loading: this.batchCurrentId !== null,
      batch_current_id: this.batchCurrentId,
      batch_pending_ids: this.batchPendingIds,
    };
  }

  updateStats(id: string, successCalls: number, totalCalls: number): void {
    const meta = this.sources.get(id);
    if (meta) {
      meta.successCalls = successCalls;
      meta.totalCalls = totalCalls;
    }
  }

  getStats(): Array<{
    id: string;
    name: string;
    successCalls: number;
    totalCalls: number;
    successRate: number;
  }> {
    return this.getAll().map(meta => ({
      id: meta.id,
      name: meta.name,
      successCalls: meta.successCalls,
      totalCalls: meta.totalCalls,
      successRate: meta.totalCalls > 0 ? meta.successCalls / meta.totalCalls : 0,
    }));
  }
}
