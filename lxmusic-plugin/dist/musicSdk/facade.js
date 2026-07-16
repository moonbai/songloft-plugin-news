// musicSdk/facade.ts - 顶层 facade
// 导出 { sources, kw, kg, tx, wy, mg }
import kwModule from './kw';
import kgModule from './kg';
import txModule from './tx';
import wyModule from './wy';
import mgModule from './mg';
export const sources = [
    { id: 'kw', name: '酷我音乐' },
    { id: 'kg', name: '酷狗音乐' },
    { id: 'tx', name: 'QQ音乐' },
    { id: 'wy', name: '网易云音乐' },
    { id: 'mg', name: '咪咕音乐' },
];
export const kw = kwModule;
export const kg = kgModule;
export const tx = txModule;
export const wy = wyModule;
export const mg = mgModule;
/** 平台模块映射 */
export const platformModules = {
    kw,
    kg,
    tx,
    wy,
    mg,
};
/** 获取平台模块 */
export function getPlatform(id) {
    return platformModules[id] || null;
}
