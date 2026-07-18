// 存储辅助
// 官方 SDK storage 自动 JSON 序列化，可直接存对象/数组，无需手动 JSON.stringify/parse

const SOURCES_KEY = 'news_custom_sources';

export async function getStoredSources(): Promise<any[]> {
  try {
    const sources = await songloft.storage.get(SOURCES_KEY) as any[] | null;
    return sources || [];
  } catch (e) {
    songloft.log.warn('Failed to load stored sources: ' + (e as Error).message);
    return [];
  }
}

export async function setStoredSources(sources: any[]): Promise<void> {
  try {
    await songloft.storage.set(SOURCES_KEY, sources);
  } catch (e) {
    songloft.log.error('Failed to store sources: ' + (e as Error).message);
  }
}
