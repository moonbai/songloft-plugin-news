// LX News 沙箱预置代码 - 在 QuickJS VM 中运行
// 暴露给用户脚本的 API：lx (全局对象)
// 使用 __go_send 发送事件, 使用全局 fetch 发起 HTTP 请求

const lxNewsPrelude = `
globalThis.window = globalThis;
globalThis.global = globalThis;

var __news_handlers = {};
var __news_sources = [];

globalThis.lx = {
  version: '1.0.0',
  sources: {},

  registerSource: function(source) {
    if (!source || !source.id) {
      throw new Error('Source must have id');
    }
    __news_sources.push(source);
    globalThis.lx.sources[source.id] = source;
  },

  on: function(eventName, handler) {
    if (!__news_handlers[eventName]) {
      __news_handlers[eventName] = [];
    }
    __news_handlers[eventName].push(handler);
  },

  request: function(url, options) {
    options = options || {};
    var method = (options.method || 'GET').toUpperCase();
    var headers = Object.assign({
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }, options.headers || {});

    var fetchOptions = { method: method, headers: headers };

    try {
      if (options.body !== undefined && options.body !== null) {
        if (typeof options.body === 'string') {
          fetchOptions.body = options.body;
        } else {
          fetchOptions.body = JSON.stringify(options.body);
          if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
        }
      }
    } catch(e) {
      return Promise.reject(e);
    }

    return fetch(url, fetchOptions).then(function(resp) {
      var respHeaders = {};
      resp.headers.forEach(function(val, key) {
        respHeaders[key.toLowerCase()] = val;
      });
      return resp.text().then(function(text) {
        var parsedBody = text;
        var ct = respHeaders['content-type'] || '';
        if (ct.indexOf('application/json') >= 0 || (text && text.trim() && (text.trim().charAt(0) === '{' || text.trim().charAt(0) === '['))) {
          try { parsedBody = JSON.parse(text); } catch(e) { parsedBody = text; }
        }
        return {
          status: resp.status,
          body: parsedBody,
          raw: text,
          headers: respHeaders,
          json: function() { return JSON.parse(text); },
        };
      });
    });
  },

  send: function(eventName, data) {
    if (eventName === 'inited') {
      globalThis.lx.sources = data.sources || {};
    }
    try {
      __go_send(eventName, JSON.stringify(data));
    } catch(e) {
      // __go_send 可能在某些上下文中不可用
    }
  },

  notifyInited: function() {
    globalThis.lx.send('inited', { sources: __news_sources });
  },

  _dispatch: function(reqId, eventName, data) {
    var handlers = __news_handlers[eventName];
    if (!handlers || handlers.length === 0) {
      __go_send('dispatchError', JSON.stringify({ id: reqId, error: 'No handler for event: ' + eventName }));
      return;
    }

    var settled = false;
    var watchdog = setTimeout(function() {
      if (!settled) {
        settled = true;
        __go_send('dispatchError', JSON.stringify({ id: reqId, error: 'Dispatch timeout (18s)' }));
      }
    }, 18000);

    try {
      var result = handlers[0](data);
      if (result && typeof result.then === 'function') {
        result.then(function(res) {
          if (!settled) {
            settled = true;
            clearTimeout(watchdog);
            __go_send('dispatchResult', JSON.stringify({ id: reqId, result: res }));
          }
        }).catch(function(err) {
          if (!settled) {
            settled = true;
            clearTimeout(watchdog);
            __go_send('dispatchError', JSON.stringify({ id: reqId, error: String(err && err.message || err) }));
          }
        });
      } else {
        if (!settled) {
          settled = true;
          clearTimeout(watchdog);
          __go_send('dispatchResult', JSON.stringify({ id: reqId, result: result }));
        }
      }
    } catch(e) {
      if (!settled) {
        settled = true;
        clearTimeout(watchdog);
        __go_send('dispatchError', JSON.stringify({ id: reqId, error: String(e && e.message || e) }));
      }
    }
  },

  utils: {
    buffer: {
      from: function(data, encoding) {
        return Buffer.from(data, encoding);
      },
      bufToString: function(buf, encoding) {
        return buf.toString(encoding);
      },
      alloc: function(size, fill) {
        return Buffer.alloc(size, fill);
      }
    },
    // crypto 封装对齐官方 SongloftCrypto 签名：
    //   aesEncrypt(buffer, mode, key, iv?)  — 第 1 参 buffer，第 2 参 mode 字符串
    //   aesDecrypt(buffer, mode, key, iv?)
    //   md5(str) / sha1(str) / sha256Bytes(buffer) / rc4(key, data) / randomBytes(size)
    crypto: {
      md5: function(data) {
        try { return crypto.md5(data); } catch(e) { return ''; }
      },
      sha1: function(data) {
        try { return crypto.sha1(data); } catch(e) { return ''; }
      },
      sha256Bytes: function(buffer) {
        try { return crypto.sha256Bytes(buffer); } catch(e) { return ''; }
      },
      aesEncrypt: function(buffer, mode, key, iv) {
        try { return crypto.aesEncrypt(buffer, mode, key, iv); } catch(e) { return ''; }
      },
      aesDecrypt: function(buffer, mode, key, iv) {
        try { return crypto.aesDecrypt(buffer, mode, key, iv); } catch(e) { return ''; }
      },
      rsaEncrypt: function(buffer, publicKeyPEM) {
        try { return crypto.rsaEncrypt(buffer, publicKeyPEM); } catch(e) { return ''; }
      },
      rc4: function(key, data) {
        try { return crypto.rc4(key, data); } catch(e) { return ''; }
      },
      randomBytes: function(size) {
        try { return crypto.randomBytes(size); } catch(e) { return ''; }
      }
    },
    zlib: {
      inflate: function(data) {
        try { return zlib.inflate(data); } catch(e) { return null; }
      },
      deflate: function(data) {
        try { return zlib.deflate(data); } catch(e) { return null; }
      }
    }
  }
};
`;

export default lxNewsPrelude;
