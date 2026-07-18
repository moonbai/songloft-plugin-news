// 聚合热搜 - 多平台热榜聚合（去重 + 归一化排序 + TTL 缓存）
import { platformModules } from './newsSdk/facade';

const PLATFORMS = ['baidu', 'weibo', 'zhihu', 'wangyi', 'toutiao', '36kr', 'pengpai', 'ximalaya', 'dedao'];

// TTL 缓存：热榜更新频率分钟级，60s 缓存避免每次请求都全量抓取 9 站
const CACHE_TTL_MS = 60 * 1000;
const cache = new Map<string, { data: unknown; expireAt: number }>();

export async function getAggregatedHotboard(
  limit: number,
  normalizeTitle: (title: string) => string,
  sourceNames: Record<string, string>,
): Promise<{ news: any[]; bySource: any[] }> {
  const cacheKey = `agg_hotboard:${limit}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expireAt > Date.now()) {
    return cached.data as { news: any[]; bySource: any[] };
  }

  const perPlatformLimit = Math.max(limit, 20); // 每个平台多取一些用于去重后仍有足够数据

  const promises = PLATFORMS.map(async (source) => {
    try {
      const module = platformModules[source];
      if (!module?.hotboard) return { source, news: [] };
      const boards = await module.hotboard.boards();
      if (!boards || boards.length === 0) return { source, news: [] };
      const result = await module.hotboard.list(boards[0].id, 1, perPlatformLimit);
      const news = result.news || [];
      // 平台内归一化：按 hot 值在该平台内的百分位计算 hotLevel (0-100)
      const maxHot = news.reduce((mx: number, n: any) => Math.max(mx, Number(n.hot || 0)), 0);
      const normalized = news.map((n: any) => ({
        ...n,
        hotLevel: maxHot > 0 ? Math.round((Number(n.hot || 0) / maxHot) * 100) : 0,
        sources: [source],
      }));
      return { source, news: normalized };
    } catch (e) {
      songloft.log.error('aggregate/hotboard: ' + source + ' failed: ' + (e as Error).message);
      return { source, news: [], error: String(e) };
    }
  });

  const results = await Promise.all(promises);

  // 合并所有平台的新闻，标题去重
  const dedupMap = new Map<string, any>();
  for (const { source, news } of results) {
    for (const item of news) {
      if (!item.title) continue;
      const key = normalizeTitle(item.title);
      if (!key) continue;

      const existing = dedupMap.get(key);
      if (existing) {
        // 已存在：合并来源，取最高 hotLevel，热度叠加
        existing.sources.push(source);
        existing.hotLevel = Math.max(existing.hotLevel, item.hotLevel);
        existing.hotCount = (existing.hotCount || 1) + 1;
        // 保留信息更完整的一条（有摘要/封面的优先）
        if ((!existing.summary && item.summary) || (!existing.cover && item.cover)) {
          existing.summary = existing.summary || item.summary;
          existing.cover = existing.cover || item.cover;
          existing.url = existing.url || item.url;
        }
      } else {
        dedupMap.set(key, { ...item, hotCount: 1 });
      }
    }
  }

  // 转数组，计算综合热度：hotLevel * (1 + 0.15 * (hotCount-1))
  // 多平台同时上榜说明热度高，给予加成
  const merged = Array.from(dedupMap.values()).map((item: any) => {
    const multiSourceBonus = 1 + 0.15 * (item.hotCount - 1);
    const names = (item.sources || [item.source]).map((s: string) => sourceNames[s] || s);
    return {
      ...item,
      source: item.sources ? item.sources[0] : item.source, // 主来源
      sourceName: names.join('/'), // 显示所有来源
      sourceNames: names, // 原始数组供前端使用
      combinedHot: Math.round(item.hotLevel * multiSourceBonus),
    };
  });

  // 按综合热度降序
  merged.sort((a, b) => b.combinedHot - a.combinedHot);

  // 截取 limit 条
  const top = merged.slice(0, limit);

  songloft.log.info('aggregate/hotboard: merged=' + merged.length + ' top=' + top.length);

  const data = { news: top, bySource: results };
  cache.set(cacheKey, { data, expireAt: Date.now() + CACHE_TTL_MS });
  return data;
}
