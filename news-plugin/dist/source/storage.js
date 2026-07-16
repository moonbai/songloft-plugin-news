"use strict";
// 存储辅助
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStoredSources = getStoredSources;
exports.setStoredSources = setStoredSources;
const SOURCES_KEY = 'news_custom_sources';
function getStoredSources() {
    try {
        const raw = songloft.storage.get(SOURCES_KEY);
        if (!raw)
            return [];
        return JSON.parse(raw);
    }
    catch (e) {
        return [];
    }
}
function setStoredSources(sources) {
    try {
        songloft.storage.set(SOURCES_KEY, JSON.stringify(sources));
    }
    catch (e) {
        songloft.log.error('Failed to store sources:', e);
    }
}
