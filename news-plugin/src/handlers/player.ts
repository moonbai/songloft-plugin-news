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
import { synthesizeWithCache } from '../player/edgeTts';
import type { PlaylistItem, TtsConfig } from '../player';
import type { NewsItem } from '../types';

/**
 * Uint8Array 转 base64 字符串
 * 宿主 HTTPResponse.body 只接受 string，二进制数据需 base64 编码后返回
 */
function uint8ToBase64(arr: Uint8Array): string {
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < arr.length; i += chunkSize) {
    const chunk = arr.subarray(i, i + chunkSize);
    // String.fromCharCode 一次处理太多参数会栈溢出，分块处理
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

/**
 * 把 NewsItem 转成官方 songs.create 的入参
 * - 原生音频：url 填 audioUrl
 * - TTS 新闻：url 填插件内的 TTS 音频流接口，宿主播放时实时生成音频
 */
function newsToSongInput(news: NewsItem): CreateSongInput | null {
  if (!news || !news.title) return null;

  // 空 id 生成 fallback，避免 dedupKey 无效
  const newsId = news.id || crypto.md5(
    (news.source || 'unknown') + ':' + (news.title || '')
  ).slice(0, 16);

  const isTts = !news.audioUrl;

  // 清洗 TTS 文本
  const rawText = news.title + '。' + (news.summary || '');
  const ttsText = rawText
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/https?:\/\/[^\s<]+/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);

  // 估算时长：中文约240字/分钟
  const estimatedDuration = isTts ? Math.max(10, Math.ceil(ttsText.length / 240 * 60)) : (news.audioDuration || 0);

  // TTS 模式：url 填插件内的 TTS 音频流接口
  // 原生音频模式：url 填 audioUrl
  let url: string;
  if (isTts) {
    const ttsParam = encodeURIComponent(ttsText);
    url = `/api/player/tts-stream?text=${ttsParam}`;
  } else {
    url = news.audioUrl || '';
  }

  const sourceData = JSON.stringify({
    newsId,
    source: news.source,
    sourceUrl: news.url,
    isTts,
    ttsText,
  });

  return {
    url,
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
        const platforms = ['weibo', '36kr', 'toutiao', 'wangyi', 'pengpai', 'baidu', 'zhihu'];

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

        songloft.log.info('registerBatch: newsList=' + newsList.length + ', playlistId=' + playlistId);

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

        songloft.log.info('registerBatch: inputs=' + inputs.length + ', skipped=' + skipped.length);

        if (inputs.length === 0) {
          return successResponse({ created: 0, added: 0, skippedCount: skipped.length, skippedItems: skipped });
        }

        let songs: Song[];
        try {
          songs = await songloft.songs.create(inputs);
          songloft.log.info('registerBatch: songs.create returned ' + songs.length + ' songs');
        } catch (hostErr) {
          songloft.log.error('registerBatch: songs.create failed: ' + (hostErr as Error).message);
          return errorResponse('宿主歌曲创建失败: ' + (hostErr as Error).message);
        }
        const songIds = songs.map(s => s.id);
        songloft.log.info('registerBatch: songIds=' + JSON.stringify(songIds.slice(0, 5)) + '...');

        // 未指定歌单时，自动创建/复用「新闻资讯」歌单
        let targetPlaylistId = playlistId;
        if (!targetPlaylistId && songIds.length > 0) {
          try {
            const allPlaylists = await songloft.playlists.list();
            songloft.log.info('registerBatch: allPlaylists count=' + allPlaylists.length);
            const radioPlaylists = allPlaylists.filter((p: any) => p.type === 'radio' || !p.type);
            let target = radioPlaylists.find((p: any) => p.name === '新闻资讯');
            if (!target) {
              target = await songloft.playlists.create({ name: '新闻资讯', type: 'radio' as any });
              songloft.log.info('registerBatch: created new playlist id=' + (target as any).id);
            }
            targetPlaylistId = (target as any).id;
            songloft.log.info('registerBatch: auto-create/use playlist id=' + targetPlaylistId);
          } catch (e) {
            songloft.log.error('registerBatch: playlist setup failed: ' + (e as Error).message);
            return errorResponse('无法创建/获取新闻歌单: ' + (e as Error).message);
          }
        }

        let added = 0;
        let addError = '';
        if (targetPlaylistId && songIds.length > 0) {
          try {
            const result = await songloft.playlists.addSongs(targetPlaylistId, songIds);
            added = result.added;
            songloft.log.info('registerBatch: addSongs added=' + added + ', skipped=' + result.skipped);
          } catch (e) {
            addError = (e as Error).message;
            songloft.log.error('registerBatch: addSongs failed: ' + addError);
          }
        } else if (!playlistId) {
          addError = '未指定目标歌单';
        }

        return successResponse({
          created: songs.length,
          added,
          addError,
          songs,
          skippedCount: skipped.length,
          skippedItems: skipped,
        });
      } catch (e) {
        songloft.log.error('registerBatch: unexpected error: ' + (e as Error).message);
        return errorResponse('Register batch failed: ' + (e as Error).message);
      }
    },

    /**
     * TTS 音频流接口 - 供宿主原生播放器调用
     * 通过在线 TTS 服务（百度翻译）实时生成 MP3 音频并返回
     *
     * 注意：宿主 HTTPResponse.body 只接受 string 类型，
     * 因此音频数据 base64 编码后作为 string 返回，前端解码为 Blob 播放。
     */
    async ttsStream(req: HTTPRequest) {
      try {
        const query = parseQuery(req.query);
        const text = String(query.text || '').trim();
        const voice = String(query.voice || 'zh-CN-XiaoxiaoNeural');
        const rate = query.rate ? Number(query.rate) : 1.0;
        const pitch = query.pitch ? Number(query.pitch) : 1.0;
        const volume = query.volume ? Number(query.volume) : 1.0;

        if (!text) {
          return {
            statusCode: 400,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            body: 'text parameter is required',
          };
        }

        if (text.length > 5000) {
          return {
            statusCode: 400,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            body: 'text too long (max 5000 chars)',
          };
        }

        songloft.log.info('ttsStream: generating audio for text length=' + text.length);

        const audioBuffer = await synthesizeWithCache(text, { voice, rate, pitch, volume });

        songloft.log.info('ttsStream: audio generated, size=' + audioBuffer.length);

        // base64 编码（宿主 body 只接受 string）
        const base64Audio = uint8ToBase64(audioBuffer);

        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'X-Audio-Base64': '1',
            'X-Audio-Size': String(audioBuffer.length),
            'Cache-Control': 'public, max-age=86400',
          },
          body: base64Audio,
        };
      } catch (e) {
        songloft.log.error('ttsStream error: ' + (e as Error).message);
        return {
          statusCode: 500,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          body: 'TTS generation failed: ' + (e as Error).message,
        };
      }
    },
  };
}
