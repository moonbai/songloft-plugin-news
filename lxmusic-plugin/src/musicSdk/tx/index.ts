// musicSdk/tx/index.ts - QQ 音乐 (QQ音乐) 平台模块
// 运行于 QuickJS 沙箱,仅可用 fetch / setTimeout / Buffer / crypto / zlib / songloft.*
// 不使用任何 node.js API,不使用 require

import { httpFetch } from '../request';
import { base64Decode } from '../crypto-shim';
import type {
  SongInfo,
  SearchResult,
  LyricResult,
  SongListItem,
  SongListDetail,
  LeaderboardItem,
  PlatformModule,
} from '../../types';

const platform = 'tx' as const;

const MUSIC_U_URL = 'https://u.y.qq.com/cgi-bin/musicu.fcg';
const LYRIC_URL = 'https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg';

const REQ_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  'User-Agent': 'Mozilla/5.0',
  'Referer': 'https://y.qq.com/',
};

/** 通用 musicu.fcg POST 请求 (body 为对象,顶层每个 key 即一个模块请求) */
async function musicuRequest(body: Record<string, unknown>, timeout = 15000): Promise<any> {
  const { promise } = httpFetch(MUSIC_U_URL, {
    method: 'POST',
    headers: REQ_HEADERS,
    body,
    timeout,
  });
  const resp = await promise;
  if (resp.statusCode !== 200) {
    throw new Error(`tx musicu request failed: ${resp.statusCode}`);
  }
  return resp.body as any;
}

/** 将 QQ 音乐歌曲对象映射为 SongInfo (兼容搜索/榜单/歌单字段命名差异) */
function mapSong(raw: any): SongInfo | null {
  if (!raw) return null;

  const singersRaw = raw.singer || raw.artists || [];
  const singers: any[] = Array.isArray(singersRaw) ? singersRaw : [];
  const album = raw.album || {};
  const file = raw.file || {};

  const name = raw.name || raw.songname || raw.title || '';
  if (!name) return null;

  const interval = Number(raw.interval ?? raw.duration ?? 0);

  return {
    platform,
    name,
    singer: singers.map((s: any) => s.name).filter(Boolean).join(' / '),
    album: album.name || raw.albumname || '',
    duration: interval > 0 ? interval : undefined,
    songmid: raw.mid || raw.songmid || '',
    musicId: String(raw.id ?? raw.songid ?? ''),
    strMediaMid: file.media_mid || raw.strMediaMid || '',
    albumMid: album.mid || raw.albummid || '',
  };
}

// ============ 搜索 ============

async function search(keyword: string, page: number, limit: number): Promise<SearchResult> {
  const key = 'music.Search.SearchCgiService';
  const body = {
    [key]: {
      module: 'music.search.SearchCgiService',
      method: 'DoSearchForQQMusicDesktop',
      param: {
        query: keyword,
        page_num: page,
        num_per_page: limit,
        search_type: 0,
      },
    },
  };

  const data = await musicuRequest(body);
  const songData = data?.[key]?.data?.body?.song;
  const list: any[] = songData?.list || [];
  const total = Number(songData?.total_song_num ?? list.length) || 0;

  const songs: SongInfo[] = [];
  for (const raw of list) {
    const info = mapSong(raw);
    if (info) songs.push(info);
  }

  return { songs, total, source: platform };
}

// ============ 歌词 ============

async function getLyric(songInfo: SongInfo): Promise<LyricResult | null> {
  const songmid = songInfo.songmid || songInfo.musicId || '';
  if (!songmid) return null;

  const timestamp = Date.now();
  const url =
    `${LYRIC_URL}?songmid=${encodeURIComponent(songmid)}` +
    `&pcachetime=${timestamp}&g_tk=5381&format=json&inCharset=utf8&outCharset=utf-8`;

  const { promise } = httpFetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://y.qq.com/' },
    timeout: 15000,
  });
  const resp = await promise;
  if (resp.statusCode !== 200) return null;

  const data = resp.body as any;
  const lyricB64 = data?.lyric;
  const transB64 = data?.trans || data?.transname;

  let lyric = '';
  let tlyric = '';
  try {
    if (lyricB64) lyric = base64Decode(lyricB64);
  } catch { /* base64 解码失败则忽略 */ }
  try {
    if (transB64) tlyric = base64Decode(transB64);
  } catch { /* 翻译解码失败则忽略 */ }

  if (!lyric) return null;

  const result: LyricResult = { lyric };
  if (tlyric) result.tlyric = tlyric;
  return result;
}

// ============ 歌单 ============

/** 歌单分类标签 */
async function getSongListTags(): Promise<unknown> {
  const body = {
    comm: { ct: 24 },
    recomPlaylist: { method: 'get_playlist_category', param: {} },
  };
  const data = await musicuRequest(body);
  return (data as any)?.recomPlaylist?.data || (data as any)?.recomPlaylist || [];
}

/** 按分类获取歌单列表 */
async function getSongListList(
  tag: string,
  page: number,
  limit: number,
): Promise<{ list: SongListItem[]; total: number }> {
  const tagId = Number(tag) || 10000000; // 10000000 = 热门
  const body = {
    comm: { ct: 24 },
    playlist: {
      method: 'get_playlist_by_category',
      param: {
        id: tagId,
        curPage: page - 1,
        size: limit,
      },
    },
  };

  const data = await musicuRequest(body);
  const plData = (data as any)?.playlist?.data;
  const arr: any[] = plData?.v_playlist || [];
  const total = Number(plData?.total ?? plData?.total_song_num ?? arr.length) || arr.length;

  const list: SongListItem[] = arr.map((item: any) => ({
    id: String(item.dirId ?? item.dirid ?? item.dissid ?? item.tid ?? ''),
    name: item.title || item.dirName || item.name || '',
    cover: item.picurl || item.picUrl || item.imgurl || '',
    author: item.creator?.name || item.creatorName || '',
    total: Number(item.songNum ?? item.songnum ?? 0) || undefined,
    playCount: '',
  }));

  return { list, total };
}

/** 获取歌单详情 (含歌曲列表) */
async function getSongListDetail(id: string, page: number): Promise<SongListDetail> {
  const size = 100;
  const begin = (page - 1) * size;
  const body = {
    comm: { ct: 24 },
    playlist: {
      method: 'get_playlist_info',
      param: {
        dirid: Number(id) || id,
        song_num: size,
        song_begin: begin,
      },
    },
  };

  const data = await musicuRequest(body);
  const plData = (data as any)?.playlist?.data;
  const dirinfo = plData?.dirinfo || {};
  const songlist: any[] = plData?.songlist || [];

  const list: SongInfo[] = [];
  for (const raw of songlist) {
    const info = mapSong(raw);
    if (info) list.push(info);
  }

  return {
    info: {
      id: String(dirinfo.id ?? dirinfo.dirId ?? id),
      name: dirinfo.title || dirinfo.name || '',
      cover: dirinfo.picurl || dirinfo.picUrl || '',
      author: dirinfo.creator?.name || '',
      desc: dirinfo.desc || '',
      total: Number(dirinfo.songnum ?? songlist.length) || undefined,
    },
    list,
  };
}

// ============ 排行榜 ============

/** 获取所有排行榜 */
async function getLeaderboardBoards(): Promise<LeaderboardItem[]> {
  const body = {
    comm: { ct: 24 },
    topList: { module: 'musicTopList.TopListInfoServer', method: 'GetAllTop', param: {} },
  };
  const data = await musicuRequest(body);
  const arr: any[] = (data as any)?.topList?.data?.List || [];

  return arr.map((item: any) => ({
    id: String(item.topId ?? item.topid ?? ''),
    name: item.title || item.name || '',
    cover: item.picUrl || item.picurl || '',
    intro: item.intro || '',
  }));
}

/** 获取排行榜歌曲列表 */
async function getLeaderboardList(
  id: string,
  page: number,
  limit: number,
): Promise<{ list: SongInfo[]; total: number }> {
  const body = {
    comm: { ct: 24 },
    topList: {
      module: 'musicTopList.TopListInfoServer',
      method: 'GetDetail',
      param: {
        topId: String(id),
        offset: (page - 1) * limit,
        num: limit,
      },
    },
  };

  const data = await musicuRequest(body);
  const td = (data as any)?.topList?.data;
  const songInfoList: any[] = td?.songInfoList || td?.data?.songInfoList || td?.List || [];

  const list: SongInfo[] = [];
  for (const raw of songInfoList) {
    // 榜单歌曲可能直接展开,也可能嵌套在 song 字段下
    const info = mapSong(raw.song || raw);
    if (info) list.push(info);
  }

  const total = Number(td?.total ?? td?.song_total ?? list.length) || list.length;
  return { list, total };
}

// ============ 模块导出 ============

const tx: PlatformModule = {
  musicSearch: { search },
  getLyric,
  songList: {
    tags: getSongListTags,
    list: getSongListList,
    detail: getSongListDetail,
  },
  leaderboard: {
    boards: getLeaderboardBoards,
    list: getLeaderboardList,
  },
};

export default tx;
export { tx, search, getLyric, getSongListTags, getSongListList, getSongListDetail, getLeaderboardBoards, getLeaderboardList };
