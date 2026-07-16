export function sizeFormate(size: number): string {
  if (size < 1024) return size + 'B';
  if (size < 1024 * 1024) return (size / 1024).toFixed(2) + 'KB';
  if (size < 1024 * 1024 * 1024) return (size / (1024 * 1024)).toFixed(2) + 'MB';
  return (size / (1024 * 1024 * 1024)).toFixed(2) + 'GB';
}

export function decodeName(name: string): string {
  try {
    return decodeURIComponent(name.replace(/\+/g, '%20'));
  } catch {
    return name;
  }
}

export function formatPlayTime(time: number): string {
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function formatPlayTimeMs(time: number): string {
  return formatPlayTime(time / 1000);
}

export function dateFormat(timestamp: number, format: string = 'YYYY-MM-DD HH:mm:ss'): string {
  const date = new Date(timestamp * 1000);
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  
  return format
    .replace('YYYY', year.toString())
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
}

export function formatPlayCount(count: number): string {
  if (count < 10000) return count.toString();
  if (count < 100000000) return (count / 10000).toFixed(1) + '万';
  return (count / 100000000).toFixed(1) + '亿';
}

export function getQuality(quality: string): string {
  const map: Record<string, string> = {
    '128k': '128kbps',
    '320k': '320kbps',
    'flac': '无损',
    'ape': 'APE',
    'hq': '高品质',
    'sq': '无损',
    'exhigh': '极高',
    'standard': '标准',
  };
  return map[quality] || quality;
}

export function generateRandomId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export { httpFetch } from './request';
export * from './crypto-shim';
