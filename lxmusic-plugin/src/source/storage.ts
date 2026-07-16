// 音源存储

import type { CustomSource } from '../types';

const SOURCES_KEY = 'lxmusic_sources';

export function getStoredSources(): CustomSource[] {
  try {
    const raw = songloft.storage.get(SOURCES_KEY);
    if (raw === null || raw === undefined) return [];
    const rawStr = String(raw);
    return JSON.parse(rawStr);
  } catch {
    return [];
  }
}

export function setStoredSources(sources: CustomSource[]): void {
  try {
    songloft.storage.set(SOURCES_KEY, JSON.stringify(sources));
  } catch (e) {
    songloft.log.error('Failed to save sources:', e);
  }
}

export function getStoredSource(id: string): CustomSource | null {
  const sources = getStoredSources();
  return sources.find(s => s.id === id) || null;
}

export function saveStoredSource(source: CustomSource): void {
  const sources = getStoredSources();
  const idx = sources.findIndex(s => s.id === source.id);
  if (idx >= 0) {
    sources[idx] = source;
  } else {
    sources.push(source);
  }
  setStoredSources(sources);
}

export function deleteStoredSource(id: string): void {
  const sources = getStoredSources().filter(s => s.id !== id);
  setStoredSources(sources);
}