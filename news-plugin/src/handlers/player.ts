// 播放器 HTTP 处理
import { platformModules } from '../newsSdk/facade';
import { successResponse, errorResponse, badRequestResponse, parseJsonBody } from './response';
import {
  getPlaylists, addToPlaylist, removeFromPlaylist, clearPlaylist,
  getTtsConfig, setTtsConfig,
  buildTtsScript,
} from '../player';
import type { PlaylistItem, TtsConfig } from '../player';
import type { NewsItem } from '../types';

export function createPlayerHandlers() {
  return {
    /**
     * 解析新闻的播放信息（包含 audioUrl、是否支持 TTS 等）
     */
    async resolve(req: unknown) {
      try {
        const request = req as any;
        if (!request.body) return badRequestResponse('No body');

        const parsed = parseJsonBody(request.body);
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
    async addToPlaylist(req: unknown) {
      try {
        const request = req as any;
        if (!request.body) return badRequestResponse('No body');

        const parsed = parseJsonBody(request.body);
        const news = parsed.news as NewsItem;
        const listName = String(parsed.listName || 'default');

        if (!news) return badRequestResponse('news is required');

        const item: PlaylistItem = {
          id: news.id,
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
    async removeFromPlaylist(req: unknown) {
      try {
        const request = req as any;
        const query = request.query || {};
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
    async getPlaylists(req: unknown) {
      try {
        const request = req as any;
        const listName = String(request.query?.listName || 'default');
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
    async clearPlaylist(req: unknown) {
      try {
        const request = req as any;
        const listName = String(request.query?.listName || 'default');
        await clearPlaylist(listName);
        return successResponse({ success: true });
      } catch (e) {
        return errorResponse('Clear failed: ' + (e as Error).message);
      }
    },

    /**
     * 获取 TTS 配置
     */
    async getTtsConfig(req: unknown) {
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
    async setTtsConfig(req: unknown) {
      try {
        const request = req as any;
        if (!request.body) return badRequestResponse('No body');

        const parsed = parseJsonBody(request.body);
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
    async getPlayableNews(req: unknown) {
      try {
        const request = req as any;
        const limit = Number(request.query?.limit) || 30;
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
  };
}
