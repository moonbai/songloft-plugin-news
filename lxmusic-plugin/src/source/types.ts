export interface SourceMeta {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  homepage?: string;
  enabled: boolean;
  loading: boolean;
  platforms: string[];
  rawScript: string;
  successCalls: number;
  totalCalls: number;
  error?: string;
}

export interface SourceIndexItem {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
}
