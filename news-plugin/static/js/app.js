// 全局新闻播放器 - 支持音频播放 + TTS 朗读双模式

class NewsPlayer {
  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'metadata';
    this.queue = [];
    this.currentIndex = -1;
    this.currentItem = null;
    this.playMode = 'queue'; // queue | single | loop
    this.ttsMode = 'auto';   // auto | tts | audio
    this.isPlaying = false;
    this.ttsUtterances = [];
    this.ttsConfig = {
      voice: 'zh-CN',
      rate: 1.0,
      pitch: 1.0,
      volume: 1.0,
      autoPlayNext: true,
      enableTts: true,
    };
    
    this._setupAudioEvents();
    this._loadTtsConfig();
  }
  
  _setupAudioEvents() {
    this.audio.addEventListener('timeupdate', () => {
      this._emit('timeupdate', {
        currentTime: this.audio.currentTime,
        duration: this.audio.duration,
        progress: this.audio.duration ? this.audio.currentTime / this.audio.duration : 0,
      });
    });
    
    this.audio.addEventListener('play', () => {
      this.isPlaying = true;
      this._emit('play', { item: this.currentItem });
    });
    
    this.audio.addEventListener('pause', () => {
      this.isPlaying = false;
      this._emit('pause', { item: this.currentItem });
    });
    
    this.audio.addEventListener('ended', () => {
      this._emit('ended', { item: this.currentItem });
      if (this.playMode === 'loop') {
        this.audio.currentTime = 0;
        this.audio.play();
        return;
      }
      this.next();
    });
    
    this.audio.addEventListener('error', (e) => {
      songloftToast && songloftToast('音频播放失败', 'error');
      this._emit('error', { error: e });
    });
    
    this.audio.addEventListener('loadedmetadata', () => {
      this._emit('loadedmetadata', { duration: this.audio.duration });
    });
  }
  
  async _loadTtsConfig() {
    try {
      const result = await api('/player/tts-config');
      if (result.code === 0 && result.data) {
        this.ttsConfig = { ...this.ttsConfig, ...result.data };
      }
    } catch (e) {
      // 忽略
    }
  }

  /**
   * 检测浏览器 TTS 能力
   * - 必须支持 SpeechSynthesis API
   * - 必须有可用语音（部分 WebView/桌面端有 API 但无语音）
   * - voices 可能异步加载，最多等 3s
   */
  _ttsAvailable() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      console.warn('[TTS] speechSynthesis API not available');
      return false;
    }
    if (typeof SpeechSynthesisUtterance === 'undefined') {
      console.warn('[TTS] SpeechSynthesisUtterance not available');
      return false;
    }
    try {
      const voices = window.speechSynthesis.getVoices();
      console.log('[TTS] voices count:', voices.length);
      if (voices.length === 0) return false;
      // 列出前几个 voice 帮助诊断
      voices.slice(0, 5).forEach((v, i) => {
        console.log(`[TTS] voice[${i}]: lang=${v.lang} name=${v.name}`);
      });
      return true;
    } catch (e) {
      console.warn('[TTS] getVoices error:', e);
      return false;
    }
  }

  /**
   * 自动选择中文 voice（避免默认非中文 voice 导致无声）
   */
  _pickChineseVoice() {
    try {
      const voices = window.speechSynthesis.getVoices();
      if (!voices || voices.length === 0) return null;
      // 优先级：zh-CN > zh-* > 任何 zh
      const zhCN = voices.find(v => /zh[-_]?CN/i.test(v.lang));
      if (zhCN) return zhCN;
      const zhAny = voices.find(v => /^zh/i.test(v.lang));
      if (zhAny) return zhAny;
      // 部分系统中文 voice 用 'cmn' 标识
      const cmn = voices.find(v => /^cmn/i.test(v.lang) || /chinese/i.test(v.name));
      if (cmn) return cmn;
      return null;
    } catch (e) {
      return null;
    }
  }

  _waitForVoices(timeoutMs = 3000) {
    return new Promise((resolve) => {
      if (this._ttsAvailable()) return resolve(true);
      let done = false;
      const finish = (ok) => { if (!done) { done = true; resolve(ok); } };
      const timer = setTimeout(() => finish(this._ttsAvailable()), timeoutMs);
      try {
        // 使用 addEventListener 避免覆盖其他回调
        const handler = () => {
          if (this._ttsAvailable()) {
            clearTimeout(timer);
            window.speechSynthesis.removeEventListener('voiceschanged', handler);
            finish(true);
          }
        };
        window.speechSynthesis.addEventListener('voiceschanged', handler);
        // 同时保留 onvoiceschanged 以兼容旧 WebView
        window.speechSynthesis.onvoiceschanged = handler;
      } catch (e) {
        clearTimeout(timer);
        finish(false);
      }
    });
  }
  
  async _saveTtsConfig() {
    try {
      await api('/player/tts-config', {
        method: 'POST',
        body: JSON.stringify(this.ttsConfig),
      });
    } catch (e) {
      // 忽略
    }
  }
  
  setTtsConfig(config) {
    this.ttsConfig = { ...this.ttsConfig, ...config };
    this._saveTtsConfig();
  }
  
  getTtsConfig() {
    return this.ttsConfig;
  }
  
  /**
   * 设置播放队列
   */
  setQueue(items, startIndex = 0) {
    this.queue = items || [];
    this.currentIndex = Math.min(startIndex, this.queue.length - 1);
    if (this.currentIndex >= 0) {
      this._playCurrent();
    }
  }
  
  /**
   * 播放单条新闻（自动选择 TTS 或音频）
   */
  async playOne(news) {
    this.queue = [news];
    this.currentIndex = 0;
    await this._playCurrent();
  }
  
  /**
   * 播放队列中当前项
   */
  async _playCurrent() {
    if (this.currentIndex < 0 || this.currentIndex >= this.queue.length) {
      this._stop();
      return;
    }

    this._stop();
    this.currentItem = this.queue[this.currentIndex];
    this._emit('itemchange', { item: this.currentItem, index: this.currentIndex });

    const hasAudio = !!this.currentItem.audioUrl;
    const ttsEnabled = this.ttsConfig.enableTts && this.ttsMode !== 'audio';

    // 决定播放方式
    if (hasAudio && this.ttsMode !== 'tts') {
      // 优先使用音频
      await this._playAudio(this.currentItem.audioUrl);
    } else if (ttsEnabled) {
      // 使用在线 TTS（不依赖浏览器 TTS 能力）
      await this._playTts(this.currentItem);
    } else {
      songloftToast && songloftToast('该新闻暂不支持播放', 'info');
    }
  }
  
  async _playAudio(url) {
    try {
      this.audio.src = url;
      this.audio.playbackRate = 1.0;
      this.audio.volume = this.ttsConfig.volume;
      await this.audio.play();
    } catch (e) {
      songloftToast && songloftToast('播放失败: ' + e.message, 'error');
    }
  }
  
  async _playTts(news) {
    try {
      // 获取 TTS 脚本（含 content）
      const result = await api('/player/resolve', {
        method: 'POST',
        body: JSON.stringify({ news, enableTts: true }),
      });

      if (result.code !== 0) {
        songloftToast && songloftToast('加载失败: ' + (result.msg || '未知错误'), 'error');
        return;
      }

      const data = result.data;
      const ttsScript = data.ttsScript || [];
      if (!ttsScript || ttsScript.length === 0) {
        songloftToast && songloftToast('该新闻无朗读内容', 'info');
        return;
      }
      this.isPlaying = true;
      this._emit('play', { item: this.currentItem, mode: 'tts' });

      // 检查 speechSynthesis API
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        songloftToast && songloftToast('当前环境不支持语音朗读（无 speechSynthesis API）', 'error');
        this._openOriginalUrl(news);
        return;
      }

      // 等待 voices 异步加载完成（最多 3 秒）
      console.log('[TTS] waiting for voices...');
      const ok = await this._waitForVoices(3000);
      console.log('[TTS] voices ready:', ok);

      if (!ok) {
        const voices = window.speechSynthesis.getVoices();
        const msg = voices.length === 0
          ? '当前环境没有可用语音包（请安装中文 TTS 语音）'
          : 'speechSynthesis 不可用';
        songloftToast && songloftToast(msg, 'error');
        this._openOriginalUrl(news);
        return;
      }

      // 自动选择中文 voice
      const zhVoice = this._pickChineseVoice();
      if (zhVoice) {
        console.log('[TTS] picked voice:', zhVoice.lang, zhVoice.name);
      } else {
        console.warn('[TTS] no Chinese voice found, falling back to default');
      }

      await this._speakSegments(ttsScript, zhVoice);
    } catch (e) {
      console.error('[TTS] _playTts error:', e);
      songloftToast && songloftToast('TTS 失败: ' + (e && e.message ? e.message : String(e)), 'error');
    }
  }

  /**
   * TTS 不可用时降级：打开原文链接
   */
  _openOriginalUrl(news) {
    if (news && news.url) {
      songloftToast && songloftToast('已为你打开原文（TTS 不可用）', 'info');
      try {
        window.open(news.url, '_blank');
      } catch (e) {}
    }
  }

  /**
   * 清洗TTS文本：去除HTML标签、实体、URL等
   */
  _cleanTtsText(text) {
    return (text || '')
      .replace(/<[^>]+>/g, '')
      .replace(/&[a-z]+;/gi, ' ')
      .replace(/https?:\/\/[^\s<]+/gi, '')
      .replace(/[a-zA-Z0-9_\-]+\.jpg|\.png|\.gif/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  _speakSegments(segments, preferredVoice) {
    return new Promise((resolve) => {
      const synth = window.speechSynthesis;
      let i = 0;
      let hasError = false;
      const startedAt = Date.now();

      const speakNext = () => {
        if (i >= segments.length) {
          console.log('[TTS] finished, segments=' + segments.length + ' dur=' + (Date.now() - startedAt) + 'ms');
          resolve();
          return;
        }

        const seg = segments[i++];
        if (seg.type === 'pause') {
          setTimeout(speakNext, seg.durationMs || 200);
          return;
        }

        // 跳过空文本段
        const text = (seg.text || '').trim();
        if (!text) {
          speakNext();
          return;
        }

        const utter = new SpeechSynthesisUtterance(text);
        // 绑定中文 voice（关键：默认 voice 可能是非中文，导致朗读中文无声）
        if (preferredVoice) {
          utter.voice = preferredVoice;
          utter.lang = preferredVoice.lang;
        } else {
          utter.lang = this.ttsConfig.voice || 'zh-CN';
        }
        utter.rate = this.ttsConfig.rate || 1.0;
        utter.pitch = this.ttsConfig.pitch || 1.0;
        utter.volume = this.ttsConfig.volume != null ? this.ttsConfig.volume : 1.0;

        utter.onstart = () => {
          console.log('[TTS] speaking segment ' + (i - 1) + ': ' + text.slice(0, 30) + '...');
        };
        utter.onend = speakNext;
        utter.onerror = (ev) => {
          // 错误类型见 https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisErrorEvent/error
          console.error('[TTS] utter error:', ev.error || ev.type, 'seg=' + (i - 1));
          // interrupted/canceled 是正常的（切换/停止时），不弹错误
          if (ev.error === 'interrupted' || ev.error === 'canceled') {
            resolve();
            return;
          }
          if (!hasError) {
            hasError = true;
            songloftToast && songloftToast('朗读失败: ' + (ev.error || '未知错误'), 'error');
          }
          // 继续下一段，避免完全卡住
          setTimeout(speakNext, 100);
        };
        this.ttsUtterances.push(utter);
        try {
          synth.speak(utter);
        } catch (e) {
          console.error('[TTS] synth.speak throw:', e);
          if (!hasError) {
            hasError = true;
            songloftToast && songloftToast('朗读调用失败: ' + (e && e.message ? e.message : String(e)), 'error');
          }
          resolve();
        }
      };

      // 取消之前的朗读，再开始新的
      try {
        synth.cancel();
      } catch (e) {}
      // 部分浏览器 cancel 后立即 speak 会失败，稍微延迟
      setTimeout(speakNext, 50);
    });
  }
  
  /**
   * 播放/暂停
   */
  toggle() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.resume();
    }
  }
  
  pause() {
    if (this.audio.src && !this.audio.paused) {
      this.audio.pause();
    } else {
      window.speechSynthesis && window.speechSynthesis.pause();
    }
  }
  
  resume() {
    if (this.audio.src && this.audio.paused) {
      this.audio.play();
    } else {
      window.speechSynthesis && window.speechSynthesis.resume();
    }
  }
  
  /**
   * 上一首
   */
  prev() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this._playCurrent();
    }
  }
  
  /**
   * 下一首
   */
  next() {
    if (this.currentIndex < this.queue.length - 1) {
      this.currentIndex++;
      this._playCurrent();
    } else if (this.playMode === 'loop') {
      this.currentIndex = 0;
      this._playCurrent();
    } else {
      this._stop();
    }
  }
  
  /**
   * 跳转到指定位置
   */
  seek(progress) {
    if (this.audio.src && this.audio.duration) {
      this.audio.currentTime = progress * this.audio.duration;
    }
  }
  
  /**
   * 设置音量
   */
  setVolume(v) {
    this.ttsConfig.volume = Math.max(0, Math.min(1, v));
    this.audio.volume = this.ttsConfig.volume;
    this._saveTtsConfig();
  }
  
  /**
   * 设置播放速度
   */
  setRate(rate) {
    this.ttsConfig.rate = rate;
    this.audio.playbackRate = rate;
    this._saveTtsConfig();
  }
  
  /**
   * 设置播放模式
   */
  setPlayMode(mode) {
    this.playMode = mode; // queue | single | loop
    this._emit('modechange', { mode });
  }
  
  /**
   * 设置 TTS/音频 模式
   */
  setTtsMode(mode) {
    this.ttsMode = mode; // auto | tts | audio
    this._emit('ttsmodechange', { mode });
  }
  
  /**
   * 停止
   */
  _stop() {
    this.isPlaying = false;
    this.audio.pause();
    this.audio.removeAttribute('src');
    window.speechSynthesis && window.speechSynthesis.cancel();
  }
  
  stop() {
    this._stop();
    this.isPlaying = false;
    this._emit('stop', {});
  }
  
  /**
   * 添加到队列
   */
  addToQueue(item) {
    this.queue.push(item);
    this._emit('queuechange', { queue: this.queue });
  }
  
  /**
   * 事件系统
   */
  _emit(event, data) {
    if (this._listeners && this._listeners[event]) {
      for (const cb of this._listeners[event]) {
        try { cb(data); } catch (e) {}
      }
    }
  }
  
  on(event, callback) {
    if (!this._listeners) this._listeners = {};
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(callback);
  }
  
  off(event, callback) {
    if (this._listeners && this._listeners[event]) {
      this._listeners[event] = this._listeners[event].filter(cb => cb !== callback);
    }
  }
  
  getState() {
    return {
      isPlaying: this.isPlaying,
      currentItem: this.currentItem,
      currentIndex: this.currentIndex,
      queue: this.queue,
      playMode: this.playMode,
      ttsMode: this.ttsMode,
      currentTime: this.audio ? this.audio.currentTime : 0,
      duration: this.audio ? this.audio.duration : 0,
      ttsConfig: this.ttsConfig,
    };
  }
}

// 前端应用
const API_BASE = './api';
const MAIN_API = '/api/v1';
let player = null;
let currentTab = 'hotboard';
let playlists = [];
let targetPlaylistId = 2;
let currentCategory = 'all';
let aggregateCategories = [];

const P = (typeof window !== 'undefined' && window.SongloftPlugin) ? window.SongloftPlugin : null;

function showSnack(msg, type) {
  const snackbar = document.getElementById('toast');
  snackbar.textContent = msg;
  snackbar.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(window.snackTimer);
  window.snackTimer = setTimeout(function () {
    snackbar.className = 'toast';
  }, 3000);
}

async function api(path, options = {}) {
  try {
    return await fetchJson(path, options);
  } catch (e) {
    return { code: -1, msg: 'Network error: ' + (e && e.message ? e.message : String(e)) };
  }
}

async function fetchJson(path, options) {
  const headers = Object.assign({}, options.headers);
  if (options.body !== undefined && options.body !== null && !(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }
  const resp = await fetch(API_BASE + path, { ...options, headers });
  const text = await resp.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    return { code: -1, msg: text || '响应解析失败' };
  }
}

async function mainApiFetch(method, path, body) {
  if (!P) throw new Error('宿主桥接不可用');
  const token = P.getAuthToken ? P.getAuthToken() : null;
  if (!token) throw new Error('无法获取认证 Token');
  const opts = {
    method: method,
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const resp = await fetch(MAIN_API + path, opts);
  const text = await resp.text();
  if (!resp.ok) {
    let msg = 'HTTP ' + resp.status;
    try {
      const j = JSON.parse(text);
      msg = j.error || j.message || msg;
    } catch (e) {}
    throw new Error(msg);
  }
  return text ? JSON.parse(text) : null;
}

async function loadPlaylists() {
  if (!P) return;
  try {
    const data = await P.apiGet('/api/playlists');
    playlists = data.playlists || [];
    renderPlaylistSelect();
  } catch (e) {
    console.warn('加载歌单失败:', e);
  }
}

async function loadSettings() {
  if (!P) return;
  try {
    const data = await P.apiGet('/api/settings');
    if (data && data.last_playlist_id) {
      targetPlaylistId = data.last_playlist_id;
      const select = document.getElementById('playlist-select');
      if (select) select.value = String(targetPlaylistId);
    }
  } catch (e) {}
}

function renderPlaylistSelect() {
  const select = document.getElementById('playlist-select');
  if (!select) return;
  select.innerHTML = '';
  playlists.forEach(function (pl) {
    var opt = document.createElement('option');
    opt.value = pl.id;
    opt.textContent = pl.name;
    select.appendChild(opt);
  });
  select.value = String(targetPlaylistId);
}

async function createNewsPlaylist(name = '新闻资讯') {
  const result = await api('/playlists', {
    method: 'POST',
    body: JSON.stringify({ name, type: 'radio' }),
  });
  if (result.error) throw new Error(result.error);
  return result.playlist;
}

async function importNewsToHost(newsItems) {
  // 调用插件自己的批量注册接口，内部用 songloft.songs.create + playlists.addSongs
  // 支持原生音频和TTS两种模式，TTS新闻通过 sourceData 携带信息
  const result = await api('/player/register-batch', {
    method: 'POST',
    body: JSON.stringify({
      newsList: newsItems,
      playlistId: targetPlaylistId,
    }),
  });

  if (result.code !== 0) {
    throw new Error(result.msg || '导入失败');
  }

  const data = result.data || result;
  const addError = data.addError || '';
  return {
    created: data.created || 0,
    added: data.added || 0,
    skipped: data.skippedCount || 0,
    addError,
  };
}

function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'toast show ' + type;
  setTimeout(() => { toast.className = 'toast'; }, 3000);
}

function formatTime(ts) {
  if (!ts) return '';
  const date = new Date(ts);
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
  if (diff < 7 * 86400000) return Math.floor(diff / 86400000) + '天前';
  return date.toLocaleDateString('zh-CN');
}

function formatDuration(s) {
  if (!s || s <= 0) return '';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

function formatHot(n) {
  if (n >= 10000) return (n / 10000).toFixed(1) + '万';
  return String(n);
}

function renderPlayActions(item) {
  const hasAudio = !!item.audioUrl;
  // 朗读按钮始终显示（使用在线TTS，不依赖浏览器能力）
  const supportsTts = item.ttsEnabled !== false;
  // 只要有音频或支持TTS就可以加入官方歌单
  const canAddToHost = hasAudio || supportsTts;

  // 无音频且无 TTS 时不渲染整个按钮组（仅显示"查看正文"由列表点击触发）
  if (!hasAudio && !supportsTts) {
    return `
      <div class="play-actions" data-id="${escapeHtml(item.id)}" data-source="${escapeHtml(item.source)}">
        <button class="play-btn add" data-action="add-playlist">+ 播放列表</button>
      </div>
    `;
  }

  return `
    <div class="play-actions" data-id="${escapeHtml(item.id)}" data-source="${escapeHtml(item.source)}">
      ${hasAudio ? `<button class="play-btn" data-action="play-audio" data-url="${escapeHtml(item.audioUrl)}">▶ 播放音频</button>` : ''}
      ${supportsTts ? `<button class="play-btn tts" data-action="play-tts">🔊 朗读</button>` : ''}
      ${canAddToHost ? `<button class="play-btn host" data-action="add-to-host" title="加入宿主歌曲库">⭐ 加入歌单</button>` : ''}
      <button class="play-btn add" data-action="add-playlist">+ 播放列表</button>
    </div>
  `;
}

function renderNewsItem(item, index, showPlayActions = true, isAggregate = false) {
  const rankClass = index !== undefined && index < 3 ? `top${index + 1}` : '';
  const topCardClass = index !== undefined && index < 3 ? `top${index + 1}-card` : '';
  const rankHtml = index !== undefined ? `<span class="hot-rank ${rankClass}">${index + 1}</span>` : '';
  const hotValue = item.combinedHot || item.hotLevel || item.hot || 0;
  const hotHtml = hotValue ? `<span class="news-hot">🔥 ${formatHot(Math.round(hotValue))}</span>` : '';
  const audioBadge = item.audioUrl ? `<span class="audio-badge">🎧 音频</span>` : '';
  const durationHtml = item.audioDuration ? `<span class="duration">⏱ ${formatDuration(item.audioDuration)}</span>` : '';
  
  const hotPercent = Math.min(100, Math.max(0, hotValue ? (hotValue / 100) * 100 : 0));
  const hotBarHtml = isAggregate && hotValue ? `<div class="hot-bar"><div class="hot-bar-fill" style="width:${hotPercent}%"></div></div>` : '';
  
  let sourceTagsHtml = '';
  if (isAggregate && item.sourceNames && item.sourceNames.length > 1) {
    sourceTagsHtml = `<div class="source-tags"><span class="multi-source-badge">📰 ${item.sourceNames.length}个来源</span>${item.sourceNames.slice(0, 3).map(s => `<span class="source-tag">${escapeHtml(s)}</span>`).join('')}</div>`;
  } else if (isAggregate && item.sourceNames && item.sourceNames.length === 1) {
    sourceTagsHtml = `<div class="source-tags"><span class="source-tag">${escapeHtml(item.sourceNames[0])}</span></div>`;
  }

  return `
    <div class="news-item ${topCardClass}" data-id="${escapeHtml(item.id)}" data-source="${escapeHtml(item.source)}" data-url="${escapeHtml(item.url || '')}">
      <div class="news-meta">
        ${rankHtml}
        <span class="news-source">${escapeHtml(item.sourceName || item.source)}</span>
        ${audioBadge}
        <span>${formatTime(item.publishTime)}</span>
        ${durationHtml}
        ${hotHtml}
      </div>
      <div class="news-title">${escapeHtml(item.title)}</div>
      ${item.summary ? `<div class="news-summary">${escapeHtml(item.summary)}</div>` : ''}
      ${sourceTagsHtml}
      ${hotBarHtml}
      ${showPlayActions ? renderPlayActions(item) : ''}
    </div>
  `;
}

function attachNewsItemHandlers(container) {
  container.querySelectorAll('.news-item').forEach(el => {
    el.addEventListener('click', (e) => {
      // 点击播放按钮时不跳转
      if (e.target.closest('.play-actions')) return;
      
      const id = el.dataset.id;
      const source = el.dataset.source;
      const url = el.dataset.url;
      if (url) {
        window.open(url, '_blank');
      } else {
        showNewsDetail(source, id);
      }
    });
    
    // 播放操作
    el.querySelectorAll('.play-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const news = {
          id: el.dataset.id,
          source: el.dataset.source,
        };
        const playItem = collectItemFromEl(el);
        if (!playItem) return;
        
        if (action === 'play-audio') {
          player.setTtsMode('audio');
          player.setQueue([playItem], 0);
        } else if (action === 'play-tts') {
          player.setTtsMode('tts');
          player.setQueue([playItem], 0);
        } else if (action === 'add-playlist') {
          const result = await api('/player/playlist/add', {
            method: 'POST',
            body: JSON.stringify({ news: playItem }),
          });
          if (result.code === 0) {
            showToast(result.data?.message || '已添加', 'success');
            btn.classList.add('added');
            btn.textContent = '✓ 已添加';
          } else {
            showToast('添加失败: ' + result.msg, 'error');
          }
        } else if (action === 'add-to-host') {
          if (!P) {
            showSnack('宿主桥接不可用，请在 Songloft 应用中打开', 'error');
            return;
          }
          const original = btn.textContent;
          btn.textContent = '⏳ 导入中...';
          btn.disabled = true;
          try {
            await loadPlaylists();
            const result = await importNewsToHost([playItem]);
            if (result.addError) {
              showSnack(`${result.created} 个已创建，但加入歌单失败: ${result.addError}`, 'error');
            } else {
              showSnack(`${result.created} 个已创建，${result.added} 个已加入歌单${result.skipped > 0 ? `，${result.skipped} 个已跳过` : ''}`, 'success');
            }
            btn.textContent = '✓ 已加入歌单';
            btn.classList.add('added');
          } catch (e) {
            showSnack('加入失败: ' + (e && e.message ? e.message : String(e)), 'error');
            btn.textContent = original;
          } finally {
            btn.disabled = false;
          }
        }
      });
    });
  });
}

function collectItemFromEl(el) {
  const id = el.dataset.id;
  const source = el.dataset.source;
  const titleEl = el.querySelector('.news-title');
  const metaEl = el.querySelector('.news-meta');
  const summaryEl = el.querySelector('.news-summary');
  
  const sourceName = metaEl?.querySelector('.news-source')?.textContent || source;
  const audioBadge = metaEl?.querySelector('.audio-badge');
  
  return {
    id,
    source,
    sourceName,
    title: titleEl?.textContent || '',
    summary: summaryEl?.textContent || '',
    url: el.dataset.url || '',
    audioUrl: el.querySelector('.play-btn[data-action="play-audio"]')?.dataset.url || '',
  };
}

async function showNewsDetail(source, id) {
  const result = await api(`/news/detail?source_id=${source}&id=${encodeURIComponent(id)}`);
  if (result.code !== 0) {
    showToast(result.msg || '加载失败', 'error');
    return;
  }
  const data = result.data;
  const news = data.news || {};
  document.getElementById('detailTitle').textContent = news.title;
  document.getElementById('detailMeta').textContent = `${news.sourceName || news.source} · ${formatTime(news.publishTime)}`;
  document.getElementById('detailContent').textContent = data.content || news.summary || '暂无内容';
  const link = document.getElementById('detailLink');
  link.href = news.url || '#';
  document.getElementById('detailModal').classList.add('active');
}

// Tab 切换
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    currentTab = tab.dataset.tab;
    const panel = document.getElementById('panel-' + currentTab);
    if (panel) panel.classList.add('active');
    
    if (currentTab === 'hotboard') loadHotboard();
    if (currentTab === 'news') loadNewsPanel();
    if (currentTab === 'player') loadPlayableNews();
    if (currentTab === 'playlist') loadPlaylist();
    if (currentTab === 'sources') loadSourceList();
  });
});

// 关闭模态框
document.querySelector('.close').addEventListener('click', () => {
  document.getElementById('detailModal').classList.remove('active');
});
document.getElementById('detailModal').addEventListener('click', (e) => {
  if (e.target.id === 'detailModal') {
    document.getElementById('detailModal').classList.remove('active');
  }
});

function renderCategoryTabs(categories) {
  const container = document.getElementById('categoryTabs');
  if (!container) return;
  container.innerHTML = categories.map(cat => `
    <div class="category-tab ${cat.id === currentCategory ? 'active' : ''}" data-category="${escapeHtml(cat.id)}">
      ${escapeHtml(cat.name)}
    </div>
  `).join('');
  
  container.querySelectorAll('.category-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      currentCategory = tab.dataset.category;
      renderCategoryTabs(aggregateCategories);
      loadHotboard();
    });
  });
}

// 热榜
async function loadHotboard() {
  const container = document.getElementById('hotboardList');
  const categoryTabs = document.getElementById('categoryTabs');
  const aggregate = document.getElementById('aggregateMode').checked;

  container.innerHTML = '<div class="empty">加载中...</div>';
  
  if (categoryTabs) {
    categoryTabs.style.display = aggregate ? 'flex' : 'none';
  }

  if (aggregate) {
    const result = await api(`/aggregate/hotboard?limit=50&category=${encodeURIComponent(currentCategory)}`);
    if (result.code !== 0) {
      container.innerHTML = `<div class="empty">${result.msg || '加载失败'}</div>`;
      return;
    }
    const data = result.data || {};
    const news = data.news || [];
    aggregateCategories = data.categories || [];
    
    renderCategoryTabs(aggregateCategories);
    
    if (news.length === 0) {
      container.innerHTML = '<div class="empty">暂无数据</div>';
      return;
    }
    container.innerHTML = news.map((item, i) => renderNewsItem(item, i, true, true)).join('');
    attachNewsItemHandlers(container);
  } else {
    const result = await api('/news/hotboard?source_id=baidu&limit=30');
    if (result.code !== 0) {
      container.innerHTML = `<div class="empty">${result.msg || '加载失败'}</div>`;
      return;
    }
    const news = (result.data && result.data.news) || [];
    if (news.length === 0) {
      container.innerHTML = '<div class="empty">暂无数据</div>';
      return;
    }
    container.innerHTML = news.map((item, i) => renderNewsItem(item, i)).join('');
    attachNewsItemHandlers(container);
  }
}

document.getElementById('aggregateMode').addEventListener('change', () => {
  currentCategory = 'all';
  loadHotboard();
});

// 新闻面板
async function loadNewsPanel() {
  const sourcesResp = await api('/sources');
  const sources = sourcesResp.data || [];
  const sourceSelect = document.getElementById('newsSource');
  
  // 按类型分组：音频源和文字源
  const audioSources = sources.filter(s => s.supportAudio);
  const textSources = sources.filter(s => !s.supportAudio);
  
  let html = '';
  if (audioSources.length > 0) {
    html += '<optgroup label="🎧 音频源">';
    html += audioSources.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
    html += '</optgroup>';
  }
  if (textSources.length > 0) {
    html += '<optgroup label="📰 文字源">';
    html += textSources.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
    html += '</optgroup>';
  }
  sourceSelect.innerHTML = html;
  
  if (sources.length > 0) {
    sourceSelect.value = sources[0].id;
    await loadCategories(sources[0].id);
  }
  
  sourceSelect.addEventListener('change', () => loadCategories(sourceSelect.value));
}

async function loadCategories(sourceId) {
  const result = await api(`/news/categories?source_id=${sourceId}`);
  const select = document.getElementById('newsCategory');
  if (result.code !== 0 || !result.data) {
    select.innerHTML = '<option value="">无分类</option>';
    return;
  }
  const cats = result.data.categories || [];
  select.innerHTML = cats.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
}

document.getElementById('loadNewsBtn').addEventListener('click', async () => {
  const sourceId = document.getElementById('newsSource').value;
  const category = document.getElementById('newsCategory').value;
  const container = document.getElementById('newsList');
  container.innerHTML = '<div class="empty">加载中...</div>';
  
  const result = await api(`/news/list?source_id=${sourceId}&category=${encodeURIComponent(category)}&page=1&limit=20`);
  if (result.code !== 0) {
    container.innerHTML = `<div class="empty">${result.msg || '加载失败'}</div>`;
    return;
  }
  const news = (result.data && result.data.news) || [];
  if (news.length === 0) {
    container.innerHTML = '<div class="empty">暂无数据</div>';
    return;
  }
  container.innerHTML = news.map((item, i) => renderNewsItem(item, i)).join('');
  attachNewsItemHandlers(container);
});

// 搜索
document.getElementById('searchBtn').addEventListener('click', async () => {
  const keyword = document.getElementById('searchInput').value.trim();
  const sourceId = document.getElementById('searchSource').value;
  
  if (!keyword) {
    showToast('请输入关键词', 'error');
    return;
  }
  
  const container = document.getElementById('searchResults');
  container.innerHTML = '<div class="empty">搜索中...</div>';
  
  const result = await api('/news/search', {
    method: 'POST',
    body: JSON.stringify({ keyword, source_id: sourceId, page: 1, page_size: 30 }),
  });
  
  if (result.code !== 0) {
    container.innerHTML = `<div class="empty">${result.msg || '搜索失败'}</div>`;
    return;
  }
  const news = result.data?.results || [];
  if (news.length === 0) {
    container.innerHTML = '<div class="empty">未找到相关结果</div>';
    return;
  }
  container.innerHTML = news.map((item, i) => renderNewsItem(item, i)).join('');
  attachNewsItemHandlers(container);
});

document.getElementById('searchInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('searchBtn').click();
});

// 可播放新闻
async function loadPlayableNews() {
  const container = document.getElementById('playableList');
  container.innerHTML = '<div class="empty">加载中...</div>';
  
  const result = await api('/player/playable?limit=30');
  if (result.code !== 0) {
    container.innerHTML = `<div class="empty">${result.msg || '加载失败'}</div>`;
    return;
  }
  
  const news = result.data?.news || [];
  if (news.length === 0) {
    container.innerHTML = '<div class="empty">暂无新闻</div>';
    return;
  }
  
  container.innerHTML = news.map((item, i) => renderNewsItem(item, i)).join('');
  attachNewsItemHandlers(container);
}

document.getElementById('playAllBtn').addEventListener('click', async () => {
  const result = await api('/player/playable?limit=20');
  if (result.code !== 0 || !result.data?.news) {
    showToast('加载失败', 'error');
    return;
  }
  const mode = document.getElementById('playerMode').value;
  player.setTtsMode(mode);
  player.setQueue(result.data.news, 0);
  showToast('开始播放', 'success');
});

document.getElementById('playerMode').addEventListener('change', (e) => {
  player.setTtsMode(e.target.value);
  updateModeDisplay();
});

function updateModeDisplay() {
  const mode = document.getElementById('playerMode').value;
  const display = document.getElementById('playerModeDisplay');
  const modeMap = {
    auto: '🔊 自动模式（优先音频）',
    audio: '🎵 仅音频模式',
    tts: '📖 TTS 朗读模式',
  };
  display.textContent = modeMap[mode] || '';
}

// 播放列表
async function loadPlaylist() {
  const result = await api('/player/playlist');
  if (result.code !== 0) {
    showToast('加载失败', 'error');
    return;
  }
  const list = result.data?.items || [];
  document.getElementById('playlistCount').textContent = `${list.length} 首`;
  
  const container = document.getElementById('playlistList');
  if (list.length === 0) {
    container.innerHTML = '<div class="empty">播放列表为空</div>';
    return;
  }
  
  container.innerHTML = list.map((item, i) => renderNewsItem(item, i)).join('');
  attachPlaylistHandlers(container, list);
}

function attachPlaylistHandlers(container, list) {
  container.querySelectorAll('.news-item').forEach((el, i) => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.play-actions')) return;
      // 点击播放此项
      const item = list[i];
      player.setTtsMode('auto');
      player.setQueue(list, i);
    });
    
    el.querySelectorAll('.play-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const item = list[i];
        
        if (action === 'play-audio') {
          player.setTtsMode('audio');
          player.setQueue([item], 0);
        } else if (action === 'play-tts') {
          player.setTtsMode('tts');
          player.setQueue([item], 0);
        } else if (action === 'add-playlist') {
          // 移除
          const result = await api(`/player/playlist/remove?id=${encodeURIComponent(item.id)}&source=${encodeURIComponent(item.source)}`, {
            method: 'DELETE',
          });
          if (result.code === 0) {
            showToast('已移除', 'success');
            loadPlaylist();
          }
        } else if (action === 'add-to-host') {
          if (!item.audioUrl) {
            showSnack('该新闻无音频，无法加入歌单', 'info');
            return;
          }
          if (!P) {
            showSnack('宿主桥接不可用，请在 Songloft 应用中打开', 'error');
            return;
          }
          const original = btn.textContent;
          btn.textContent = '⏳ 导入中...';
          btn.disabled = true;
          try {
            await loadPlaylists();
            const result = await importNewsToHost([item]);
            showSnack(`${result.created} 个已创建，${result.added} 个已加入歌单${result.skipped > 0 ? `，${result.skipped} 个已跳过` : ''}`, 'success');
            btn.textContent = '✓ 已加入歌单';
            btn.classList.add('added');
          } catch (e) {
            showSnack('加入失败: ' + (e && e.message ? e.message : String(e)), 'error');
            btn.textContent = original;
          } finally {
            btn.disabled = false;
          }
        }
      });
    });
  });
}

document.getElementById('playPlaylistBtn').addEventListener('click', async () => {
  // 重新从 API 加载播放列表
  const result = await api('/player/playlist');
  if (result.code !== 0 || !result.data?.items || result.data.items.length === 0) {
    showToast('播放列表为空', 'error');
    return;
  }
  player.setQueue(result.data.items, 0);
  showToast('开始播放列表', 'success');
});

document.getElementById('clearPlaylistBtn').addEventListener('click', async () => {
  if (!confirm('确认清空播放列表？')) return;
  const result = await api('/player/playlist/clear?listName=default', { method: 'DELETE' });
  if (result.code === 0) {
    showToast('已清空', 'success');
    loadPlaylist();
  }
});

// 脚本管理
async function loadSourceList() {
  const result = await api('/custom-sources');
  const list = document.getElementById('sourceList');
  if (result.code !== 0 || !result.data) {
    list.innerHTML = '<div class="empty">加载失败</div>';
    return;
  }
  const sources = result.data.sources || [];
  if (sources.length === 0) {
    list.innerHTML = '<div class="empty">尚未导入任何自定义脚本</div>';
    return;
  }
  list.innerHTML = sources.map(s => `
    <div class="source-item" data-id="${escapeHtml(s.id)}">
      <label class="switch">
        <input type="checkbox" ${s.enabled ? 'checked' : ''}>
        <span class="slider"></span>
      </label>
      <div class="source-info">
        <div class="source-name">${escapeHtml(s.name)} <small>v${escapeHtml(s.version || '1.0.0')}</small></div>
        <div class="source-meta">
          作者: ${escapeHtml(s.author || '未知')} | 
          平台: ${(s.platforms || []).map(escapeHtml).join(', ') || '通用'} | 
          ${formatTime(s.updateTime)}
        </div>
        ${s.description ? `<div class="source-meta">${escapeHtml(s.description)}</div>` : ''}
      </div>
      <div class="source-actions">
        <button class="delete-btn danger">删除</button>
      </div>
    </div>
  `).join('');
  
  list.querySelectorAll('.source-item').forEach(item => {
    const id = item.dataset.id;
    const switchInput = item.querySelector('input[type="checkbox"]');
    switchInput.addEventListener('change', async () => {
      const result = await api('/custom-sources/toggle', {
        method: 'PUT',
        body: JSON.stringify({ id, enabled: switchInput.checked }),
      });
      if (result.code === 0) {
        showToast(switchInput.checked ? '已启用' : '已禁用', 'success');
      } else {
        switchInput.checked = !switchInput.checked;
        showToast('操作失败', 'error');
      }
    });
    item.querySelector('.delete-btn').addEventListener('click', async () => {
      if (!confirm('确认删除此脚本？')) return;
      const result = await api(`/custom-sources?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (result.code === 0) {
        showToast('已删除', 'success');
        loadSourceList();
      } else {
        showToast('删除失败', 'error');
      }
    });
  });
}

document.getElementById('importScriptBtn').addEventListener('click', async () => {
  const name = document.getElementById('scriptName').value.trim() || 'imported';
  const content = document.getElementById('scriptContent').value.trim();
  if (!content) {
    showToast('请输入脚本内容', 'error');
    return;
  }
  const result = await api('/custom-sources/import', {
    method: 'POST',
    body: JSON.stringify({ name, content }),
  });
  if (result.code === 0) {
    showToast('导入成功', 'success');
    document.getElementById('scriptContent').value = '';
    document.getElementById('scriptName').value = '';
    loadSourceList();
  } else {
    showToast('导入失败: ' + (result.msg || ''), 'error');
  }
});

document.getElementById('importUrlBtn').addEventListener('click', async () => {
  const url = document.getElementById('scriptUrl').value.trim();
  if (!url) {
    showToast('请输入 URL', 'error');
    return;
  }
  showToast('导入中...', 'info');
  const result = await api('/custom-sources/import-url', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
  if (result.code === 0) {
    showToast('导入成功', 'success');
    document.getElementById('scriptUrl').value = '';
    loadSourceList();
  } else {
    showToast('导入失败: ' + (result.msg || ''), 'error');
  }
});

document.getElementById('reloadSourcesBtn').addEventListener('click', async () => {
  const result = await api('/custom-sources/reload', { method: 'POST' });
  if (result.code === 0) {
    showToast('已重新加载', 'success');
    loadSourceList();
  } else {
    showToast('重载失败', 'error');
  }
});

// ============= 播放器控制 =============

function setupPlayer() {
  player = new NewsPlayer();
  
  const playerPanel = document.getElementById('playerPanel');
  const playerTitle = document.getElementById('playerTitle');
  const playerSubtitle = document.getElementById('playerSubtitle');
  const playerCover = document.getElementById('playerCover');
  const playerIcon = document.getElementById('playerIcon');
  const playerPlayBtn = document.getElementById('playerPlayBtn');
  const playerPrevBtn = document.getElementById('playerPrevBtn');
  const playerNextBtn = document.getElementById('playerNextBtn');
  const playerModeBtn = document.getElementById('playerModeBtn');
  const playerCloseBtn = document.getElementById('playerCloseBtn');
  const playerVolumeBtn = document.getElementById('playerVolumeBtn');
  const playerVolumePopup = document.getElementById('playerVolumePopup');
  const playerVolumeRange = document.getElementById('playerVolumeRange');
  const playerRate = document.getElementById('playerRate');
  const playerProgressBar = document.getElementById('playerProgressBar');
  const playerProgressFill = document.getElementById('playerProgressFill');
  const playerCurrentTime = document.getElementById('playerCurrentTime');
  const playerDuration = document.getElementById('playerDuration');
  
  function updateUI() {
    const state = player.getState();
    if (state.currentItem) {
      playerPanel.classList.add('active');
      playerTitle.textContent = state.currentItem.title || '未知';
      playerSubtitle.textContent = `${state.currentItem.sourceName || state.currentItem.source} · ${formatTime(state.currentItem.publishTime)}`;
      if (state.currentItem.cover) {
        playerCover.src = state.currentItem.cover;
        playerCover.style.display = 'block';
      } else {
        playerCover.style.display = 'none';
      }
    } else {
      playerPanel.classList.remove('active');
    }
    playerPlayBtn.textContent = state.isPlaying ? '⏸' : '▶';
    
    // 高亮正在播放的卡片
    document.querySelectorAll('.news-item.playing').forEach(el => el.classList.remove('playing'));
    if (state.currentItem) {
      const el = document.querySelector(`.news-item[data-id="${state.currentItem.id}"][data-source="${state.currentItem.source}"]`);
      if (el) el.classList.add('playing');
    }
  }
  
  player.on('itemchange', updateUI);
  player.on('play', updateUI);
  player.on('pause', updateUI);
  player.on('stop', updateUI);
  player.on('ttsmodechange', updateModeDisplay);
  
  player.on('timeupdate', (data) => {
    playerCurrentTime.textContent = formatDuration(data.currentTime);
    playerDuration.textContent = formatDuration(data.duration);
    playerProgressFill.style.width = (data.progress * 100) + '%';
  });
  
  player.on('loadedmetadata', (data) => {
    playerDuration.textContent = formatDuration(data.duration);
  });
  
  playerPlayBtn.addEventListener('click', () => player.toggle());
  playerPrevBtn.addEventListener('click', () => player.prev());
  playerNextBtn.addEventListener('click', () => player.next());
  playerCloseBtn.addEventListener('click', () => {
    player.stop();
    playerPanel.classList.remove('active');
  });
  
  const playModes = ['queue', 'loop', 'single'];
  const modeIcons = { queue: '🔁', loop: '🔂', single: '1️⃣' };
  playerModeBtn.addEventListener('click', () => {
    const idx = playModes.indexOf(player.playMode);
    const next = playModes[(idx + 1) % playModes.length];
    player.setPlayMode(next);
    playerModeBtn.textContent = modeIcons[next] || '🔁';
    showToast(`播放模式：${next === 'queue' ? '列表循环' : next === 'loop' ? '单曲循环' : '单曲'}`, 'info');
  });
  
  playerVolumeBtn.addEventListener('click', () => {
    playerVolumePopup.classList.toggle('active');
  });
  
  playerVolumeRange.addEventListener('input', (e) => {
    player.setVolume(Number(e.target.value) / 100);
  });
  
  playerRate.addEventListener('change', (e) => {
    player.setRate(Number(e.target.value));
  });
  
  playerProgressBar.addEventListener('click', (e) => {
    const rect = playerProgressBar.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    player.seek(x);
  });
  
  updateModeDisplay();
}

function showImportResult(created, added, skipped) {
  const resultCard = document.getElementById('import-result');
  if (!resultCard) return;
  resultCard.style.display = '';
  var html = '';
  html += '<div class="result-item">';
  html += '<div class="result-icon success">✓</div>';
  html += '<div class="result-text"><span class="result-num">' + created + '</span> 个新闻已创建</div>';
  html += '</div>';
  html += '<div class="result-item">';
  html += '<div class="result-icon info">📋</div>';
  html += '<div class="result-text"><span class="result-num">' + added + '</span> 个已添加到歌单';
  if (skipped > 0) html += '，<span style="color:var(--news-on-surface-variant)">' + skipped + ' 个已跳过（重复）</span>';
  html += '</div></div>';
  resultCard.innerHTML = html;
  resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function initImportUI() {
  const playlistSelect = document.getElementById('playlist-select');
  const btnNewPlaylist = document.getElementById('btn-new-playlist');
  const btnBatchImport = document.getElementById('btn-batch-import');
  const dialogOverlay = document.getElementById('newPlaylistModal');
  const dialogCancel = document.getElementById('dialog-cancel');
  const dialogConfirm = document.getElementById('dialog-confirm');
  const newPlaylistName = document.getElementById('new-playlist-name');

  if (playlistSelect) {
    playlistSelect.addEventListener('change', function () {
      targetPlaylistId = parseInt(playlistSelect.value);
      if (P) {
        P.apiPost('/api/settings', { last_playlist_id: targetPlaylistId }).catch(function () {});
      }
    });
  }

  if (btnNewPlaylist && dialogOverlay) {
    btnNewPlaylist.addEventListener('click', function () {
      if (newPlaylistName) newPlaylistName.value = '';
      dialogOverlay.style.display = 'flex';
      if (newPlaylistName) newPlaylistName.focus();
    });
  }

  if (dialogCancel && dialogOverlay) {
    dialogCancel.addEventListener('click', function () {
      dialogOverlay.style.display = 'none';
    });
  }

  if (dialogOverlay) {
    dialogOverlay.addEventListener('click', function (e) {
      if (e.target === dialogOverlay) dialogOverlay.style.display = 'none';
    });
  }

  if (dialogConfirm && newPlaylistName && dialogOverlay) {
    dialogConfirm.addEventListener('click', function () {
      var name = newPlaylistName.value.trim();
      if (!name) {
        showSnack('请输入歌单名称', 'error');
        return;
      }
      dialogConfirm.disabled = true;
      createNewsPlaylist(name).then(function (data) {
        dialogOverlay.style.display = 'none';
        showSnack('歌单已创建');
        playlists.push(data);
        targetPlaylistId = data.id;
        renderPlaylistSelect();
      }).catch(function (err) {
        showSnack(err.message || '创建失败', 'error');
      }).finally(function () {
        dialogConfirm.disabled = false;
      });
    });
  }

  if (newPlaylistName) {
    newPlaylistName.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        const confirmBtn = document.getElementById('dialog-confirm');
        if (confirmBtn) confirmBtn.click();
      }
    });
  }

  if (btnBatchImport) {
    btnBatchImport.addEventListener('click', async function () {
      const result = await api('/player/playable?limit=30');
      if (result.code !== 0 || !result.data?.news || result.data.news.length === 0) {
        showSnack('暂无可导入的新闻', 'info');
        return;
      }
      const newsItems = result.data.news.filter(n => !!n.audioUrl);
      if (newsItems.length === 0) {
        showSnack('暂无带音频的新闻', 'info');
        return;
      }
      btnBatchImport.disabled = true;
      btnBatchImport.innerHTML = '<span>⏳ 导入中...</span>';
      try {
        await loadPlaylists();
        const importResult = await importNewsToHost(newsItems);
        showImportResult(importResult.created, importResult.added, importResult.skipped);
      } catch (e) {
        showSnack('批量导入失败: ' + (e && e.message ? e.message : String(e)), 'error');
      } finally {
        btnBatchImport.disabled = false;
        btnBatchImport.innerHTML = '批量导入到歌单';
      }
    });
  }
}

window.songloftToast = showToast;

function init() {
  setupPlayer();
  loadPlaylists();
  loadSettings();
  initImportUI();
  loadHotboard();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
