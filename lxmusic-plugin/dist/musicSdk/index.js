// musicSdk/index.ts - 共享工具函数 (移植自 lxserver modules/utils/index.js)
// ============ 全局兼容 ============
// 混淆脚本/平台代码可能引用 global/window
globalThis.window = globalThis;
globalThis.global = globalThis;
// ============ 格式化工具 ============
/** 文件大小格式化 */
export function sizeFormate(size) {
    if (size === undefined || size === null || isNaN(size))
        return '0B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let index = 0;
    let s = size;
    while (s >= 1024 && index < units.length - 1) {
        s /= 1024;
        index++;
    }
    return s.toFixed(2) + units[index];
}
/** 解码文件名 (去除可能的前后引号/转义) */
export function decodeName(name) {
    if (!name)
        return '';
    try {
        // 尝试 decodeURIComponent
        return decodeURIComponent(name);
    }
    catch {
        return name;
    }
}
/** 格式化播放时间 (秒 → mm:ss) */
export function formatPlayTime(time) {
    if (!time || time <= 0)
        return '00:00';
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
/** 日期格式化 */
export function dateFormat(date, format = 'YYYY-MM-DD HH:mm:ss') {
    const d = new Date(date);
    if (isNaN(d.getTime()))
        return '';
    const pad = (n) => n.toString().padStart(2, '0');
    return format
        .replace('YYYY', d.getFullYear().toString())
        .replace('MM', pad(d.getMonth() + 1))
        .replace('DD', pad(d.getDate()))
        .replace('HH', pad(d.getHours()))
        .replace('mm', pad(d.getMinutes()))
        .replace('ss', pad(d.getSeconds()));
}
/** 格式化播放次数 */
export function formatPlayCount(count) {
    const n = Number(count);
    if (isNaN(n))
        return '0';
    if (n < 10000)
        return n.toString();
    if (n < 100000000)
        return (n / 10000).toFixed(1) + '万';
    return (n / 100000000).toFixed(1) + '亿';
}
// ============ 防御性字段读取 ============
/** 从对象中取值,大小写不敏感 */
export function getField(obj, ...keys) {
    for (const key of keys) {
        if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
            return obj[key];
        }
        // 首字母大写
        const capKey = key.charAt(0).toUpperCase() + key.slice(1);
        if (obj[capKey] !== undefined && obj[capKey] !== null && obj[capKey] !== '') {
            return obj[capKey];
        }
    }
    return undefined;
}
/** 归一化 songInfo: musicId/songmid 互为 fallback */
export function normalizeSongInfo(song) {
    const result = { ...song };
    const musicId = getField(result, 'musicId', 'songmid', 'hash', 'copyrightId');
    if (musicId) {
        if (!result.musicId)
            result.musicId = String(musicId);
        if (!result.songmid)
            result.songmid = String(musicId);
    }
    return result;
}
// ============ 通用 defer ============
export function defer() {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}
// 重新导出 crypto-shim 方便平台代码引用
export * from './crypto-shim';
