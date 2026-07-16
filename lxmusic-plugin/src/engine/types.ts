export interface LxSource {
  name: string;
  type: string;
  actions: string[];
  qualitys: string[];
}

export interface SourceRuntimeOptions {
  id: string;
  name: string;
  rawScript: string;
}

export interface DispatchResult {
  id: string;
  result?: unknown;
  error?: unknown;
}

export interface MusicUrlRequest {
  source: string;
  action: string;
  info: {
    musicInfo: Record<string, unknown>;
    type: string;
  };
}

export interface RuntimeStats {
  successCalls: number;
  totalCalls: number;
}
