import type { SourceMeta, SourceIndexItem } from './types';

const INDEX_KEY = 'source_index';
const SCRIPT_PREFIX = 'source_script_';

export async function getSourceIndex(): Promise<SourceIndexItem[]> {
  const data = await songloft.storage.get(INDEX_KEY);
  if (!data) return [];
  
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export async function saveSourceIndex(index: SourceIndexItem[]): Promise<void> {
  await songloft.storage.set(INDEX_KEY, JSON.stringify(index));
}

export async function getSourceScript(id: string): Promise<string | null> {
  return songloft.storage.get(SCRIPT_PREFIX + id);
}

export async function saveSourceScript(id: string, script: string): Promise<void> {
  await songloft.storage.set(SCRIPT_PREFIX + id, script);
}

export async function deleteSourceScript(id: string): Promise<void> {
  await songloft.storage.delete(SCRIPT_PREFIX + id);
}

export async function getAllSources(): Promise<SourceMeta[]> {
  const index = await getSourceIndex();
  const sources: SourceMeta[] = [];
  
  for (const item of index) {
    const script = await getSourceScript(item.id);
    if (script) {
      sources.push({
        id: item.id,
        name: item.name,
        version: item.version,
        enabled: item.enabled,
        loading: false,
        platforms: [],
        rawScript: script,
        successCalls: 0,
        totalCalls: 0,
      });
    }
  }
  
  return sources;
}

export async function saveSource(meta: SourceMeta): Promise<void> {
  const index = await getSourceIndex();
  const existingIdx = index.findIndex(i => i.id === meta.id);
  
  if (existingIdx >= 0) {
    index[existingIdx] = {
      id: meta.id,
      name: meta.name,
      version: meta.version,
      enabled: meta.enabled,
    };
  } else {
    index.push({
      id: meta.id,
      name: meta.name,
      version: meta.version,
      enabled: meta.enabled,
    });
  }
  
  await saveSourceIndex(index);
  await saveSourceScript(meta.id, meta.rawScript);
}

export async function deleteSource(id: string): Promise<void> {
  const index = await getSourceIndex();
  const filtered = index.filter(i => i.id !== id);
  await saveSourceIndex(filtered);
  await deleteSourceScript(id);
}

export async function toggleSource(id: string, enabled: boolean): Promise<void> {
  const index = await getSourceIndex();
  const item = index.find(i => i.id === id);
  if (item) {
    item.enabled = enabled;
    await saveSourceIndex(index);
  }
}
