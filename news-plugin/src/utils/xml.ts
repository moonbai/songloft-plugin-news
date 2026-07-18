import type { NewsItem } from '../types';

export interface RssItem {
  title: string;
  audioUrl: string;
  description: string;
  pubDate: string;
  link: string;
  duration?: string;
  image?: string;
}

export function parseRssXml(xmlStr: string): RssItem[] {
  const items: RssItem[] = [];
  const itemReg = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemReg.exec(xmlStr)) !== null) {
    const itemXml = match[1];

    const title = decodeHtmlEntities(
      itemXml.match(/<title>(.*?)<\/title>/s)?.[1] || ''
    ).trim();

    const enclosureMatch = itemXml.match(/enclosure[^>]*url="([^"]+\.mp3[^"]*)"/i);
    const audioUrl = enclosureMatch?.[1] || '';

    const description = decodeHtmlEntities(
      stripHtml(itemXml.match(/<description>(.*?)<\/description>/s)?.[1] || '')
    ).trim();

    const pubDate = itemXml.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';
    const link = itemXml.match(/<link>(.*?)<\/link>/)?.[1] || '';
    const duration = itemXml.match(/<itunes:duration>(.*?)<\/itunes:duration>/)?.[1] ||
      itemXml.match(/duration="([^"]+)"/)?.[1] || '';
    const image = itemXml.match(/<itunes:image[^>]*href="([^"]+)"/)?.[1] ||
      itemXml.match(/image[^>]*url="([^"]+)"/i)?.[1] || '';

    if (audioUrl) {
      items.push({ title, audioUrl, description, pubDate, link, duration, image });
    }
  }

  return items;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ');
}

function decodeHtmlEntities(str: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&apos;': "'",
    '&nbsp;': ' ',
  };
  return str.replace(/&[a-z]+;/gi, (m) => entities[m.toLowerCase()] || ' ');
}

export function parseRssDate(dateStr: string): number {
  const d = new Date(dateStr);
  const ts = d.getTime();
  return isNaN(ts) ? Date.now() : ts;
}

export function parseDuration(durationStr: string): number {
  if (!durationStr) return 0;
  const parts = durationStr.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return parseInt(durationStr) || 0;
}
