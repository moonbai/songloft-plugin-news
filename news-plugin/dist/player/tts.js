"use strict";
// TTS 服务 - 浏览器端 TTS 调用服务
// 由于后端无法直接调用 TTS，前端通过 Web Speech API 实现
// 后端只负责内容准备和 TTS 配置
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildTtsScript = buildTtsScript;
exports.estimateSpeechDuration = estimateSpeechDuration;
function buildTtsScript(news, content) {
    const segments = [];
    segments.push({
        id: 'title',
        type: 'title',
        text: news.title,
    });
    if (news.author) {
        segments.push({
            id: 'author',
            type: 'source',
            text: news.author,
        });
    }
    segments.push({
        id: 'source',
        type: 'source',
        text: `来源：${news.sourceName}`,
    });
    if (news.publishTime) {
        const date = new Date(news.publishTime);
        segments.push({
            id: 'time',
            type: 'time',
            text: date.toLocaleString('zh-CN'),
        });
    }
    segments.push({ id: 'pause1', type: 'pause', text: '', durationMs: 500 });
    if (news.summary) {
        segments.push({
            id: 'summary',
            type: 'content',
            text: news.summary,
        });
        segments.push({ id: 'pause2', type: 'pause', text: '', durationMs: 300 });
    }
    if (content) {
        // 清理 HTML/特殊字符
        const cleanContent = content
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&[a-z]+;/gi, '')
            .replace(/\s+/g, ' ')
            .trim();
        if (cleanContent) {
            // 拆分成段落（每段不超过 200 字符，避免单段过长）
            const paragraphs = cleanContent.split(/[。！？\n]/).filter(p => p.trim());
            for (let i = 0; i < Math.min(paragraphs.length, 50); i++) {
                const p = paragraphs[i].trim();
                if (p) {
                    segments.push({
                        id: `content-${i}`,
                        type: 'content',
                        text: p,
                    });
                    segments.push({
                        id: `pause-c-${i}`,
                        type: 'pause',
                        text: '',
                        durationMs: 200,
                    });
                }
            }
        }
    }
    return segments;
}
function estimateSpeechDuration(text, rate = 1.0) {
    // 中文按每分钟 240 字计算
    const charCount = text.length;
    const wordsPerMin = 240 * rate;
    return (charCount / wordsPerMin) * 60 * 1000;
}
