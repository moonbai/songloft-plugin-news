// 宿主原生集成：对接官方 createSearchHandler + createMusicUrlHandler
//
// 这是宿主播放插件内容的"官方推荐"方式：
//   1. 宿主在搜索框输入关键词 → 调用插件 POST /api/search
//   2. 宿主把搜到的 SearchResultItem（含 source_data）加入歌单/播放队列
//   3. 宿主播放时 → 调用插件 POST /api/music/url，传回 source_data
//   4. 插件返回真实可播放 URL（+可选 headers，如 Referer）
//   5. 宿主用原生播放器播放该 URL
//
// TTS 新闻播放方案：
//   - source_data 中携带 ttsText 和 isTts 标记
//   - 宿主请求 /api/music/url 时，返回插件内的 TTS 音频流 URL
//   - 宿主访问该 URL 时，插件通过 Edge TTS 实时生成音频并返回

import {
  createSearchHandler,
  createMusicUrlHandler,
} from '@songloft/plugin-sdk';
import type { SearchResultItem } from '@songloft/plugin-sdk';
import { platformModules } from '../newsSdk/facade';
import type { NewsItem } from '../types';

// 只在这些源里搜可播放内容（全部为文字源，通过 Edge TTS 朗读）
const PLAYABLE_SOURCES = ['weibo', 'zhihu', 'baidu', '36kr', 'ithome', 'huxiu', 'sspai', 'juejin', 'toutiao', 'pengpai', 'wangyi'];

interface NewsSourceData {
  source: string;
  newsId: string;
  audioUrl?: string;
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
    .slice(0, 500);
  // 估算时长：中文约240字/分钟
  const estimatedDuration = isTts ? Math.max(10, Math.ceil(ttsText.length / 240 * 60)) : (n.audioDuration || 0);

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
 *
 * TTS 新闻：返回插件内的 TTS 音频流 URL，宿主访问时实时生成音频
 */
export const hostMusicUrlHandler = createMusicUrlHandler({
  async resolveUrl(sourceData: Record<string, unknown>) {
    const sd = sourceData as NewsSourceData;
    if (!sd) {
      throw new Error('missing source_data');
    }

    // 有原生音频URL的，直接返回
    if (sd.audioUrl) {
      return { url: sd.audioUrl };
    }

    // TTS 新闻：返回插件内的 TTS 音频流 URL
    // 宿主会通过这个 URL 获取音频流，插件实时用 Edge TTS 生成
    if (sd.isTts && sd.ttsText) {
      const ttsParam = encodeURIComponent(sd.ttsText);
      const titleParam = encodeURIComponent(sd.title || '');
      // 返回相对路径，宿主会自动拼接插件的基础 URL
      return { url: `/api/player/tts-stream?text=${ttsParam}&title=${titleParam}` };
    }

    // 没有音频也不是TTS的，返回错误
    throw new Error('no audio available');
  },
  // 宿主下发 fallback hint 时，按标题在各源中搜
  async fallbackSearch(hint) {
    try {
      const sourceIds = Object.keys(platformModules);
      for (const sid of sourceIds) {
        const module = platformModules[sid];
        if (!module?.hotboard) continue;
        const boards = await module.hotboard.boards();
        if (!boards.length) continue;
        const result = await module.hotboard.list(boards[0].id, 1, 30);
        const match = result.news.find(n =>
          n.title && n.title.includes(hint.title)
        );
        if (match) {
          const isTts = !match.audioUrl;
          const ttsText = (match.title + '。' + (match.summary || ''))
            .replace(/<[^>]+>/g, '')
            .replace(/&[a-z]+;/gi, ' ')
            .replace(/https?:\/\/[^\s<]+/gi, '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 500);
          return {
            source_data: {
              source: match.source,
              newsId: match.id,
              audioUrl: match.audioUrl,
              title: match.title,
              isTts,
              ttsText,
            } as NewsSourceData,
            title: match.title,
            artist: match.sourceName,
          };
        }
      }
      return null;
    } catch {
      return null;
    }
  },
});
