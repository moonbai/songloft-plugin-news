// Edge TTS 后端客户端 - 使用微软在线 TTS 服务生成音频
// 供宿主原生播放器调用

const EDGE_TTS_WS_URL = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const DEFAULT_VOICE = 'zh-CN-XiaoxiaoNeural';

export interface EdgeTtsConfig {
  voice?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
}

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function escapeXml(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatRate(rate: number): string {
  return Math.round((rate - 1) * 100) + '%';
}

function formatPitch(pitch: number): string {
  return Math.round((pitch - 1) * 100) + 'Hz';
}

function formatVolume(volume: number): string {
  return Math.round(volume * 100) + '%';
}

export async function synthesizeToBuffer(text: string, config: EdgeTtsConfig = {}): Promise<Uint8Array> {
  const voice = config.voice || DEFAULT_VOICE;
  const rate = formatRate(config.rate ?? 1.0);
  const pitch = formatPitch(config.pitch ?? 1.0);
  const volume = formatVolume(config.volume ?? 1.0);

  return new Promise((resolve, reject) => {
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(EDGE_TTS_WS_URL);
    } catch (e) {
      reject(new Error('Failed to create WebSocket: ' + (e as Error).message));
      return;
    }

    const audioChunks: Uint8Array[] = [];
    let hasError = false;
    let errorMsg = '';

    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      const ssml = `
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="zh-CN">
  <voice name="${voice}">
    <prosody rate="${rate}" pitch="${pitch}" volume="${volume}">
      ${escapeXml(text)}
    </prosody>
  </voice>
</speak>`.trim();

      const configMessage = `Content-Type:application/json; charset=utf-8\r\nX-RequestId:${generateId()}\r\nX-Timestamp:${new Date().toISOString()}\r\n\r\n${JSON.stringify({
        context: {
          synthesis: {
            audio: {
              metadataoptions: { sentenceBoundaryEnabled: false, wordBoundaryEnabled: false },
              outputFormat: 'audio-24khz-48kbitrate-mono-mp3'
            }
          }
        }
      })}`;

      const ssmlMessage = `Content-Type:application/ssml+xml\r\nX-RequestId:${generateId()}\r\nX-Timestamp:${new Date().toISOString()}\r\n\r\n${ssml}`;

      try {
        ws!.send(configMessage);
        setTimeout(() => {
          if (ws && ws.readyState === 1) {
            ws.send(ssmlMessage);
          }
        }, 100);
      } catch (e) {
        hasError = true;
        errorMsg = (e as Error).message;
        try { ws!.close(); } catch {}
      }
    };

    ws.onmessage = (event: MessageEvent) => {
      if (typeof event.data === 'string') {
        const data = event.data;
        if (data.includes('Path:turn.end')) {
          try { ws!.close(); } catch {}
        }
      } else if (event.data instanceof ArrayBuffer) {
        const buffer = new Uint8Array(event.data);
        const headerEnd = findHeaderEnd(buffer);
        if (headerEnd > 0) {
          const audioData = buffer.slice(headerEnd);
          audioChunks.push(audioData);
        }
      }
    };

    ws.onclose = () => {
      if (hasError) {
        reject(new Error(errorMsg || 'Edge TTS connection error'));
        return;
      }
      if (audioChunks.length === 0) {
        reject(new Error('No audio data received from Edge TTS'));
        return;
      }
      const totalLength = audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of audioChunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }
      resolve(result);
    };

    ws.onerror = () => {
      hasError = true;
      errorMsg = 'Edge TTS WebSocket error';
    };
  });
}

function findHeaderEnd(buffer: Uint8Array): number {
  const separator = [13, 10, 13, 10]; // \r\n\r\n
  for (let i = 0; i <= buffer.length - separator.length; i++) {
    let found = true;
    for (let j = 0; j < separator.length; j++) {
      if (buffer[i + j] !== separator[j]) {
        found = false;
        break;
      }
    }
    if (found) return i + separator.length;
  }
  return -1;
}

// 简单的 TTS 缓存（按文本内容 hash 缓存，避免重复生成）
const ttsCache = new Map<string, Uint8Array>();
const MAX_CACHE_SIZE = 20;

export async function synthesizeWithCache(text: string, config: EdgeTtsConfig = {}): Promise<Uint8Array> {
  const cacheKey = crypto.md5(text + '|' + (config.voice || DEFAULT_VOICE) + '|' + config.rate + '|' + config.pitch + '|' + config.volume);
  
  const cached = ttsCache.get(cacheKey);
  if (cached) {
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
