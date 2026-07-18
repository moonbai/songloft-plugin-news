/* =========================================================
 * LX Music 音源 - 前端应用 (原生 JS)
 * 基础 API 路径: ./api/  (插件挂载于 /api/v1/jsplugin/lxmusic/)
 * ========================================================= */

(function () {
  'use strict';

  /* ---------- 常量 ---------- */

  var API_BASE = './api/';

  // 内置平台（与后端 musicSdk/facade.ts 保持一致）
  var PLATFORMS = [
    { id: 'kw', name: '酷我音乐' },
    { id: 'kg', name: '酷狗音乐' },
    { id: 'tx', name: 'QQ音乐' },
    { id: 'wy', name: '网易云音乐' },
    { id: 'mg', name: '咪咕音乐' }
  ];

  // 搜索分页
  var searchState = { page: 1, pageSize: 30, total: 0, results: [], sourceId: 'kw', keyword: '' };
  // 歌单列表分页
  var songlistState = { page: 1, pageSize: 20, total: 0, sourceId: 'kw', tag: '', keyword: '', mode: 'list' };
  // 选中的搜索结果（按索引）
  var selectedSongs = {};

  // 轮询句柄
  var loadingPollTimer = null;

  /* ---------- 工具函数 ---------- */

  function $(id) { return document.getElementById(id); }

  function escapeHtml(s) {
    if (s === undefined || s === null) return '';
    return String(s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  function formatDuration(sec) {
    sec = Number(sec) || 0;
    if (sec <= 0) return '--:--';
    var m = Math.floor(sec / 60);
    var s = Math.floor(sec % 60);
    return m + ':' + (s < 10 ? '0' + s : s);
  }

  function formatTime(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    var now = Date.now();
    var diff = now - ts;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
    return d.toLocaleDateString('zh-CN');
  }

  /**
   * API 调用助手
   * - body 为 FormData 时不设置 Content-Type，交由浏览器自动添加 multipart boundary
   * - 其余对象/数组以 JSON 发送
   * - 返回值：成功时为后端原始 JSON；
   *   注意 /api/search 由 SDK 工厂返回裸 {results}，其它内部端点为 {code,msg,data}
   *   网络异常统一返回 {code:-1, msg}
   */
  function api(path, options) {
    options = options || {};
    var headers = Object.assign({}, options.headers);
    var body = options.body;
    var init = {
      method: options.method || 'GET',
      headers: headers
    };

    if (body instanceof FormData) {
      init.body = body;
    } else if (body !== undefined && body !== null) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }

    return fetch(API_BASE + path, init)
      .then(function (resp) {
        return resp.text().then(function (text) {
          try { return JSON.parse(text); }
          catch (e) { return { code: -1, msg: text || '响应解析失败' }; }
        });
      })
      .catch(function (e) {
        return { code: -1, msg: '网络错误: ' + (e && e.message ? e.message : e) };
      });
  }

  /* ---------- Toast ---------- */

  var toastTimer = null;
  function showToast(msg, type, duration) {
    var el = $('toast');
    el.textContent = msg;
    el.className = 'toast show ' + (type || '');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.className = 'toast';
    }, duration || 2800);
  }

  /* ---------- 加载态 ---------- */

  function setLoading(btn, loading) {
    if (!btn) return;
    var spinner = btn.querySelector('.spinner');
    if (loading) {
      btn.dataset._disabled = btn.disabled ? '1' : '0';
      btn.disabled = true;
      if (spinner) spinner.hidden = false;
    } else {
      btn.disabled = btn.dataset._disabled === '1';
      if (spinner) spinner.hidden = true;
    }
  }

  function emptyRow(cols, text) {
    return '<tr><td colspan="' + cols + '" class="empty">' + escapeHtml(text) + '</td></tr>';
  }

  /* ---------- 平台名映射 ---------- */

  function platformName(id) {
    for (var i = 0; i < PLATFORMS.length; i++) {
      if (PLATFORMS[i].id === id) return PLATFORMS[i].name;
    }
    return id || '';
  }

  function fillPlatformSelects() {
    var html = PLATFORMS.map(function (p) {
      return '<option value="' + p.id + '">' + escapeHtml(p.name) + '</option>';
    }).join('');
    $('searchSource').innerHTML = html;
    $('songlistSource').innerHTML = html;
  }

  /* =========================================================
   * 标签导航
   * ========================================================= */

  function moveTabIndicator() {
    var active = document.querySelector('.tab.active');
    var indicator = document.querySelector('.tab-indicator');
    if (!active || !indicator) return;
    indicator.style.width = active.offsetWidth + 'px';
    indicator.style.transform = 'translateX(' + active.offsetLeft + 'px)';
  }

  function switchTab(name) {
    document.querySelectorAll('.tab').forEach(function (t) {
      var on = t.dataset.tab === name;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.querySelectorAll('.panel').forEach(function (p) {
      p.classList.toggle('active', p.id === 'panel-' + name);
    });
    moveTabIndicator();

    if (name === 'sources') loadSources();
    if (name === 'songlist' && !$('tagChips').dataset.loaded) loadSonglistTags();
  }

  document.querySelectorAll('.tab').forEach(function (tab) {
    tab.addEventListener('click', function () { switchTab(tab.dataset.tab); });
  });

  /* =========================================================
   * 健康检查
   * ========================================================= */

  function updateHealth(data) {
    var pill = $('healthPill');
    var text = $('healthText');
    pill.classList.remove('ok', 'err', 'loading');
    if (!data) { pill.classList.add('err'); text.textContent = '未连接'; return; }

    var loaded = data.loadedSources || 0;
    if (data.loading) {
      pill.classList.add('loading');
      text.textContent = '加载中…';
    } else if (loaded > 0) {
      pill.classList.add('ok');
      text.textContent = '已加载 ' + loaded + ' 个音源';
    } else {
      pill.classList.add('err');
      text.textContent = '未加载音源';
    }
  }

  function checkHealth() {
    api('health').then(function (res) {
      if (res && res.code === 0) updateHealth(res.data);
      else updateHealth(null);
    });
  }

  /* =========================================================
   * 导入目标选择对话框
   * ========================================================= */

  // 当前待导入的歌曲列表和触发按钮
  var pendingImport = { songs: [], btn: null };

  function openImportModal(songs, btn) {
    if (!songs || songs.length === 0) { showToast('请先选择歌曲', 'warning'); return; }
    pendingImport = { songs: songs, btn: btn };
    $('importModal').hidden = false;
    $('newPlaylistBox').hidden = true;
    $('newPlaylistName').value = '';
    loadModalPlaylists();
  }

  function closeImportModal() {
    $('importModal').hidden = true;
    pendingImport = { songs: [], btn: null };
  }

  function loadModalPlaylists() {
    var list = $('modalPlaylistList');
    list.innerHTML = '<div class="empty">加载中…</div>';
    api('playlists').then(function (res) {
      if (res && res.code === 0) {
        var playlists = extractPlaylistList(res.data);
        if (playlists.length === 0) {
          list.innerHTML = '<div class="empty">暂无歌单</div>';
          return;
        }
        list.innerHTML = playlists.map(function (pl) {
          var coverHtml = pl.cover
            ? '<img src="' + escapeHtml(pl.cover) + '" alt="" onerror="this.style.display=\'none\';this.parentElement.textContent=\'♪\'">'
            : '♪';
          return '<div class="modal-playlist-item" data-id="' + escapeHtml(pl.id) + '">' +
            '<div class="modal-playlist-cover">' + coverHtml + '</div>' +
            '<div class="modal-playlist-name">' + escapeHtml(pl.name) + '</div>' +
            (pl.count != null ? '<span class="modal-playlist-count">' + pl.count + ' 首</span>' : '') +
          '</div>';
        }).join('');

        list.querySelectorAll('.modal-playlist-item').forEach(function (item) {
          item.addEventListener('click', function () {
            doImport(pendingImport.songs, pendingImport.btn, { playlist_id: item.dataset.id });
          });
        });
      } else {
        list.innerHTML = '<div class="empty">' + escapeHtml((res && res.msg) || '加载失败') + '</div>';
      }
    });
  }

  /** 从后端返回的不定结构中提取歌单列表 */
  function extractPlaylistList(data) {
    var arr = [];
    if (Array.isArray(data)) arr = data;
    else if (data && Array.isArray(data.list)) arr = data.list;
    else if (data && Array.isArray(data.data)) arr = data.data;
    else if (data && Array.isArray(data.playlists)) arr = data.playlists;

    return arr.map(function (p) {
      if (typeof p === 'string') return { id: p, name: p, cover: '', count: null };
      if (p && typeof p === 'object') {
        return {
          id: String(p.id != null ? p.id : (p.playlist_id != null ? p.playlist_id : '')),
          name: String(p.name != null ? p.name : (p.title != null ? p.title : '未命名')),
          cover: p.cover || p.cover_url || p.pic || '',
          count: p.count != null ? p.count : (p.song_count != null ? p.song_count : (p.total != null ? p.total : null))
        };
      }
      return null;
    }).filter(function (p) { return p && p.id; });
  }

  /**
   * 执行导入
   * @param {Array} songs 待导入歌曲
   * @param {Element} btn 触发按钮 (用于 loading 态)
   * @param {Object} extra 额外参数 { playlist_id?, new_playlist_name? }
   */
  function doImport(songs, btn, extra) {
    if (!songs || songs.length === 0) { showToast('请先选择歌曲', 'warning'); return; }
    closeImportModal();
    setLoading(btn, true);

    var body = { songs: songs };
    if (extra && extra.playlist_id) body.playlist_id = extra.playlist_id;
    if (extra && extra.new_playlist_name) body.new_playlist_name = extra.new_playlist_name;

    api('songs/import', { method: 'POST', body: body }).then(function (res) {
      setLoading(btn, false);
      if (res && res.code === 0) {
        var data = res.data || {};
        var results = Array.isArray(data.songs) ? data.songs : (Array.isArray(data) ? data : []);
        var ok = 0, fail = 0;
        results.forEach(function (r) { if (r && r.success) ok++; else fail++; });

        var msg = '成功导入 ' + ok + ' 首歌曲';
        if (data.playlist) {
          msg += '，已添加到歌单';
        }
        if (fail > 0) msg += '（失败 ' + fail + ' 首）';
        showToast(msg, fail > 0 ? 'warning' : 'success');
      } else {
        showToast('导入失败: ' + (res && res.msg ? res.msg : '未知错误'), 'error');
      }
    });
  }

  /* =========================================================
   * 搜索
   * ========================================================= */

  function doSearch(page) {
    var keyword = $('searchInput').value.trim();
    var sourceId = $('searchSource').value;
    if (!keyword) { showToast('请输入关键词', 'warning'); return; }

    searchState.keyword = keyword;
    searchState.sourceId = sourceId;
    searchState.page = page || 1;
    selectedSongs = {};
    updateSelectAll();
    updateImportButton();

    var btn = $('searchBtn');
    setLoading(btn, true);
    $('searchResults').innerHTML = emptyRow(5, '搜索中…');
    $('searchPagination').hidden = true;

    api('search', {
      method: 'POST',
      body: {
        keyword: keyword,
        source_id: sourceId,
        page: searchState.page,
        page_size: searchState.pageSize
      }
    }).then(function (res) {
      setLoading(btn, false);
      // /api/search 返回裸 {results}；异常时 api() 返回 {code:-1,msg}
      if (res && Array.isArray(res.results)) {
        searchState.results = res.results;
        searchState.total = res.total || res.results.length;
        renderSearchResults();
      } else {
        searchState.results = [];
        $('searchResults').innerHTML = emptyRow(5, (res && res.msg) ? res.msg : '搜索失败');
        if (res && res.msg) showToast(res.msg, 'error');
      }
    });
  }

  function renderSearchResults() {
    var list = searchState.results;
    var tbody = $('searchResults');
    $('resultCount').textContent = list.length + ' 条';

    if (list.length === 0) {
      tbody.innerHTML = emptyRow(5, '未找到相关结果');
      $('searchPagination').hidden = true;
      return;
    }

    tbody.innerHTML = list.map(function (song, i) {
      var checked = selectedSongs[i] ? ' checked' : '';
      return '' +
        '<tr data-index="' + i + '" class="' + (checked ? 'selected' : '') + '">' +
          '<td class="col-check"><input type="checkbox" class="song-check"' + checked + '></td>' +
          '<td class="col-title">' +
            '<div class="song-title-cell">' + escapeHtml(song.title) + '</div>' +
            '<span class="song-platform">' + escapeHtml(platformName(song.source_data && song.source_data.platform)) + '</span>' +
          '</td>' +
          '<td class="col-artist"><div class="cell-ellipsis">' + escapeHtml(song.artist) + '</div></td>' +
          '<td class="col-album"><div class="cell-ellipsis">' + escapeHtml(song.album) + '</div></td>' +
          '<td class="col-dur">' + formatDuration(song.duration) + '</td>' +
        '</tr>';
    }).join('');

    // 行复选框事件
    tbody.querySelectorAll('.song-check').forEach(function (cb) {
      cb.addEventListener('change', function () {
        var tr = cb.closest('tr');
        var idx = Number(tr.dataset.index);
        if (cb.checked) selectedSongs[idx] = searchState.results[idx];
        else delete selectedSongs[idx];
        tr.classList.toggle('selected', cb.checked);
        updateSelectAll();
        updateImportButton();
      });
    });

    renderSearchPagination();
  }

  function renderSearchPagination() {
    var total = searchState.total;
    var pages = Math.max(1, Math.ceil(total / searchState.pageSize));
    $('searchPagination').hidden = pages <= 1;
    $('searchPageInfo').textContent = searchState.page + ' / ' + pages;
  }

  function updateSelectAll() {
    var list = searchState.results;
    var all = list.length > 0;
    for (var i = 0; i < list.length; i++) {
      if (!selectedSongs[i]) { all = false; break; }
    }
    $('selectAll').checked = all;
  }

  function updateImportButton() {
    var count = Object.keys(selectedSongs).length;
    var btn = $('importBtn');
    btn.disabled = count === 0;
    btn.textContent = count > 0 ? '导入选中 (' + count + ')' : '导入选中';
  }

  function importSelected() {
    var songs = Object.keys(selectedSongs).map(function (k) {
      var s = selectedSongs[k];
      return {
        title: s.title,
        artist: s.artist,
        album: s.album,
        duration: s.duration,
        cover_url: s.cover_url,
        source_data: s.source_data
      };
    });
    if (songs.length === 0) { showToast('请先选择歌曲', 'warning'); return; }
    openImportModal(songs, $('importBtn'));
  }

  /* =========================================================
   * 音源管理
   * ========================================================= */

  // 文件选择
  var pendingFiles = [];

  function renderFileList() {
    var list = $('fileList');
    var uploadBtn = $('uploadBtn');
    if (pendingFiles.length === 0) {
      list.innerHTML = '';
      uploadBtn.disabled = true;
    } else {
      list.innerHTML = pendingFiles.map(function (f, i) {
        return '<div class="file-item">' +
          '<span class="file-name">' + escapeHtml(f.name) + ' (' + (f.size / 1024).toFixed(1) + ' KB)</span>' +
          '<button class="file-remove" data-i="' + i + '" title="移除">×</button>' +
          '</div>';
      }).join('');
      uploadBtn.disabled = false;
      list.querySelectorAll('.file-remove').forEach(function (b) {
        b.addEventListener('click', function (e) {
          e.stopPropagation();
          pendingFiles.splice(Number(b.dataset.i), 1);
          renderFileList();
        });
      });
    }
  }

  function handleFiles(files) {
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      var name = (f.name || '').toLowerCase();
      if (name.endsWith('.js') || name.endsWith('.zip')) {
        pendingFiles.push(f);
      } else {
        showToast('已忽略不支持的文件: ' + f.name, 'warning');
      }
    }
    renderFileList();
  }

  function loadSources() {
    api('sources').then(function (res) {
      if (!res || res.code !== 0) {
        $('sourceList').innerHTML = '<div class="empty">加载失败</div>';
        updateHealth(null);
        return;
      }
      var data = res.data || {};
      var sources = data.custom || [];
      var loaded = data.loaded || [];

      // 健康状态
      updateHealth({
        loadedSources: loaded.length,
        loading: data.loading
      });

      // 批量加载状态
      var batch = {
        loading: !!data.loading,
        current: data.batch_current_id,
        pending: data.batch_pending_ids || []
      };
      renderLoadingStatus(batch);

      // 列表
      $('sourceCount').textContent = sources.length + ' 个';
      if (sources.length === 0) {
        $('sourceList').innerHTML = '<div class="empty">尚未导入任何音源脚本</div>';
        return;
      }
      $('sourceList').innerHTML = sources.map(function (s) {
        var loadedInfo = loaded.indexOf(s.id) >= 0 ? ' · 已加载' : '';
        return '<div class="source-item' + (s.enabled ? '' : ' disabled') + '" data-id="' + escapeHtml(s.id) + '">' +
          '<label class="switch">' +
            '<input type="checkbox" class="source-toggle"' + (s.enabled ? ' checked' : '') + '>' +
            '<span class="track"></span>' +
          '</label>' +
          '<div class="source-info">' +
            '<div class="source-name">' + escapeHtml(s.name) +
              (s.version ? ' <span class="ver">v' + escapeHtml(s.version) + '</span>' : '') +
            '</div>' +
            '<div class="source-meta">作者: ' + escapeHtml(s.author || '未知') + ' · ' + formatTime(s.importedAt) + loadedInfo + '</div>' +
            (s.description ? '<div class="source-desc">' + escapeHtml(s.description) + '</div>' : '') +
          '</div>' +
          '<div class="source-actions">' +
            '<button class="btn btn-text btn-danger delete-source">删除</button>' +
          '</div>' +
        '</div>';
      }).join('');

      attachSourceHandlers();
    });
  }

  function attachSourceHandlers() {
    document.querySelectorAll('.source-item').forEach(function (item) {
      var id = item.dataset.id;
      var toggle = item.querySelector('.source-toggle');
      toggle.addEventListener('change', function () {
        var enabled = toggle.checked;
        api('sources/toggle', { method: 'PUT', body: { id: id, enabled: enabled } }).then(function (res) {
          if (res && res.code === 0) {
            showToast(enabled ? '已启用，正在加载…' : '已禁用', 'success');
            item.classList.toggle('disabled', !enabled);
            // 启用后稍候刷新以反映加载状态
            if (enabled) setTimeout(loadSources, 800);
          } else {
            toggle.checked = !enabled;
            showToast('操作失败: ' + (res && res.msg ? res.msg : ''), 'error');
          }
        });
      });

      item.querySelector('.delete-source').addEventListener('click', function () {
        if (!confirm('确认删除此音源脚本？')) return;
        api('sources?id=' + encodeURIComponent(id), { method: 'DELETE' }).then(function (res) {
          if (res && res.code === 0) {
            showToast('已删除', 'success');
            loadSources();
          } else {
            showToast('删除失败: ' + (res && res.msg ? res.msg : ''), 'error');
          }
        });
      });
    });
  }

  function uploadFiles() {
    if (pendingFiles.length === 0) return;
    var form = new FormData();
    pendingFiles.forEach(function (f) { form.append('files', f, f.name); });

    var btn = $('uploadBtn');
    setLoading(btn, true);
    showToast('正在上传导入…', '');
    api('sources/import', { method: 'POST', body: form }).then(function (res) {
      setLoading(btn, false);
      if (res && res.code === 0) {
        var imported = Array.isArray(res.data) ? res.data : (res.data ? [res.data] : []);
        showToast('导入成功 ' + imported.length + ' 个音源', 'success');
        pendingFiles = [];
        renderFileList();
        loadSources();
      } else {
        showToast('导入失败: ' + (res && res.msg ? res.msg : ''), 'error');
      }
    });
  }

  function importFromUrl() {
    var url = $('sourceUrl').value.trim();
    if (!url) { showToast('请输入 URL', 'warning'); return; }
    var btn = $('importUrlBtn');
    setLoading(btn, true);
    showToast('正在从 URL 导入…', '');
    api('sources/import-url', { method: 'POST', body: { url: url } }).then(function (res) {
      setLoading(btn, false);
      if (res && res.code === 0) {
        showToast('导入成功', 'success');
        $('sourceUrl').value = '';
        loadSources();
      } else {
        showToast('导入失败: ' + (res && res.msg ? res.msg : ''), 'error');
      }
    });
  }

  function reloadAll() {
    var btn = $('reloadBtn');
    setLoading(btn, true);
    api('sources/reload', { method: 'POST' }).then(function (res) {
      setLoading(btn, false);
      if (res && res.code === 0) {
        showToast('已重新加载', 'success');
        loadSources();
      } else {
        showToast('重载失败: ' + (res && res.msg ? res.msg : ''), 'error');
      }
    });
  }

  /* ---------- 批量加载状态轮询 ---------- */

  function renderLoadingStatus(batch) {
    var card = $('loadingCard');
    if (!batch.loading) {
      card.hidden = true;
      if (loadingPollTimer) { clearInterval(loadingPollTimer); loadingPollTimer = null; }
      return;
    }
    card.hidden = false;
    var detail = $('loadingDetail');
    var progress = $('loadingProgress');
    var pending = batch.pending ? batch.pending.length : 0;
    var cur = batch.current ? '当前: ' + escapeHtml(batch.current) : '';
    detail.innerHTML = cur + (cur && pending ? ' · ' : '') + '剩余 ' + pending + ' 个';
    // 无法精确知道总数，使用相对进度展示
    progress.style.width = pending > 0 ? '50%' : '85%';

    if (!loadingPollTimer) {
      loadingPollTimer = setInterval(function () {
        api('sources').then(function (res) {
          if (!res || res.code !== 0) return;
          var d = res.data || {};
          renderLoadingStatus({
            loading: !!d.loading,
            current: d.batch_current_id,
            pending: d.batch_pending_ids || []
          });
          if (!d.loading) {
            clearInterval(loadingPollTimer);
            loadingPollTimer = null;
            loadSources();
          }
        });
      }, 1500);
    }
  }

  /* =========================================================
   * 歌单
   * ========================================================= */

  /** 从后端 tags() 的不定结构中提取 {id,name} 列表（含分组） */
  function extractTags(data) {
    var groups = []; // [{title, tags:[{id,name}]}]

    function pushTag(arr, t) {
      if (!t) return;
      if (typeof t === 'string') { arr.push({ id: t, name: t }); return; }
      if (typeof t === 'object') {
        var id = t.id != null ? t.id : (t.name != null ? t.name : null);
        var name = t.name != null ? t.name : (t.id != null ? t.id : null);
        if (id != null) arr.push({ id: String(id), name: String(name) });
      }
    }

    var arr = [];
    if (Array.isArray(data)) arr = data;
    else if (data && Array.isArray(data.data)) arr = data.data;
    else if (data && Array.isArray(data.tag)) arr = data.tag;
    else if (data && Array.isArray(data.tags)) arr = data.tags;
    else if (data && Array.isArray(data.list)) arr = data.list;

    if (arr.length === 0) return groups;

    // 判断是否为分组结构（元素含 children/list/tags 子数组）
    var hasGroups = arr.some(function (it) {
      return it && typeof it === 'object' && !it.id &&
        (Array.isArray(it.list) || Array.isArray(it.tags) || Array.isArray(it.children));
    });

    if (hasGroups) {
      arr.forEach(function (cat) {
        var children = cat.list || cat.tags || cat.children || [];
        var tags = [];
        children.forEach(function (c) { pushTag(tags, c); });
        if (tags.length) groups.push({ title: cat.name || cat.title || '分类', tags: tags });
      });
    } else {
      var flat = [];
      arr.forEach(function (t) { pushTag(flat, t); });
      if (flat.length) groups.push({ title: '全部分类', tags: flat });
    }
    return groups;
  }

  function loadSonglistTags() {
    var sourceId = $('songlistSource').value;
    songlistState.sourceId = sourceId;
    var chips = $('tagChips');
    chips.innerHTML = '<div class="empty">加载中…</div>';

    api('songlist/tags?source_id=' + encodeURIComponent(sourceId)).then(function (res) {
      if (res && res.code === 0) {
        var groups = extractTags(res.data);
        $('tagChips').dataset.loaded = '1';
        if (groups.length === 0) {
          chips.innerHTML = '<div class="empty">该平台暂无分类，可直接搜索歌单</div>';
          return;
        }
        chips.innerHTML = groups.map(function (g) {
          return '<div class="tag-group">' +
            '<div class="tag-group-title">' + escapeHtml(g.title) + '</div>' +
            g.tags.map(function (t) {
              return '<span class="chip" data-id="' + escapeHtml(t.id) + '">' + escapeHtml(t.name) + '</span>';
            }).join('') +
          '</div>';
        }).join('');

        chips.querySelectorAll('.chip').forEach(function (chip) {
          chip.addEventListener('click', function () {
            chips.querySelectorAll('.chip').forEach(function (c) { c.classList.remove('active'); });
            chip.classList.add('active');
            songlistState.tag = chip.dataset.id;
            loadSonglistList(1);
          });
        });
      } else {
        chips.innerHTML = '<div class="empty">' + escapeHtml((res && res.msg) || '加载失败') + '</div>';
      }
    });
  }

  function loadSonglistList(page) {
    var sourceId = $('songlistSource').value;
    songlistState.sourceId = sourceId;
    songlistState.page = page || 1;

    var url = 'songlist/list?source_id=' + encodeURIComponent(sourceId) +
      '&tag=' + encodeURIComponent(songlistState.tag) +
      '&page=' + songlistState.page + '&limit=' + songlistState.pageSize;

    var grid = $('songlistList');
    grid.innerHTML = '<div class="empty">加载中…</div>';
    $('songlistPagination').hidden = true;
    $('backToTagsBtn').hidden = false;

    api(url).then(function (res) {
      if (res && res.code === 0 && res.data) {
        var list = res.data.list || [];
        songlistState.total = res.data.total || list.length;
        renderSonglistList(list);
      } else {
        grid.innerHTML = '<div class="empty">' + escapeHtml((res && res.msg) || '加载失败') + '</div>';
      }
    });
  }

  function renderSonglistList(list) {
    var grid = $('songlistList');
    if (list.length === 0) {
      grid.innerHTML = '<div class="empty">暂无歌单</div>';
      $('songlistPagination').hidden = true;
      return;
    }
    grid.innerHTML = list.map(function (item) {
      var cover = item.cover ? escapeHtml(item.cover) : '';
      var coverHtml = cover
        ? '<img src="' + cover + '" alt="" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'grid\';"><span class="cover-fallback" style="display:none;">♪</span>'
        : '<span class="cover-fallback">♪</span>';
      return '<div class="songlist-card" data-id="' + escapeHtml(item.id) + '">' +
        '<div class="songlist-cover">' + coverHtml +
          (item.playCount ? '<span class="songlist-playcount">▶ ' + escapeHtml(item.playCount) + '</span>' : '') +
        '</div>' +
        '<div class="songlist-info">' +
          '<div class="songlist-name">' + escapeHtml(item.name) + '</div>' +
          (item.author ? '<div class="songlist-author">' + escapeHtml(item.author) + '</div>' : '') +
        '</div>' +
      '</div>';
    }).join('');

    grid.querySelectorAll('.songlist-card').forEach(function (card) {
      card.addEventListener('click', function () {
        loadSonglistDetail(card.dataset.id);
      });
    });

    var pages = Math.max(1, Math.ceil(songlistState.total / songlistState.pageSize));
    $('songlistPagination').hidden = pages <= 1;
    $('songlistPageInfo').textContent = songlistState.page + ' / ' + pages;
  }

  function loadSonglistDetail(id) {
    var sourceId = $('songlistSource').value;
    $('songlistDetailCard').hidden = false;
    $('detailSongs').innerHTML = emptyRow(4, '加载中…');
    $('detailTitle').textContent = '歌单详情';
    $('detailInfo').innerHTML = '';

    api('songlist/detail?source_id=' + encodeURIComponent(sourceId) + '&id=' + encodeURIComponent(id) + '&page=1').then(function (res) {
      if (res && res.code === 0 && res.data) {
        var info = res.data.info || {};
        var list = res.data.list || [];
        $('detailTitle').textContent = info.name || '歌单详情';
        $('detailSongCount').textContent = list.length + ' 首';

        var coverHtml = info.cover
          ? '<img class="detail-cover" src="' + escapeHtml(info.cover) + '" alt="" onerror="this.style.display=\'none\'">'
          : '';
        $('detailInfo').innerHTML = coverHtml +
          '<div class="detail-meta">' +
            '<h3>' + escapeHtml(info.name) + '</h3>' +
            (info.author ? '<p>创建者: ' + escapeHtml(info.author) + '</p>' : '') +
            (info.total ? '<p>歌曲数: ' + info.total + '</p>' : '') +
            (info.desc ? '<p class="desc">' + escapeHtml(info.desc) + '</p>' : '') +
          '</div>';

        $('detailSongs').innerHTML = list.length
          ? list.map(function (song) {
              return '<tr>' +
                '<td class="col-title"><div class="song-title-cell">' + escapeHtml(song.name) + '</div></td>' +
                '<td class="col-artist"><div class="cell-ellipsis">' + escapeHtml(song.singer) + '</div></td>' +
                '<td class="col-album"><div class="cell-ellipsis">' + escapeHtml(song.album || '') + '</div></td>' +
                '<td class="col-dur">' + formatDuration(song.duration) + '</td>' +
              '</tr>';
            }).join('')
          : emptyRow(4, '歌单内暂无歌曲');

        // 缓存以供「导入全部」
        songlistState.detailSongs = list;
        songlistState.detailSourceId = sourceId;
      } else {
        $('detailSongs').innerHTML = emptyRow(4, (res && res.msg) ? res.msg : '加载失败');
      }
    });
  }

  function searchSonglist() {
    var keyword = $('songlistKeyword').value.trim();
    if (!keyword) { showToast('请输入歌单关键词', 'warning'); return; }
    var sourceId = $('songlistSource').value;
    songlistState.sourceId = sourceId;
    songlistState.keyword = keyword;

    var grid = $('songlistList');
    grid.innerHTML = '<div class="empty">搜索中…</div>';
    $('songlistPagination').hidden = true;
    $('backToTagsBtn').hidden = false;

    api('songlist/search?source_id=' + encodeURIComponent(sourceId) +
        '&keyword=' + encodeURIComponent(keyword) +
        '&page=1&limit=' + songlistState.pageSize).then(function (res) {
      if (res && res.code === 0 && res.data) {
        songlistState.total = res.data.total || 0;
        renderSonglistList(res.data.list || []);
      } else {
        grid.innerHTML = '<div class="empty">' + escapeHtml((res && res.msg) || '搜索失败') + '</div>';
      }
    });
  }

  function importSonglistAll() {
    var list = songlistState.detailSongs;
    if (!list || list.length === 0) { showToast('暂无可导入的歌曲', 'warning'); return; }
    var sourceId = songlistState.detailSourceId;

    var songs = list.map(function (song) {
      return {
        title: song.name,
        artist: song.singer,
        album: song.album || '',
        duration: song.duration || 0,
        cover_url: song.cover || '',
        source_data: {
          platform: song.platform || sourceId,
          quality: 'standard',
          songInfo: song
        }
      };
    });

    openImportModal(songs, $('importSonglistBtn'));
  }

  /* =========================================================
   * 事件绑定
   * ========================================================= */

  function bindEvents() {
    // 搜索
    $('searchBtn').addEventListener('click', function () { doSearch(1); });
    $('searchInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') doSearch(1);
    });
    $('selectAll').addEventListener('change', function () {
      var checked = $('selectAll').checked;
      var list = searchState.results;
      document.querySelectorAll('#searchResults .song-check').forEach(function (cb, i) {
        cb.checked = checked;
        var idx = Number(cb.closest('tr').dataset.index);
        if (checked) selectedSongs[idx] = list[idx];
        else delete selectedSongs[idx];
        cb.closest('tr').classList.toggle('selected', checked);
      });
      updateImportButton();
    });
    $('importBtn').addEventListener('click', importSelected);
    $('searchPrev').addEventListener('click', function () {
      if (searchState.page > 1) doSearch(searchState.page - 1);
    });
    $('searchNext').addEventListener('click', function () {
      var pages = Math.ceil(searchState.total / searchState.pageSize);
      if (searchState.page < pages) doSearch(searchState.page + 1);
    });

    // 音源管理
    var dropzone = $('dropzone');
    var fileInput = $('fileInput');
    dropzone.addEventListener('click', function () { fileInput.click(); });
    dropzone.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
    });
    fileInput.addEventListener('change', function () {
      handleFiles(fileInput.files);
      fileInput.value = '';
    });
    ['dragenter', 'dragover'].forEach(function (ev) {
      dropzone.addEventListener(ev, function (e) {
        e.preventDefault(); e.stopPropagation();
        dropzone.classList.add('dragover');
      });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      dropzone.addEventListener(ev, function (e) {
        e.preventDefault(); e.stopPropagation();
        dropzone.classList.remove('dragover');
      });
    });
    dropzone.addEventListener('drop', function (e) {
      if (e.dataTransfer && e.dataTransfer.files) handleFiles(e.dataTransfer.files);
    });
    $('uploadBtn').addEventListener('click', uploadFiles);
    $('importUrlBtn').addEventListener('click', importFromUrl);
    $('reloadBtn').addEventListener('click', reloadAll);

    // 歌单
    $('songlistSource').addEventListener('change', function () {
      $('tagChips').dataset.loaded = '';
      $('tagChips').innerHTML = '<div class="empty">选择平台后点击「浏览分类」</div>';
      $('songlistList').innerHTML = '<div class="empty">暂无数据</div>';
    });
    $('songlistBrowseBtn').addEventListener('click', loadSonglistTags);
    $('songlistSearchBtn').addEventListener('click', searchSonglist);
    $('songlistKeyword').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') searchSonglist();
    });
    $('backToTagsBtn').addEventListener('click', function () {
      $('songlistList').innerHTML = '<div class="empty">暂无数据</div>';
      $('songlistPagination').hidden = true;
      $('backToTagsBtn').hidden = true;
    });
    $('backToListBtn').addEventListener('click', function () {
      $('songlistDetailCard').hidden = true;
    });
    $('importSonglistBtn').addEventListener('click', importSonglistAll);
    $('songlistPrev').addEventListener('click', function () {
      if (songlistState.page > 1) loadSonglistList(songlistState.page - 1);
    });
    $('songlistNext').addEventListener('click', function () {
      var pages = Math.ceil(songlistState.total / songlistState.pageSize);
      if (songlistState.page < pages) loadSonglistList(songlistState.page + 1);
    });

    // 导入目标对话框
    $('importModalClose').addEventListener('click', closeImportModal);
    $('importModal').addEventListener('click', function (e) {
      if (e.target === $('importModal')) closeImportModal();
    });
    document.querySelectorAll('.modal-option').forEach(function (opt) {
      opt.addEventListener('click', function () {
        var target = opt.dataset.target;
        if (target === 'library') {
          doImport(pendingImport.songs, pendingImport.btn, {});
        } else if (target === 'new-playlist') {
          $('newPlaylistBox').hidden = false;
          $('newPlaylistName').focus();
        }
      });
    });
    $('confirmNewPlaylist').addEventListener('click', function () {
      var name = $('newPlaylistName').value.trim();
      if (!name) { showToast('请输入歌单名称', 'warning'); return; }
      doImport(pendingImport.songs, pendingImport.btn, { new_playlist_name: name });
    });
    $('newPlaylistName').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') $('confirmNewPlaylist').click();
    });

    window.addEventListener('resize', moveTabIndicator);
  }

  /* =========================================================
   * 启动
   * ========================================================= */

  function init() {
    fillPlatformSelects();
    bindEvents();
    moveTabIndicator();
    checkHealth();
    setInterval(checkHealth, 30000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
