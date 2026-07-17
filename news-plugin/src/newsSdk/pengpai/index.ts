import httpFetch from '../request';
import type { NewsItem, CategoryItem } from '../../types';
import type { NewsListResult, NewsDetailResult, NewsSearchResult, PlatformModule } from '../types';

function normalizeArticle(article: any): NewsItem {
  return {
    id: String(article.contId || article.cont_id || article.id || ''),
    title: String(article.name || article.title || ''),
    url: String(article.shareurl || article.url || article.shareUrl || ''),
    source: 'pengpai',
    sourceName: '澎湃新闻',
    category: article.column || '',
    author: article.source || article.media || '',
    publishTime: Number(article.publishTime || article.pubTime || Date.now()),
    summary: String(article.digest || article.summary || ''),
    cover: String(article.pic || article.bigPic || article.thumb || ''),
    hot: Number(article.pv || article.readCount || 0),
  };
}

const newsList = {
  async list(category: string, page: number, limit: number): Promise<NewsListResult> {
    const url = `https://www.thepaper.cn/load_index.jsp?nodeids=${category || '25950'}&pageIdx=${page}&topCids=&parentCid=&pageSize=${limit}&actionType=`;
    const resp = await httpFetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.thepaper.cn/',
      },
    });
    const data = resp.body as any;
    const news = ((data?.data?.list as any[]) || []).map(normalizeArticle);
    return { news, hasMore: news.length >= limit };
  },

  async categories(): Promise<CategoryItem[]> {
    return [
      { id: '25950', name: '要闻', source: 'pengpai' },
      { id: '26916', name: '时事', source: 'pengpai' },
      { id: '25951', name: '财经', source: 'pengpai' },
      { id: '25952', name: '科技', source: 'pengpai' },
      { id: '25953', name: '思想', source: 'pengpai' },
      { id: '25954', name: '生活', source: 'pengpai' },
    ];
  },
};

const newsDetail = {
  async detail(id: string): Promise<NewsDetailResult | null> {
    const url = `https://www.thepaper.cn/newsDetail_forward_${id}`;
    const resp = await httpFetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    const raw = resp.raw || String(resp.body || '');
    let title = '';
    let content = '';
    // 尝试从 __NEXT_DATA__ 中提取
    const jsonMatch = raw.match(/__NEXT_DATA__[^>]*>([^<]+)</);
    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[1]);
        const detail = data?.props?.pageProps?.detailData;
        if (detail) {
          title = detail.name || detail.title || '';
          content = (detail.content || '').replace(/<[^>]+>/g, '').trim();
        }
      } catch (e) {}
    }
    if (!title) {
      const titleMatch = raw.match(/<title>([^<]+)<\/title>/);
      title = titleMatch ? titleMatch[1] : '';
    }
    if (!content) {
      content = raw.replace(/<[^>]+>/g, '').trim().slice(0, 5000);
    }
    return {
      news: {
        id,
        title,
        url,
        source: 'pengpai',
        sourceName: '澎湃新闻',
        publishTime: Date.now(),
      },
      content,
    };
  },
};

const newsSearch = {
  async search(keyword: string, page: number, limit: number): Promise<NewsSearchResult> {
    const url = `https://www.thepaper.cn/searchResult?searchWord=${encodeURIComponent(keyword)}&pageSearch=${page}`;
    const resp = await httpFetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    const raw = resp.raw || String(resp.body || '');
    // 澎湃搜索返回的是 HTML 页面，从 JSON 数据块中提取
    const jsonMatch = raw.match(/__NEXT_DATA__[^>]*>([^<]+)</);
    let news: NewsItem[] = [];
    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[1]);
        const list = (data?.props?.pageProps?.searchData?.list as any[]) || [];
        news = list.map(normalizeArticle);
      } catch (e) {}
    }
    // 如果 JSON 提取失败，尝试从 HTML 中正则匹配
    if (news.length === 0) {
      const titleRegex = /<a[^>]+href="\/newsDetail_forward_(\d+)"[^>]*>([^<]+)<\/a>/g;
      let match;
      let count = 0;
      while ((match = titleRegex.exec(raw)) !== null && count < limit) {
        news.push({
          id: match[1],
          title: match[2].trim(),
          url: `https://www.thepaper.cn/newsDetail_forward_${match[1]}`,
          source: 'pengpai',
          sourceName: '澎湃新闻',
          publishTime: Date.now(),
        });
        count++;
      }
    }
    return { news: news.slice(0, limit), total: news.length };
  },
};

const hotboard = {
  async boards() {
    return [{ id: 'hot', name: '澎湃热榜', source: 'pengpai' }];
  },
  async list(id: string, page: number, limit: number): Promise<NewsListResult> {
    return newsList.list('25950', page, limit);
  },
};

const pengpai: PlatformModule = {
  id: 'pengpai',
  name: '澎湃新闻',
  newsList,
  newsDetail,
  newsSearch,
  hotboard,
};

export default pengpai;
