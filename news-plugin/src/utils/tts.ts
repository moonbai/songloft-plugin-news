export function buildBaiduTtsUrl(text: string, options?: {
  per?: number;
  rate?: number;
  vol?: number;
}): string {
  const per = options?.per ?? 0;
  const rate = options?.rate ?? 5;
  const vol = options?.vol ?? 9;
  return 'https://tts.baidu.com/text2audio'
    + '?tex=' + encodeURIComponent(text)
    + '&cuid=baike'
    + '&lan=ZH'
    + '&ctp=1'
    + '&pdt=301'
    + '&vol=' + vol
    + '&rate=' + rate
    + '&per=' + per;
}
