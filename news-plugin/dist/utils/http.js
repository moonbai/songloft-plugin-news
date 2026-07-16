"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.httpGet = httpGet;
exports.httpGetJson = httpGetJson;
// 通用 HTTP 工具
async function httpGet(url, headers = {}) {
    const resp = await songloft.http.fetch(url, {
        method: 'GET',
        headers,
        timeout: 15000,
    });
    return typeof resp.body === 'string' ? resp.body : new TextDecoder().decode(resp.body);
}
async function httpGetJson(url, headers = {}) {
    const resp = await songloft.http.fetch(url, {
        method: 'GET',
        headers,
        timeout: 15000,
    });
    const text = typeof resp.body === 'string' ? resp.body : new TextDecoder().decode(resp.body);
    try {
        return JSON.parse(text);
    }
    catch (e) {
        return text;
    }
}
