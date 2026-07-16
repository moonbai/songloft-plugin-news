"use strict";
// 音源存储
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStoredSources = getStoredSources;
exports.setStoredSources = setStoredSources;
exports.getStoredSource = getStoredSource;
exports.saveStoredSource = saveStoredSource;
exports.deleteStoredSource = deleteStoredSource;
const SOURCES_KEY = 'lxmusic_sources';
function getStoredSources() {
    try {
        const raw = songloft.storage.get(SOURCES_KEY);
        if (raw === null || raw === undefined)
            return [];
        const rawStr = String(raw);
        return JSON.parse(rawStr);
    }
    catch {
        return [];
    }
}
function setStoredSources(sources) {
    try {
        songloft.storage.set(SOURCES_KEY, JSON.stringify(sources));
    }
    catch (e) {
        songloft.log.error('Failed to save sources:', e);
    }
}
function getStoredSource(id) {
    const sources = getStoredSources();
    return sources.find(s => s.id === id) || null;
}
function saveStoredSource(source) {
    const sources = getStoredSources();
    const idx = sources.findIndex(s => s.id === source.id);
    if (idx >= 0) {
        sources[idx] = source;
    }
    else {
        sources.push(source);
    }
    setStoredSources(sources);
}
function deleteStoredSource(id) {
    const sources = getStoredSources().filter(s => s.id !== id);
    setStoredSources(sources);
}
