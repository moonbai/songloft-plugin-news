import httpFetch from '../request';
function normalizeArticle(article) {
    return {
        id: String(article.docid || article.id || article.sketchid || ''),
        title: String(article.title || ''),
        url: String(article.url || article.shareurl || `https://www.163.com/news/article/${article.docid}.html`),
        source: 'wangyi',
        sourceName: '网易新闻',
        category: article.channelname || article.category || '',
        author: article.source || article.mediaName || '',
        publishTime: Number(article.ptime || article.publishTime || Date.now()),
        summary: String(article.digest || article.summary || ''),
        cover: String(article.imgsrc || article.bigimg || ''),
        hot: Number(article.commentCount || article.replyCount || 0),
    };
}
const newsList = {
    async list(category, page, limit) {
        const url = `https://3g.163.com/touch/reconstruct/article/list/${category || 'BBM54PGAwangning'}/${page}-${limit}.html`;
        const resp = await httpFetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_0 like Mac OS X)',
            },
        });
        const raw = String(resp.body || '');
        const jsonStr = raw.replace(/^[^[]*/, '').replace(/[^]]*$/, '');
        let data = [];
        try {
            data = JSON.parse(jsonStr);
        }
        catch (e) {
            data = [];
        }
        const news = data.map(normalizeArticle);
        return { news, hasMore: news.length >= limit };
    },
    async categories() {
        return [
            { id: 'BBM54PGAwangning', name: '头条', source: 'wangyi' },
            { id: 'BA8BG6DGwangning', name: '娱乐', source: 'wangyi' },
            { id: 'BA8BG6DKwangning', name: '体育', source: 'wangyi' },
            { id: 'BA8D4A3Rwangning', name: '财经', source: 'wangyi' },
            { id: 'BAI67OGGwangning', name: '科技', source: 'wangyi' },
        ];
    },
};
const newsDetail = {
    async detail(id) {
        const url = `https://www.163.com/news/article/${id}.html`;
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
                source: 'wangyi',
                sourceName: '网易新闻',
                publishTime: Date.now(),
            },
            content: raw.replace(/<[^>]+>/g, '').trim().slice(0, 5000),
        };
    },
};
const newsSearch = {
    async search(keyword, page, limit) {
        const url = `https://www.163.com/search?keyword=${encodeURIComponent(keyword)}`;
        const resp = await httpFetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        const raw = String(resp.body || '');
        const titleRegex = /<a[^>]+href="(\/news\/article\/[^"]+)"[^>]*>([^<]+)<\/a>/g;
        const news = [];
        let match;
        let count = 0;
        while ((match = titleRegex.exec(raw)) !== null && count < limit) {
            const id = (match[1].match(/article\/([^.]+)/) || [])[1] || '';
            news.push({
                id,
                title: match[2],
                url: `https://www.163.com${match[1]}`,
                source: 'wangyi',
                sourceName: '网易新闻',
                publishTime: Date.now(),
            });
            count++;
        }
        return { news, total: news.length };
    },
};
const hotboard = {
    async boards() {
        return [{ id: 'hot', name: '网易热榜', source: 'wangyi' }];
    },
    async list(id, page, limit) {
        return newsList.list('BBM54PGAwangning', page, limit);
    },
};
const wangyi = {
    id: 'wangyi',
    name: '网易新闻',
    newsList,
    newsDetail,
    newsSearch,
    hotboard,
};
export default wangyi;
