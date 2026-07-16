// musicSdk/request.ts - HTTP 适配层
// 用沙箱 fetch 重写 lxserver 的 httpFetch (needle),保持签名一致
// httpFetch(url, options) => { promise, cancelHttp }
// promise resolve { statusCode, headers, body } — body 自动 JSON.parse
const DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Encoding': 'gzip, deflate',
    'Connection': 'keep-alive',
};
export function httpFetch(url, options = {}) {
    const controller = new AbortController();
    let timer;
    const promise = new Promise((resolve, reject) => {
        const method = (options.method || 'GET').toUpperCase();
        const headers = { ...DEFAULT_HEADERS, ...(options.headers || {}) };
        let bodyData;
        if (options.form) {
            // form 对象 urlencode
            const params = new URLSearchParams();
            for (const [k, v] of Object.entries(options.form)) {
                params.append(k, String(v));
            }
            bodyData = params.toString();
            headers['Content-Type'] = 'application/x-www-form-urlencoded';
        }
        else if (options.formData) {
            // formData 对象 — 简单 urlencode (不做 multipart)
            const params = new URLSearchParams();
            for (const [k, v] of Object.entries(options.formData)) {
                params.append(k, String(v));
            }
            bodyData = params.toString();
            headers['Content-Type'] = 'application/x-www-form-urlencoded';
        }
        else if (options.body !== undefined && options.body !== null) {
            if (typeof options.body === 'string') {
                bodyData = options.body;
            }
            else {
                bodyData = JSON.stringify(options.body);
                headers['Content-Type'] = 'application/json';
            }
        }
        // timeout
        if (options.timeout) {
            timer = setTimeout(() => {
                controller.abort();
                reject(new Error('Request timeout'));
            }, options.timeout);
        }
        fetch(url, {
            method,
            headers,
            body: bodyData,
            signal: controller.signal,
        }).then(async (resp) => {
            if (timer)
                clearTimeout(timer);
            const respHeaders = {};
            resp.headers.forEach((value, key) => {
                respHeaders[key.toLowerCase()] = value;
            });
            // 读取 body 文本
            const text = await resp.text();
            let parsedBody = text;
            // 自动 JSON.parse
            if (text) {
                const ct = respHeaders['content-type'] || '';
                const isJson = ct.includes('application/json') || ct.includes('text/json') || options.json;
                if (isJson || (text.trim().startsWith('{') || text.trim().startsWith('['))) {
                    try {
                        parsedBody = JSON.parse(text);
                    }
                    catch {
                        parsedBody = text;
                    }
                }
            }
            resolve({
                statusCode: resp.status,
                headers: respHeaders,
                body: parsedBody,
            });
        }).catch((err) => {
            if (timer)
                clearTimeout(timer);
            reject(err);
        });
    });
    const cancelHttp = () => {
        try {
            controller.abort();
        }
        catch {
            // ignore
        }
    };
    return { promise, cancelHttp };
}
/** 简化版:直接 await 拿到 result */
export async function httpFetchAsync(url, options) {
    const { promise } = httpFetch(url, options);
    return promise;
}
