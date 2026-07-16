// 得到 App 知识新闻/听书
import httpFetch from '../request';
function normalizeArticle(article) {
    return {
        id: String(article.id || article.aid || ''),
        title: String(article.title || article.name || ''),
        url: String(article.shareurl || article.url || `https://www.dedao.cn/article/${article.id}`),
        source: 'dedao',
        sourceName: '得到',
        category: article.classify_name || article.column_name || '',
        author: article.author_name || article.editor_name || '',
        publishTime: Number(article.publish_time || article.create_time || Date.now()) * 1000,
        summary: String(article.content_brief || article.brief || article.desc || ''),
        cover: String(article.cover || article.image || article.pic || ''),
        hot: Number(article.read_count || article.like_count || 0),
        audioUrl: String(article.audio_url || article.mp3 || ''),
        audioDuration: Number(article.audio_duration || article.duration || 0),
        ttsEnabled: true,
    };
}
const newsList = {
    async list(category, page, limit) {
        const url = `https://www.dedao.cn/api/v2/columns/${category || 'knowledge'}?page=${page}&size=${limit}`;
        const resp = await httpFetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        const data = resp.body;
        const news = (data?.data?.list || []).map(normalizeArticle);
        return { news, hasMore: news.length >= limit };
    },
    async categories() {
        return [
            { id: 'knowledge', name: '知识新闻', source: 'dedao' },
            { id: 'business', name: '商业洞察', source: 'dedao' },
            { id: 'tech', name: '科技前沿', source: 'dedao' },
            { id: 'culture', name: '文化人文', source: 'dedao' },
        ];
    },
};
const newsDetail = {
    async detail(id) {
        const url = `https://www.dedao.cn/api/v2/article/${id}`;
        const resp = await httpFetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        const data = resp.body;
        const article = data?.data || {};
        return {
            news: normalizeArticle(article),
            content: String(article.content || article.content_brief || ''),
        };
    },
};
const newsSearch = {
    async search(keyword, page, limit) {
        const url = `https://www.dedao.cn/api/v2/search?keyword=${encodeURIComponent(keyword)}&page=${page}&size=${limit}`;
        const resp = await httpFetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        const data = resp.body;
        const news = (data?.data?.list || []).map(normalizeArticle);
        return { news, total: news.length };
    },
};
const hotboard = {
    async boards() {
        return [{ id: 'knowledge', name: '得到热榜', source: 'dedao' }];
    },
    async list(id, page, limit) {
        return newsList.list(id, page, limit);
    },
};
const dedao = {
    id: 'dedao',
    name: '得到',
    newsList,
    newsDetail,
    newsSearch,
    hotboard,
};
export default dedao;
