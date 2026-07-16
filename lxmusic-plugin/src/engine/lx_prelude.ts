// engine/lx_prelude.ts - LX prelude 代码
// 注入子 VM,构造洛雪音源脚本期望的全局 lx 对象

export const LX_PRELUDE_JS = `
// ============ LX Prelude ============
// 构造 lx-music-desktop 自定义源 API 的全局环境

globalThis.window = globalThis;
globalThis.global = globalThis;

// --- 事件系统 ---
var __lx_handlers = {};
var __lx_sources = {};
var __lx_pendingDispatch = {};

globalThis.lx = {
  version: '2.0.0',
  sources: {},
  currentScriptInfo: null,
  ENV: 'plugin',

  // --- 回调风格 HTTP ---
  request: function(url, options, callback) {
    options = options || {};
    var method = (options.method || 'GET').toUpperCase();
    var headers = Object.assign({
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }, options.headers || {});

    var fetchOptions = { method: method, headers: headers };

    try {
      if (options.form) {
        var formParts = [];
        for (var k in options.form) {
          formParts.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(options.form[k])));
        }
        fetchOptions.body = formParts.join('&');
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
      } else if (options.formData) {
        var fdParts = [];
        for (var k2 in options.formData) {
          fdParts.push(encodeURIComponent(k2) + '=' + encodeURIComponent(String(options.formData[k2])));
        }
        fetchOptions.body = fdParts.join('&');
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
      } else if (options.body !== undefined && options.body !== null) {
        if (typeof options.body === 'string') {
          fetchOptions.body = options.body;
        } else {
          fetchOptions.body = JSON.stringify(options.body);
          if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
        }
      }
    } catch(e) {
      callback(e, null, null);
      return;
    }

    fetch(url, fetchOptions).then(function(resp) {
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
        var respInfo = {
          statusCode: resp.status,
          statusMessage: resp.statusText,
          headers: respHeaders,
          body: parsedBody
        };
        callback(null, respInfo, parsedBody);
      });
    }).catch(function(err) {
      callback(err, null, null);
    });
  },

  // --- Promise 风格 HTTP ---
  promiseRequest: function(url, options) {
    return new Promise(function(resolve, reject) {
      globalThis.lx.request(url, options, function(err, resp) {
        if (err) reject(err);
        else resolve(resp);
      });
    });
  },

  // --- 事件发送 (子→父) ---
  send: function(eventName, data) {
    // 特殊处理 inited
    if (eventName === 'inited') {
      __lx_sources = data.sources || {};
      globalThis.lx.sources = __lx_sources;
    }
    try {
      __go_send(eventName, JSON.stringify(data));
    } catch(e) {
      // __go_send 可能在某些上下文中不可用
    }
  },

  // --- 事件注册 (脚本注册 handler) ---
  on: function(eventName, handler) {
    if (!__lx_handlers[eventName]) {
      __lx_handlers[eventName] = [];
    }
    __lx_handlers[eventName].push(handler);
  },

  // --- 父侧触发脚本处理请求 ---
  _dispatch: function(reqId, eventName, data) {
    var handlers = __lx_handlers[eventName];
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

  // --- 工具集 ---
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
    crypto: {
      md5: function(data) {
        try { return crypto.md5(data); } catch(e) { return ''; }
      },
      aesEncrypt: function(data, key, iv, mode) {
        try { return crypto.aesEncrypt(data, key, iv, mode); } catch(e) { return ''; }
      },
      aesDecrypt: function(data, key, iv, mode) {
        try { return crypto.aesDecrypt(data, key, iv, mode); } catch(e) { return ''; }
      },
      rsaEncrypt: function(data, key) {
        try { return crypto.rsaEncrypt(data, key); } catch(e) { return ''; }
      },
      randomBytes: function(n) {
        try { return crypto.randomBytes(n); } catch(e) { return ''; }
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
  },

  // --- 通知初始化完成 ---
  notifyInited: function() {
    globalThis.lx.send('inited', { sources: globalThis.lx.sources });
  },

  // --- 兼容性: 派发请求的简化接口 ---
  request_dispatch: function(reqId, source, action, info) {
    globalThis.lx._dispatch(reqId, 'request', { source: source, action: action, info: info });
  }
};

// ============ 防止脚本意外覆盖关键函数 ============
var __originalSend = globalThis.lx.send;
var __originalDispatch = globalThis.lx._dispatch;
`;
