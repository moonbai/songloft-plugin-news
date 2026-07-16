// musicSdk/mg/index.ts - 咪咕音乐 (Migu Music) 平台模块
// 运行于 QuickJS 沙箱:仅使用 fetch / setTimeout / Buffer / crypto / zlib / songloft.*
// 不使用 node.js API 与 require

import { httpFetch } from '../request';
import { getField } from '../index';
import type {
  SongInfo,
  SearchResult,
  LyricResult,
  SongListItem,
  SongListDetail,
  LeaderboardItem,
  PlatformSearch,
  PlatformSongList,
  PlatformLeaderboard,
  PlatformModule,
} from '../../types';

// ============ 常量 ============
const MIGU_M_BASE = 'https://m.music.migu.cn';
const MIGU_V3_BASE = 'https://music.migu.cn/v3';

const MIGU_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0',
  'Referer': 'https://m.music.migu.cn/v3/',
};

// ============ 工具函数 ============

/** 解析时长: 支持 "mm:ss" / "hh:mm:ss" / 秒 / 毫秒 → 秒 */
function parseDuration(duration: unknown): number {
  if (duration == null) return 0;
  if (typeof duration === 'number') {
    if (isNaN(duration)) return 0;
    // 大于 10000 视为毫秒 (最长歌曲约 2 小时 = 7200 秒)
    return duration > 10000 ? Math.floor(duration / 1000) : Math.floor(duration);
  }
  const str = String(duration).trim();
  if (!str) return 0;
  if (str.indexOf(':') !== -1) {
    const parts = str.split(':').map((p) => parseInt(p, 10) || 0);
    if (parts.length >= 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return parts[0] || 0;
  }
  const n = parseInt(str, 10);
  if (isNaN(n)) return 0;
  return n > 10000 ? Math.floor(n / 1000) : n;
}

/** 解析歌手字段 (可能是字符串/数组/对象) */
function parseSinger(singer: unknown): string {
  if (!singer) return '';
  if (typeof singer === 'string') return singer;
  if (Array.isArray(singer)) {
    return singer
      .map((s) => {
        if (s && typeof s === 'object') {
          return (s as any).name || (s as any).singerName || (s as any).artistName || '';
        }
        return String(s);
      })
      .filter(Boolean)
      .join('、');
  }
  if (typeof singer === 'object') return (singer as any).name || '';
  return String(singer);
}

/** 从原始 music 对象构建 SongInfo */
function buildSongInfo(raw: any): SongInfo {
  const id = getField(raw as any, 'id', 'songId');
  const copyrightId = getField(raw as any, 'copyrightId', 'copyrightID', 'copyright');
  const idStr = id != null ? String(id) : '';
  const cpStr = copyrightId != null ? String(copyrightId) : '';
  return {
    platform: 'mg',
    name: (getField(raw as any, 'songName', 'name', 'title') as string) || '',
    singer: parseSinger(getField(raw as any, 'singer', 'singers', 'artist', 'artists')),
    album: (getField(raw as any, 'albumName', 'album', 'albumTitle') as string) || '',
    duration: parseDuration(getField(raw as any, 'duration', 'timeLength')),
    musicId: idStr,
    copyrightId: cpStr,
    songmid: cpStr || idStr,
    cover:
      (getField(raw as any, 'cover', 'img', 'albumImg', 'pic', 'imageUrl', 'albumPic') as string) ||
      '',
  };
}

/** 安全 HTTP GET (返回已解析 body) */
async function miguGet(url: string, extraHeaders?: Record<string, string>): Promise<any> {
  const { promise } = httpFetch(url, {
    method: 'GET',
    headers: { ...MIGU_HEADERS, ...(extraHeaders || {}) },
    timeout: 15000,
  });
  const resp = await promise;
  if (resp.statusCode !== 200) {
    throw new Error('migu request failed: ' + resp.statusCode + ' ' + url);
  }
  return resp.body;
}

// ============ 搜索 ============
const musicSearch: PlatformSearch = {
  async search(keyword: string, page: number, limit: number): Promise<SearchResult> {
    const url =
      MIGU_M_BASE +
      '/migu/remoting/scr_search_tag?keyword=' +
      encodeURIComponent(keyword) +
      '&pgc=' +
      page +
      '&rows=' +
      limit +
      '&type=2';
    const data: any = await miguGet(url);
    const musics: any[] = (data && data.musics) || [];
    const songs = musics.map(buildSongInfo);
    const total = Number(data && data.total) || songs.length;
    return { songs, total, source: 'mg' };
  },
};

// ============ 歌词 ============
async function getLyric(songInfo: SongInfo): Promise<LyricResult | null> {
  const copyrightId = String(
    songInfo.copyrightId || songInfo.musicId || songInfo.songmid || '',
  );
  if (!copyrightId) return null;

  // 候选 endpoint,按序尝试
  const endpoints = [
    MIGU_M_BASE + '/migu/remoting/cms_artist_song_lyric?songid=' + copyrightId,
    MIGU_V3_BASE + '/api/music/audioapi/get-lyric?copyrightId=' + copyrightId,
  ];

  for (const url of endpoints) {
    let body: any;
    try {
      body = await miguGet(url);
    } catch {
      continue;
    }
    if (body == null) continue;

    // 直接是字符串
    if (typeof body === 'string') {
      const t = body.trim();
      if (t) return { lyric: t };
      continue;
    }

    // 多个可能的字段
    const lyricField = (body.lyric || body.content || body.result || body.lyrics || body.lrc) as any;
    let text = '';
    if (typeof lyricField === 'string') {
      text = lyricField;
    } else if (lyricField && typeof lyricField === 'object') {
      text = (lyricField as any).content || (lyricField as any).lyric || '';
    }
    if (text && text.trim()) {
      return { lyric: text.trim() };
    }
  }

  return null;
}

// ============ 歌单 ============
const FALLBACK_TAGS: { id: string; name: string }[] = [
  { id: '1', name: '热门' },
  { id: '2', name: '推荐' },
  { id: '3', name: '流行' },
  { id: '4', name: '摇滚' },
];

const songList: PlatformSongList = {
  async tags(): Promise<{ id: string; name: string }[]> {
    try {
      const data: any = await miguGet(MIGU_M_BASE + '/migu/remoting/cms_playlist_tag?msisdn=');
      const arr: any[] = Array.isArray(data)
        ? data
        : (data && Array.isArray(data.tagList) ? data.tagList : []) ;
      if (arr.length) {
        const list = arr.map((t: any) => ({
          id: String(t.tagId || t.id || ''),
          name: t.tagName || t.name || '',
        }));
        const filtered = list.filter((t) => t.id);
        if (filtered.length) return filtered;
      }
    } catch {
      // fallback
    }
    return FALLBACK_TAGS;
  },

  async list(
    tag: string,
    page: number,
    limit: number,
  ): Promise<{ list: SongListItem[]; total: number }> {
    const pageIndex = Math.max(0, (page || 1) - 1);
    const url =
      MIGU_M_BASE +
      '/migu/remoting/cms_playlist_list_tag?tagId=' +
      encodeURIComponent(tag) +
      '&pageIndex=' +
      pageIndex +
      '&pageSize=' +
      limit;
    const data: any = await miguGet(url);
    const items: any[] =
      (data && (data.retItemList || data.playlistList || data.list)) || [];
    const list: SongListItem[] = items.map((it: any) => ({
      id: String(it.id || it.playListId || ''),
      name: it.title || it.name || it.playListTitle || '',
      cover: it.img || it.imageUrl || it.pic || '',
      author: it.userName || it.creator || '',
      playCount: it.playCount != null ? String(it.playCount) : '',
      total: it.contentCount != null ? Number(it.contentCount) : undefined,
    }));
    const total = Number(data && (data.totalCount || data.total)) || list.length;
    return { list, total };
  },

  async detail(id: string, _page: number): Promise<SongListDetail> {
    // 咪咕歌单详情固定取前 100 首
    const url =
      MIGU_M_BASE +
      '/migu/remoting/cms_playlist_song_list?playListId=' +
      encodeURIComponent(id) +
      '&pageIndex=0&pageSize=100';
    const data: any = await miguGet(url);
    const songs: any[] = (data && (data.songList || data.list)) || [];
    const list: SongInfo[] = songs.map(buildSongInfo);
    return {
      info: {
        id: String(id),
        name: (data && (data.playListName || data.title || data.name)) || '',
        cover: (data && (data.img || data.imageUrl || data.pic)) || '',
        author: (data && (data.userName || data.creator)) || '',
        total: list.length,
      },
      list,
    };
  },
};

// ============ 排行榜 ============
const FALLBACK_BOARDS: LeaderboardItem[] = [
  { id: '2755', name: '飙升榜' },
  { id: '2756', name: '热歌榜' },
  { id: '2757', name: '新歌榜' },
];

const leaderboard: PlatformLeaderboard = {
  async boards(): Promise<LeaderboardItem[]> {
    try {
      const data: any = await miguGet(MIGU_M_BASE + '/migu/remoting/cms_topdata_list?msisdn=');
      const arr: any[] = Array.isArray(data)
        ? data
        : (data && Array.isArray(data.topList) ? data.topList : data && Array.isArray(data.list) ? data.list : []);
      if (arr.length) {
        const list = arr.map((b: any) => ({
          id: String(b.id || b.topId || b.toplistId || ''),
          name: b.title || b.name || b.topName || '',
          cover: b.img || b.imageUrl || b.pic || '',
        }));
        const filtered = list.filter((b) => b.id);
        if (filtered.length) return filtered;
      }
    } catch {
      // fallback
    }
    return FALLBACK_BOARDS;
  },

  async list(
    id: string,
    page: number,
    limit: number,
  ): Promise<{ list: SongInfo[]; total: number }> {
    const pageIndex = Math.max(0, (page || 1) - 1);
    const url =
      MIGU_M_BASE +
      '/migu/remoting/cms_top_song_list?topId=' +
      encodeURIComponent(id) +
      '&pageIndex=' +
      pageIndex +
      '&pageSize=' +
      limit;
    const data: any = await miguGet(url);
    const songs: any[] = (data && (data.songList || data.list)) || [];
    const list: SongInfo[] = songs.map(buildSongInfo);
    const total = Number(data && (data.totalCount || data.total)) || list.length;
    return { list, total };
  },
};

// ============ 平台模块导出 ============
const mg: PlatformModule = {
  musicSearch,
  getLyric,
  songList,
  leaderboard,
};

export { musicSearch, getLyric, songList, leaderboard };
export default mg;
