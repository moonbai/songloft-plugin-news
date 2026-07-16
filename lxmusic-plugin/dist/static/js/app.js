const API_BASE = '/api/v1/jsplugin/lxmusic';

let searchResults = [];
let selectedSongs = new Set();

function initTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  const panes = document.querySelectorAll('.tab-pane');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panes.forEach(p => p.classList.remove('active'));
      
      tab.classList.add('active');
      document.getElementById(tab.dataset.tab).classList.add('active');
    });
  });
}

async function searchMusic() {
  const keyword = document.getElementById('search-input').value.trim();
  const source = document.getElementById('source-select').value;
  const quality = document.getElementById('quality-select').value;

  if (!keyword) return;

  try {
    const response = await fetch(`${API_BASE}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword, source_id: source, quality, page: 1, page_size: 20 }),
    });
    const data = await response.json();

    if (data.code === 0) {
      searchResults = data.data.results || [];
      renderSearchResults(searchResults);
    }
  } catch (error) {
    console.error('Search failed:', error);
  }
}

function renderSearchResults(results) {
  const container = document.getElementById('search-results');
  container.innerHTML = '';

  results.forEach((song, index) => {
    const card = document.createElement('div');
    card.className = 'song-card';
    card.dataset.index = index;

    const duration = formatDuration(song.duration);

    card.innerHTML = `
      <input type="checkbox" class="song-checkbox">
      <div class="song-info">
        <h3>${escapeHtml(song.title)}</h3>
        <p>${escapeHtml(song.artist)} - ${escapeHtml(song.album)}</p>
      </div>
      <div class="song-duration">${duration}</div>
      <div class="song-actions">
        <button class="play-btn" onclick="playSong(${index})">▶</button>
        <button class="import-btn" onclick="importSong(${index})">+</button>
      </div>
    `;

    card.querySelector('.song-checkbox').addEventListener('change', (e) => {
      if (e.target.checked) {
        selectedSongs.add(index);
        card.classList.add('selected');
      } else {
        selectedSongs.delete(index);
        card.classList.remove('selected');
      }
      updateImportButtons();
    });

    container.appendChild(card);
  });

  updateImportButtons();
}

function updateImportButtons() {
  const importAllBtn = document.getElementById('import-all-btn');
  const importSelectedBtn = document.getElementById('import-selected-btn');

  importAllBtn.disabled = searchResults.length === 0;
  importSelectedBtn.disabled = selectedSongs.size === 0;
}

async function playSong(index) {
  const song = searchResults[index];
  if (!song) return;

  try {
    const response = await fetch(`${API_BASE}/api/search/topone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyword: song.title,
        source_id: song.source_data.platform,
        quality: song.source_data.quality,
      }),
    });
    const data = await response.json();

    if (data.code === 0 && data.data.url) {
      const audio = new Audio(data.data.url);
      audio.play();
    }
  } catch (error) {
    console.error('Play failed:', error);
  }
}

async function importSong(index) {
  const song = searchResults[index];
  if (!song) return;

  try {
    const response = await fetch(`${API_BASE}/api/songs/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        songs: [{
          title: song.title,
          artist: song.artist,
          album: song.album,
          cover_url: song.cover_url,
          duration: song.duration,
          source_data: song.source_data,
        }],
      }),
    });
    const data = await response.json();
    alert(data.code === 0 ? 'Imported successfully' : 'Import failed');
  } catch (error) {
    console.error('Import failed:', error);
  }
}

async function importAllSongs() {
  if (searchResults.length === 0) return;

  try {
    const songs = searchResults.map(song => ({
      title: song.title,
      artist: song.artist,
      album: song.album,
      cover_url: song.cover_url,
      duration: song.duration,
      source_data: song.source_data,
    }));

    const response = await fetch(`${API_BASE}/api/songs/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ songs }),
    });
    const data = await response.json();
    alert(data.code === 0 ? 'All imported' : 'Import failed');
  } catch (error) {
    console.error('Import failed:', error);
  }
}

async function importSelectedSongs() {
  if (selectedSongs.size === 0) return;

  try {
    const songs = Array.from(selectedSongs).map(index => {
      const song = searchResults[index];
      return {
        title: song.title,
        artist: song.artist,
        album: song.album,
        cover_url: song.cover_url,
        duration: song.duration,
        source_data: song.source_data,
      };
    });

    const response = await fetch(`${API_BASE}/api/songs/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ songs }),
    });
    const data = await response.json();
    alert(data.code === 0 ? 'Selected imported' : 'Import failed');
  } catch (error) {
    console.error('Import failed:', error);
  }
}

async function loadSources() {
  try {
    const response = await fetch(`${API_BASE}/api/sources`);
    const data = await response.json();

    if (data.code === 0) {
      renderSources(data.data.sources);
    }
  } catch (error) {
    console.error('Load sources failed:', error);
  }
}

function renderSources(sources) {
  const container = document.getElementById('source-list');
  container.innerHTML = '';

  sources.forEach(source => {
    const card = document.createElement('div');
    card.className = 'source-card';

    const platforms = source.platforms?.length ? source.platforms.join(', ') : 'None';
    let statusClass = 'disabled';
    let statusText = 'Disabled';

    if (source.loading) {
      statusClass = 'loading';
      statusText = 'Loading...';
    } else if (source.enabled) {
      statusClass = 'enabled';
      statusText = 'Enabled';
    }

    card.innerHTML = `
      <div class="source-info">
        <h3>${escapeHtml(source.name)}</h3>
        <div class="source-meta">
          <span>v${source.version}</span>
          ${source.author ? `<span>${escapeHtml(source.author)}</span>` : ''}
        </div>
        ${platforms !== 'None' ? `<div class="source-platforms">Platforms: ${platforms}</div>` : ''}
      </div>
      <div class="source-status ${statusClass}">${statusText}</div>
      <div class="source-actions-btns">
        <button class="toggle-btn" onclick="toggleSource('${source.id}')">
          ${source.enabled ? 'Disable' : 'Enable'}
        </button>
        <button class="delete-btn" onclick="deleteSource('${source.id}')">Delete</button>
      </div>
    `;

    container.appendChild(card);
  });
}

async function toggleSource(id) {
  try {
    const response = await fetch(`${API_BASE}/api/sources/toggle`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    const data = await response.json();
    if (data.code === 0) {
      loadSources();
    }
  } catch (error) {
    console.error('Toggle source failed:', error);
  }
}

async function deleteSource(id) {
  if (!confirm('Are you sure you want to delete this source?')) return;

  try {
    const response = await fetch(`${API_BASE}/api/sources?id=${id}`, {
      method: 'DELETE',
    });
    const data = await response.json();
    if (data.code === 0) {
      loadSources();
    }
  } catch (error) {
    console.error('Delete source failed:', error);
  }
}

async function importSourceFile() {
  const fileInput = document.getElementById('source-file');
  const files = fileInput.files;
  if (!files || files.length === 0) return;

  const formData = new FormData();
  for (let i = 0; i < files.length; i++) {
    formData.append('files', files[i]);
  }

  try {
    const response = await fetch(`${API_BASE}/api/sources/import`, {
      method: 'POST',
      body: formData,
    });
    const data = await response.json();
    if (data.code === 0) {
      loadSources();
      fileInput.value = '';
    }
  } catch (error) {
    console.error('Import file failed:', error);
  }
}

async function importSourceUrl() {
  const urlInput = document.getElementById('source-url');
  const url = urlInput.value.trim();
  if (!url) return;

  try {
    const response = await fetch(`${API_BASE}/api/sources/import-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const data = await response.json();
    if (data.code === 0) {
      loadSources();
      urlInput.value = '';
    }
  } catch (error) {
    console.error('Import URL failed:', error);
  }
}

async function reloadSources() {
  try {
    const response = await fetch(`${API_BASE}/api/sources/reload`, {
      method: 'POST',
    });
    const data = await response.json();
    if (data.code === 0) {
      loadSources();
    }
  } catch (error) {
    console.error('Reload sources failed:', error);
  }
}

async function createPlaylist() {
  const name = document.getElementById('playlist-name').value.trim();
  const desc = document.getElementById('playlist-desc').value.trim();

  if (!name) return;

  try {
    const response = await fetch(`${API_BASE}/api/playlists/create?name=${encodeURIComponent(name)}&description=${encodeURIComponent(desc)}`, {
      method: 'GET',
    });
    const data = await response.json();
    alert(data.code === 0 ? 'Playlist created' : 'Failed to create');
    if (data.code === 0) {
      document.getElementById('playlist-name').value = '';
      document.getElementById('playlist-desc').value = '';
    }
  } catch (error) {
    console.error('Create playlist failed:', error);
  }
}

function formatDuration(seconds) {
  if (!seconds) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  
  document.getElementById('search-btn').addEventListener('click', searchMusic);
  document.getElementById('search-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchMusic();
  });
  
  document.getElementById('import-all-btn').addEventListener('click', importAllSongs);
  document.getElementById('import-selected-btn').addEventListener('click', importSelectedSongs);
  
  document.getElementById('import-file-btn').addEventListener('click', () => {
    document.getElementById('source-file').click();
  });
  document.getElementById('source-file').addEventListener('change', importSourceFile);
  
  document.getElementById('import-url-btn').addEventListener('click', importSourceUrl);
  document.getElementById('reload-sources-btn').addEventListener('click', reloadSources);
  
  document.getElementById('create-playlist-btn').addEventListener('click', createPlaylist);
  
  loadSources();
});
