const API = '/api';
let token = localStorage.getItem('melodia_admin_token');

// ── Init ──
window.onload = async () => {
  if (token) {
    try {
      const res  = await fetch(`${API}/auth/verify`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.valid) {
        showDashboard();
        loadSongs();
      } else {
        clearToken();
      }
    } catch {
      clearToken();
    }
  }
};

// ── Auth ──
function clearToken() {
  token = null;
  localStorage.removeItem('melodia_admin_token');
}

async function login() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const errorEl  = document.getElementById('login-error');
  errorEl.textContent = '';

  if (!username || !password) {
    errorEl.textContent = 'Please enter username and password.';
    return;
  }

  try {
    const res  = await fetch(`${API}/auth/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      errorEl.textContent = data.error;
      return;
    }

    token = data.token;
    localStorage.setItem('melodia_admin_token', token);
    showDashboard();
    loadSongs();
  } catch {
    errorEl.textContent = 'Cannot reach server. Is it running?';
  }
}

function logout() {
  clearToken();
  document.getElementById('dashboard').style.display  = 'none';
  document.getElementById('login-page').style.display = 'flex';
}

function showDashboard() {
  document.getElementById('login-page').style.display = 'none';
  document.getElementById('dashboard').style.display  = 'block';
}

// ── File select ──
function onFileSelect(input) {
  const file = input.files[0];
  if (!file) return;

  document.getElementById('selected-file').style.display = 'block';
  document.getElementById('selected-name').textContent   = file.name;

  // Auto-fill title/artist hints from filename
  const name  = file.name.replace(/\.[^/.]+$/, '');
  const parts = name.split(' - ');
  if (parts.length > 1) {
    document.getElementById('song-artist').placeholder = parts[0].trim();
    document.getElementById('song-title').placeholder  = parts.slice(1).join(' - ').trim();
  } else {
    document.getElementById('song-title').placeholder = name.trim();
  }
}

// ── Drag and drop ──
const dropArea = document.getElementById('drop-area');

dropArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropArea.classList.add('active');
});

dropArea.addEventListener('dragleave', () => {
  dropArea.classList.remove('active');
});

dropArea.addEventListener('drop', (e) => {
  e.preventDefault();
  dropArea.classList.remove('active');
  const file = e.dataTransfer.files[0];
  if (file) {
    const input   = document.getElementById('song-file');
    const dt      = new DataTransfer();
    dt.items.add(file);
    input.files   = dt.files;
    onFileSelect(input);
  }
});

// ── Upload ──
async function uploadSong() {
  const fileInput = document.getElementById('song-file');
  if (!fileInput.files[0]) {
    showToast('Please select an audio file first.', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('song',   fileInput.files[0]);
  formData.append('title',  document.getElementById('song-title').value);
  formData.append('artist', document.getElementById('song-artist').value);
  formData.append('album',  document.getElementById('song-album').value);

  const bar  = document.getElementById('upload-progress');
  const fill = document.getElementById('upload-progress-fill');
  bar.style.display = 'block';
  fill.style.width  = '10%';

  try {
    const res  = await fetch(`${API}/admin/upload`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}` },
      body:    formData,
    });

    fill.style.width = '100%';
    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Upload failed.', 'error');
    } else {
      showToast(`✅ "${data.song.title}" uploaded!`, 'success');
      // Reset form
      fileInput.value = '';
      document.getElementById('selected-file').style.display = 'none';
      document.getElementById('song-title').value   = '';
      document.getElementById('song-artist').value  = '';
      document.getElementById('song-album').value   = '';
      document.getElementById('song-title').placeholder  = 'Auto from filename';
      document.getElementById('song-artist').placeholder = 'Auto from filename';
      loadSongs();
    }
  } catch {
    showToast('Upload failed. Is the server running?', 'error');
  } finally {
    setTimeout(() => {
      bar.style.display = 'none';
      fill.style.width  = '0%';
    }, 1000);
  }
}

// ── Load Songs ──
async function loadSongs() {
  try {
    const res  = await fetch(`${API}/admin/songs`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    const list = document.getElementById('songs-list');

    document.getElementById('songs-count').textContent =
      `${data.total} song${data.total !== 1 ? 's' : ''}`;

    if (data.songs.length === 0) {
      list.innerHTML = `
        <div class="empty-songs">
          <div class="empty-songs-icon">🎶</div>
          No songs uploaded yet.
        </div>`;
      return;
    }

    list.innerHTML = data.songs.map(song => `
      <div class="song-row" id="row-${song.id}">
        <div class="song-icon">🎵</div>
        <div class="song-info">
          <div class="song-title">${song.title}</div>
          <div class="song-artist">
            ${song.artist}${song.album !== 'Unknown Album' ? ' · ' + song.album : ''}
          </div>
        </div>
        <div class="song-size">${formatSize(song.size)}</div>
        <button class="delete-btn" onclick="deleteSong('${song.id}', '${song.title.replace(/'/g, "\\'")}')" title="Delete">🗑</button>
      </div>
    `).join('');

  } catch {
    showToast('Could not load songs.', 'error');
  }
}

// ── Delete ──
async function deleteSong(id, title) {
  if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;

  try {
    const res = await fetch(`${API}/admin/songs/${id}`, {
      method:  'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      showToast(`🗑 "${title}" deleted.`, 'success');
      loadSongs();
    } else {
      showToast('Failed to delete song.', 'error');
    }
  } catch {
    showToast('Delete failed. Is the server running?', 'error');
  }
}

// ── Toast ──
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = `toast ${type} show`;
  setTimeout(() => t.classList.remove('show'), 3500);
}

// ── Helpers ──
function formatSize(bytes) {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}