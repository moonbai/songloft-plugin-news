// 播放列表存储
// 官方 SDK storage 自动 JSON 序列化，可直接存对象/数组，无需手动 JSON.stringify/parse

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
    if (raw === null) return getDefaultTtsConfig();
    const config = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return { ...getDefaultTtsConfig(), ...config };
  } catch (e) {
    songloft.log.warn('Failed to load TTS config: ' + (e as Error).message);
    return getDefaultTtsConfig();
  }
}

export async function setTtsConfig(config: TtsConfig): Promise<void> {
  try {
    // 官方 storage.set 自动序列化，直接传对象
    await songloft.storage.set(TTS_CONFIG_KEY, config);
  } catch (e) {
    songloft.log.error('Failed to save TTS config: ' + (e as Error).message);
  }
}

export async function getPlaylists(): Promise<{ name: string; items: PlaylistItem[] }[]> {
  try {
    const raw = await songloft.storage.get(PLAYLIST_KEY);
    if (raw === null) return [];
    const playlists = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(playlists)) return [];
    return playlists as { name: string; items: PlaylistItem[] }[];
  } catch (e) {
    songloft.log.warn('Failed to load playlists: ' + (e as Error).message);
    return [];
  }
}

export async function setPlaylists(playlists: { name: string; items: PlaylistItem[] }[]): Promise<void> {
  try {
    await songloft.storage.set(PLAYLIST_KEY, playlists);
  } catch (e) {
    songloft.log.error('Failed to save playlists: ' + (e as Error).message);
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
