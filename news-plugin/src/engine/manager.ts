// 运行时管理器 - 管理多个 source 脚本的运行时
import { SourceRuntime } from './runtime';
import type { NewsItem } from '../types';
import { platformModules } from '../newsSdk';

export class RuntimeManager {
  private runtimes: Map<string, SourceRuntime> = new Map();
  private initPromises: Map<string, Promise<boolean>> = new Map();

  /**
   * 加载一个 source 脚本
   */
  async loadSource(name: string, script: string): Promise<boolean> {
    if (this.runtimes.has(name)) {
      songloft.log.warn(`Source ${name} already loaded, destroying old runtime`);
      const old = this.runtimes.get(name);
      if (old) await old.destroy();
      this.runtimes.delete(name);
    }

    const runtime = new SourceRuntime({ name, script });
    this.runtimes.set(name, runtime);

    const initPromise = runtime.init();
    this.initPromises.set(name, initPromise);
    return await initPromise;
  }

  /**
   * 重新加载一个 source
   */
  async reloadSource(name: string, script: string): Promise<boolean> {
    return this.loadSource(name, script);
  }

  /**
   * 卸载一个 source
   */
  async unloadSource(name: string): Promise<void> {
    const runtime = this.runtimes.get(name);
    if (runtime) {
      await runtime.destroy();
      this.runtimes.delete(name);
    }
    this.initPromises.delete(name);
  }

  /**
   * 列出所有已加载的 source
   */
  listSources(): Array<{ name: string; inited: boolean; platforms: string[]; sources: any[] }> {
    const result: Array<{ name: string; inited: boolean; platforms: string[]; sources: any[] }> = [];
    for (const [name, runtime] of this.runtimes) {
      result.push({
        name,
        inited: runtime.inited,
        platforms: runtime.getPlatforms(),
        sources: JSON.parse(JSON.stringify(runtime.sources)),
      });
    }
    return result;
  }

  /**
   * 解析新闻列表
   */
  async fetchNewsList(source: string, category: string, page: number, limit: number): Promise<{ news: NewsItem[]; total?: number }> {
    // 先尝试内置平台
    if (platformModules[source]) {
      const result = await platformModules[source].newsList.list(category, page, limit);
      return { news: result.news, total: result.news.length };
    }

    // 尝试自定义脚本
    for (const [name, runtime] of this.runtimes) {
      if (!runtime.inited) continue;
      const platforms = runtime.getPlatforms();
      if (platforms.includes(source)) {
        const data = await runtime.dispatchRequest({
          source,
          action: 'newsList',
          info: { category, page, limit },
        });
        return data as { news: NewsItem[]; total?: number };
      }
    }

    throw new Error(`Source ${source} not found`);
  }

  /**
   * 解析新闻详情
   */
  async fetchNewsDetail(source: string, id: string): Promise<{ news: NewsItem; content?: string } | null> {
    // 先尝试内置平台
    if (platformModules[source]) {
      return await platformModules[source].newsDetail.detail(id);
    }

    // 尝试自定义脚本
    for (const [name, runtime] of this.runtimes) {
      if (!runtime.inited) continue;
      const platforms = runtime.getPlatforms();
      if (platforms.includes(source)) {
        const data = await runtime.dispatchRequest({
          source,
          action: 'newsDetail',
          info: { id },
        });
        return data as { news: NewsItem; content?: string };
      }
    }

    throw new Error(`Source ${source} not found`);
  }

  /**
   * 解析新闻搜索
   */
  async fetchNewsSearch(source: string, keyword: string, page: number, limit: number): Promise<{ news: NewsItem[]; total?: number }> {
    // 先尝试内置平台
    if (platformModules[source]) {
      const result = await platformModules[source].newsSearch.search(keyword, page, limit);
      return { news: result.news, total: result.total };
    }

    // 尝试自定义脚本
    for (const [name, runtime] of this.runtimes) {
      if (!runtime.inited) continue;
      const platforms = runtime.getPlatforms();
      if (platforms.includes(source)) {
        const data = await runtime.dispatchRequest({
          source,
          action: 'newsSearch',
          info: { keyword, page, limit },
        });
        return data as { news: NewsItem[]; total?: number };
      }
    }

    throw new Error(`Source ${source} not found`);
  }

  /**
   * 并行尝试多个源直到有一个成功
   */
  async tryMultipleSources<T>(
    sources: string[],
    fetcher: (source: string) => Promise<T>
  ): Promise<{ source: string; data: T } | null> {
    const promises = sources.map(async (source) => {
      try {
        const data = await fetcher(source);
        return { source, data };
      } catch (e) {
        return null;
      }
    });

    const results = await Promise.all(promises);
    for (const r of results) {
      if (r) return r;
    }
    return null;
  }

  async clear(): Promise<void> {
    const destroyPromises: Promise<void>[] = [];
    for (const runtime of this.runtimes.values()) {
      destroyPromises.push(runtime.destroy());
    }
    await Promise.all(destroyPromises);
    this.runtimes.clear();
    this.initPromises.clear();
  }
}
