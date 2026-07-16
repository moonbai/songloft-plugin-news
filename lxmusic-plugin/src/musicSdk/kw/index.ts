// musicSdk/kw/index.ts - 酷我音乐平台模块
// 运行于 QuickJS 沙箱,禁用 Node.js API,仅用 fetch/setTimeout/Buffer/crypto/zlib/songloft.*

import { httpFetch } from '../request';
import { formatPlayCount } from '../index';
import type {
  SongInfo,
  SearchResult,
  LyricResult,
  SongListItem,
  SongListDetail,
  LeaderboardItem,
  PlatformModule,
} from '../../types';

const platform: 'kw' = 'kw';

// ============ 公共请求头 ============
const COMMON_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Accept-Encoding': 'gzip, deflate',
  'Connection': 'keep-alive',
  'Referer': 'http://www.kuwo.cn/',
};

// 酷我封面图前缀
const ALBUM_PIC_PREFIX = 'http://img1.kuwo.cn/star/album/300/';

// ============ 工具函数 ============

/** 清洗酷我字段中的 &nbsp; 实体 */
function cleanText(s: unknown): string {
  if (s === undefined || s === null) return '';
  return String(s).replace(/&nbsp;/g, ' ').trim();
}

/** 将 mm:ss / mm:ss.xx / 秒数 字符串解析为秒 */
function parseTimeToSeconds(t: unknown): number {
  if (t === undefined || t === null) return 0;
  if (typeof t === 'number') return t;
  const str = String(t).trim();
  if (!str) return 0;
  // mm:ss[.xx]
  const m = str.match(/^(\d+):(\d{1,2})(?:\.(\d+))?$/);
  if (m) {
    const mm = parseInt(m[1], 10) || 0;
    const ss = parseInt(m[2], 10) || 0;
    return mm * 60 + ss;
  }
  const n = parseInt(str, 10);
  return isNaN(n) ? 0 : n;
}

/** 格式化歌词单行: [mm:ss.xx]line */
function formatLrcLine(time: unknown, line: unknown): string {
  const text = line == null ? '' : String(line);
  const t = parseFloat(String(time));
  if (isNaN(t) || t < 0) return text;
  const total = Math.floor(t * 1000);
  const mm = Math.floor(total / 60000)
    .toString()
    .padStart(2, '0');
  const ss = Math.floor((total % 60000) / 1000)
    .toString()
    .padStart(2, '0');
  const xx = Math.floor((total % 1000) / 10)
    .toString()
    .padStart(2, '0');
  return `[${mm}:${ss}.${xx}]${text}`;
}

/** 安全取数字 */
function toNumber(v: unknown, def = 0): number {
  if (v === undefined || v === null) return def;
  const n = typeof v === 'number' ? v : parseInt(String(v), 10);
  return isNaN(n) ? def : n;
}

// ============ 搜索结果映射 ============

/** 搜索 abslist 项 → SongInfo */
function mapSearchSong(item: any): SongInfo {
  const id = String(item.DC_TARGETID || item.MUSICRID || item.id || '');
  const duration = toNumber(item.DURATION, 0);
  let cover = '';
  if (item.web_albumpic_short) {
    cover = ALBUM_PIC_PREFIX + String(item.web_albumpic_short);
  } else if (item.web_artistpic_short) {
    cover = 'http://img1.kuwo.cn/star/star/500/' + String(item.web_artistpic_short);
  } else if (item.albumpic) {
    cover = String(item.albumpic);
  } else if (item.pic) {
    cover = String(item.pic);
  }
  return {
    platform,
    name: cleanText(item.NAME),
    singer: cleanText(item.ARTIST),
    album: cleanText(item.ALBUM),
    duration,
    musicId: id,
    songmid: id,
    cover,
  };
}

// ============ musicSearch ============

const musicSearch = {
  async search(keyword: string, page: number, limit: number): Promise<SearchResult> {
    const pn = Math.max((page || 1) - 1, 0);
    const rn = limit || 20;
    const url = 'http://search.kuwo.cn/r.s';
    const form: Record<string, string> = {
      all: keyword || '',
      ft: 'music',
      itemset: 'web_2013',
      client: 'kt',
      pn: String(pn),
      rn: String(rn),
      rformat: 'json',
      encoding: 'utf8',
      pcurl: 'http://www.kuwo.cn/',
    };

    let songs: SongInfo[] = [];
    let total = 0;

    try {
      const { promise } = httpFetch(url, {
        method: 'POST',
        form,
        headers: COMMON_HEADERS,
        timeout: 15000,
      });
      const resp = await promise;
      const body = (resp.body as any) || {};
      const abslist = body.abslist;
      if (Array.isArray(abslist)) {
        songs = abslist.map((item: any) => mapSearchSong(item));
      }
      total = toNumber(
        body.HITSMATCHTOTAL ?? body.TOTAL ?? body.total ?? body.MUSIC_DANCE,
        songs.length,
      );
    } catch (err) {
      songloft.log.error('[kw] search error:', err);
    }

    return { songs, total, source: platform };
  },
};

// ============ getLyric ============

async function getLyric(songInfo: SongInfo): Promise<LyricResult | null> {
  const musicId = songInfo.musicId || songInfo.songmid;
  if (!musicId) return null;

  const url = `http://m.kuwo.cn/newh5/singles/songinfoandlrc?musicId=${encodeURIComponent(
    String(musicId),
  )}&httpsStatus=1`;

  try {
    const { promise } = httpFetch(url, {
      method: 'GET',
      headers: {
        ...COMMON_HEADERS,
        Referer: 'http://m.kuwo.cn/',
      },
      timeout: 15000,
    });
    const resp = await promise;
    const body = (resp.body as any) || {};
    const data = body.data || {};
    const lrclist = data.lrclist;
    if (!Array.isArray(lrclist) || lrclist.length === 0) {
      return null;
    }
    const lyric = lrclist
      .map((l: any) => formatLrcLine(l.time, l.line))
      .filter((line: string) => line.length > 0)
      .join('\n');
    if (!lyric) return null;
    return { lyric };
  } catch (err) {
    songloft.log.error('[kw] getLyric error:', err);
    return null;
  }
}

// ============ 歌单详情歌曲映射 ============

/** 歌单/榜单 musiclist 项 → SongInfo */
function mapDetailSong(item: any): SongInfo {
  const id = String(item.id || item.DC_TARGETID || item.musicrid || '');
  const duration =
    parseTimeToSeconds(item.songTimeMinutes) ||
    toNumber(item.duration, 0) ||
    toNumber(item.DURATION, 0);
  const cover =
    item.pic || item.albumpic || item.web_albumpic_short
      ? item.pic || item.albumpic || ALBUM_PIC_PREFIX + String(item.web_albumpic_short)
      : '';
  return {
    platform,
    name: cleanText(item.name || item.NAME),
    singer: cleanText(item.artist || item.ARTIST),
    album: cleanText(item.album || item.ALBUM),
    duration,
    musicId: id,
    songmid: id,
    cover,
  };
}

// ============ songList (歌单浏览) ============

const songList = {
  /** 获取歌单标签 */
  async tags(): Promise<unknown> {
    const url =
      'http://wapi.kuwo.cn/api/pc/classify/playlist/getTagList?cmd=rcm_keyword_playlist&user=0&prod=kwplayer_pc_9.0.5.0&vipver=12&level=8&auth=';
    try {
      const { promise } = httpFetch(url, {
        method: 'GET',
        headers: COMMON_HEADERS,
        timeout: 15000,
      });
      const resp = await promise;
      return resp.body;
    } catch (err) {
      songloft.log.error('[kw] songList.tags error:', err);
      return null;
    }
  },

  /** 按标签获取歌单列表 */
  async list(
    tag: string,
    page: number,
    limit: number,
  ): Promise<{ list: SongListItem[]; total: number }> {
    const pn = Math.max((page || 1) - 1, 0);
    const rn = limit || 30;
    const url = `http://wapi.kuwo.cn/api/pc/classify/playlist/getTagPlayList?cmd=rcm_keyword_playlist&user=0&prod=kwplayer_pc_9.0.5.0&vipver=12&level=8&id=${encodeURIComponent(
      tag,
    )}&pn=${pn}&rn=${rn}&`;

    let list: SongListItem[] = [];
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
      const arr = data.data;
      if (Array.isArray(arr)) {
        list = arr.map((item: any) => ({
          id: String(item.id || ''),
          name: cleanText(item.name),
          cover: String(item.img || ''),
          author: cleanText(item.uname),
          playCount: formatPlayCount(toNumber(item.playcnt, 0)),
          total: toNumber(item.total, 0),
        }));
      }
      total = toNumber(data.total, list.length);
    } catch (err) {
      songloft.log.error('[kw] songList.list error:', err);
    }

    return { list, total };
  },

  /** 获取歌单详情 */
  async detail(id: string, page: number): Promise<SongListDetail> {
    const pn = Math.max((page || 1) - 1, 0);
    const url = `http://nplserver.kuwo.cn/pl.svc?op=getlistinfo&pid=${encodeURIComponent(
      id,
    )}&pn=${pn}&rn=100&encode=utf8&keyset=pl2012&identity=kuwo&pcmp4=1&vipver=MUSIC_9.0.5.0&newver=1`;

    let info: SongListDetail['info'] = {
      id: String(id),
      name: '',
      cover: '',
      author: '',
      desc: '',
      total: 0,
    };
    let list: SongInfo[] = [];

    try {
      const { promise } = httpFetch(url, {
        method: 'GET',
        headers: COMMON_HEADERS,
        timeout: 15000,
      });
      const resp = await promise;
      const body = (resp.body as any) || {};
      const pl = body.playlist || {};
      info = {
        id: String(pl.id || id),
        name: cleanText(pl.name),
        cover: String(pl.pic || ''),
        author: cleanText(pl.uname),
        desc: cleanText(pl.intro),
        total: toNumber(pl.total, 0),
      };
      const musiclist = body.musiclist;
      if (Array.isArray(musiclist)) {
        list = musiclist.map((item: any) => mapDetailSong(item));
      }
    } catch (err) {
      songloft.log.error('[kw] songList.detail error:', err);
    }

    return { info, list };
  },
};

// ============ 默认榜单 (API 失败时兜底) ============
const DEFAULT_BOARDS: LeaderboardItem[] = [
  { id: '93', name: '酷我飙升榜', cover: '' },
  { id: '17', name: '酷我热歌榜', cover: '' },
  { id: '16', name: '酷我新歌榜', cover: '' },
  { id: '158', name: '抖音热歌榜', cover: '' },
  { id: '285', name: '古风金曲榜', cover: '' },
  { id: '21', name: '欧美金曲榜', cover: '' },
  { id: '26', name: '经典金曲榜', cover: '' },
  { id: '32', name: '影视金曲榜', cover: '' },
  { id: '271', name: '网络红歌榜', cover: '' },
  { id: '286', name: '摇滚榜', cover: '' },
];

// ============ leaderboard (排行榜) ============

const leaderboard = {
  /** 获取所有榜单 */
  async boards(): Promise<LeaderboardItem[]> {
    const url = 'http://wapi.kuwo.cn/api/pc/bang/bangList?prod=kwplayer_pc_9.0.5.0&vipver=12';
    try {
      const { promise } = httpFetch(url, {
        method: 'GET',
        headers: COMMON_HEADERS,
        timeout: 15000,
      });
      const resp = await promise;
      const body = (resp.body as any) || {};
      const arr = body?.data?.list;
      if (Array.isArray(arr) && arr.length > 0) {
        return arr.map((item: any) => ({
          id: String(item.id || ''),
          name: cleanText(item.name),
          cover: String(item.pic || ''),
        }));
      }
    } catch (err) {
      songloft.log.error('[kw] leaderboard.boards error:', err);
    }
    return DEFAULT_BOARDS;
  },

  /** 获取榜单歌曲列表 */
  async list(
    id: string,
    page: number,
    limit: number,
  ): Promise<{ list: SongInfo[]; total: number }> {
    const pn = Math.max((page || 1) - 1, 0);
    const rn = limit || 30;
    const url = `http://kbangserver.kuwo.cn/ksong.svc?act=bang&bc=${encodeURIComponent(
      id,
    )}&pn=${pn}&rn=${rn}&mobi=1`;

    let list: SongInfo[] = [];
    let total = 0;

    try {
      const { promise } = httpFetch(url, {
        method: 'GET',
        headers: COMMON_HEADERS,
        timeout: 15000,
      });
      const resp = await promise;
      const body = (resp.body as any) || {};
      const musiclist = body.musiclist;
      if (Array.isArray(musiclist)) {
        list = musiclist.map((item: any) => mapDetailSong(item));
      }
      total = toNumber(body.total ?? body.TOTAL ?? body.MUSIC_DANCE, list.length);
    } catch (err) {
      songloft.log.error('[kw] leaderboard.list error:', err);
    }

    return { list, total };
  },
};

// ============ 平台模块导出 ============

const kw: PlatformModule = {
  musicSearch,
  getLyric,
  songList,
  leaderboard,
};

export default kw;
