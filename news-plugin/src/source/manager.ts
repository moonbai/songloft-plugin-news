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
    const stored = await getStoredSources();
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
        songloft.log.error(`Failed to load source ${source.id}: ${(e as Error).message}`);
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
        songloft.log.error(`Failed to load source ${source.id}: ${(e as Error).message}`);
      });
    }

    return source;
  }

  /**
   * 从 URL 导入 source
   * 安全限制：仅允许 https，禁止内网地址（防 SSRF）
   */
  async importFromUrl(url: string): Promise<CustomSource | CustomSource[]> {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new Error('无效的 URL');
    }

    // 仅允许 https（防中间人篡改脚本）
    if (parsedUrl.protocol !== 'https:') {
      throw new Error('仅支持 https:// URL（安全限制）');
    }

    // 禁止内网地址 / 回环（防 SSRF）
    const host = parsedUrl.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' ||
        host.startsWith('10.') || host.startsWith('192.168.') ||
        host.startsWith('169.254.') || host.endsWith('.local') ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(host)) {
      throw new Error('禁止从内网地址导入（安全限制）');
    }

    const MAX_SIZE = 5 * 1024 * 1024;
    const resp = await fetch(url, { method: 'GET' });
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
    }

    const contentLength = Number(resp.headers.get('content-length') || 0);
    if (contentLength > MAX_SIZE) {
      throw new Error('文件过大（超过 5MB）');
    }

    const ab = await resp.arrayBuffer();
    if (ab.byteLength > MAX_SIZE) {
      throw new Error('文件过大（超过 5MB）');
    }
    const data = new Uint8Array(ab);

    if (data[0] === 0x50 && data[1] === 0x4b && data[2] === 0x03 && data[3] === 0x04) {
      const zipName = url.split('/').pop()?.replace(/\.zip$/i, '') || 'zip_source';
      const sources = parseZipSource(zipName, data);
      for (const source of sources) {
        this.sources.set(source.id, source);
        if (source.enabled) {
          this.runtimeManager.loadSource(source.id, source.script).catch(e => {
            songloft.log.error('Failed to load source ' + source.id + ': ' + (e as Error).message);
          });
        }
      }
      this.persist();
      return sources;
    } else {
      const content = new TextDecoder().decode(data);
      try {
        new Function(content);
      } catch (e) {
        throw new Error('脚本语法错误: ' + (e as Error).message);
      }
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
          songloft.log.error(`Failed to load source ${source.id}: ${(e as Error).message}`);
        });
      }
    }
    this.persist();
    return sources;
  }

  /**
   * 删除 source
   */
  async delete(id: string): Promise<boolean> {
    if (!this.sources.has(id)) return false;
    await this.runtimeManager.unloadSource(id);
    this.sources.delete(id);
    await this.persist();
    return true;
  }

  /**
   * 启用/禁用 source
   */
  async setEnabled(id: string, enabled: boolean): Promise<boolean> {
    const source = this.sources.get(id);
    if (!source) return false;
    source.enabled = enabled;
    source.updateTime = Date.now();
    await this.persist();

    if (enabled) {
      this.runtimeManager.loadSource(source.id, source.script).catch(e => {
        songloft.log.error(`Failed to load source ${source.id}: ${(e as Error).message}`);
      });
    } else {
      await this.runtimeManager.unloadSource(id);
    }

    return true;
  }

  /**
   * 重新加载所有 source
   */
  async reloadAll(): Promise<void> {
    for (const source of this.sources.values()) {
      await this.runtimeManager.unloadSource(source.id);
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

  private async persist(): Promise<void> {
    await setStoredSources(Array.from(this.sources.values()));
  }
}
