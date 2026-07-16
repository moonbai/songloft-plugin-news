// 自定义 source 管理器
import { RuntimeManager } from '../engine';
import { getStoredSources, setStoredSources } from './storage';
import { parseJsSource, parseZipSource } from './parser';
import type { CustomSource } from './types';

export class SourceManager {
  private sources: Map<string, CustomSource> = new Map();
  
  constructor(private runtimeManager: RuntimeManager) {}

  /**
   * 初始化 - 加载所有已保存的 source
   */
  async init(): Promise<void> {
    const stored = getStoredSources();
    for (const src of stored) {
      this.sources.set(src.id, src);
    }
    songloft.log.info(`Loaded ${this.sources.size} custom sources from storage`);
  }

  /**
   * 加载所有启用的 source 到运行时
   */
  async loadAllEnabled(): Promise<void> {
    const enabled = Array.from(this.sources.values()).filter(s => s.enabled);
    songloft.log.info(`Loading ${enabled.length} enabled custom sources`);
    
    for (const source of enabled) {
      try {
        await this.runtimeManager.loadSource(source.id, source.script);
      } catch (e) {
        songloft.log.error(`Failed to load source ${source.id}:`, e);
      }
    }
  }

  /**
   * 列出所有 source
   */
  list(): CustomSource[] {
    return Array.from(this.sources.values());
  }

  /**
   * 获取单个 source
   */
  get(id: string): CustomSource | undefined {
    return this.sources.get(id);
  }

  /**
   * 从 JS 文本导入 source
   */
  importJs(name: string, content: string): CustomSource {
    const source = parseJsSource(name, content);
    this.sources.set(source.id, source);
    this.persist();
    
    if (source.enabled) {
      this.runtimeManager.loadSource(source.id, source.script).catch(e => {
        songloft.log.error(`Failed to load source ${source.id}:`, e);
      });
    }
    
    return source;
  }

  /**
   * 从 URL 导入 source
   */
  async importFromUrl(url: string): Promise<CustomSource | CustomSource[]> {
    const resp = await songloft.http.fetch(url, { method: 'GET', timeout: 30000 });
    const data = resp.body as Uint8Array;
    
    // 检查是否为 ZIP
    if (data[0] === 0x50 && data[1] === 0x4b && data[2] === 0x03 && data[3] === 0x04) {
      // ZIP 文件
      const zipName = url.split('/').pop()?.replace(/\.zip$/i, '') || 'zip_source';
      const sources = parseZipSource(zipName, data);
      for (const source of sources) {
        this.sources.set(source.id, source);
        if (source.enabled) {
          this.runtimeManager.loadSource(source.id, source.script).catch(e => {
            songloft.log.error(`Failed to load source ${source.id}:`, e);
          });
        }
      }
      this.persist();
      return sources;
    } else {
      // JS 文件
      const content = new TextDecoder().decode(data);
      const name = url.split('/').pop()?.replace(/\.js$/i, '') || 'url_source';
      return this.importJs(name, content);
    }
  }

  /**
   * 从 ZIP 数据导入
   */
  importZip(name: string, zipData: Uint8Array): CustomSource[] {
    const sources = parseZipSource(name, zipData);
    for (const source of sources) {
      this.sources.set(source.id, source);
      if (source.enabled) {
        this.runtimeManager.loadSource(source.id, source.script).catch(e => {
          songloft.log.error(`Failed to load source ${source.id}:`, e);
        });
      }
    }
    this.persist();
    return sources;
  }

  /**
   * 删除 source
   */
  delete(id: string): boolean {
    if (!this.sources.has(id)) return false;
    this.runtimeManager.unloadSource(id);
    this.sources.delete(id);
    this.persist();
    return true;
  }

  /**
   * 启用/禁用 source
   */
  setEnabled(id: string, enabled: boolean): boolean {
    const source = this.sources.get(id);
    if (!source) return false;
    source.enabled = enabled;
    source.updateTime = Date.now();
    this.persist();
    
    if (enabled) {
      this.runtimeManager.loadSource(source.id, source.script).catch(e => {
        songloft.log.error(`Failed to load source ${source.id}:`, e);
      });
    } else {
      this.runtimeManager.unloadSource(source.id);
    }
    
    return true;
  }

  /**
   * 重新加载所有 source
   */
  async reloadAll(): Promise<void> {
    for (const source of this.sources.values()) {
      this.runtimeManager.unloadSource(source.id);
    }
    await this.loadAllEnabled();
  }

  /**
   * 导出所有 source 配置（不含脚本）
   */
  exportConfig(): any[] {
    return Array.from(this.sources.values()).map(s => ({
      id: s.id,
      name: s.name,
      version: s.version,
      author: s.author,
      description: s.description,
      platforms: s.platforms,
      enabled: s.enabled,
      createTime: s.createTime,
      updateTime: s.updateTime,
    }));
  }

  private persist() {
    setStoredSources(Array.from(this.sources.values()));
  }
}
