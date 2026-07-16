"use strict";
// HTTP 请求封装
Object.defineProperty(exports, "__esModule", { value: true });
function httpFetch(url, options = {}) {
    return (async () => {
        const resp = await songloft.http.fetch(url, {
            method: options.method || 'GET',
            headers: options.headers || {},
            body: options.body,
            timeout: options.timeout || 15000,
        });
        const text = typeof resp.body === 'string' ? resp.body : new TextDecoder().decode(resp.body);
        let body = text;
        const contentType = resp.headers['Content-Type'] || resp.headers['content-type'] || '';
        if (contentType.includes('application/json')) {
            try {
                body = JSON.parse(text);
            }
            catch (e) {
                body = text;
            }
        }
        return {
            status: resp.status,
            body,
            raw: text,
        };
    })();
}
exports.default = httpFetch;
