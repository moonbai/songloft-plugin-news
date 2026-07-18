// 聚合热搜 - 多平台热榜聚合（去重 + 归一化排序 + TTL 缓存）
import { platformModules } from './newsSdk/facade';

const PLATFORM_CONFIG: Record<string, {
  weight: number;
  category: string;
  enabled: boolean;
}> = {
  weibo:     { weight: 1.0, category: 'social',   enabled: true  },
  baidu:     { weight: 0.95, category: 'general',  enabled: true  },
  zhihu:     { weight: 0.9,  category: 'knowledge', enabled: true },
  toutiao:   { weight: 0.85, category: 'general',  enabled: true  },
  '36kr':    { weight: 0.85, category: 'tech',     enabled: true  },
  ithome:    { weight: 0.85, category: 'tech',     enabled: true  },
  juejin:    { weight: 0.8,  category: 'tech',     enabled: true  },
  huxiu:     { weight: 0.8,  category: 'business', enabled: true  },
  sspai:     { weight: 0.75, category: 'tech',     enabled: true  },
  pengpai:   { weight: 0.75, category: 'news',     enabled: true  },
  wangyi:    { weight: 0.7,  category: 'news',     enabled: true  },
  ximalaya:  { weight: 0.5,  category: 'audio',    enabled: false },
  dedao:     { weight: 0.5,  category: 'knowledge', enabled: false },
  cctv:      { weight: 0.85, category: 'audio',    enabled: true  },
  cnr:       { weight: 0.8,  category: 'audio',    enabled: true  },
  people:    { weight: 0.8,  category: 'audio',    enabled: true  },
};

const CATEGORY_NAMES: Record<string, string> = {
  all:       '全部',
  social:    '社交',
  general:   '综合',
  news:      '新闻',
  tech:      '科技',
  business:  '财经商业',
  knowledge: '知识',
  audio:     '音频',
};

const CACHE_TTL_MS = 60 * 1000;
const cache = new Map<string, { data: unknown; expireAt: number }>();

interface AggregatedNews {
  id: string;
  title: string;
  url: string;
  source: string;
  sourceName: string;
  sourceNames: string[];
  sources: string[];
  summary?: string;
  cover?: string;
  publishTime: number;
  hot: number;
  hotLevel: number;
  combinedHot: number;
  hotCount: number;
  category: string;
}

export async function getAggregatedHotboard(
  limit: number,
  normalizeTitle: (title: string) => string,
  sourceNames: Record<string, string>,
  category: string = 'all',
): Promise<{
  news: AggregatedNews[];
  bySource: { source: string; news: any[]; error?: string }[];
  categories: { id: string; name: string }[];
  totalMerged: number;
}> {
  const cacheKey = `agg_hotboard:${limit}:${category}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expireAt > Date.now()) {
    return cached.data as any;
  }

  const perPlatformLimit = Math.max(limit * 2, 30);

  const enabledPlatforms = Object.entries(PLATFORM_CONFIG)
    .filter(([, cfg]) => cfg.enabled)
    .map(([id]) => id);

  const promises = enabledPlatforms.map(async (source) => {
    try {
      const module = platformModules[source];
      if (!module?.hotboard) return { source, news: [] };
      const boards = await module.hotboard.boards();
      if (!boards || boards.length === 0) return { source, news: [] };
      const result = await module.hotboard.list(boards[0].id, 1, perPlatformLimit);
      const news = result.news || [];
      const maxHot = news.reduce((mx: number, n: any) => Math.max(mx, Number(n.hot || 0)), 0);
      const cfg = PLATFORM_CONFIG[source];
      const normalized = news.map((n: any, idx: number) => ({
        ...n,
        hotLevel: maxHot > 0
          ? Math.round((Number(n.hot || 0) / maxHot) * 100)
          : Math.max(0, 100 - idx * 2),
        sources: [source],
        rank: idx + 1,
        category: cfg.category,
        platformWeight: cfg.weight,
      }));
      return { source, news: normalized };
    } catch (e) {
      songloft.log.error('aggregate/hotboard: ' + source + ' failed: ' + (e as Error).message);
      return { source, news: [], error: String(e) };
    }
  });

  const results = await Promise.all(promises);

  const dedupMap = new Map<string, any>();
  for (const { source, news } of results) {
    for (const item of news) {
      if (!item.title) continue;
      const key = normalizeTitle(item.title);
      if (!key) continue;

      const existing = dedupMap.get(key);
      if (existing) {
        existing.sources.push(source);
        const newHotLevel = item.hotLevel * item.platformWeight;
        const oldHotLevel = existing.hotLevel * existing.platformWeight;
        if (newHotLevel > oldHotLevel) {
          existing.hotLevel = item.hotLevel;
          existing.platformWeight = item.platformWeight;
          existing.summary = existing.summary || item.summary;
          existing.cover = existing.cover || item.cover;
          existing.url = item.url || existing.url;
          existing.id = item.id;
          existing.source = source;
          existing.publishTime = item.publishTime || existing.publishTime;
        }
        existing.hotCount = (existing.hotCount || 1) + 1;
        const existingCats = new Set(existing.categories || [existing.category]);
        existingCats.add(item.category);
        existing.categories = Array.from(existingCats);
      } else {
        dedupMap.set(key, {
          ...item,
          hotCount: 1,
          categories: [item.category],
        });
      }
    }
  }

  const merged = Array.from(dedupMap.values()).map((item: any) => {
    const hotCountBonus = 1 + 0.2 * (item.hotCount - 1);
    const weightedHot = item.hotLevel * item.platformWeight * hotCountBonus;
    const names = (item.sources || [item.source]).map((s: string) => sourceNames[s] || s);
    const primaryCategory = determinePrimaryCategory(item.categories || [item.category]);
    return {
      ...item,
      source: item.sources ? item.sources[0] : item.source,
      sourceName: names.join('/'),
      sourceNames: names,
      combinedHot: Math.round(weightedHot * 100) / 100,
      category: primaryCategory,
    };
  });

  merged.sort((a, b) => b.combinedHot - a.combinedHot);

  const categories = buildCategoryList(merged);

  let filtered = merged;
  if (category && category !== 'all') {
    filtered = merged.filter((n: any) =>
      n.categories?.includes(category) || n.category === category
    );
  }

  const top = filtered.slice(0, limit);

  songloft.log.info(
    'aggregate/hotboard: total=' + merged.length +
    ' filtered=' + filtered.length +
    ' top=' + top.length +
    ' category=' + category
  );

  const data = {
    news: top,
    bySource: results,
    categories,
    totalMerged: merged.length,
  };

  cache.set(cacheKey, { data, expireAt: Date.now() + CACHE_TTL_MS });
  return data;
}

function determinePrimaryCategory(categories: string[]): string {
  if (categories.length === 0) return 'general';
  const priority = ['news', 'social', 'tech', 'business', 'knowledge', 'general', 'audio'];
  for (const p of priority) {
    if (categories.includes(p)) return p;
  }
  return categories[0];
}

function buildCategoryList(allNews: any[]): { id: string; name: string }[] {
  const catCounts = new Map<string, number>();
  for (const n of allNews) {
    const cats = n.categories || [n.category];
    for (const c of cats) {
      catCounts.set(c, (catCounts.get(c) || 0) + 1);
    }
  }
  const result = [{ id: 'all', name: '全部 (' + allNews.length + ')' }];
  const sorted = Array.from(catCounts.entries())
    .sort((a, b) => b[1] - a[1]);
  for (const [id, count] of sorted) {
    result.push({
      id,
      name: (CATEGORY_NAMES[id] || id) + ' (' + count + ')',
    });
  }
  return result;
}
