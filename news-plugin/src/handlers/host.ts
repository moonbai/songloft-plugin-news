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

// 只在这些源里搜可播放内容（有音频的 + 支持TTS的）
const PLAYABLE_SOURCES = ['cctv', 'cnr', 'people', 'ximalaya', 'dedao', 'weibo', 'zhihu', 'baidu', '36kr', 'ithome', 'huxiu', 'sspai', 'juejin'];

interface NewsSourceData {
  source: string;
  newsId: string;
  audioUrl?: string;
  ttsUrl?: string;
  title: string;
  artist?: string;
  coverUrl?: string;
  duration?: number;
  sourceUrl?: string;
  // TTS 专属字段
  isTts?: boolean;
  ttsText?: string;
}

/**
 * 加载某源的热榜（所有新闻都支持TTS播放）
 */
async function loadPlayableNews(sourceId: string, limit: number): Promise<NewsItem[]> {
  const module = platformModules[sourceId];
  if (!module?.hotboard) return [];
  try {
    const boards = await module.hotboard.boards();
    if (boards.length === 0) return [];
    const result = await module.hotboard.list(boards[0].id, 1, limit);
    // 所有新闻都可以通过TTS播放，不再过滤audioUrl
    return result.news;
  } catch {
    return [];
  }
}

function newsToSearchResult(n: NewsItem): SearchResultItem {
  const isTts = !n.audioUrl;
  // 清洗 TTS 文本
  const rawText = n.title + '。' + (n.summary || '');
  const ttsText = rawText
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/https?:\/\/[^\s<]+/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
  // 估算时长：中文约240字/分钟
  const estimatedDuration = isTts ? Math.ceil(ttsText.length / 240 * 60) : (n.audioDuration || 0);

  // TTS 模式直接生成有道 URL
  const ttsUrl = isTts
    ? 'https://dict.youdao.com/dictvoice?audio=' + encodeURIComponent(ttsText) + '&type=1'
    : undefined;

  return {
    title: n.title,
    artist: n.sourceName || n.author || n.source,
    album: '新闻资讯',
    duration: estimatedDuration,
    cover_url: n.cover,
    source_data: {
      source: n.source,
      newsId: n.id,
      audioUrl: n.audioUrl,
      ttsUrl,
      title: n.title,
      artist: n.sourceName || n.author || n.source,
      coverUrl: n.cover,
      duration: estimatedDuration,
      sourceUrl: n.url,
      isTts,
      ttsText,
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
    if (!sd) {
      throw new Error('missing source_data');
    }

    // 有原生音频URL的，直接返回
    if (sd.audioUrl) {
      return {
        url: sd.audioUrl,
        headers: sd.source === 'ximalaya' ? { Referer: 'https://www.ximalaya.com/' } : undefined,
      };
    }

    // TTS 新闻：优先用预生成的 ttsUrl，否则现场生成
    if (sd.isTts) {
      if (sd.ttsUrl) {
        return { url: sd.ttsUrl };
      }
      if (sd.ttsText) {
        const text = sd.ttsText.slice(0, 200);
        const ttsUrl = 'https://dict.youdao.com/dictvoice?audio=' +
          encodeURIComponent(text) + '&type=1';
        return { url: ttsUrl };
      }
    }

    // 没有音频也不是TTS的，返回错误
    throw new Error('no audio available');
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
