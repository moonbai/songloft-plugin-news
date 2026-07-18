// 在线 TTS 后端客户端 - 使用百度翻译 TTS 服务生成音频
//
// QuickJS 运行时不支持 WebSocket 全局，因此不能用 Edge TTS 的 WebSocket 协议。
// Google TTS 在国内被墙，有道 TTS 接口已失效（HTTP 688/500）。
// 改用百度翻译 TTS（fanyi.baidu.com/gettts），国内访问稳定，支持长文本。
//
// 接口：GET https://fanyi.baidu.com/gettts?lan=zh&text={text}&spd=3&source=web
// 返回：audio/mpeg (MP3)
// 限制：单次请求建议不超过 ~500 字符，超长文本会按句子切分后拼接。

const BAIDU_TTS_URL = 'https://fanyi.baidu.com/gettts';
const MAX_CHUNK_LENGTH = 200; // 百度 TTS 单次请求安全长度

const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'audio/mpeg,audio/*,*/*;q=0.9',
  'Referer': 'https://fanyi.baidu.com/',
};

export interface EdgeTtsConfig {
  voice?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
}

/**
 * 将长文本按句子边界分割为适合 TTS 接口的短文本
 * 按。！？.!?;；\n 切分，保留分隔符，单块不超过 maxLen
 */
function splitText(text: string, maxLen: number): string[] {
  if (!text) return [];
  if (text.length <= maxLen) return [text];

  const chunks: string[] = [];
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

/**
 * 调用百度翻译 TTS 获取单个 chunk 的音频
 * spd: 语速（0-5，3=正常，配置 rate 越大语速越快）
 */
async function baiduTts(text: string, rate: number): Promise<Uint8Array> {
  // rate 1.0 -> spd 3; rate 1.5 -> spd 5; rate 0.5 -> spd 1
  const spd = Math.max(1, Math.min(7, Math.round(rate * 3)));
  const params = new URLSearchParams();
  params.set('lan', 'zh');
  params.set('text', text);
  params.set('spd', String(spd));
  params.set('source', 'web');
  const url = BAIDU_TTS_URL + '?' + params.toString();

  const resp = await fetch(url, { method: 'GET', headers: DEFAULT_HEADERS });
  if (!resp.ok) {
    throw new Error('HTTP ' + resp.status);
  }
  const ab = await resp.arrayBuffer();
  if (!ab || ab.byteLength === 0) {
    throw new Error('Empty audio response');
  }
  return new Uint8Array(ab);
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
 * 使用百度翻译 TTS 合成音频
 * 长文本按句子切分后分别合成，再拼接 MP3 字节流
 */
export async function synthesizeToBuffer(text: string, config: EdgeTtsConfig = {}): Promise<Uint8Array> {
  const rate = config.rate ?? 1.0;
  const chunks = splitText(text, MAX_CHUNK_LENGTH);
  if (chunks.length === 0) {
    throw new Error('No text to synthesize');
  }

  songloft.log.info('TTS: synthesizing ' + chunks.length + ' chunks, total ' + text.length + ' chars, rate=' + rate);

  try {
    const buffers: Uint8Array[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      songloft.log.info('TTS: chunk ' + (i + 1) + '/' + chunks.length + ' len=' + chunk.length);
      const buf = await baiduTts(chunk, rate);
      if (buf && buf.length > 0) {
        buffers.push(buf);
      }
    }
    if (buffers.length === 0) {
      throw new Error('No audio data received from Baidu TTS');
    }
    const total = buffers.reduce((s, b) => s + b.length, 0);
    songloft.log.info('TTS: baidu succeeded, ' + buffers.length + ' chunks, ' + total + ' bytes');
    return concatBuffers(buffers);
  } catch (e) {
    throw new Error('Baidu TTS failed: ' + (e as Error).message);
  }
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
