// 存储辅助

const SOURCES_KEY = 'news_custom_sources';

export function getStoredSources(): any[] {
  try {
    const raw = songloft.storage.get(SOURCES_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

export function setStoredSources(sources: any[]): void {
  try {
    songloft.storage.set(SOURCES_KEY, JSON.stringify(sources));
  } catch (e) {
    songloft.log.error('Failed to store sources:', e);
  }
}
