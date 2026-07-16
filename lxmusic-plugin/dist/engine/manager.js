"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuntimeManager = void 0;
const runtime_1 = require("./runtime");
class RuntimeManager {
    constructor() {
        this.runtimes = new Map();
        this.platformIndex = new Map();
    }
    /**
     * 加载一个音源脚本
     */
    async loadSource(id, name, script) {
        if (this.runtimes.has(id)) {
            const old = this.runtimes.get(id);
            if (old) {
                old.destroy();
                this.runtimes.delete(id);
            }
        }
        const runtime = new runtime_1.SourceRuntime({ id, name });
        const success = await runtime.init(script);
        if (success) {
            this.runtimes.set(id, runtime);
            this.updatePlatformIndex(runtime);
            songloft.log.info(`Source ${name} loaded successfully`);
        }
        return success;
    }
    updatePlatformIndex(runtime) {
        // 先清理旧的索引
        for (const [platform, ids] of this.platformIndex) {
            ids.delete(runtime.getId());
            if (ids.size === 0) {
                this.platformIndex.delete(platform);
            }
        }
        // 添加新索引
        for (const platform of runtime.getPlatforms()) {
            if (!this.platformIndex.has(platform)) {
                this.platformIndex.set(platform, new Set());
            }
            this.platformIndex.get(platform).add(runtime.getId());
        }
    }
    /**
     * 获取支持指定平台的所有 runtime
     */
    getRuntimesForPlatform(platform) {
        const ids = this.platformIndex.get(platform);
        if (!ids)
            return [];
        const runtimes = [];
        for (const id of ids) {
            const rt = this.runtimes.get(id);
            if (rt && rt.isInited()) {
                runtimes.push(rt);
            }
        }
        // 按成功率排序
        runtimes.sort((a, b) => {
            const sa = a.getStats();
            const sb = b.getStats();
            const rateA = sa.totalCalls > 0 ? sa.successCalls / sa.totalCalls : 0;
            const rateB = sb.totalCalls > 0 ? sb.successCalls / sb.totalCalls : 0;
            return rateB - rateA;
        });
        return runtimes;
    }
    /**
     * 获取音乐 URL - 并行竞速
     */
    async getMusicUrl(songInfo, quality) {
        const platform = songInfo.platform;
        const runtimes = this.getRuntimesForPlatform(platform);
        if (runtimes.length === 0) {
            songloft.log.warn(`No source available for platform: ${platform}`);
            return null;
        }
        const musicInfo = this.songInfoToMusicInfo(songInfo);
        // 单源直接调用
        if (runtimes.length === 1) {
            const url = await runtimes[0].getMusicUrl(platform, musicInfo, quality);
            if (url) {
                return { url, source: runtimes[0] };
            }
            return null;
        }
        // 多源并行竞速
        const calls = runtimes.map(rt => ({
            envName: rt.getEnvName(),
            code: this.buildDispatchCode(rt, platform, musicInfo, quality),
            timeout: 18000,
            waitChannels: ['lx_dispatch_result']
        }));
        try {
            const results = await songloft.jsenv.executeParallel(calls, 3);
            for (let i = 0; i < results.length; i++) {
                const result = results[i];
                const rt = runtimes[i];
                const url = this.extractUrlFromResult(result);
                if (url) {
                    return { url, source: rt };
                }
            }
        }
        catch (error) {
            songloft.log.error('executeParallel error:', error);
        }
        return null;
    }
    songInfoToMusicInfo(songInfo) {
        return {
            name: songInfo.name,
            singer: songInfo.singer,
            album: songInfo.album,
            musicId: songInfo.musicId || songInfo.songmid,
            songmid: songInfo.songmid || songInfo.musicId,
            hash: songInfo.hash,
            copyrightId: songInfo.copyrightId,
            albumId: songInfo.albumId,
            albumMid: songInfo.albumMid,
            strMediaMid: songInfo.strMediaMid,
            platform: songInfo.platform,
        };
    }
    buildDispatchCode(runtime, platform, musicInfo, quality) {
        const reqId = 'req_' + runtime.getId() + '_' + Date.now();
        const dispatchData = {
            source: platform,
            action: 'musicUrl',
            info: { musicInfo, type: quality }
        };
        return `lx._dispatch('${reqId}', 'request', ${JSON.stringify(dispatchData)});`;
    }
    extractUrlFromResult(result) {
        if (!result)
            return null;
        try {
            let obj;
            if (typeof result === 'string') {
                obj = JSON.parse(result);
            }
            else if (typeof result === 'object') {
                obj = result;
            }
            else {
                return null;
            }
            if (obj.error)
                return null;
            if (typeof obj.result === 'string' && obj.result) {
                return obj.result;
            }
            if (obj.result && typeof obj.result === 'object') {
                const r = obj.result;
                if (typeof r.url === 'string' && r.url) {
                    return r.url;
                }
            }
        }
        catch {
            // ignore
        }
        return null;
    }
    /**
     * 列出所有已加载的音源
     */
    listSources() {
        const result = [];
        for (const [id, rt] of this.runtimes) {
            result.push({
                id,
                name: rt.getName(),
                platforms: rt.getPlatforms(),
                inited: rt.isInited(),
                stats: rt.getStats()
            });
        }
        return result;
    }
    /**
     * 获取已加载的音源数量
     */
    getSourceCount() {
        return this.runtimes.size;
    }
    /**
     * 检查是否有可用音源
     */
    hasSources() {
        return this.runtimes.size > 0;
    }
    /**
     * 卸载一个音源
     */
    unloadSource(id) {
        const rt = this.runtimes.get(id);
        if (rt) {
            rt.destroy();
            this.runtimes.delete(id);
            this.updatePlatformIndex(rt);
        }
    }
    /**
     * 清理所有音源
     */
    clear() {
        for (const rt of this.runtimes.values()) {
            rt.destroy();
        }
        this.runtimes.clear();
        this.platformIndex.clear();
    }
}
exports.RuntimeManager = RuntimeManager;
