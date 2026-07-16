"use strict";
// 播放列表存储
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDefaultTtsConfig = getDefaultTtsConfig;
exports.getTtsConfig = getTtsConfig;
exports.setTtsConfig = setTtsConfig;
exports.getPlaylists = getPlaylists;
exports.setPlaylists = setPlaylists;
exports.getDefaultPlaylist = getDefaultPlaylist;
exports.addToPlaylist = addToPlaylist;
exports.removeFromPlaylist = removeFromPlaylist;
exports.clearPlaylist = clearPlaylist;
const PLAYLIST_KEY = 'news_playlists';
const TTS_CONFIG_KEY = 'news_tts_config';
function getDefaultTtsConfig() {
    return {
        voice: 'zh-CN',
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0,
        autoPlayNext: true,
        enableTts: true,
    };
}
function getTtsConfig() {
    try {
        const raw = songloft.storage.get(TTS_CONFIG_KEY);
        if (!raw)
            return getDefaultTtsConfig();
        return { ...getDefaultTtsConfig(), ...JSON.parse(raw) };
    }
    catch (e) {
        return getDefaultTtsConfig();
    }
}
function setTtsConfig(config) {
    try {
        songloft.storage.set(TTS_CONFIG_KEY, JSON.stringify(config));
    }
    catch (e) {
        songloft.log.error('Failed to save TTS config:', e);
    }
}
function getPlaylists() {
    try {
        const raw = songloft.storage.get(PLAYLIST_KEY);
        if (!raw)
            return [];
        return JSON.parse(raw);
    }
    catch (e) {
        return [];
    }
}
function setPlaylists(playlists) {
    try {
        songloft.storage.set(PLAYLIST_KEY, JSON.stringify(playlists));
    }
    catch (e) {
        songloft.log.error('Failed to save playlists:', e);
    }
}
function getDefaultPlaylist() {
    const all = getPlaylists();
    const existing = all.find(p => p.name === 'default');
    if (existing)
        return existing;
    const newList = { name: 'default', items: [] };
    all.push(newList);
    setPlaylists(all);
    return newList;
}
function addToPlaylist(item, listName = 'default') {
    const all = getPlaylists();
    let list = all.find(p => p.name === listName);
    if (!list) {
        list = { name: listName, items: [] };
        all.push(list);
    }
    if (list.items.find(i => i.id === item.id && i.source === item.source)) {
        return false; // 已存在
    }
    list.items.push(item);
    setPlaylists(all);
    return true;
}
function removeFromPlaylist(id, source, listName = 'default') {
    const all = getPlaylists();
    const list = all.find(p => p.name === listName);
    if (!list)
        return false;
    const idx = list.items.findIndex(i => i.id === id && i.source === source);
    if (idx < 0)
        return false;
    list.items.splice(idx, 1);
    setPlaylists(all);
    return true;
}
function clearPlaylist(listName = 'default') {
    const all = getPlaylists();
    const list = all.find(p => p.name === listName);
    if (!list)
        return false;
    list.items = [];
    setPlaylists(all);
    return true;
}
