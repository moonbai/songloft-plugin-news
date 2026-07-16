// musicSdk/kg/index.ts - 酷狗音乐平台模块
// 运行于 QuickJS 沙箱,禁用 Node.js API,仅用 fetch/setTimeout/Buffer/crypto/zlib/songloft.*

import { httpFetch } from '../request';
import { md5 } from '../crypto-shim';
import { decodeName, formatPlayCount } from '../index';
import type {
  SongInfo,
  SearchResult,
  LyricResult,
  SongListItem,
  SongListDetail,
  LeaderboardItem,
  PlatformModule,
} from '../../types';

const platform: 'kg' = 'kg';

// ============ 公共请求头 ============
const COMMON_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0',
  'Referer': 'http://m.kugou.com',
};

// ============ 工具函数 ============

/** 安全取数字 */
function toNumber(v: unknown, def = 0): number {
  if (v === undefined || v === null) return def;
  const n = typeof v === 'number' ? v : parseInt(String(v), 10);
  return isNaN(n) ? def : n;
}

/** 清洗酷狗封面图 url 中的 {size} 占位 */
function formatCover(url: unknown): string | undefined {
  if (url === undefined || url === null || url === '') return undefined;
  return String(url).replace('{size}', '400');
}

/** 解析 "歌手 - 歌名" 格式 filename */
function parseFilename(filename: unknown): { singer: string; name: string } {
  if (filename === undefined || filename === null) return { singer: '', name: '' };
  const name = decodeName(String(filename));
  const idx = name.indexOf(' - ');
  if (idx > -1) {
    return {
      singer: name.substring(0, idx).trim(),
      name: name.substring(idx + 3).trim(),
    };
  }
  return { singer: '', name };
}

/** 把 filename 类型的歌曲项映射为 SongInfo (用于歌单详情 / 榜单) */
function mapFilenameSong(item: any): SongInfo {
  const parsed = parseFilename(item.filename);
  const hash = String(item.hash || '');
  const albumId = String(item.album_id || '');
  return {
    platform,
    name: parsed.name,
    singer: parsed.singer,
    hash,
    albumId,
    songmid: hash,
    musicId: hash,
    duration: toNumber(item.duration, 0),
  };
}

// ============ 搜索结果映射 ============

/** 搜索 info 项 → SongInfo */
function mapSearchSong(item: any): SongInfo {
  const hash = String(item.hash || '');
  const albumId = String(item.album_id || '');
  return {
    platform,
    name: decodeName(String(item.songname || '')),
    singer: decodeName(String(item.singername || '')),
    album: decodeName(String(item.album_name || '')),
    duration: toNumber(item.duration, 0),
    hash,
    albumId,
    songmid: hash,
    musicId: hash,
  };
}

// ============ musicSearch ============

const musicSearch = {
  async search(keyword: string, page: number, limit: number): Promise<SearchResult> {
    const pg = page || 1;
    const size = limit || 20;
    const url =
      'http://msearchcdn.kugou.com/api/v3/search/song?keyword=' +
      encodeURIComponent(keyword || '') +
      '&page=' + pg +
      '&pagesize=' + size +
      '&showtype=10&format=json';

    let songs: SongInfo[] = [];
    let total = 0;

    try {
      const { promise } = httpFetch(url, {
        method: 'GET',
        headers: COMMON_HEADERS,
        timeout: 15000,
      });
      const resp = await promise;
      const body = (resp.body as any) || {};
      const data = body.data || {};
      const info = data.info;
      if (Array.isArray(info)) {
        songs = info
          .map((item: any) => mapSearchSong(item))
          .filter((s: SongInfo) => s.hash);
      }
      total = toNumber(data.total, songs.length);
    } catch (err) {
      songloft.log.error('[kg] search error:', err);
    }

    return { songs, total, source: platform };
  },
};

// ============ getLyric ============

async function getLyric(songInfo: SongInfo): Promise<LyricResult | null> {
  const hash = String(songInfo.hash || '');
  if (!hash) return null;

  const name = songInfo.name || '';
  const singer = songInfo.singer || '';
  const duration = toNumber(songInfo.duration, 0);
  const albumId = String(songInfo.albumId || '');

  // 主:直接请求 krc.php 拿 LRC 文本
  try {
    const keyword = encodeURIComponent(name + '-' + singer);
    const url =
      'http://m.kugou.com/app/i/krc.php?keyword=' + keyword +
      '&duration=' + (duration * 1000) +
      '&hash=' + hash +
      '&cmd=100&timelength=1000';
    const { promise } = httpFetch(url, {
      method: 'GET',
      headers: COMMON_HEADERS,
      timeout: 15000,
    });
    const resp = await promise;
    let lyric = '';
    if (typeof resp.body === 'string') {
      lyric = resp.body;
    } else if (resp.body && typeof resp.body === 'object') {
      const b = resp.body as any;
      lyric = String(b.content || b.lyric || b.lyrics || '');
    }
    lyric = lyric.trim();
    if (lyric) {
      return { lyric };
    }
  } catch (err) {
    songloft.log.error('[kg] getLyric krc error:', err);
  }

  // 备:先通过 trackercdn 取歌词地址,再请求
  try {
    const key = md5(hash + 'kgcloudv2');
    const url =
      'http://trackercdn.kugou.com/i/v2/?key=' + key +
      '&hash=' + hash +
      '&br=hq&appid=1005&pid=2&cmd=25&behavior=play&album_id=' + encodeURIComponent(albumId);
    const { promise } = httpFetch(url, {
      method: 'GET',
      headers: COMMON_HEADERS,
      timeout: 15000,
    });
    const resp = await promise;
    const body = (resp.body as any) || {};
    const candidates = [
      body.url,
      body.lyrics,
      body.lyric,
      body.data && body.data.url,
      body.data && body.data.lyrics,
      body.data && body.data.lyric,
    ];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.indexOf('http') === 0) {
        const { promise: promise2 } = httpFetch(candidate, {
          method: 'GET',
          headers: COMMON_HEADERS,
          timeout: 15000,
        });
        const resp2 = await promise2;
        let lyric = '';
        if (typeof resp2.body === 'string') {
          lyric = resp2.body;
        } else if (resp2.body && typeof resp2.body === 'object') {
          lyric = String((resp2.body as any).content || (resp2.body as any).lyric || '');
        }
        lyric = lyric.trim();
        if (lyric) {
          return { lyric };
        }
      }
    }
  } catch (err) {
    songloft.log.error('[kg] getLyric trackercdn error:', err);
  }

  return null;
}

// ============ songList (歌单浏览) ============

const songList = {
  async tags(): Promise<unknown> {
    try {
      const url = 'http://m.kugou.com/plist/index?json=true';
      const { promise } = httpFetch(url, {
        method: 'GET',
        headers: COMMON_HEADERS,
        timeout: 15000,
      });
      const resp = await promise;
      const body = (resp.body as any) || {};
      const tagList = body.tag && body.tag.list;
      if (Array.isArray(tagList) && tagList.length > 0) {
        const tags = tagList
          .map((item: any) => ({
            id: String(item.kind || item.id || ''),
            name: String(item.name || ''),
          }))
          .filter((t: any) => t.id);
        if (tags.length > 0) return tags;
      }
    } catch (err) {
      songloft.log.error('[kg] songList.tags error:', err);
    }
    return [
      { id: 'hot', name: '热门' },
      { id: 'new', name: '最新' },
    ];
  },

  async list(
    tag: string,
    page: number,
    limit: number,
  ): Promise<{ list: SongListItem[]; total: number }> {
    const pg = page || 1;
    const size = limit || 20;
    const url =
      'http://m.kugou.com/plist/list?tag=' + encodeURIComponent(tag || '') +
      '&page=' + pg +
      '&pagesize=' + size +
      '&json=true';

    let result: SongListItem[] = [];
    let total = 0;

    try {
      const { promise } = httpFetch(url, {
        method: 'GET',
        headers: COMMON_HEADERS,
        timeout: 15000,
      });
      const resp = await promise;
      const body = (resp.body as any) || {};
      const plist = body.plist || {};
      const listWrap = plist.list || {};
      const info = listWrap.info;
      if (Array.isArray(info)) {
        result = info
          .map((item: any) => ({
            id: String(item.specialid || ''),
            name: decodeName(String(item.specialname || '')),
            cover: formatCover(item.imgurl),
            author: String(item.username || ''),
            playCount: formatPlayCount(toNumber(item.playcount, 0)),
            total: toNumber(item.songcount, 0),
          }))
          .filter((s: SongListItem) => s.id);
      }
      total = toNumber(plist.total, result.length);
    } catch (err) {
      songloft.log.error('[kg] songList.list error:', err);
    }

    return { list: result, total };
  },

  async detail(id: string, page: number): Promise<SongListDetail> {
    const pg = page || 1;
    const url =
      'http://m.kugou.com/plist/special/' + encodeURIComponent(id || '') +
      '?page=' + pg +
      '&pagesize=100&json=true';

    let songs: SongInfo[] = [];
    let plInfo: any = {};
    let total = 0;

    try {
      const { promise } = httpFetch(url, {
        method: 'GET',
        headers: COMMON_HEADERS,
        timeout: 15000,
      });
      const resp = await promise;
      const body = (resp.body as any) || {};

      // 歌单元信息 (plist/special 把元信息放在 info 对象里)
      if (body.info && !Array.isArray(body.info)) {
        plInfo = body.info;
      }

      // 歌曲列表:兼容多种返回结构
      let infoArr: any[] | undefined;
      if (body.list && Array.isArray(body.list.info)) {
        infoArr = body.list.info;
        total = toNumber(body.list.total, 0);
      } else if (Array.isArray(body.info)) {
        infoArr = body.info;
      } else if (body.data && Array.isArray(body.data.info)) {
        infoArr = body.data.info;
        total = toNumber(body.data.total, 0);
      } else if (body.plist && body.plist.info && Array.isArray(body.plist.info)) {
        infoArr = body.plist.info;
      }

      if (infoArr) {
        songs = infoArr
          .map((item: any) => mapFilenameSong(item))
          .filter((s: SongInfo) => s.hash);
      }
      if (!total) total = toNumber(body.total, songs.length);
    } catch (err) {
      songloft.log.error('[kg] songList.detail error:', err);
    }

    return {
      info: {
        id: String(plInfo.specialid || id || ''),
        name: plInfo.specialname ? decodeName(String(plInfo.specialname)) : '',
        cover: formatCover(plInfo.imgurl),
        author: String(plInfo.username || ''),
        desc: String(plInfo.intro || ''),
        total,
      },
      list: songs,
    };
  },
};

// ============ leaderboard (排行榜) ============

const leaderboard = {
  async boards(): Promise<LeaderboardItem[]> {
    try {
      const url = 'http://m.kugou.com/rank/list?json=true';
      const { promise } = httpFetch(url, {
        method: 'GET',
        headers: COMMON_HEADERS,
        timeout: 15000,
      });
      const resp = await promise;
      const body = (resp.body as any) || {};
      const rankList = body.rank && body.rank.list;
      if (Array.isArray(rankList) && rankList.length > 0) {
        const boards = rankList
          .map((item: any) => ({
            id: String(item.rankid || ''),
            name: String(item.rankname || ''),
            cover: formatCover(item.imgurl),
            intro: String(item.intro || ''),
          }))
          .filter((b: LeaderboardItem) => b.id);
        if (boards.length > 0) return boards;
      }
    } catch (err) {
      songloft.log.error('[kg] leaderboard.boards error:', err);
    }
    return [
      { id: '8888', name: '酷狗TOP500' },
      { id: '23784', name: '飙升榜' },
      { id: '24971', name: '网络红歌' },
    ];
  },

  async list(
    id: string,
    page: number,
    limit: number,
  ): Promise<{ list: SongInfo[]; total: number }> {
    const pg = page || 1;
    const size = limit || 20;
    const url =
      'http://m.kugou.com/rank/info?rankid=' + encodeURIComponent(id || '') +
      '&page=' + pg +
      '&pagesize=' + size +
      '&json=true';

    let result: SongInfo[] = [];
    let total = 0;

    try {
      const { promise } = httpFetch(url, {
        method: 'GET',
        headers: COMMON_HEADERS,
        timeout: 15000,
      });
      const resp = await promise;
      const body = (resp.body as any) || {};
      const songs = body.songs || {};
      const info = songs.info;
      if (Array.isArray(info)) {
        result = info
          .map((item: any) => mapFilenameSong(item))
          .filter((s: SongInfo) => s.hash);
      }
      total = toNumber(songs.total, result.length);
    } catch (err) {
      songloft.log.error('[kg] leaderboard.list error:', err);
    }

    return { list: result, total };
  },
};

// ============ 平台模块导出 ============

const kg: PlatformModule = {
  musicSearch,
  getLyric,
  songList,
  leaderboard,
};

export default kg;
