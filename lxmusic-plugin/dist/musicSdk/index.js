"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.httpFetch = void 0;
exports.sizeFormate = sizeFormate;
exports.decodeName = decodeName;
exports.formatPlayTime = formatPlayTime;
exports.formatPlayTimeMs = formatPlayTimeMs;
exports.dateFormat = dateFormat;
exports.formatPlayCount = formatPlayCount;
exports.getQuality = getQuality;
exports.generateRandomId = generateRandomId;
function sizeFormate(size) {
    if (size < 1024)
        return size + 'B';
    if (size < 1024 * 1024)
        return (size / 1024).toFixed(2) + 'KB';
    if (size < 1024 * 1024 * 1024)
        return (size / (1024 * 1024)).toFixed(2) + 'MB';
    return (size / (1024 * 1024 * 1024)).toFixed(2) + 'GB';
}
function decodeName(name) {
    try {
        return decodeURIComponent(name.replace(/\+/g, '%20'));
    }
    catch {
        return name;
    }
}
function formatPlayTime(time) {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
function formatPlayTimeMs(time) {
    return formatPlayTime(time / 1000);
}
function dateFormat(timestamp, format = 'YYYY-MM-DD HH:mm:ss') {
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
function formatPlayCount(count) {
    if (count < 10000)
        return count.toString();
    if (count < 100000000)
        return (count / 10000).toFixed(1) + '万';
    return (count / 100000000).toFixed(1) + '亿';
}
function getQuality(quality) {
    const map = {
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
function generateRandomId() {
    return Math.random().toString(36).substring(2, 15);
}
var request_1 = require("./request");
Object.defineProperty(exports, "httpFetch", { enumerable: true, get: function () { return request_1.httpFetch; } });
__exportStar(require("./crypto-shim"), exports);
