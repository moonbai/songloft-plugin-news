// LX News 沙箱预置代码 - 在 QuickJS VM 中运行
// 暴露给用户脚本的 API：lx (全局对象)

const lxNewsPrelude = `
var lx = (function() {
  var __channels = {};
  var __eventHandler = null;
  var __sources = [];

  function _emit(eventName, data) {
    if (eventName === 'request' && __eventHandler) {
      try {
        __eventHandler(data);
      } catch (e) {
        lx_event(JSON.stringify({ eventName: 'error', data: { message: String(e) } }));
      }
    } else if (eventName === 'inited') {
      lx_event(JSON.stringify({ eventName: 'inited', data: data }));
    }
  }

  return {
    version: '1.0.0',

    registerSource: function(source) {
      if (!source || !source.id) {
        throw new Error('Source must have id');
      }
      __sources.push(source);
    },

    on: function(eventName, handler) {
      if (eventName === 'request') {
        __eventHandler = handler;
      }
    },

    request: function(url, options) {
      options = options || {};
      return songloft.http.fetch(url, {
        method: options.method || 'GET',
        headers: options.headers || {},
        body: options.body,
        timeout: options.timeout || 15000,
      }).then(function(resp) {
        return {
          status: resp.status,
          body: typeof resp.body === 'string' ? resp.body : new TextDecoder().decode(resp.body),
          headers: resp.headers,
          json: function() { return JSON.parse(this.body); },
        };
      });
    },

    notifyInited: function() {
      _emit('inited', { sources: __sources });
    },

    _dispatch: function(id, eventName, data) {
      if (eventName === 'request') {
        if (!__eventHandler) {
          lx_event(JSON.stringify({ id: id, error: 'No handler' }));
          return;
        }
        try {
          var result = __eventHandler(data);
          if (result && typeof result.then === 'function') {
            result.then(function(r) {
              lx_event(JSON.stringify({ id: id, data: r }));
            }).catch(function(e) {
              lx_event(JSON.stringify({ id: id, error: String(e) }));
            });
          } else {
            lx_event(JSON.stringify({ id: id, data: result }));
          }
        } catch (e) {
          lx_event(JSON.stringify({ id: id, error: String(e) }));
        }
      }
    }
  };
})();
`;

export default lxNewsPrelude;
