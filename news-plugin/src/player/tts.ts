// TTS 服务 - 浏览器端 TTS 调用服务
// 由于后端无法直接调用 TTS，前端通过 Web Speech API 实现
// 后端只负责内容准备和 TTS 配置

import type { NewsItem } from '../types';

export interface TtsSegment {
  id: string;
  type: 'title' | 'source' | 'time' | 'content' | 'pause';
  text: string;
  durationMs?: number;
}

export function buildTtsScript(news: NewsItem, content?: string): TtsSegment[] {
  const segments: TtsSegment[] = [];
  
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
    // 清洗 summary 中的 HTML
    const cleanSummary = news.summary
      .replace(/<[^>]+>/g, '')
      .replace(/&[a-z]+;/gi, ' ')
      .replace(/https?:\/\/[^\s]+/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleanSummary) {
      segments.push({
        id: 'summary',
        type: 'content',
        text: cleanSummary,
      });
      segments.push({ id: 'pause2', type: 'pause', text: '', durationMs: 300 });
    }
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
        if (!p) continue;
        // 超长段落进一步按分号/逗号拆分，避免单段超过 180 字符
        // （部分 WebView 的 speechSynthesis 在长文本上会卡死或无声）
        const chunks: string[] = [];
        if (p.length <= 180) {
          chunks.push(p);
        } else {
          let cur = '';
          for (const piece of p.split(/[；;，,]/)) {
            if ((cur + piece).length > 180) {
              if (cur) chunks.push(cur);
              cur = piece;
            } else {
              cur = cur ? cur + piece : piece;
            }
          }
          if (cur) chunks.push(cur);
        }
        for (let j = 0; j < chunks.length; j++) {
          segments.push({
            id: `content-${i}-${j}`,
            type: 'content',
            text: chunks[j],
          });
          segments.push({
            id: `pause-c-${i}-${j}`,
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

export function estimateSpeechDuration(text: string, rate = 1.0): number {
  // 中文按每分钟 240 字计算
  const charCount = text.length;
  const wordsPerMin = 240 * rate;
  return (charCount / wordsPerMin) * 60 * 1000;
}
