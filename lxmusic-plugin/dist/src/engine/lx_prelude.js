// LX Music Prelude - 注入子 VM 的全局 lx 对象
// 遵循 lx-music-desktop 自定义源 API
export const LX_PRELUDE_JS = `
// 全局环境补丁
globalThis.window = globalThis;
globalThis.global = globalThis;

// 事件通道 - 与父 VM 通信
var __lx_channels = {
  pending: {},
  handlers: {}
};

// 内部发送事件到父侧
function __lx_send(eventName, data) {
  if (typeof __go_send === 'function') {
    __go_send(eventName, JSON.stringify(data));
  }
}

// lx 全局对象
var lx = {
  version: '2.0.0',
  
  // 当前脚本信息 (由父侧注入)
  currentScriptInfo: null,
  _sourceId: '',
  
  // 注册的源信息
  sources: [],
  
  // HTTP 请求 - 回调风格
  request: function(url, options, callback) {
    options = options || {};
    var method = options.method || 'GET';
    var headers = options.headers || {};
    var timeout = options.timeout || 10000;
    
    // 处理 body
    var body = null;
    if (options.body) {
      if (typeof options.body === 'string') {
        body = options.body;
      } else {
        body = JSON.stringify(options.body);
        if (!headers['Content-Type']) {
          headers['Content-Type'] = 'application/json';
        }
      }
    }
    
    // 处理 form
    if (options.form) {
      var parts = [];
      for (var key in options.form) {
        parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(options.form[key]));
      }
      body = parts.join('&');
      if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
      }
    }
    
    // 默认 UA
    if (!headers['User-Agent']) {
      headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    }
    
    // 发起 fetch
    fetch(url, {
      method: method,
      headers: headers,
      body: body,
      timeout: timeout
    }).then(function(response) {
      var respHeaders = {};
      if (response.headers && response.headers.forEach) {
        response.headers.forEach(function(v, k) { respHeaders[k] = v; });
      }
      
      var contentType = respHeaders['content-type'] || '';
      
      // 读取 body
      if (contentType.includes('application/json')) {
        return response.json().then(function(json) {
          return { body: json, isJson: true, response: response, headers: respHeaders };
        }).catch(function() {
          return response.text().then(function(text) {
            return { body: text, isJson: false, response: response, headers: respHeaders };
          });
        });
      } else {
        return response.text().then(function(text) {
          return { body: text, isJson: false, response: response, headers: respHeaders };
        });
      }
    }).then(function(result) {
      callback(null, {
        statusCode: result.response.status,
        statusMessage: result.response.statusText || '',
        headers: result.headers
      }, result.body);
    }).catch(function(err) {
      callback(err, null, null);
    });
  },
  
  // Promise 版本的 request
  promiseRequest: function(url, options) {
    return new Promise(function(resolve, reject) {
      lx.request(url, options, function(err, resp, body) {
        if (err) {
          reject(err);
        } else {
          resolve({ statusCode: resp.statusCode, headers: resp.headers, body: body });
        }
      });
    });
  },
  
  // 发送事件 (inited 等)
  send: function(eventName, data) {
    if (eventName === 'inited') {
      lx.sources = data.sources || [];
    }
    __lx_send('lx_event', { eventName: eventName, data: data });
  },
  
  // 注册事件处理器
  on: function(eventName, handler) {
    __lx_channels.handlers[eventName] = handler;
  },
  
  // 内部: 分发请求 (由父侧调用)
  _dispatch: function(reqId, eventName, data) {
    var handler = __lx_channels.handlers[eventName];
    if (!handler) {
      __lx_send('lx_dispatch_result', { id: reqId, error: 'No handler for ' + eventName });
      return;
    }
    
    try {
      var result = handler(data);
      
      // 支持 Promise
      if (result && typeof result.then === 'function') {
        result.then(function(r) {
          __lx_send('lx_dispatch_result', { id: reqId, result: r });
        }).catch(function(e) {
          __lx_send('lx_dispatch_result', { id: reqId, error: String(e) });
        });
      } else {
        __lx_send('lx_dispatch_result', { id: reqId, result: result });
      }
    } catch (e) {
      __lx_send('lx_dispatch_result', { id: reqId, error: String(e) });
    }
  },
  
  // 注册源
  registerSource: function(sourceInfo) {
    lx.sources.push(sourceInfo);
  },
  
  // 工具函数
  utils: {
    // Buffer 编解码
    buffer: {
      from: function(data, encoding) {
        if (typeof Buffer !== 'undefined') {
          return Buffer.from(data, encoding);
        }
        if (typeof data === 'string') {
          return new TextEncoder().encode(data);
        }
        return data;
      },
      toString: function(buf, encoding) {
        if (typeof Buffer !== 'undefined' && Buffer.isBuffer(buf)) {
          return buf.toString(encoding);
        }
        return new TextDecoder().decode(buf);
      }
    },
    
    // 加密工具
    crypto: {
      md5: function(data) {
        if (typeof crypto !== 'undefined' && crypto.md5) {
          return crypto.md5(data);
        }
        return '';
      },
      aesEncrypt: function(data, key, iv) {
        if (typeof crypto !== 'undefined' && crypto.aesEncrypt) {
          return crypto.aesEncrypt(data, key, iv);
        }
        return '';
      },
      randomBytes: function(n) {
        if (typeof crypto !== 'undefined' && crypto.randomBytes) {
          return crypto.randomBytes(n);
        }
        var arr = new Uint8Array(n);
        for (var i = 0; i < n; i++) arr[i] = Math.floor(Math.random() * 256);
        return arr;
      }
    },
    
    // 压缩解压
    zlib: {
      inflate: function(data) {
        if (typeof zlib !== 'undefined' && zlib.inflate) {
          return zlib.inflate(data);
        }
        return null;
      },
      deflate: function(data) {
        if (typeof zlib !== 'undefined' && zlib.deflate) {
          return zlib.deflate(data);
        }
        return null;
      }
    }
  },
  
  // 初始化完成通知
  notifyInited: function() {
    lx.send('inited', { sources: lx.sources });
  }
};

// 暴露到全局
globalThis.lx = lx;
`;
export default LX_PRELUDE_JS;
