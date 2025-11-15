const app = document.getElementById('app'),
      playerDock = document.getElementById('player-dock'),
      dockCover = document.getElementById('dock-cover'),
      dockTitle = document.getElementById('dock-title'),
      dockSub = document.getElementById('dock-sub'),
      btnPlay = document.getElementById('btn-play'),
      btnPrev = document.getElementById('btn-prev'),
      btnNext = document.getElementById('btn-next'),
      curTime = document.getElementById('cur-time'),
      durTime = document.getElementById('dur-time'),
      seek = document.getElementById('seek'),
      downloadLink = document.getElementById('download-link'),
      adminIcon = document.getElementById('admin-icon');
      
// --- ÉLÉMENTS MODAL ---
const modalOverlay = document.getElementById('modal-overlay'),
      customModal = document.getElementById('custom-modal'),
      modalTitle = document.getElementById('modal-title'),
      modalText = document.getElementById('modal-text'),
      modalInputArea = document.getElementById('modal-input-area'),
      modalPassword = document.getElementById('modal-password'),
      modalSubmit = document.getElementById('modal-submit'),
      modalCancel = document.getElementById('modal-cancel');

let releases = [], currentIndex = 0, audio = new Audio(), isPlaying = false;
let currentSort = 'date';
let currentView = 'grid'; // État de la vue
let paperColor, trackColor;
// modalResolve est maintenant géré localement dans chaque promesse

// --- ICONS ---
const SVG_PLAY = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
const SVG_PAUSE = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
const SVG_GRID = '<svg fill="currentColor" viewBox="0 0 16 16"><path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5v-3zm8 0A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5v-3zm-8 8A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5v-3zm8 0A1.5 1.5 0 0 1 10.5 9h3A1.5 1.5 0 0 1 15 10.5v3A1.5 1.5 0 0 1 13.5 15h-3A1.5 1.5 0 0 1 9 13.5v-3z"/></svg>';
const SVG_LIST = '<svg fill="currentColor" viewBox="0 0 16 16"><path d="M2 3.5A.5.5 0 0 1 2.5 3h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5zm0 4A.5.5 0 0 1 2.5 7h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5zm0 4A.5.5 0 0 1 2.5 11h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5z"/></svg>';


//--- UTIL ---
// MODIFIÉ : Correction de la syntaxe de ' (remplacé ''' par '&#39;')
const escapeHtml = s => s || s === 0 ? s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]) : '';
const formatTime = s => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
const downloadFile = (name, text) => { const blob = new Blob([text], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); };

const formatDate = (dateString) => {
    try {
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}-${month}-${year}`;
    } catch (e) {
        console.error("Erreur formatage date:", e);
        return dateString;
    }
};

//--- FETCH ---
async function loadReleases() {
  try {
    const res = await fetch('https://raw.githubusercontent.com/dxnel/lyndxn/refs/heads/main/releases.json?t=' + Date.now());
    if (!res.ok) throw new Error(res.status);
    releases = await res.json();
  } catch (e) {
    console.error(e);
    app.innerHTML = `<p style="color:#f55">Error: ${e.message}</p>`;
  }
}

//--- TRANSITION SYSTEM ---
function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function transitionTo(renderFn) {
    app.classList.add('page-exit');
    await wait(350);
    renderFn();
    window.scrollTo(0, 0);
    app.classList.remove('page-exit');
    app.classList.add('page-enter');
    void app.offsetWidth; 
    app.classList.remove('page-enter');
}

//--- ROUTER ---
async function router() {
  if (!releases.length) await loadReleases();
  
  const hash = window.location.hash;
  
  transitionTo(() => {
      if (hash.startsWith('#/release/')) renderRelease(hash.split('/')[2]);
      else if (hash === '#/admin') renderAdmin();
      else renderHome();
  });
}

//--- HOME & GRID ---
async function renderHome() {
  app.innerHTML = `
    <div class="home-header">
      <h2>Library</h2>
      <div class="view-toggle" id="view-toggle">
        <button class="view-btn ${currentView === 'grid' ? 'active' : ''}" data-view="grid" title="Grid View">${SVG_GRID}</button>
        <button class="view-btn ${currentView === 'list' ? 'active' : ''}" data-view="list" title="List View">${SVG_LIST}</button>
      </div>
      <div class="tabs" id="sort-tabs">
        <button class="tab-btn active" data-sort="date">Recent</button>
        <button class="tab-btn" data-sort="title">Name (A-Z)</button>
        <button class="tab-btn" data-sort="artist">Artist (A-Z)</button>
      </div>
    </div>
    <div class="grid-container" id="grid-container">
    </div>`;
    
  document.getElementById('sort-tabs').addEventListener('click', handleSortClick);
  document.getElementById('view-toggle').addEventListener('click', handleViewClick);
  
  currentSort = 'date';
  
  const gridContainer = document.getElementById('grid-container');
  gridContainer.classList.add('grid-page-enter');
  renderGrid();
  
  await wait(50);
  
  void gridContainer.offsetWidth;
  gridContainer.classList.remove('grid-page-enter');
}

function handleSortClick(e) {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    
    const sortBy = btn.dataset.sort;
    if (sortBy === currentSort) return;
    
    currentSort = sortBy;
    
    document.querySelectorAll('#sort-tabs .tab-btn').forEach(b => {
        b.classList.remove('active');
    });
    btn.classList.add('active');
    
    renderGrid();
}

async function handleViewClick(e) {
    const btn = e.target.closest('.view-btn');
    if (!btn) return;

    const view = btn.dataset.view;
    if (view === currentView) return;

    currentView = view;

    document.querySelectorAll('#view-toggle .view-btn').forEach(b => {
        b.classList.remove('active');
    });
    btn.classList.add('active');

    const gridContainer = document.getElementById('grid-container');
    if (gridContainer) {
        gridContainer.classList.add('fading');
        await wait(150);
        renderGrid();
        gridContainer.classList.remove('fading');
    }
}

function renderGrid() {
    const gridContainer = document.getElementById('grid-container');
    if (!gridContainer) return;

    if (!releases.length) {
        gridContainer.innerHTML = '<p>Loading...</p>'; 
        return; 
    }

    let sortedReleases = [...releases];
    if (currentSort === 'date') {
        sortedReleases.sort((a, b) => new Date(b.date) - new Date(a.date));
    } else if (currentSort === 'title') {
        sortedReleases.sort((a, b) => a.title.localeCompare(b.title));
    } else if (currentSort === 'artist') {
        sortedReleases.sort((a, b) => a.credits.localeCompare(b.credits));
    }

    let html = '';
    
    if (currentView === 'grid') {
        html = `<div class="grid">
            ${sortedReleases.map(r => `
            <div class="card">
                <a href="#/release/${r.slug}" class="card-link">
                    <div class="card-image-wrap">
                        <img src="${r.cover}" alt="${r.title}" loading="lazy">
                    </div>
                    <div class="card-text">
                        <div class="title">${escapeHtml(r.title)}</div>
                        <div class="meta">${escapeHtml(r.credits)}</div>
                    </div>
                </a>
            </div>`).join('')}
        </div>`;
    } else {
        html = `<div class="list">
            ${sortedReleases.map(r => `
            <a href="#/release/${r.slug}" class="list-item">
                <img src="${r.cover}" alt="${r.title}" loading="lazy">
                <div class="list-item-meta">
                    <div class="title">${escapeHtml(r.title)}</div>
                    <div class="meta">${escapeHtml(r.credits)}</div>
                </div>
                <div class="list-item-date">${formatDate(r.date)}</div>
            </a>
            `).join('')}
        </div>`;
    }

    gridContainer.innerHTML = html;
}


//--- RELEASE ---
function renderRelease(slug) {
  const r = releases.find(x => x.slug === slug);
  if (!r) { app.innerHTML = `<p>Release not found. <a href="#">Go home</a></p>`; return; }
  const desc = escapeHtml(r.description).replace(/\n/g, '<br>');
  
  const html = `
  <div class="page-header">
    <a href="#" class="back-link">← Back to library</a>
  </div>

  <section class="release-hero">
    <img src="${r.cover}" alt="${r.title}">
    <div class="release-details">
      
      <h1 class="release-title">${escapeHtml(r.title)}</h1>
      <div class="release-artist">${escapeHtml(r.credits)}</div>
      
      <div style="display:flex; gap:12px; margin-bottom:32px;">
         <button class="btn" id="play-release-btn">${SVG_PLAY} Play</button>
         <a class="btn secondary" href="${r.audio}" download="${r.slug}.mp3">Download</a>
      </div>

      <p class="release-desc">${desc || '...'}</p>
      
      <div class="release-date-bottom">Release date: ${formatDate(r.date)}</div>
      
      ${r.lyrics ? `<h3 style="margin-top:40px; font-size:14px; text-transform:uppercase; letter-spacing:1px; color:var(--muted);">Lyrics</h3><p class="release-desc" style="color:var(--muted);">${r.lyrics.replace(/\n/g, '<br>')}</p>` : ''}
      
    </div>
  </section>`;
  
  app.innerHTML = html;
  document.getElementById('play-release-btn').addEventListener('click', () => playRelease(r));
}

//--- FONCTIONS MODAL ---
function closeModal() {
    return new Promise(resolve => {
        modalOverlay.classList.remove('visible');
        setTimeout(() => {
            modalOverlay.classList.add('hidden');
            resolve();
        }, 300);
    });
}
function showCustomAlert(title, text) {
    modalTitle.textContent = title;
    modalText.innerHTML = text;
    modalInputArea.classList.add('hidden');
    modalSubmit.textContent = 'OK';
    modalCancel.classList.add('hidden');
    
    modalOverlay.classList.remove('hidden');
    requestAnimationFrame(() => modalOverlay.classList.add('visible'));

    return new Promise(resolve => {
        const handleSubmit = async () => {
            await closeModal();
            cleanupListeners();
            resolve(true);
        };
        const handleOverlayClick = async (e) => {
            if (e.target === modalOverlay) await handleSubmit();
        };
        const handleKeydown = async (e) => {
            if (e.key === 'Escape' || e.key === 'Enter') await handleSubmit();
        };
        const cleanupListeners = () => {
            modalSubmit.removeEventListener('click', handleSubmit);
            modalOverlay.removeEventListener('click', handleOverlayClick);
            window.removeEventListener('keydown', handleKeydown);
        };
        modalSubmit.addEventListener('click', handleSubmit);
        modalOverlay.addEventListener('click', handleOverlayClick);
        window.addEventListener('keydown', handleKeydown);
    });
}
function showCustomPrompt(title, text, placeholder) {
    modalTitle.textContent = title;
    modalText.innerHTML = text;
    modalInputArea.classList.remove('hidden');
    modalPassword.value = '';
    modalPassword.placeholder = placeholder || '';
    modalSubmit.textContent = 'Login';
    modalCancel.classList.remove('hidden');

    modalOverlay.classList.remove('hidden');
    requestAnimationFrame(() => modalOverlay.classList.add('visible'));
    
    return new Promise(resolve => {
        const handleSubmit = async () => {
            const value = modalPassword.value;
            await closeModal();
            cleanupListeners();
            resolve(value);
        };
        const handleCancel = async () => {
            await closeModal();
            cleanupListeners();
            resolve(null);
        };
        const handleOverlayClick = async (e) => {
            if (e.target === modalOverlay) await handleCancel();
        };
        const handleKeydown = async (e) => {
            if (e.key === 'Escape') await handleCancel();
            if (e.key === 'Enter') await handleSubmit();
        };
        const cleanupListeners = () => {
            modalSubmit.removeEventListener('click', handleSubmit);
            modalCancel.removeEventListener('click', handleCancel);
            modalOverlay.removeEventListener('click', handleOverlayClick);
            window.removeEventListener('keydown', handleKeydown);
        };
        modalSubmit.addEventListener('click', handleSubmit);
        modalCancel.addEventListener('click', handleCancel);
        modalOverlay.addEventListener('click', handleOverlayClick);
        window.addEventListener('keydown', handleKeydown);
    });
}

//--- LOGIQUE ADMIN ---
adminIcon.addEventListener('click', async () => {
  const p = await showCustomPrompt('Admin Login', 'Enter admin password:', 'Password');
  
  if (p === '1234') {
    window.location.hash = '#/admin';
  } else if (p !== null) {
    await showCustomAlert('Error', 'Wrong password.');
  }
});
function renderAdmin() {
  app.innerHTML = `<section>
  <div class="page-header">
    <a href="#" class="back-link">← Back to library</a>
  </div>
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
    <h2>Database Manager</h2>
  </div>
  <div class="admin-area">
  <p style="color:var(--muted); margin-bottom:12px;">Edit standard JSON format.</p>
  <textarea class="jsonedit" id="json-edit">${escapeHtml(JSON.stringify(releases, null, 2))}</textarea>
  <div style="margin-top:20px; display:flex; gap:12px;">
  <button class="btn" id="download-json">Download JSON</button>
  <button class="btn secondary" id="apply-json">Apply Test</button>
  </div></div></section>`;
  
  document.getElementById('download-json').addEventListener('click', () => downloadFile('releases.json', document.getElementById('json-edit').value));
  
  document.getElementById('apply-json').addEventListener('click', async () => {
    try { 
      releases = JSON.parse(document.getElementById('json-edit').value); 
      await showCustomAlert('Success', 'Applied in memory.');
    } catch (e) { 
      await showCustomAlert('Error', 'JSON error: ' + e.message);
    }
  });
}

//--- PLAYBACK ---
function updateMediaSession(r) {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: r.title,
      artist: r.credits,
      album: 't.m.t.r.',
      artwork: [
        { src: r.cover, sizes: '512x512', type: 'image/png' }, // J'assume png/jpg, ajuste si besoin
      ]
    });
  }
}

function playRelease(r) {
  currentIndex = releases.findIndex(x => x.slug === r.slug); if (currentIndex === -1) return;
  const isSameTrack = audio.src.includes(r.audio.split('/').pop());
  
  if(!isSameTrack) {
      audio.src = r.audio;
      dockCover.src = r.cover; 
      dockTitle.textContent = r.title; 
      dockSub.textContent = r.credits;
      downloadLink.href = r.audio; 
      downloadLink.download = `${r.slug}.mp3`;
      audio.play();
      isPlaying = true;
  } else {
      togglePlay();
  }
  
  playerDock.classList.add('active'); 
  updatePlayBtn();
  updateSliderBackground();
  updateMediaSession(r);
  
  if ('mediaSession' in navigator) {
    navigator.mediaSession.playbackState = 'playing';
  }
}

function updatePlayBtn() {
    const icon = isPlaying ? SVG_PAUSE : SVG_PLAY;
    btnPlay.innerHTML = icon;
    const bigBtn = document.getElementById('play-release-btn');
    if(bigBtn) bigBtn.innerHTML = `${icon} ${isPlaying ? 'Pause' : 'Play'}`;
}

function togglePlay() {
    if (!audio.src && releases.length > 0) { playRelease(releases[0]); return; }
    isPlaying ? audio.pause() : audio.play();
    isPlaying = !isPlaying;
    updatePlayBtn();
    
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }
}

function playNext() { if(releases.length) playRelease(releases[(currentIndex + 1) % releases.length]); }
function playPrev() { if(releases.length) playRelease(releases[(currentIndex - 1 + releases.length) % releases.length]); }

function updateSliderBackground() {
    const pct = seek.value || 0;
    seek.style.background = `linear-gradient(to right, ${paperColor} ${pct}%, ${trackColor} ${pct}%)`;
}


//--- INIT ---
function init() {
  try {
      paperColor = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim();
      trackColor = getComputedStyle(document.documentElement).getPropertyValue('--muted').trim();
      if (!paperColor) paperColor = '#ededed';
      if (!trackColor) trackColor = '#444';
  } catch (e) {
      console.error("Could not get CSS vars for slider, using fallbacks:", e);
      paperColor = '#ededed';
      trackColor = '#444';
  }
  
  updateSliderBackground();

  btnPlay.addEventListener('click', togglePlay);
  btnNext.addEventListener('click', playNext);
  btnPrev.addEventListener('click', playPrev);
  
  audio.addEventListener('timeupdate', () => {
      curTime.textContent = formatTime(audio.currentTime);
      const pct = (audio.currentTime / audio.duration * 100) || 0;
      seek.value = pct;
      updateSliderBackground();
  });
  
  audio.addEventListener('loadedmetadata', () => { durTime.textContent = formatTime(audio.duration); });
  audio.addEventListener('ended', () => playNext());
  
  seek.addEventListener('input', () => { 
      if (!audio.duration) return; 
      const newTime = (seek.value / 100) * audio.duration;
      audio.currentTime = newTime;
      updateSliderBackground();
  });
  
  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('previoustrack', playPrev);
    navigator.mediaSession.setActionHandler('nexttrack', playNext);
    navigator.mediaSession.setActionHandler('play', togglePlay);
    navigator.mediaSession.setActionHandler('pause', togglePlay);
  }

  window.addEventListener('hashchange', router);
  document.getElementById('year').textContent = new Date().getFullYear();
  
  loadReleases().then(router);
}

init();