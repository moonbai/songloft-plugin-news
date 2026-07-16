export { 
  getPlaylists, setPlaylists, getDefaultPlaylist,
  addToPlaylist, removeFromPlaylist, clearPlaylist,
  getTtsConfig, setTtsConfig, getDefaultTtsConfig,
} from './storage';
export type { PlaylistItem, TtsConfig } from './storage';
export { buildTtsScript, estimateSpeechDuration } from './tts';
export type { TtsSegment } from './tts';
