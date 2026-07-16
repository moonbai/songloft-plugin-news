export const LX_PRELUDE_JS = `
globalThis.window = globalThis;
globalThis.global = globalThis;

const events = {};
const requestHandlers = {};
let reqIdCounter = 0;

const lx = {
  request: function(url, options, callback) {
    options = options || {};
    const method = options.method || 'GET';
    const headers = options.headers || {};
    
    let body = null;
    if (options.body) {
      if (typeof options.body === 'string') {
        body = options.body;
      } else {
        body = JSON.stringify(options.body);
        headers['Content-Type'] = 'application/json';
      }
    } else if (options.form) {
      body = Object.keys(options.form)
        .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(options.form[key]))
        .join('&');
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    } else if (options.formData) {
      const formData = new FormData();
      for (const key in options.formData) {
        formData.append(key, options.formData[key]);
      }
      body = formData;
    }
    
    fetch(url, { method, headers, body })
      .then(response => {
        const headers = {};
        response.headers.forEach((v, k) => headers[k] = v);
        return response.text().then(text => ({
          statusCode: response.status,
          statusMessage: response.statusText,
          headers,
          body: text
        }));
      })
      .then(result => callback(null, result, result.body))
      .catch(err => callback(err, null, null));
  },
  
  send: function(eventName, data) {
    __go_send('lx_event', JSON.stringify({
      eventName,
      data,
      sourceId: lx._sourceId
    }));
  },
  
  on: function(eventName, handler) {
    if (!events[eventName]) events[eventName] = [];
    events[eventName].push(handler);
  },
  
  emit: function(eventName, data) {
    if (events[eventName]) {
      events[eventName].forEach(handler => {
        try { handler(data); } catch(e) {}
      });
    }
  },
  
  _sourceId: '',
  
  _dispatch: function(reqId, eventName, dataJSON) {
    const data = typeof dataJSON === 'string' ? JSON.parse(dataJSON) : dataJSON;
    const handlers = events[eventName] || [];
    
    if (handlers.length === 0) {
      __go_send('lx_dispatch_result', JSON.stringify({
        id: reqId,
        error: 'no handler registered for ' + eventName
      }));
      return;
    }
    
    const handler = handlers[0];
    try {
      const result = handler(data);
      if (result && typeof result.then === 'function') {
        result.then(res => {
          __go_send('lx_dispatch_result', JSON.stringify({ id: reqId, result: res }));
        }).catch(err => {
          __go_send('lx_dispatch_result', JSON.stringify({ id: reqId, error: err.message || err }));
        });
      } else {
        __go_send('lx_dispatch_result', JSON.stringify({ id: reqId, result: result }));
      }
    } catch (err) {
      __go_send('lx_dispatch_result', JSON.stringify({ id: reqId, error: err.message || err }));
    }
  }
};

lx.utils = {
  buffer: {
    from: function(data, encoding) {
      if (typeof data === 'string') {
        return new Uint8Array(data.split('').map(c => c.charCodeAt(0)));
      }
      return new Uint8Array(data);
    },
    toString: function(buf, encoding) {
      return Array.from(buf).map(b => String.fromCharCode(b)).join('');
    }
  },
  crypto: {
    md5: function(data) {
      return crypto.md5(data);
    },
    sha1: function(data) {
      return crypto.sha1(data);
    },
    sha256: function(data) {
      return crypto.sha256(data);
    },
    hmacSHA1: function(data, key) {
      return crypto.hmacSHA1(data, key);
    },
    hmacSHA256: function(data, key) {
      return crypto.hmacSHA256(data, key);
    },
    aesEncrypt: function(data, key, iv) {
      return crypto.aesEncrypt(data, key, iv);
    },
    rsaEncrypt: function(data, publicKey) {
      return crypto.rsaEncrypt(data, publicKey);
    }
  },
  zlib: {
    inflate: function(data) {
      return zlib.inflate(data);
    },
    deflate: function(data) {
      return zlib.deflate(data);
    }
  }
};

globalThis.lx = lx;
globalThis.window = globalThis;
`;
