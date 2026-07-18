// 播放器 HTTP 处理
import { parseQuery } from '@songloft/plugin-sdk';
import type { HTTPRequest, CreateSongInput, Song } from '@songloft/plugin-sdk';
import { platformModules } from '../newsSdk/facade';
import { successResponse, errorResponse, badRequestResponse, parseJsonBody } from './response';
import {
  getPlaylists, addToPlaylist, removeFromPlaylist, clearPlaylist,
  getTtsConfig, setTtsConfig,
  buildTtsScript,
} from '../player';
import type { PlaylistItem, TtsConfig } from '../player';
import type { NewsItem } from '../types';

/**
 * 把 NewsItem 转成官方 songs.create 的入参
 * 支持原生音频和TTS两种模式：
 * - 原生音频：url 填 audioUrl
 * - TTS模式：url 留空（或占位），sourceData 中标记 isTts + ttsText
 *   宿主播放时会回调 /api/music/url，从 sourceData 解析出TTS文本生成URL
 */
function newsToSongInput(news: NewsItem): CreateSongInput | null {
  if (!news || !news.title) return null;

  // 空 id 生成 fallback，避免 dedupKey 无效
  const newsId = news.id || crypto.md5(
    (news.source || 'unknown') + ':' + (news.title || '')
  ).slice(0, 16);

  const isTts = !news.audioUrl;
  const ttsText = news.title + '。' + (news.summary || '');
  // 估算时长：中文约240字/分钟
  const estimatedDuration = isTts ? Math.ceil(ttsText.length / 240 * 60) : (news.audioDuration || 0);

  const sourceData = JSON.stringify({
    newsId,
    source: news.source,
    sourceUrl: news.url,
    isTts,
    ttsText,
  });

  return {
    // TTS模式url留空，宿主通过music/url回调获取真实播放地址
    url: news.audioUrl || '',
    title: news.title,
    artist: news.sourceName || news.author || news.source,
    album: '新闻资讯',
    coverUrl: news.cover,
    duration: estimatedDuration,
    sourceData,
    dedupKey: `${news.source}:${newsId}`,
  };
}

export function createPlayerHandlers() {
  return {
    /**
     * 解析新闻的播放信息（包含 audioUrl、是否支持 TTS 等）
     */
    async resolve(req: HTTPRequest) {
      try {
        if (!req.body) return badRequestResponse('No body');

        const parsed = parseJsonBody(req.body);
        const news = parsed.news as NewsItem;
        const enableTts = parsed.enableTts !== false;

        if (!news) return badRequestResponse('news is required');

        const module = platformModules[news.source];
        let audioUrl = news.audioUrl;
        let audioDuration = news.audioDuration;
        let content = news.content;

        // 如果没有 audioUrl 但有详情，先获取详情
        if (!audioUrl && module && !news.content) {
          try {
            const detail = await module.newsDetail.detail(news.id);
            if (detail) {
              audioUrl = detail.news.audioUrl;
              audioDuration = detail.news.audioDuration;
              content = detail.content;
            }
          } catch (e) {
            // 忽略
          }
        }

        const ttsScript = enableTts ? buildTtsScript(news, content) : null;

        return successResponse({
          news: { ...news, audioUrl, audioDuration, content },
          audioUrl: audioUrl || null,
          audioDuration: audioDuration || 0,
          hasAudio: !!audioUrl,
          ttsScript,
          ttsEnabled: enableTts,
        });
      } catch (e) {
        return errorResponse('Resolve failed: ' + (e as Error).message);
      }
    },

    /**
     * 添加到播放列表
     */
    async addToPlaylist(req: HTTPRequest) {
      try {
        if (!req.body) return badRequestResponse('No body');

        const parsed = parseJsonBody(req.body);
        const news = parsed.news as NewsItem;
        const listName = String(parsed.listName || 'default');

        if (!news) return badRequestResponse('news is required');

        // 为空 id 生成 fallback，避免播放列表去重和移除失败
        const itemId = news.id || crypto.md5(
          (news.source || 'unknown') + ':' + (news.title || news.url || Date.now())
        ).slice(0, 16);

        const item: PlaylistItem = {
          id: itemId,
          title: news.title,
          source: news.source,
          sourceName: news.sourceName,
          url: news.url,
          cover: news.cover,
          audioUrl: news.audioUrl,
          audioDuration: news.audioDuration,
          summary: news.summary,
          publishTime: news.publishTime,
          addTime: Date.now(),
        };

        const success = await addToPlaylist(item, listName);
        return successResponse({ success, message: success ? '已添加' : '已在列表中' });
      } catch (e) {
        return errorResponse('Add failed: ' + (e as Error).message);
      }
    },

    /**
     * 从播放列表移除
     */
    async removeFromPlaylist(req: HTTPRequest) {
      try {
        const query = parseQuery(req.query);
        const id = String(query.id || '');
        const source = String(query.source || '');
        const listName = String(query.listName || 'default');

        if (!id || !source) return badRequestResponse('id and source are required');

        const success = await removeFromPlaylist(id, source, listName);
        return successResponse({ success });
      } catch (e) {
        return errorResponse('Remove failed: ' + (e as Error).message);
      }
    },

    /**
     * 获取播放列表
     */
    async getPlaylists(req: HTTPRequest) {
      try {
        const query = parseQuery(req.query);
        const listName = String(query.listName || 'default');
        const all = await getPlaylists();
        const list = all.find(p => p.name === listName) || { name: listName, items: [] };
        return successResponse(list);
      } catch (e) {
        return errorResponse('Get list failed: ' + (e as Error).message);
      }
    },

    /**
     * 清空播放列表
     */
    async clearPlaylist(req: HTTPRequest) {
      try {
        const query = parseQuery(req.query);
        const listName = String(query.listName || 'default');
        await clearPlaylist(listName);
        return successResponse({ success: true });
      } catch (e) {
        return errorResponse('Clear failed: ' + (e as Error).message);
      }
    },

    /**
     * 获取 TTS 配置
     */
    async getTtsConfig(req: HTTPRequest) {
      try {
        const config = await getTtsConfig();
        return successResponse(config);
      } catch (e) {
        return errorResponse('Get TTS config failed');
      }
    },

    /**
     * 保存 TTS 配置
     */
    async setTtsConfig(req: HTTPRequest) {
      try {
        if (!req.body) return badRequestResponse('No body');

        const parsed = parseJsonBody(req.body);
        const config = parsed as unknown as TtsConfig;
        await setTtsConfig(config);
        return successResponse({ success: true });
      } catch (e) {
        return errorResponse('Save TTS config failed');
      }
    },

    /**
     * 一键获取"可播放新闻"列表
     */
    async getPlayableNews(req: HTTPRequest) {
      try {
        const query = parseQuery(req.query);
        const limit = Number(query.limit) || 30;
        const platforms = ['ximalaya', 'dedao', 'weibo', '36kr', 'toutiao', 'wangyi', 'pengpai', 'baidu', 'zhihu'];

        const promises = platforms.map(async (sourceId) => {
          try {
            const module = platformModules[sourceId];
            if (!module) return { source: sourceId, news: [] };
            const result = await module.newsList.list('', 1, Math.ceil(limit / platforms.length));
            return { source: sourceId, news: result.news };
          } catch (e) {
            return { source: sourceId, news: [] };
          }
        });

        const results = await Promise.all(promises);
        const allNews: NewsItem[] = [];
        for (const r of results) {
          for (const n of r.news) {
            allNews.push({
              ...n,
              hasAudio: !!n.audioUrl,
              canTts: n.ttsEnabled !== false,
            });
          }
        }

        // 按发布时间倒序
        allNews.sort((a, b) => b.publishTime - a.publishTime);

        return successResponse({
          news: allNews.slice(0, limit),
          total: allNews.length,
        });
      } catch (e) {
        return errorResponse('Get playable failed: ' + (e as Error).message);
      }
    },

    /**
     * 注册单条新闻到宿主歌曲库
     * - 支持原生音频和TTS两种模式
     * - dedupKey 用 `${source}:${id}`，重复注册会复用同一 Song
     */
    async registerSong(req: HTTPRequest) {
      try {
        if (!req.body) return badRequestResponse('No body');
        const parsed = parseJsonBody(req.body);
        const news = parsed.news as NewsItem;

        if (!news || !news.id || !news.title) {
          return badRequestResponse('news (with id and title) is required');
        }

        const songInput = newsToSongInput(news);
        if (!songInput) return badRequestResponse('invalid news');

        const songs: Song[] = await songloft.songs.create([songInput]);
        const song = songs[0];
        if (!song) return errorResponse('Host refused to create song');

        return successResponse({
          song,
          songId: song.id,
          playableUrl: song.url,
        });
      } catch (e) {
        return errorResponse('Register song failed: ' + (e as Error).message);
      }
    },

    /**
     * 批量注册新闻到宿主歌曲库
     * - 用于"一键加入歌单"场景
     * - 支持原生音频和TTS两种模式
     * - 支持指定 playlistId 自动加入歌单
     */
    async registerBatch(req: HTTPRequest) {
      try {
        if (!req.body) return badRequestResponse('No body');
        const parsed = parseJsonBody(req.body);
        const newsList = (parsed.newsList || parsed.news || []) as NewsItem[];
        const playlistId = parsed.playlistId ? Number(parsed.playlistId) : null;

        if (!Array.isArray(newsList) || newsList.length === 0) {
          return badRequestResponse('newsList is required and must be non-empty');
        }

        const inputs: CreateSongInput[] = [];
        const skipped: { id: string; title: string; reason: string }[] = [];
        for (const n of newsList) {
          if (!n || !n.title) {
            skipped.push({ id: n?.id || '', title: n?.title || '', reason: 'missing title' });
            continue;
          }
          const input = newsToSongInput(n);
          if (input) inputs.push(input);
          else skipped.push({ id: n?.id || '', title: n?.title || '', reason: 'invalid' });
        }

        if (inputs.length === 0) {
          return successResponse({ created: 0, added: 0, skippedCount: skipped.length, skippedItems: skipped });
        }

        const songs: Song[] = await songloft.songs.create(inputs);
        const songIds = songs.map(s => s.id);

        let added = 0;
        if (playlistId && songIds.length > 0) {
          try {
            const result = await songloft.playlists.addSongs(playlistId, songIds);
            added = result.added;
          } catch (e) {
            songloft.log.error('add to playlist failed: ' + (e as Error).message);
          }
        }

        return successResponse({
          created: songs.length,
          added,
          songs,
          skippedCount: skipped.length,
          skippedItems: skipped,
        });
      } catch (e) {
        return errorResponse('Register batch failed: ' + (e as Error).message);
      }
    },
  };
}
