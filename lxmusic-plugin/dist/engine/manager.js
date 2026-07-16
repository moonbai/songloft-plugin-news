export class RuntimeManager {
    constructor() {
        this.runtimes = new Map();
        this.platformIndex = new Map();
    }
    register(runtime) {
        this.runtimes.set(runtime.getId(), runtime);
        for (const platform of runtime.getPlatforms()) {
            if (!this.platformIndex.has(platform)) {
                this.platformIndex.set(platform, []);
            }
            this.platformIndex.get(platform).push(runtime);
        }
    }
    unregister(id) {
        const runtime = this.runtimes.get(id);
        if (runtime) {
            for (const platform of runtime.getPlatforms()) {
                const list = this.platformIndex.get(platform);
                if (list) {
                    const idx = list.indexOf(runtime);
                    if (idx > -1)
                        list.splice(idx, 1);
                }
            }
            runtime.destroy();
            this.runtimes.delete(id);
        }
    }
    get(id) {
        return this.runtimes.get(id);
    }
    getAll() {
        return Array.from(this.runtimes.values());
    }
    getRuntimesForPlatform(platform) {
        return this.platformIndex.get(platform) || [];
    }
    hasPlatform(platform) {
        return this.platformIndex.has(platform) && this.platformIndex.get(platform).length > 0;
    }
    async getMusicUrl(songInfo, quality) {
        const platform = songInfo.platform;
        const runtimes = this.getRuntimesForPlatform(platform);
        if (runtimes.length === 0) {
            songloft.log.warn(`No runtime available for platform: ${platform}`);
            return null;
        }
        const sortedRuntimes = this.sortBySuccessRate(runtimes);
        for (const runtime of sortedRuntimes) {
            if (!runtime.isInited())
                continue;
            try {
                const url = await runtime.getMusicUrl(platform, songInfo, quality);
                if (url) {
                    return url;
                }
            }
            catch (error) {
                songloft.log.warn(`Runtime ${runtime.getName()} failed:`, error);
            }
        }
        songloft.log.warn(`All runtimes for ${platform} failed`);
        return null;
    }
    sortBySuccessRate(runtimes) {
        return [...runtimes].sort((a, b) => {
            const statsA = a.getStats();
            const statsB = b.getStats();
            const rateA = statsA.totalCalls > 0 ? statsA.successCalls / statsA.totalCalls : 0.5;
            const rateB = statsB.totalCalls > 0 ? statsB.successCalls / statsB.totalCalls : 0.5;
            return rateB - rateA;
        });
    }
    async getMusicUrlParallel(songInfo, quality) {
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
    clear() {
        for (const runtime of this.runtimes.values()) {
            runtime.destroy();
        }
        this.runtimes.clear();
        this.platformIndex.clear();
    }
}
