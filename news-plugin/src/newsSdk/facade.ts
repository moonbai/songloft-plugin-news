import toutiao from './toutiao';
import pengpai from './pengpai';
import wangyi from './wangyi';
import baidu from './baidu';
import zhihu from './zhihu';
import ximalaya from './ximalaya';
import dedao from './dedao';

export const sources = [
  { id: 'toutiao', name: '今日头条', supportAudio: false, supportTts: true },
  { id: 'pengpai', name: '澎湃新闻', supportAudio: false, supportTts: true },
  { id: 'wangyi', name: '网易新闻', supportAudio: false, supportTts: true },
  { id: 'baidu', name: '百度热搜', supportAudio: false, supportTts: true },
  { id: 'zhihu', name: '知乎热榜', supportAudio: false, supportTts: true },
  { id: 'ximalaya', name: '喜马拉雅', supportAudio: true, supportTts: false },
  { id: 'dedao', name: '得到', supportAudio: true, supportTts: true },
];

export const toutiaoModule = toutiao;
export const pengpaiModule = pengpai;
export const wangyiModule = wangyi;
export const baiduModule = baidu;
export const zhihuModule = zhihu;
export const ximalayaModule = ximalaya;
export const dedaoModule = dedao;

export const platformModules: Record<string, any> = {
  toutiao,
  pengpai,
  wangyi,
  baidu,
  zhihu,
  ximalaya,
  dedao,
};

export default platformModules;
