"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuntimeManager = void 0;
// 运行时管理器 - 管理多个 source 脚本的运行时
const runtime_1 = require("./runtime");
const newsSdk_1 = require("../newsSdk");
class RuntimeManager {
    constructor() {
        this.runtimes = new Map();
        this.initPromises = new Map();
    }
    /**
     * 加载一个 source 脚本
     */
    async loadSource(name, script) {
        if (this.runtimes.has(name)) {
            songloft.log.warn(`Source ${name} already loaded, destroying old runtime`);
            const old = this.runtimes.get(name);
            if (old)
                old.destroy();
            this.runtimes.delete(name);
        }
        const runtime = new runtime_1.SourceRuntime({ name, script });
        this.runtimes.set(name, runtime);
        const initPromise = runtime.init();
        this.initPromises.set(name, initPromise);
        return await initPromise;
    }
    /**
     * 重新加载一个 source
     */
    async reloadSource(name, script) {
        return this.loadSource(name, script);
    }
    /**
     * 卸载一个 source
     */
    unloadSource(name) {
        const runtime = this.runtimes.get(name);
        if (runtime) {
            runtime.destroy();
            this.runtimes.delete(name);
        }
        this.initPromises.delete(name);
    }
    /**
     * 列出所有已加载的 source
     */
    listSources() {
        const result = [];
        for (const [name, runtime] of this.runtimes) {
            result.push({
                name,
                inited: runtime.inited,
                platforms: runtime.getPlatforms(),
                sources: runtime.sources,
            });
        }
        return result;
    }
    /**
     * 解析新闻列表
     */
    async fetchNewsList(source, category, page, limit) {
        // 先尝试内置平台
        if (newsSdk_1.platformModules[source]) {
            const result = await newsSdk_1.platformModules[source].newsList.list(category, page, limit);
            return { news: result.news, total: result.news.length };
        }
        // 尝试自定义脚本
        for (const [name, runtime] of this.runtimes) {
            if (!runtime.inited)
                continue;
            const platforms = runtime.getPlatforms();
            if (platforms.includes(source)) {
                const data = await runtime.dispatchRequest({
                    source,
                    action: 'newsList',
                    info: { category, page, limit },
                });
                return data;
            }
        }
        throw new Error(`Source ${source} not found`);
    }
    /**
     * 解析新闻详情
     */
    async fetchNewsDetail(source, id) {
        // 先尝试内置平台
        if (newsSdk_1.platformModules[source]) {
            return await newsSdk_1.platformModules[source].newsDetail.detail(id);
        }
        // 尝试自定义脚本
        for (const [name, runtime] of this.runtimes) {
            if (!runtime.inited)
                continue;
            const platforms = runtime.getPlatforms();
            if (platforms.includes(source)) {
                const data = await runtime.dispatchRequest({
                    source,
                    action: 'newsDetail',
                    info: { id },
                });
                return data;
            }
        }
        throw new Error(`Source ${source} not found`);
    }
    /**
     * 解析新闻搜索
     */
    async fetchNewsSearch(source, keyword, page, limit) {
        // 先尝试内置平台
        if (newsSdk_1.platformModules[source]) {
            const result = await newsSdk_1.platformModules[source].newsSearch.search(keyword, page, limit);
            return { news: result.news, total: result.total };
        }
        // 尝试自定义脚本
        for (const [name, runtime] of this.runtimes) {
            if (!runtime.inited)
                continue;
            const platforms = runtime.getPlatforms();
            if (platforms.includes(source)) {
                const data = await runtime.dispatchRequest({
                    source,
                    action: 'newsSearch',
                    info: { keyword, page, limit },
                });
                return data;
            }
        }
        throw new Error(`Source ${source} not found`);
    }
    /**
     * 并行尝试多个源直到有一个成功
     */
    async tryMultipleSources(sources, fetcher) {
        const promises = sources.map(async (source) => {
            try {
                const data = await fetcher(source);
                return { source, data };
            }
            catch (e) {
                return null;
            }
        });
        const results = await Promise.all(promises);
        for (const r of results) {
            if (r)
                return r;
        }
        return null;
    }
    clear() {
        for (const runtime of this.runtimes.values()) {
            runtime.destroy();
        }
        this.runtimes.clear();
        this.initPromises.clear();
    }
}
exports.RuntimeManager = RuntimeManager;
