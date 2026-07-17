// 播放列表存储 (async — 官方 SDK storage 返回 Promise)

const PLAYLIST_KEY = 'news_playlists';
const TTS_CONFIG_KEY = 'news_tts_config';

export interface PlaylistItem {
  id: string;
  title: string;
  source: string;
  sourceName: string;
  url: string;
  cover?: string;
  audioUrl?: string;
  audioDuration?: number;
  summary?: string;
  publishTime: number;
  addTime: number;
}

export interface TtsConfig {
  voice: string;
  rate: number;
  pitch: number;
  volume: number;
  autoPlayNext: boolean;
  enableTts: boolean;
}

export function getDefaultTtsConfig(): TtsConfig {
  return {
    voice: 'zh-CN',
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
    autoPlayNext: true,
    enableTts: true,
  };
}

export async function getTtsConfig(): Promise<TtsConfig> {
  try {
    const raw = await songloft.storage.get(TTS_CONFIG_KEY);
    if (!raw) return getDefaultTtsConfig();
    return { ...getDefaultTtsConfig(), ...JSON.parse(raw) };
  } catch (e) {
    return getDefaultTtsConfig();
  }
}

export async function setTtsConfig(config: TtsConfig): Promise<void> {
  try {
    await songloft.storage.set(TTS_CONFIG_KEY, JSON.stringify(config));
  } catch (e) {
    songloft.log.error('Failed to save TTS config:', e);
  }
}

export async function getPlaylists(): Promise<{ name: string; items: PlaylistItem[] }[]> {
  try {
    const raw = await songloft.storage.get(PLAYLIST_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

export async function setPlaylists(playlists: { name: string; items: PlaylistItem[] }[]): Promise<void> {
  try {
    await songloft.storage.set(PLAYLIST_KEY, JSON.stringify(playlists));
  } catch (e) {
    songloft.log.error('Failed to save playlists:', e);
  }
}

export async function getDefaultPlaylist(): Promise<{ name: string; items: PlaylistItem[] }> {
  const all = await getPlaylists();
  const existing = all.find(p => p.name === 'default');
  if (existing) return existing;
  const newList = { name: 'default', items: [] };
  all.push(newList);
  await setPlaylists(all);
  return newList;
}

export async function addToPlaylist(item: PlaylistItem, listName = 'default'): Promise<boolean> {
  const all = await getPlaylists();
  let list = all.find(p => p.name === listName);
  if (!list) {
    list = { name: listName, items: [] };
    all.push(list);
  }

  if (list.items.find(i => i.id === item.id && i.source === item.source)) {
    return false; // 已存在
  }

  list.items.push(item);
  await setPlaylists(all);
  return true;
}

export async function removeFromPlaylist(id: string, source: string, listName = 'default'): Promise<boolean> {
  const all = await getPlaylists();
  const list = all.find(p => p.name === listName);
  if (!list) return false;
  const idx = list.items.findIndex(i => i.id === id && i.source === source);
  if (idx < 0) return false;
  list.items.splice(idx, 1);
  await setPlaylists(all);
  return true;
}

export async function clearPlaylist(listName = 'default'): Promise<boolean> {
  const all = await getPlaylists();
  const list = all.find(p => p.name === listName);
  if (!list) return false;
  list.items = [];
  await setPlaylists(all);
  return true;
}
