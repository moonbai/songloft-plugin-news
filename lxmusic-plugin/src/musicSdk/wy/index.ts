// musicSdk/wy/index.ts - 网易云音乐 (NetEase Cloud Music) 平台模块
// 运行于 QuickJS 沙箱:仅使用 fetch / setTimeout / Buffer / crypto / zlib / songloft.*
// 使用 NetEase 旧版 /api/ 接口 (无需 weapi 加密),通过 Cookie MUSIC_U=00 / os=pc 访问

import { httpFetch } from '../request';
import { formatPlayCount, decodeName } from '../index';
import type {
  SongInfo,
  SearchResult,
  LyricResult,
  SongListItem,
  SongListDetail,
  LeaderboardItem,
  PlatformModule,
} from '../../types';

const platform = 'wy' as const;

// ============ 常量 ============

const API_BASE = 'https://music.163.com';
const DEFAULT_LIMIT = 20;
const DETAIL_LIMIT = 30; // 歌单详情 / 排行榜分页大小
const REQUEST_TIMEOUT = 15000;

const COMMON_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Referer: 'https://music.163.com/',
  Cookie: 'MUSIC_U=00; os=pc; __remember_me=true; __csrf=',
  Accept: '*/*',
  'Accept-Encoding': 'gzip, deflate',
  'Content-Type': 'application/x-www-form-urlencoded',
};

// 排行榜兜底列表 (接口失败时使用)
const DEFAULT_BOARDS: LeaderboardItem[] = [
  { id: '19723756', name: '飙升榜' },
  { id: '3779629', name: '新歌榜' },
  { id: '2884035', name: '原创榜' },
  { id: '3778678', name: '热歌榜' },
];

// ============ 内部工具 ============

/** 网易云原始歌曲对象 → SongInfo (兼容 artists/ar、album/al、duration/dt 两种字段命名) */
function mapSong(raw: any): SongInfo {
  const artists: any[] = raw.artists || raw.ar || [];
  const album: any = raw.album || raw.al || {};
  const duration = raw.duration || raw.dt || 0;
  const id = raw.id;
  const albumId = album.id;
  return {
    platform,
    name: decodeName(raw.name || ''),
    singer: artists.map((a: any) => a.name).filter(Boolean).join(' / '),
    album: album.name || '',
    duration: Math.floor(Number(duration || 0) / 1000),
    musicId: id != null ? String(id) : '',
    songmid: id != null ? String(id) : '',
    albumId: albumId != null ? String(albumId) : '',
    cover: album.picUrl || '',
  };
}

/** POST form 请求 (body 自动 JSON.parse) */
async function postForm(url: string, form: Record<string, string>): Promise<any> {
  const { promise } = httpFetch(url, {
    method: 'POST',
    headers: COMMON_HEADERS,
    form,
    timeout: REQUEST_TIMEOUT,
  });
  const resp = await promise;
  return resp.body;
}

/** GET JSON 请求 (body 自动 JSON.parse) */
async function getJSON(url: string): Promise<any> {
  const { promise } = httpFetch(url, {
    method: 'GET',
    headers: COMMON_HEADERS,
    timeout: REQUEST_TIMEOUT,
  });
  const resp = await promise;
  return resp.body;
}

/** 拉取歌单/排行榜详情,分页返回歌曲列表 (复用 /api/playlist/detail) */
async function fetchPlaylistTracks(
  id: string,
  page: number,
  limit: number,
): Promise<{ list: SongInfo[]; total: number }> {
  const data: any = await getJSON(`${API_BASE}/api/playlist/detail?id=${encodeURIComponent(id)}`);
  const playlist: any = (data && data.playlist) || {};
  const allTracks: any[] = playlist.tracks || [];
  const offset = (page - 1) * limit;
  const pageTracks = allTracks.slice(offset, offset + limit);
  return {
    list: pageTracks.map(mapSong),
    total: allTracks.length,
  };
}

// ============ 搜索 ============

const musicSearch = {
  async search(keyword: string, page: number, limit: number): Promise<SearchResult> {
    page = page || 1;
    limit = limit || DEFAULT_LIMIT;
    const offset = (page - 1) * limit;
    const data: any = await postForm(`${API_BASE}/api/search/get/web`, {
      s: keyword,
      type: '1',
      offset: String(offset),
      limit: String(limit),
      total: 'true',
    });
    const result: any = (data && data.result) || {};
    const songs: SongInfo[] = (result.songs || []).map(mapSong);
    const total: number = result.songCount || songs.length;
    return { songs, total, source: platform };
  },
};

// ============ 歌词 ============

async function getLyric(songInfo: SongInfo): Promise<LyricResult | null> {
  const musicId = songInfo.musicId || songInfo.songmid;
  if (!musicId) return null;
  const data: any = await getJSON(
    `${API_BASE}/api/song/lyric?id=${encodeURIComponent(String(musicId))}&lv=1&kv=1&tv=-1`,
  );
  if (!data) return null;
  const lyric: string = (data.lrc && data.lrc.lyric) || '';
  const tlyric: string = (data.tlyric && data.tlyric.lyric) || '';
  if (!lyric) return null;
  return { lyric, tlyric: tlyric || undefined };
}

// ============ 歌单 ============

const songList = {
  /** 歌单分类标签 */
  async tags(): Promise<unknown> {
    const data: any = await postForm(`${API_BASE}/api/playlist/catalogue`, {});
    if (!data) return { hot: [], tagsList: {} };
    const sub: any[] = data.sub || [];
    const categories: Record<string, string> = data.categories || {};

    const groupByCat: Record<string, { name: string; id: string }[]> = {};
    const hot: { name: string; id: string }[] = [];
    for (const item of sub) {
      const cat = String(item.category);
      const tag = { name: item.name, id: item.name };
      if (!groupByCat[cat]) groupByCat[cat] = [];
      groupByCat[cat].push(tag);
      if (item.hot) hot.push(tag);
    }

    const result: Record<string, unknown> = { hot, tagsList: groupByCat };
    for (const [cat, name] of Object.entries(categories)) {
      result[cat] = { name, list: groupByCat[cat] || [] };
    }
    return result;
  },

  /** 按分类浏览歌单 */
  async list(tag: string, page: number, limit: number): Promise<{ list: SongListItem[]; total: number }> {
    page = page || 1;
    limit = limit || DEFAULT_LIMIT;
    tag = tag || '全部';
    const offset = (page - 1) * limit;
    const data: any = await postForm(`${API_BASE}/api/playlist/list`, {
      cat: tag,
      offset: String(offset),
      limit: String(limit),
      order: 'hot',
      total: 'true',
    });
    const playlists: any[] = (data && data.playlists) || [];
    const list: SongListItem[] = playlists.map((p: any) => ({
      id: String(p.id),
      name: decodeName(p.name || ''),
      cover: p.coverImgUrl || p.picUrl || '',
      author: (p.creator && p.creator.nickname) || '',
      playCount: formatPlayCount(p.playCount || 0),
      total: p.trackCount || 0,
    }));
    const total: number = (data && data.total) || list.length;
    return { list, total };
  },

  /** 歌单详情 (分页返回歌曲) */
  async detail(id: string, page: number): Promise<SongListDetail> {
    page = page || 1;
    const limit = DETAIL_LIMIT;
    const data: any = await getJSON(`${API_BASE}/api/playlist/detail?id=${encodeURIComponent(id)}`);
    const playlist: any = (data && data.playlist) || {};
    const allTracks: any[] = playlist.tracks || [];
    const offset = (page - 1) * limit;
    const pageTracks = allTracks.slice(offset, offset + limit);
    return {
      info: {
        id: String(playlist.id || id),
        name: decodeName(playlist.name || ''),
        cover: playlist.coverImgUrl || '',
        author: (playlist.creator && playlist.creator.nickname) || '',
        desc: playlist.description || '',
        total: playlist.trackCount || allTracks.length,
      },
      list: pageTracks.map(mapSong),
    };
  },
};

// ============ 排行榜 ============

const leaderboard = {
  /** 排行榜列表 (接口异常时使用兜底) */
  async boards(): Promise<LeaderboardItem[]> {
    try {
      const data: any = await getJSON(`${API_BASE}/api/toplist`);
      const list: any[] = data && data.list;
      if (list && list.length) {
        return list.map((b: any) => ({
          id: String(b.id),
          name: decodeName(b.name || ''),
          cover: b.coverImgUrl || '',
          description: b.description || '',
        }));
      }
    } catch {
      // 接口异常,使用兜底列表
    }
    return DEFAULT_BOARDS;
  },

  /** 排行榜歌曲 (复用 /api/playlist/detail 接口) */
  async list(id: string, page: number, limit: number): Promise<{ list: SongInfo[]; total: number }> {
    page = page || 1;
    limit = limit || DETAIL_LIMIT;
    return fetchPlaylistTracks(id, page, limit);
  },
};

// ============ 导出平台模块 ============

const wy: PlatformModule = {
  musicSearch,
  getLyric,
  songList,
  leaderboard,
};

export default wy;
