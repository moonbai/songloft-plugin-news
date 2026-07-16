"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SourceManager = void 0;
const storage_1 = require("./storage");
const parser_1 = require("./parser");
class SourceManager {
    constructor(runtimeManager) {
        this.sources = new Map();
        this.runtimeManager = runtimeManager;
    }
    async init() {
        const stored = (0, storage_1.getStoredSources)();
        for (const src of stored) {
            this.sources.set(src.id, src);
        }
        songloft.log.info(`Loaded ${this.sources.size} custom sources from storage`);
    }
    async loadAllEnabled() {
        const enabled = Array.from(this.sources.values()).filter(s => s.enabled);
        songloft.log.info(`Loading ${enabled.length} enabled custom sources`);
        for (const source of enabled) {
            try {
                await this.runtimeManager.loadSource(source.id, source.name, source.script);
                // 间隔 1000ms 让出 env 锁
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            catch (e) {
                songloft.log.error(`Failed to load source ${source.id}:`, e);
            }
        }
    }
    list() {
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
    get(id) {
        return this.sources.get(id);
    }
    importJs(name, content) {
        const source = (0, parser_1.parseJsSource)(name, content);
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
                }
                catch (e) {
                    songloft.log.error(`Failed to load source ${source.id}:`, e);
                }
            }, 100);
        }
        return source;
    }
    async importFromUrl(url) {
        const resp = await fetch(url, { method: 'GET' });
        const data = new Uint8Array(await resp.arrayBuffer());
        // 检查是否为 ZIP
        if (data[0] === 0x50 && data[1] === 0x4b && data[2] === 0x03 && data[3] === 0x04) {
            const zipName = url.split('/').pop()?.replace(/\.zip$/i, '') || 'zip_source';
            const sources = (0, parser_1.parseZipSource)(zipName, data);
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
                        }
                        catch (e) {
                            songloft.log.error(`Failed to load source ${source.id}:`, e);
                        }
                    }, 100);
                }
            }
            return sources;
        }
        else {
            const content = new TextDecoder().decode(data);
            const name = url.split('/').pop()?.replace(/\.js$/i, '') || 'url_source';
            return this.importJs(name, content);
        }
    }
    importZip(name, zipData) {
        const sources = (0, parser_1.parseZipSource)(name, zipData);
        for (const source of sources) {
            this.sources.set(source.id, source);
        }
        this.persist();
        return sources;
    }
    delete(id) {
        if (!this.sources.has(id))
            return false;
        this.runtimeManager.unloadSource(id);
        this.sources.delete(id);
        this.persist();
        return true;
    }
    setEnabled(id, enabled) {
        const source = this.sources.get(id);
        if (!source)
            return false;
        source.enabled = enabled;
        source.updateTime = Date.now();
        this.persist();
        return true;
    }
    async reloadAll(runtimeManager) {
        for (const source of this.sources.values()) {
            runtimeManager.unloadSource(source.id);
        }
        await this.loadAllEnabled();
    }
    persist() {
        (0, storage_1.setStoredSources)(Array.from(this.sources.values()));
    }
}
exports.SourceManager = SourceManager;
