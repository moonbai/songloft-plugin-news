import { SourceRuntime } from './runtime';
import type { SongInfo } from '../types';

export class RuntimeManager {
  private runtimes: Map<string, SourceRuntime> = new Map();
  private platformIndex: Map<string, SourceRuntime[]> = new Map();

  register(runtime: SourceRuntime): void {
    this.runtimes.set(runtime.getId(), runtime);
    
    for (const platform of runtime.getPlatforms()) {
      if (!this.platformIndex.has(platform)) {
        this.platformIndex.set(platform, []);
      }
      this.platformIndex.get(platform)!.push(runtime);
    }
  }

  unregister(id: string): void {
    const runtime = this.runtimes.get(id);
    if (runtime) {
      for (const platform of runtime.getPlatforms()) {
        const list = this.platformIndex.get(platform);
        if (list) {
          const idx = list.indexOf(runtime);
          if (idx > -1) list.splice(idx, 1);
        }
      }
      runtime.destroy();
      this.runtimes.delete(id);
    }
  }

  get(id: string): SourceRuntime | undefined {
    return this.runtimes.get(id);
  }

  getAll(): SourceRuntime[] {
    return Array.from(this.runtimes.values());
  }

  getRuntimesForPlatform(platform: string): SourceRuntime[] {
    return this.platformIndex.get(platform) || [];
  }

  hasPlatform(platform: string): boolean {
    return this.platformIndex.has(platform) && this.platformIndex.get(platform)!.length > 0;
  }

  async getMusicUrl(songInfo: SongInfo, quality: string): Promise<string | null> {
    const platform = songInfo.platform;
    const runtimes = this.getRuntimesForPlatform(platform);
    
    if (runtimes.length === 0) {
      songloft.log.warn(`No runtime available for platform: ${platform}`);
      return null;
    }

    const sortedRuntimes = this.sortBySuccessRate(runtimes);

    for (const runtime of sortedRuntimes) {
      if (!runtime.isInited()) continue;
      
      try {
        const url = await runtime.getMusicUrl(platform, songInfo, quality);
        if (url) {
          return url;
        }
      } catch (error) {
        songloft.log.warn(`Runtime ${runtime.getName()} failed:`, error);
      }
    }

    songloft.log.warn(`All runtimes for ${platform} failed`);
    return null;
  }

  private sortBySuccessRate(runtimes: SourceRuntime[]): SourceRuntime[] {
    return [...runtimes].sort((a, b) => {
      const statsA = a.getStats();
      const statsB = b.getStats();
      
      const rateA = statsA.totalCalls > 0 ? statsA.successCalls / statsA.totalCalls : 0.5;
      const rateB = statsB.totalCalls > 0 ? statsB.successCalls / statsB.totalCalls : 0.5;
      
      return rateB - rateA;
    });
  }

  async getMusicUrlParallel(songInfo: SongInfo, quality: string): Promise<string | null> {
    const platform = songInfo.platform;
    const runtimes = this.getRuntimesForPlatform(platform);
    
    if (runtimes.length === 0) {
      return null;
    }

    const activeRuntimes = runtimes.filter(r => r.isInited());
    if (activeRuntimes.length === 0) {
      return null;
    }

    const sortedRuntimes = this.sortBySuccessRate(activeRuntimes);
    const topRuntimes = sortedRuntimes.slice(0, 3);

    const promises = topRuntimes.map(runtime => {
      return runtime.getMusicUrl(platform, songInfo, quality)
        .then(url => ({ url, runtime }));
    });

    const results = await Promise.allSettled(promises);

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.url) {
        return result.value.url;
      }
    }

    return null;
  }

  clear(): void {
    for (const runtime of this.runtimes.values()) {
      runtime.destroy();
    }
    this.runtimes.clear();
    this.platformIndex.clear();
  }
}
