import { RuntimeManager } from '../engine';
import { getStoredSources, setStoredSources } from './storage';
import { parseJsSource, parseZipSource } from './parser';
import type { CustomSource } from '../types';

export class SourceManager {
  private sources: Map<string, CustomSource> = new Map();
  private runtimeManager: RuntimeManager;

  constructor(runtimeManager: RuntimeManager) {
    this.runtimeManager = runtimeManager;
  }

  async init(): Promise<void> {
    const stored = getStoredSources();
    for (const src of stored) {
      this.sources.set(src.id, src);
    }
    songloft.log.info(`Loaded ${this.sources.size} custom sources from storage`);
  }

  async loadAllEnabled(): Promise<void> {
    const enabled = Array.from(this.sources.values()).filter(s => s.enabled);
    songloft.log.info(`Loading ${enabled.length} enabled custom sources`);
    
    for (const source of enabled) {
      try {
        await this.runtimeManager.loadSource(source.id, source.name, source.script);
        // 间隔 1000ms 让出 env 锁
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (e) {
        songloft.log.error(`Failed to load source ${source.id}:`, e);
      }
    }
  }

  list(): CustomSource[] {
    return Array.from(this.sources.values()).map(s => ({
      id: s.id,
      name: s.name,
      version: s.version || '',
      author: s.author || '',
      description: s.description || '',
      script: s.script,
      enabled: s.enabled,
      createTime: s.createTime,
      updateTime: s.updateTime,
    }));
  }

  get(id: string): CustomSource | undefined {
    return this.sources.get(id);
  }

  importJs(name: string, content: string): CustomSource {
    const source = parseJsSource(name, content);
    
    // 检查是否存在同名，先删除
    if (this.sources.has(source.id)) {
      this.sources.delete(source.id);
    }
    
    this.sources.set(source.id, source);
    this.persist();
    
    // 如果启用，异步加载
    if (source.enabled) {
      setTimeout(async () => {
        try {
          await this.runtimeManager.loadSource(source.id, source.name, source.script);
        } catch (e) {
          songloft.log.error(`Failed to load source ${source.id}:`, e);
        }
      }, 100);
    }
    
    return source;
  }

  async importFromUrl(url: string): Promise<CustomSource | CustomSource[]> {
    const resp = await fetch(url, { method: 'GET' });
    const data = new Uint8Array(await resp.arrayBuffer());
    
    // 检查是否为 ZIP
    if (data[0] === 0x50 && data[1] === 0x4b && data[2] === 0x03 && data[3] === 0x04) {
      const zipName = url.split('/').pop()?.replace(/\.zip$/i, '') || 'zip_source';
      const sources = parseZipSource(zipName, data);
      
      for (const source of sources) {
        this.sources.set(source.id, source);
      }
      this.persist();
      
      // 异步加载
      for (const source of sources) {
        if (source.enabled) {
          setTimeout(async () => {
            try {
              await this.runtimeManager.loadSource(source.id, source.name, source.script);
              await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (e) {
              songloft.log.error(`Failed to load source ${source.id}:`, e);
            }
          }, 100);
        }
      }
      
      return sources;
    } else {
      const content = new TextDecoder().decode(data);
      const name = url.split('/').pop()?.replace(/\.js$/i, '') || 'url_source';
      return this.importJs(name, content);
    }
  }

  importZip(name: string, zipData: Uint8Array): CustomSource[] {
    const sources = parseZipSource(name, zipData);
    for (const source of sources) {
      this.sources.set(source.id, source);
    }
    this.persist();
    return sources;
  }

  delete(id: string): boolean {
    if (!this.sources.has(id)) return false;
    this.runtimeManager.unloadSource(id);
    this.sources.delete(id);
    this.persist();
    return true;
  }

  setEnabled(id: string, enabled: boolean): boolean {
    const source = this.sources.get(id);
    if (!source) return false;
    source.enabled = enabled;
    source.updateTime = Date.now();
    this.persist();
    return true;
  }

  async reloadAll(runtimeManager: RuntimeManager): Promise<void> {
    for (const source of this.sources.values()) {
      runtimeManager.unloadSource(source.id);
    }
    await this.loadAllEnabled();
  }

  private persist() {
    setStoredSources(Array.from(this.sources.values()));
  }
}