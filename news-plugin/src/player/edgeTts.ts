// 在线 TTS 后端客户端 - 使用 HTTP-based TTS 服务生成音频
//
// QuickJS 运行时不支持 WebSocket 全局，因此不能用 Edge TTS 的 WebSocket 协议。
// 改用 HTTP-based TTS 服务：
//   1. 优先 Google Translate TTS（质量较好，支持 zh-CN）
//   2. 失败回退有道 TTS（国内可访问）
//
// 长文本会按句子边界分割为短块，分别合成后拼接 MP3 字节流。

const GOOGLE_TTS_URL = 'https://translate.google.com/translate_tts';
const YOUDAO_TTS_URL = 'https://tts.youdao.com/fanyivoice';
const MAX_CHUNK_LENGTH = 180;

const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'audio/mpeg,audio/*,*/*;q=0.9',
};

export interface EdgeTtsConfig {
  voice?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
}

/**
 * 将长文本按句子边界分割为适合 TTS 接口的短文本（每次最多 ~180 字）
 */
function splitText(text: string, maxLen: number): string[] {
  if (!text) return [];
  if (text.length <= maxLen) return [text];

  const chunks: string[] = [];
  // 按中英文句号、问号、叹号、分号、换行分割，保留分隔符
  const parts = text.split(/([。！？.!?;；\n])/g);
  let current = '';

  for (const part of parts) {
    if ((current + part).length > maxLen) {
      if (current.trim()) chunks.push(current.trim());
      if (part.length > maxLen) {
        // 单句过长，按长度硬切
        for (let j = 0; j < part.length; j += maxLen) {
          const slice = part.slice(j, j + maxLen).trim();
          if (slice) chunks.push(slice);
        }
        current = '';
      } else {
        current = part;
      }
    } else {
      current += part;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

async function fetchAudioBuffer(url: string): Promise<Uint8Array> {
  const resp = await fetch(url, { method: 'GET', headers: DEFAULT_HEADERS });
  if (!resp.ok) {
    throw new Error('HTTP ' + resp.status + ' from ' + url.slice(0, 60));
  }
  const ab = await resp.arrayBuffer();
  if (!ab || ab.byteLength === 0) {
    throw new Error('Empty audio response from ' + url.slice(0, 60));
  }
  return new Uint8Array(ab);
}

async function googleTts(text: string): Promise<Uint8Array> {
  const params = new URLSearchParams();
  params.set('ie', 'UTF-8');
  params.set('q', text);
  params.set('tl', 'zh-CN');
  params.set('client', 'tw-ob');
  const url = GOOGLE_TTS_URL + '?' + params.toString();
  return fetchAudioBuffer(url);
}

async function youdaoTts(text: string): Promise<Uint8Array> {
  const params = new URLSearchParams();
  params.set('word', text);
  params.set('le', 'zh');
  const url = YOUDAO_TTS_URL + '?' + params.toString();
  return fetchAudioBuffer(url);
}

function concatBuffers(buffers: Uint8Array[]): Uint8Array {
  const total = buffers.reduce((sum, b) => sum + b.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const b of buffers) {
    result.set(b, offset);
    offset += b.length;
  }
  return result;
}

/**
 * 使用在线 TTS 服务合成音频
 * 优先 Google Translate TTS，失败回退有道 TTS
 */
export async function synthesizeToBuffer(text: string, config: EdgeTtsConfig = {}): Promise<Uint8Array> {
  const chunks = splitText(text, MAX_CHUNK_LENGTH);
  if (chunks.length === 0) {
    throw new Error('No text to synthesize');
  }

  songloft.log.info('TTS: synthesizing ' + chunks.length + ' chunks, total ' + text.length + ' chars');

  const strategies = [
    { name: 'google', fn: googleTts },
    { name: 'youdao', fn: youdaoTts },
  ];

  const errors: string[] = [];
  for (const strategy of strategies) {
    try {
      const buffers: Uint8Array[] = [];
      for (const chunk of chunks) {
        const buf = await strategy.fn(chunk);
        if (buf && buf.length > 0) {
          buffers.push(buf);
        }
      }
      if (buffers.length > 0) {
        songloft.log.info('TTS: ' + strategy.name + ' succeeded, ' + buffers.length + ' chunks, ' + buffers.reduce((s, b) => s + b.length, 0) + ' bytes');
        return concatBuffers(buffers);
      }
      errors.push(strategy.name + ': no audio data');
    } catch (e) {
      const msg = strategy.name + ': ' + (e as Error).message;
      errors.push(msg);
      songloft.log.warn('TTS: ' + msg);
    }
  }

  throw new Error('All TTS strategies failed: ' + errors.join('; '));
}

// 简单的 TTS 缓存（按文本内容 hash 缓存，避免重复生成）
const ttsCache = new Map<string, Uint8Array>();
const MAX_CACHE_SIZE = 20;

export async function synthesizeWithCache(text: string, config: EdgeTtsConfig = {}): Promise<Uint8Array> {
  const cacheKey = crypto.md5(text + '|' + (config.voice || '') + '|' + config.rate + '|' + config.pitch + '|' + config.volume);

  const cached = ttsCache.get(cacheKey);
  if (cached) {
    songloft.log.info('TTS: cache hit');
    return cached;
  }

  const audio = await synthesizeToBuffer(text, config);

  // 简单的 LRU 缓存
  if (ttsCache.size >= MAX_CACHE_SIZE) {
    const firstKey = ttsCache.keys().next().value;
    if (firstKey) ttsCache.delete(firstKey);
  }
  ttsCache.set(cacheKey, audio);

  return audio;
}
