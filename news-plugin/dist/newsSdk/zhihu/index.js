import httpFetch from '../request';
function normalizeItem(item) {
    return {
        id: String(item.id || item.target?.id || ''),
        title: String(item.title || item.target?.title_area?.text || ''),
        url: String(item.target?.link?.url || item.url || ''),
        source: 'zhihu',
        sourceName: '知乎热榜',
        author: item.target?.author?.name || '',
        publishTime: Number(item.create_time || item.target?.created_time || Date.now()) * 1000,
        summary: String(item.target?.excerpt_area?.text || item.detail_text || ''),
        cover: String(item.target?.image_area?.url || ''),
        hot: Number((String(item.detail_text || '').match(/\d+/)?.[0]) || 0),
    };
}
const newsList = {
    async list(category, page, limit) {
        return hotboard.list('hot', page, limit);
    },
    async categories() {
        return [
            { id: 'hot', name: '知乎热榜', source: 'zhihu' },
        ];
    },
};
const newsDetail = {
    async detail(id) {
        const url = `https://www.zhihu.com/question/${id}`;
        const resp = await httpFetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        return {
            news: {
                id,
                title: '',
                url,
                source: 'zhihu',
                sourceName: '知乎',
                publishTime: Date.now(),
            },
        };
    },
};
const newsSearch = {
    async search(keyword, page, limit) {
        const url = `https://www.zhihu.com/api/v4/search_v3?t=general&q=${encodeURIComponent(keyword)}&offset=${(page - 1) * limit}&limit=${limit}`;
        const resp = await httpFetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        const data = resp.body;
        const news = (data?.data || []).map((item) => normalizeItem({
            id: item.object?.id,
            title: item.highlight?.title || item.object?.title,
            url: item.object?.url,
            target: item.object,
        }));
        return { news, total: news.length };
    },
};
const hotboard = {
    async boards() {
        return [{ id: 'hot', name: '知乎热榜', source: 'zhihu' }];
    },
    async list(id, page, limit) {
        const url = `https://www.zhihu.com/api/v3/feed/topstory/hot-lists/total?limit=${limit}`;
        const resp = await httpFetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        const data = resp.body;
        const news = (data?.data || []).map(normalizeItem);
        return { news, hasMore: news.length >= limit };
    },
};
const zhihu = {
    id: 'zhihu',
    name: '知乎热榜',
    newsList,
    newsDetail,
    newsSearch,
    hotboard,
};
export default zhihu;
