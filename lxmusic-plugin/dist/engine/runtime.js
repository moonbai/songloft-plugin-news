import { LX_PRELUDE_JS } from './lx_prelude';
export class SourceRuntime {
    constructor(options) {
        this.sources = [];
        this.successCalls = 0;
        this.totalCalls = 0;
        this.inited = false;
        this.id = options.id;
        this.name = options.name;
        this.envName = 'lx_source_' + this.id.replace(/[^a-zA-Z0-9_]/g, '_');
    }
    getEnvName() {
        return this.envName;
    }
    getId() {
        return this.id;
    }
    getName() {
        return this.name;
    }
    getSources() {
        return this.sources;
    }
    getPlatforms() {
        return [...new Set(this.sources.map(s => s.name))];
    }
    isInited() {
        return this.inited;
    }
    getStats() {
        return {
            successCalls: this.successCalls,
            totalCalls: this.totalCalls
        };
    }
    async init(rawScript) {
        try {
            songloft.jsenv.create(this.envName, LX_PRELUDE_JS);
            songloft.jsenv.execute(this.envName, `
        lx._sourceId = '${this.id}';
        globalThis.lx.currentScriptInfo = {
          name: '${this.name}',
          version: '1.0.0',
          rawScript: ${JSON.stringify(rawScript)}
        };
      `);
            const result = songloft.jsenv.executeWait(this.envName, rawScript, 30000, ['lx_event']);
            const eventData = this.parseEventResult(result);
            if (eventData?.eventName === 'inited') {
                const data = eventData.data;
                this.sources = data?.sources || [];
                this.inited = true;
                songloft.log.info(`Source ${this.name} initialized with platforms: ${this.getPlatforms().join(', ')}`);
                return true;
            }
            songloft.log.warn(`Source ${this.name} did not emit inited event`);
            this.destroy();
            return false;
        }
        catch (error) {
            songloft.log.error(`Failed to initialize source ${this.name}:`, error);
            this.destroy();
            return false;
        }
    }
    parseEventResult(result) {
        try {
            const str = String(result);
            const parsed = JSON.parse(str);
            if (parsed && parsed.eventName) {
                return parsed;
            }
        }
        catch {
        }
        return null;
    }
    async getMusicUrl(source, musicInfo, quality) {
        if (!this.inited)
            return null;
        this.totalCalls++;
        try {
            const reqId = 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            const dispatchData = {
                source,
                action: 'musicUrl',
                info: { musicInfo, type: quality }
            };
            const dispatchCode = `lx._dispatch('${reqId}', 'request', ${JSON.stringify(dispatchData)});`;
            const result = songloft.jsenv.executeWait(this.envName, dispatchCode, 18000, ['lx_dispatch_result']);
            const dispatchResult = this.parseDispatchResult(result);
            if (dispatchResult && dispatchResult.id === reqId) {
                if (dispatchResult.error) {
                    songloft.log.warn(`Source ${this.name} dispatch error:`, dispatchResult.error);
                    return null;
                }
                const url = this.extractUrl(dispatchResult.result);
                if (url) {
                    this.successCalls++;
                    return url;
                }
            }
        }
        catch (error) {
            songloft.log.error(`Source ${this.name} getMusicUrl error:`, error);
        }
        return null;
    }
    parseDispatchResult(result) {
        try {
            const str = String(result);
            const parsed = JSON.parse(str);
            if (parsed && typeof parsed.id === 'string') {
                return parsed;
            }
        }
        catch {
        }
        return null;
    }
    extractUrl(result) {
        if (typeof result === 'string') {
            return result;
        }
        if (result && typeof result === 'object' && typeof result.url === 'string') {
            return String(result.url);
        }
        return null;
    }
    destroy() {
        try {
            songloft.jsenv.destroy(this.envName);
        }
        catch {
        }
        this.inited = false;
        this.sources = [];
    }
}
