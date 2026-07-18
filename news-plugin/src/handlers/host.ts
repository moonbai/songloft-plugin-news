// 宿主原生集成：对接官方 createSearchHandler + createMusicUrlHandler
//
// 这是宿主播放插件内容的"官方推荐"方式：
//   1. 宿主在搜索框输入关键词 → 调用插件 POST /api/search
//   2. 宿主把搜到的 SearchResultItem（含 source_data）加入歌单/播放队列
//   3. 宿主播放时 → 调用插件 POST /api/music/url，传回 source_data
//   4. 插件返回真实可播放 URL（+可选 headers，如 Referer）
//   5. 宿主用原生播放器播放该 URL
//
// 不依赖 songs.create 权限，也不需要宿主额外支持远程 Song。
// source_data 由插件自定义，宿主只透传。

import {
  createSearchHandler,
  createMusicUrlHandler,
} from '@songloft/plugin-sdk';
import type { SearchResultItem } from '@songloft/plugin-sdk';
import { platformModules } from '../newsSdk/facade';
import type { NewsItem } from '../types';

// 只在这些源里搜可播放内容（有音频的）
const PLAYABLE_SOURCES = ['ximalaya', 'dedao', 'weibo'];

interface NewsSourceData {
  source: string;
  newsId: string;
  audioUrl: string;
  title: string;
  artist?: string;
  coverUrl?: string;
  duration?: number;
  sourceUrl?: string;
}

/**
 * 加载某源的热榜（带音频的）
 */
async function loadPlayableNews(sourceId: string, limit: number): Promise<NewsItem[]> {
  const module = platformModules[sourceId];
  if (!module?.hotboard) return [];
  try {
    const boards = await module.hotboard.boards();
    if (boards.length === 0) return [];
    const result = await module.hotboard.list(boards[0].id, 1, limit);
    return result.news.filter(n => !!n.audioUrl);
  } catch {
    return [];
  }
}

function newsToSearchResult(n: NewsItem): SearchResultItem {
  return {
    title: n.title,
    artist: n.sourceName || n.author || n.source,
    album: '新闻资讯',
    duration: n.audioDuration || 0,
    cover_url: n.cover,
    source_data: {
      source: n.source,
      newsId: n.id,
      audioUrl: n.audioUrl,
      title: n.title,
      artist: n.sourceName || n.author || n.source,
      coverUrl: n.cover,
      duration: n.audioDuration,
      sourceUrl: n.url,
    } as NewsSourceData,
  };
}

/**
 * 宿主搜索入口：POST /api/search
 * body: { keyword, page?, page_size? }
 * resp: { results: SearchResultItem[] }
 */
export const hostSearchHandler = createSearchHandler({
  async search(keyword: string, page?: number, pageSize?: number) {
    const p = page || 1;
    const ps = pageSize || 20;

    // 从所有可播放源拉热榜，按关键词过滤
    const promises = PLAYABLE_SOURCES
      .filter(s => platformModules[s])
      .map(sid => loadPlayableNews(sid, 50));

    const arrays = await Promise.all(promises);
    const allNews: NewsItem[] = [];
    for (const arr of arrays) allNews.push(...arr);

    const kw = keyword.toLowerCase();
    const matched = allNews.filter(n =>
      (n.title && n.title.toLowerCase().includes(kw)) ||
      (n.summary && n.summary.toLowerCase().includes(kw))
    );

    // 分页
    const start = (p - 1) * ps;
    return matched.slice(start, start + ps).map(newsToSearchResult);
  },
});

/**
 * 宿主播放解析：POST /api/music/url
 * body: { source_data, fallback? }
 * resp: { url, headers? } 或 { error: 'source_not_available' }
 */
export const hostMusicUrlHandler = createMusicUrlHandler({
  async resolveUrl(sourceData: Record<string, unknown>) {
    const sd = sourceData as NewsSourceData;
    if (!sd || !sd.audioUrl) {
      throw new Error('missing audioUrl in source_data');
    }
    // 新闻音频 URL 一般可直接访问，无需特殊 headers
    return {
      url: sd.audioUrl,
      // 部分源可能需要 Referer，按 source 加（目前都不需要）
      headers: sd.source === 'ximalaya' ? { Referer: 'https://www.ximalaya.com/' } : undefined,
    };
  },
  // 宿主下发 fallback hint 时，按标题在喜马拉雅搜
  async fallbackSearch(hint) {
    try {
      const module = platformModules['ximalaya'];
      if (!module?.hotboard) return null;
      const boards = await module.hotboard.boards();
      if (!boards.length) return null;
      const result = await module.hotboard.list(boards[0].id, 1, 50);
      const match = result.news.find(n =>
        n.audioUrl && n.title.includes(hint.title)
      );
      if (!match) return null;
      return {
        source_data: {
          source: match.source,
          newsId: match.id,
          audioUrl: match.audioUrl,
          title: match.title,
        } as NewsSourceData,
        title: match.title,
        artist: match.sourceName,
      };
    } catch {
      return null;
    }
  },
});
