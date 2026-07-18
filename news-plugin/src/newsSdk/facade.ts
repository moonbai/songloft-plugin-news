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
import cctv from './cctv';
import cnr from './cnr';
import people from './people';

export const sources = [
  { id: 'cctv', name: '央视新闻', supportAudio: true, supportTts: false, isOfficial: true },
  { id: 'cnr', name: '中国之声', supportAudio: true, supportTts: false, isOfficial: true },
  { id: 'people', name: '人民日报', supportAudio: true, supportTts: false, isOfficial: true },
  { id: 'ximalaya', name: '喜马拉雅', supportAudio: true, supportTts: false, isOfficial: false },
  { id: 'dedao', name: '得到', supportAudio: true, supportTts: true, isOfficial: false },
  { id: 'weibo', name: '微博热搜', supportAudio: false, supportTts: true, isOfficial: false },
  { id: 'baidu', name: '百度热搜', supportAudio: false, supportTts: true, isOfficial: false },
  { id: 'zhihu', name: '知乎热榜', supportAudio: false, supportTts: true, isOfficial: false },
  { id: '36kr', name: '36氪', supportAudio: false, supportTts: true, isOfficial: false },
  { id: 'ithome', name: 'IT之家', supportAudio: false, supportTts: true, isOfficial: false },
  { id: 'huxiu', name: '虎嗅', supportAudio: false, supportTts: true, isOfficial: false },
  { id: 'sspai', name: '少数派', supportAudio: false, supportTts: true, isOfficial: false },
  { id: 'juejin', name: '掘金', supportAudio: false, supportTts: true, isOfficial: false },
  { id: 'toutiao', name: '今日头条', supportAudio: false, supportTts: true, isOfficial: false },
  { id: 'pengpai', name: '澎湃新闻', supportAudio: false, supportTts: true, isOfficial: false },
  { id: 'wangyi', name: '网易新闻', supportAudio: false, supportTts: true, isOfficial: false },
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
export const cctvModule = cctv;
export const cnrModule = cnr;
export const peopleModule = people;

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
  cctv,
  cnr,
  people,
};

export default platformModules;
