// engine/manager.ts - RuntimeManager
// 管理多个 SourceRuntime,维护 平台→runtime[] 反向索引
// 取 URL 时多源并行竞速

import { SourceRuntime } from './runtime';
import type { LoadedSourceInfo } from './types';
import type { SongInfo, MusicUrlResult } from '../types';

export class RuntimeManager {
  private runtimes: Map<string, SourceRuntime> = new Map();
  private platformIndex: Map<string, string[]> = new Map(); // platform → runtimeIds[]

  /** 加载音源 */
  async loadSource(id: string, name: string, script: string, scriptInfo?: unknown): Promise<boolean> {
    // 如果已存在,先销毁
    const existing = this.runtimes.get(id);
    if (existing) {
      await existing.destroy();
      this.runtimes.delete(id);
    }

    const runtime = new SourceRuntime(id, name, script, scriptInfo as any);
    const result = await runtime.init();

    if (result.success && result.sources) {
      this.runtimes.set(id, runtime);
      this.rebuildIndex();
      return true;
    }

    songloft.log.error(`Failed to load source ${name}: ${result.error}`);
    return false;
  }

  /** 卸载音源 */
  unloadSource(id: string): void {
    const runtime = this.runtimes.get(id);
    if (runtime) {
      runtime.destroy().catch(() => {});
      this.runtimes.delete(id);
      this.rebuildIndex();
    }
  }

  /** 重建平台反向索引 */
  private rebuildIndex(): void {
    this.platformIndex.clear();
    for (const [id, runtime] of this.runtimes) {
      for (const platform of runtime.getPlatforms()) {
        if (!this.platformIndex.has(platform)) {
          this.platformIndex.set(platform, []);
        }
        this.platformIndex.get(platform)!.push(id);
      }
    }
  }

  /** 获取播放 URL — 多源并行竞速 */
  async getMusicUrl(songInfo: SongInfo, quality: string): Promise<MusicUrlResult | null> {
    const platform = songInfo.platform;
    const runtimeIds = this.platformIndex.get(platform);

    if (!runtimeIds || runtimeIds.length === 0) {
      return null;
    }

    // 收集所有支持该平台的 runtime
    const runtimes: SourceRuntime[] = [];
    for (const id of runtimeIds) {
      const rt = this.runtimes.get(id);
      if (rt && rt.getStatus() === 'ready') {
        runtimes.push(rt);
      }
    }

    if (runtimes.length === 0) return null;

    // 单源直接请求
    if (runtimes.length === 1) {
      const result = await runtimes[0].getMusicUrl(songInfo, quality);
      if (result) return result;
      return null;
    }

    // 多源并行竞速 (用 executeParallel 的思路,但这里用 Promise.race)
    // 构造并行请求
    const promises = runtimes.map(rt =>
      rt.getMusicUrl(songInfo, quality).then(result => ({ runtime: rt, result })),
    );

    try {
      // 等第一个成功
      const firstSuccess = await Promise.race(
        promises.map(async (p) => {
          const { result } = await p;
          if (result) return result;
          throw new Error('no result');
        }),
      );
      return firstSuccess;
    } catch {
      // 全部失败,等所有完成
      const results = await Promise.allSettled(promises);
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value.result) {
          return r.value.result;
        }
      }
      return null;
    }
  }

  /** 是否有任何已加载音源 */
  hasSources(): boolean {
    return this.runtimes.size > 0;
  }

  /** 获取已加载音源数量 */
  getSourceCount(): number {
    return this.runtimes.size;
  }

  /** 列出所有已加载音源信息 */
  listSources(): LoadedSourceInfo[] {
    const list: LoadedSourceInfo[] = [];
    for (const [, runtime] of this.runtimes) {
      const stats = runtime.getStats();
      list.push({
        id: runtime.id,
        name: runtime.name,
        status: runtime.getStatus(),
        platforms: runtime.getPlatforms(),
        successCalls: stats.successCalls,
        totalCalls: stats.totalCalls,
      });
    }
    return list;
  }

  /** 获取支持指定平台的所有 runtime ID */
  getRuntimesForPlatform(platform: string): string[] {
    return this.platformIndex.get(platform) || [];
  }

  /** 清理所有 */
  async clear(): Promise<void> {
    const destroyPromises: Promise<void>[] = [];
    for (const [, runtime] of this.runtimes) {
      destroyPromises.push(runtime.destroy());
    }
    await Promise.all(destroyPromises);
    this.runtimes.clear();
    this.platformIndex.clear();
  }
}
