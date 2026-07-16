// source/storage.ts - 音源持久化
const INDEX_KEY = 'source_index';
const SCRIPT_PREFIX = 'source_script_';
export class SourceStorage {
    /** 加载索引 */
    async loadIndex() {
        try {
            const data = await songloft.storage.get(INDEX_KEY);
            if (!data)
                return [];
            return JSON.parse(data);
        }
        catch {
            return [];
        }
    }
    /** 保存索引 */
    async saveIndex(sources) {
        await songloft.storage.set(INDEX_KEY, JSON.stringify(sources));
    }
    /** 保存脚本 */
    async saveScript(id, script) {
        await songloft.storage.set(SCRIPT_PREFIX + id, script);
    }
    /** 加载脚本 */
    async loadScript(id) {
        return songloft.storage.get(SCRIPT_PREFIX + id);
    }
    /** 删除脚本 */
    async deleteScript(id) {
        await songloft.storage.delete(SCRIPT_PREFIX + id);
    }
    /** 删除所有 */
    async deleteAll() {
        const keys = await songloft.storage.keys();
        for (const key of keys) {
            if (key === INDEX_KEY || key.startsWith(SCRIPT_PREFIX)) {
                await songloft.storage.delete(key);
            }
        }
    }
}
