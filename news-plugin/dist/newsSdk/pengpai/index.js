import httpFetch from '../request';
function normalizeArticle(article) {
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
    async list(category, page, limit) {
        const url = `https://www.thepaper.cn/load_index.jsp?nodeids=${category || '25950'}&pageIdx=${page}&topCids=&parentCid=&pageSize=${limit}&actionType=`;
        const resp = await httpFetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://www.thepaper.cn/',
            },
        });
        const data = resp.body;
        const news = (data?.data?.list || []).map(normalizeArticle);
        return { news, hasMore: news.length >= limit };
    },
    async categories() {
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
    async detail(id) {
        const url = `https://www.thepaper.cn/newsDetail_forward_${id}`;
        const resp = await httpFetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        const raw = String(resp.body || '');
        const titleMatch = raw.match(/<title>([^<]+)<\/title>/);
        return {
            news: {
                id,
                title: titleMatch ? titleMatch[1] : '',
                url,
                source: 'pengpai',
                sourceName: '澎湃新闻',
                publishTime: Date.now(),
            },
            content: raw.replace(/<[^>]+>/g, '').trim().slice(0, 5000),
        };
    },
};
const newsSearch = {
    async search(keyword, page, limit) {
        const url = `https://www.thepaper.cn/searchResult?searchWord=${encodeURIComponent(keyword)}&pageSearch=${page}`;
        const resp = await httpFetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        const data = resp.body;
        const news = (data?.data || []).map(normalizeArticle);
        return { news, total: news.length };
    },
};
const hotboard = {
    async boards() {
        return [{ id: 'hot', name: '澎湃热榜', source: 'pengpai' }];
    },
    async list(id, page, limit) {
        return newsList.list('25950', page, limit);
    },
};
const pengpai = {
    id: 'pengpai',
    name: '澎湃新闻',
    newsList,
    newsDetail,
    newsSearch,
    hotboard,
};
export default pengpai;
