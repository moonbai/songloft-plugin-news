// 存储辅助 (async — 官方 SDK storage 返回 Promise)

const SOURCES_KEY = 'news_custom_sources';

export async function getStoredSources(): Promise<any[]> {
  try {
    const raw = await songloft.storage.get(SOURCES_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

export async function setStoredSources(sources: any[]): Promise<void> {
  try {
    await songloft.storage.set(SOURCES_KEY, JSON.stringify(sources));
  } catch (e) {
    songloft.log.error('Failed to store sources:', e);
  }
}
