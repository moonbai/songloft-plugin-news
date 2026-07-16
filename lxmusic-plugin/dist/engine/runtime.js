// engine/runtime.ts - SourceRuntime (单个音源实例)
import { LX_PRELUDE_JS } from './lx_prelude';
/** 生成安全的 envName (只含安全字符,非 ASCII 编码成 hex) */
function safeEnvName(id) {
    let result = '';
    for (let i = 0; i < id.length; i++) {
        const ch = id[i];
        if (/[a-zA-Z0-9_\-\.]/.test(ch)) {
            result += ch;
        }
        else if (ch.charCodeAt(0) > 127) {
            // 非 ASCII 编码成 hex
            const hex = ch.charCodeAt(0).toString(16);
            result += '_' + hex + '_';
        }
        else {
            result += '_';
        }
    }
    return 'lx_' + result;
}
let reqIdCounter = 0;
function nextReqId() {
    reqIdCounter++;
    return 'req_' + Date.now() + '_' + reqIdCounter;
}
export class SourceRuntime {
    constructor(id, name, script, scriptInfo) {
        this.status = 'idle';
        this.sources = {};
        this.error = null;
        this.successCalls = 0;
        this.totalCalls = 0;
        this.id = id;
        this.name = name;
        this.script = script;
        this.envName = safeEnvName(id);
        this.scriptInfo = scriptInfo || { name, rawScript: script };
    }
    /** 初始化:创建 VM + 注入 prelude + 执行脚本 + 等 inited */
    async init() {
        this.status = 'loading';
        try {
            // 1. 创建子 VM,注入 prelude
            const created = await songloft.jsenv.create(this.envName, LX_PRELUDE_JS);
            if (!created) {
                this.status = 'error';
                this.error = 'Failed to create jsenv';
                return { success: false, error: this.error };
            }
            // 2. 注入 currentScriptInfo (rawScript 必须是真实脚本源码)
            const infoCode = `globalThis.lx.currentScriptInfo = ${JSON.stringify({
                name: this.scriptInfo.name,
                version: this.scriptInfo.version || '',
                description: this.scriptInfo.description || '',
                author: this.scriptInfo.author || '',
                homepage: this.scriptInfo.homepage || '',
                rawScript: this.script, // ⚠️ 必须是真实脚本源码
            })};`;
            await songloft.jsenv.execute(this.envName, infoCode, 5000);
            // 3. 执行音源脚本
            const execResult = await songloft.jsenv.execute(this.envName, this.script, 10000);
            if (!execResult.ok && execResult.error) {
                // 脚本执行可能报错,但只要 inited 事件已发送就行
                songloft.log.warn(`[${this.name}] Script execution warning: ${execResult.error}`);
            }
            // 4. 等待 inited 事件
            const waitResult = await songloft.jsenv.executeWait(this.envName, ';', // no-op, just wait for events
            30000, ['inited']);
            if (!waitResult.ok) {
                this.status = 'error';
                this.error = waitResult.error || 'Init timeout (30s)';
                await this.destroy();
                return { success: false, error: this.error };
            }
            // 解析 inited 事件数据
            let initedData = null;
            if (waitResult.events) {
                for (const evt of waitResult.events) {
                    if (evt.name === 'inited') {
                        initedData = evt.data.sources || {};
                        break;
                    }
                }
            }
            if (!initedData || Object.keys(initedData).length === 0) {
                this.status = 'error';
                this.error = 'No sources from inited event';
                await this.destroy();
                return { success: false, error: this.error };
            }
            this.sources = initedData;
            this.status = 'ready';
            songloft.log.info(`[${this.name}] Initialized with platforms: ${Object.keys(initedData).join(', ')}`);
            return { success: true, sources: initedData };
        }
        catch (e) {
            this.status = 'error';
            this.error = e.message || String(e);
            songloft.log.error(`[${this.name}] Init failed: ${this.error}`);
            await this.destroy();
            return { success: false, error: this.error };
        }
    }
    /** 获取播放 URL */
    async getMusicUrl(songInfo, quality) {
        if (this.status !== 'ready')
            return null;
        const platform = songInfo.platform;
        // 检查是否支持该平台
        if (!this.sources[platform])
            return null;
        const reqId = nextReqId();
        this.totalCalls++;
        try {
            // 构造 dispatch 请求
            const dispatchCode = `globalThis.lx._dispatch(${JSON.stringify(reqId)}, "request", ${JSON.stringify({
                source: platform,
                action: 'musicUrl',
                info: {
                    musicInfo: songInfo,
                    type: quality,
                },
            })});`;
            const result = await songloft.jsenv.executeWait(this.envName, dispatchCode, 20000, ['dispatchResult', 'dispatchError']);
            if (!result.ok) {
                songloft.log.warn(`[${this.name}] getMusicUrl failed: ${result.error}`);
                return null;
            }
            // 查找匹配 reqId 的事件
            if (result.events) {
                for (const evt of result.events) {
                    const evtData = evt.data;
                    if (evt.name === 'dispatchResult' && evtData?.id === reqId) {
                        const res = evtData.result;
                        // result 可能是字符串 URL 或 { url } 对象
                        let url = null;
                        if (typeof res === 'string') {
                            url = res;
                        }
                        else if (res && typeof res === 'object') {
                            url = res.url || null;
                        }
                        if (url) {
                            this.successCalls++;
                            return { url };
                        }
                        return null;
                    }
                    if (evt.name === 'dispatchError' && evtData?.id === reqId) {
                        songloft.log.warn(`[${this.name}] Dispatch error: ${evtData.error}`);
                        return null;
                    }
                }
            }
            return null;
        }
        catch (e) {
            songloft.log.warn(`[${this.name}] getMusicUrl exception: ${e.message}`);
            return null;
        }
    }
    /** 是否支持指定平台 */
    supportsPlatform(platform) {
        return this.status === 'ready' && !!this.sources[platform];
    }
    /** 获取支持的平台列表 */
    getPlatforms() {
        return Object.keys(this.sources);
    }
    /** 获取状态 */
    getStatus() {
        return this.status;
    }
    /** 获取成功率 */
    getSuccessRate() {
        if (this.totalCalls === 0)
            return 0;
        return this.successCalls / this.totalCalls;
    }
    /** 获取统计 */
    getStats() {
        return {
            successCalls: this.successCalls,
            totalCalls: this.totalCalls,
            successRate: this.getSuccessRate(),
        };
    }
    /** 销毁 */
    async destroy() {
        if (this.status === 'destroyed')
            return;
        try {
            await songloft.jsenv.destroy(this.envName);
        }
        catch {
            // ignore
        }
        this.status = 'destroyed';
        this.sources = {};
    }
}
