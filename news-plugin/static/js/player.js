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
      const result = await fetch('/api/player/tts-config').then(r => r.json());
      if (result.code === 0 && result.data) {
        this.ttsConfig = { ...this.ttsConfig, ...result.data };
      }
    } catch (e) {
      // 忽略
    }
  }
  
  async _saveTtsConfig() {
    try {
      await fetch('/api/player/tts-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    
    // 决定播放方式
    if (this.currentItem.audioUrl && this.ttsMode !== 'tts') {
      // 优先使用音频
      await this._playAudio(this.currentItem.audioUrl);
    } else if (this.ttsConfig.enableTts && this.ttsMode !== 'audio') {
      // 使用 TTS
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
    if (!('speechSynthesis' in window)) {
      songloftToast && songloftToast('当前浏览器不支持 TTS', 'error');
      return;
    }
    
    try {
      // 先获取 TTS 脚本（含 content）
      const result = await fetch('/api/player/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ news, enableTts: true }),
      }).then(r => r.json());
      
      if (result.code !== 0) {
        songloftToast && songloftToast('加载失败', 'error');
        return;
      }
      
      const data = result.data;
      const ttsScript = data.ttsScript || [];
      this.isPlaying = true;
      this._emit('play', { item: this.currentItem, mode: 'tts' });
      
      await this._speakSegments(ttsScript);
    } catch (e) {
      songloftToast && songloftToast('TTS 失败: ' + e.message, 'error');
    }
  }
  
  _speakSegments(segments) {
    return new Promise((resolve) => {
      const synth = window.speechSynthesis;
      let i = 0;
      
      const speakNext = () => {
        if (i >= segments.length) {
          resolve();
          return;
        }
        
        const seg = segments[i++];
        if (seg.type === 'pause') {
          setTimeout(speakNext, seg.durationMs || 200);
          return;
        }
        
        const utter = new SpeechSynthesisUtterance(seg.text);
        utter.lang = this.ttsConfig.voice;
        utter.rate = this.ttsConfig.rate;
        utter.pitch = this.ttsConfig.pitch;
        utter.volume = this.ttsConfig.volume;
        utter.onend = speakNext;
        utter.onerror = speakNext;
        this.ttsUtterances.push(utter);
        synth.speak(utter);
      };
      
      synth.cancel();
      speakNext();
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
    this.audio.pause();
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

window.NewsPlayer = NewsPlayer;
