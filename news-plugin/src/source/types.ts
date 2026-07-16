export interface CustomSource {
  id: string;
  name: string;
  version?: string;
  author?: string;
  description?: string;
  platforms?: string[];
  script: string;
  enabled: boolean;
  createTime: number;
  updateTime: number;
}
