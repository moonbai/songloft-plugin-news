"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.platformModules = exports.dedaoModule = exports.ximalayaModule = exports.zhihuModule = exports.baiduModule = exports.wangyiModule = exports.pengpaiModule = exports.toutiaoModule = exports.sources = void 0;
const toutiao_1 = __importDefault(require("./toutiao"));
const pengpai_1 = __importDefault(require("./pengpai"));
const wangyi_1 = __importDefault(require("./wangyi"));
const baidu_1 = __importDefault(require("./baidu"));
const zhihu_1 = __importDefault(require("./zhihu"));
const ximalaya_1 = __importDefault(require("./ximalaya"));
const dedao_1 = __importDefault(require("./dedao"));
exports.sources = [
    { id: 'toutiao', name: '今日头条', supportAudio: false, supportTts: true },
    { id: 'pengpai', name: '澎湃新闻', supportAudio: false, supportTts: true },
    { id: 'wangyi', name: '网易新闻', supportAudio: false, supportTts: true },
    { id: 'baidu', name: '百度热搜', supportAudio: false, supportTts: true },
    { id: 'zhihu', name: '知乎热榜', supportAudio: false, supportTts: true },
    { id: 'ximalaya', name: '喜马拉雅', supportAudio: true, supportTts: false },
    { id: 'dedao', name: '得到', supportAudio: true, supportTts: true },
];
exports.toutiaoModule = toutiao_1.default;
exports.pengpaiModule = pengpai_1.default;
exports.wangyiModule = wangyi_1.default;
exports.baiduModule = baidu_1.default;
exports.zhihuModule = zhihu_1.default;
exports.ximalayaModule = ximalaya_1.default;
exports.dedaoModule = dedao_1.default;
exports.platformModules = {
    toutiao: toutiao_1.default,
    pengpai: pengpai_1.default,
    wangyi: wangyi_1.default,
    baidu: baidu_1.default,
    zhihu: zhihu_1.default,
    ximalaya: ximalaya_1.default,
    dedao: dedao_1.default,
};
exports.default = exports.platformModules;
