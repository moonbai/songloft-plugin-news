import toutiao from './toutiao';
import pengpai from './pengpai';
import wangyi from './wangyi';
import baidu from './baidu';
import zhihu from './zhihu';
import ximalaya from './ximalaya';
import dedao from './dedao';
import weibo from './weibo';
import kr36 from './36kr';
import ithome from './ithome';
import huxiu from './huxiu';
import sspai from './sspai';
import juejin from './juejin';

export const sources = [
  { id: 'weibo', name: '微博热搜', supportAudio: false, supportTts: true },
  { id: 'baidu', name: '百度热搜', supportAudio: false, supportTts: true },
  { id: 'zhihu', name: '知乎热榜', supportAudio: false, supportTts: true },
  { id: '36kr', name: '36氪', supportAudio: false, supportTts: true },
  { id: 'ithome', name: 'IT之家', supportAudio: false, supportTts: true },
  { id: 'huxiu', name: '虎嗅', supportAudio: false, supportTts: true },
  { id: 'sspai', name: '少数派', supportAudio: false, supportTts: true },
  { id: 'juejin', name: '掘金', supportAudio: false, supportTts: true },
  { id: 'toutiao', name: '今日头条', supportAudio: false, supportTts: true },
  { id: 'pengpai', name: '澎湃新闻', supportAudio: false, supportTts: true },
  { id: 'wangyi', name: '网易新闻', supportAudio: false, supportTts: true },
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
export const weiboModule = weibo;
export const kr36Module = kr36;
export const ithomeModule = ithome;
export const huxiuModule = huxiu;
export const sspaiModule = sspai;
export const juejinModule = juejin;

export const platformModules: Record<string, any> = {
  toutiao,
  pengpai,
  wangyi,
  baidu,
  zhihu,
  ximalaya,
  dedao,
  weibo,
  '36kr': kr36,
  ithome,
  huxiu,
  sspai,
  juejin,
};

export default platformModules;
