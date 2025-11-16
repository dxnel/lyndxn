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
let currentView = 'grid';
let isGrouped = false;
let paperColor, trackColor;
// modalResolve est maintenant géré localement

// --- ICONS ---
const SVG_PLAY = '<i class="fi fi-sr-play"></i>';
const SVG_PAUSE = '<i class="fi fi-sr-pause"></i>';
const SVG_GRID = '<i class="fi fi-sr-apps"></i>';
const SVG_LIST = '<i class="fi fi-sr-list"></i>';
const SVG_GROUP = '<i class="fi fi-sr-user"></i>';
const SVG_LISTEN = '<i class="fi fi-sr-music-alt"></i>';
// MODIFIÉ : Icônes de badge
const ICON_EXPLICIT = '<i class="fi fi-sr-circle-e"></i>';
const ICON_EXCLUSIVE = '<i class="fi fi-sr-play"></i>';


//--- UTIL ---
// CORRIGÉ : Bug de syntaxe
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

// MODIFIÉ : Fonction pour générer les badges
function createBadgeHtml(r) {
  let html = '';
  // Hiérarchie : Explicite d'abord
  if (r.explicit) {
    html += ` <div class="badge explicit" title="Explicit">${ICON_EXPLICIT}</div>`;
  }
  if (r.exclusive !== false) { // Affiche si 'exclusive' est true ou non défini
    html += ` <div class="badge exclusive" title="Exclusive">${ICON_EXCLUSIVE}</div>`;
  }
  return html.length > 0 ? `<div class="badge-container">${html}</div>` : '';
}

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
      <h2>Releases</h2>
      <div class="library-controls" id="library-controls">
        <div class="control-group">
          <button class="view-btn" data-action="toggle-group" title="Group by Artist" id="group-toggle-btn">${SVG_GROUP}</button>
        </div>
        <div class="control-group" id="view-toggle">
          <button class="view-btn ${currentView === 'grid' ? 'active' : ''}" data-action="toggle-view" data-view="grid" title="Grid View">${SVG_GRID}</button>
          <button class="view-btn ${currentView === 'list' ? 'active' : ''}" data-action="toggle-view" data-view="list" title="List View">${SVG_LIST}</button>
        </div>
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
  document.getElementById('library-controls').addEventListener('click', handleControlsClick);
  
  currentSort = 'date';
  isGrouped = false;
  
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

async function handleControlsClick(e) {
    const btn = e.target.closest('.view-btn');
    if (!btn) return;

    const action = btn.dataset.action;
    const gridContainer = document.getElementById('grid-container');
    let needsReflow = false;

    if (action === 'toggle-view') {
        const view = btn.dataset.view;
        if (view === currentView) return;
        currentView = view;
        
        document.querySelector('[data-view="grid"]').classList.toggle('active', currentView === 'grid');
        document.querySelector('[data-view="list"]').classList.toggle('active', currentView === 'list');
        needsReflow = true;
        
    } else if (action === 'toggle-group') {
        isGrouped = !isGrouped;
        btn.classList.toggle('active', isGrouped);
        needsReflow = true;
    }

    if (needsReflow && gridContainer) {
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

    let html = '';
    
    const sortFn = (a, b) => {
        if (currentSort === 'date') return new Date(b.date) - new Date(a.date);
        if (currentSort === 'title') return a.title.localeCompare(b.title);
        if (currentSort === 'artist') return a.credits.localeCompare(b.credits);
        return 0;
    };
     
    const renderItem = (r) => {
        if (currentView === 'grid') {
            return `
            <div class="card">
                <a href="#/release/${r.slug}" class="card-link">
                    <div class="card-image-wrap">
                        <img src="${r.cover}" alt="${r.title}" loading="lazy">
                    </div>
                    <div class="card-text">
                        <div class="card-title-row">
                            <div class="title">${escapeHtml(r.title)}</div>
                            ${createBadgeHtml(r)}
                        </div>
                        <div class="meta">
    <span>${escapeHtml(r.credits)}</span>
    <span class="meta-dot">●</span>
    <span>${new Date(r.date).getFullYear()}</span>
</div>
                    </div>
                </a>
            </div>`;
        } else {
            return `
            <a href="#/release/${r.slug}" class="list-item">
                <img src="${r.cover}" alt="${r.title}" loading="lazy">
                <div class="list-item-meta">
                    <div class="list-title-row">
                        <span class="title">${escapeHtml(r.title)}</span>
                    </div>
                    <div class="meta">${escapeHtml(r.credits)}</div>
                    
                </div>
                <div class="list-date-row">
                    <span>${formatDate(r.date)}</span>
                    ${createBadgeHtml(r)}
                </div>
            </a>`;
        }
    };

    if (isGrouped) {
        const releasesByArtist = releases.reduce((acc, release) => {
            const artist = release.credits || 'Unknown Artist';
            if (!acc[artist]) acc[artist] = [];
            acc[artist].push(release);
            return acc;
        }, {});

        const sortedArtists = Object.keys(releasesByArtist).sort((a, b) => a.localeCompare(b));

        const listClass = currentView === 'list' ? 'list' : '';
        html += `<div class="${listClass}">`;
        
        for (const artist of sortedArtists) {
            html += `<h2 class="artist-group-header">${escapeHtml(artist)}</h2>`;
            const artistTracks = releasesByArtist[artist].sort(sortFn);
            
            if (currentView === 'grid') {
                html += '<div class="grid">';
                html += artistTracks.map(renderItem).join('');
                html += '</div>';
            } else {
                html += artistTracks.map(renderItem).join('');
            }
        }
        
        html += `</div>`;
        
    } else {
        const sortedReleases = [...releases].sort(sortFn);
        if (currentView === 'grid') {
            html = `<div class="grid">${sortedReleases.map(renderItem).join('')}</div>`;
        } else {
            html = `<div class="list">${sortedReleases.map(renderItem).join('')}</div>`;
        }
    }

    gridContainer.innerHTML = html;
}


//--- RELEASE ---
function renderRelease(slug) {
  const r = releases.find(x => x.slug === slug);
  if (!r) { app.innerHTML = `<p>Release not found.</p>`; return; }
  const desc = escapeHtml(r.description).replace(/\n/g, '<br>');
  
  const isExclusive = r.exclusive !== false;
  let buttonHtml = '';
  if (isExclusive) {
      buttonHtml = `
        <button class="btn" id="play-release-btn"><i class="fi fi-sr-play"></i> Play</button>
        <a class="btn secondary" href="${r.audio}" download="${r.slug}.mp3">Download</a>
      `;
  } else {
      buttonHtml = `
        <a class="btn" href="${r.stream_url || '#'}" target="_blank"><i class="fi fi-sr-headphones"></i> Listen Now</a>
      `;
  }
  
  const html = `
  <div class="page-header">
    <a href="#" class="back-link">← Back to releases</a>
  </div>

  <section class="release-hero">
    <img src="${r.cover}" alt="${r.title}">
    <div class="release-details">
      
      <h1 class="release-title">${escapeHtml(r.title)}</h1>
      <div class="release-artist">${escapeHtml(r.credits)}</div>
      <div class="release-year"><span>${escapeHtml(r.genre + " " || 'No genre')}<span class="meta-dot">● </span><span>${new Date(r.date).getFullYear()}</span></span></div>
      
      <div class="release-actions">
   ${buttonHtml}
</div>

      <p class="release-desc">${desc || '...'}</p>
      
      <div class="release-date-bottom">${formatDate(r.date)}</div>
      <div class="release-badges">${createBadgeHtml(r)}</div>
      
      ${r.lyrics ? `<h3 style="margin-top:40px; font-size:14px; text-transform:uppercase; letter-spacing:1px; color:var(--muted);">Lyrics</h3><p class="release-desc">${r.lyrics.replace(/\n/g, '<br>')}</p>` : ''}
      
    </div>
  </section>`;
  
  app.innerHTML = html;
  
  if (isExclusive) {
    document.getElementById('play-release-btn').addEventListener('click', () => playRelease(r));
  }
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
    <a href="#" class="back-link">← Back to releases</a>
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
        { src: r.cover, sizes: '512x512', type: 'image/png' },
      ]
    });
  }
}

function playRelease(r) {
  if (r.exclusive === false) return; 
  
  currentIndex = releases.findIndex(x => x.slug === r.slug); 
  if (currentIndex === -1) return;
  
  const isSameTrack = audio.src.includes(r.audio.split('/').pop());
  
  dockCover.src = r.cover; 
  dockTitle.textContent = r.title; 
  dockSub.textContent = r.credits;
  downloadLink.href = r.audio; 
  downloadLink.download = `${r.slug}.mp3`;
  updateMediaSession(r);
  
  if(!isSameTrack) {
      audio.src = r.audio;
      seek.value = 0;
      curTime.textContent = '0:00';
      updateSliderBackground(0);
      
      audio.play();
      isPlaying = true;
  } else {
      togglePlay();
  }
  
  playerDock.classList.add('active'); 
  updatePlayBtn();
  
  if ('mediaSession' in navigator) {
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }
}

function updatePlayBtn() {
    const icon = isPlaying ? SVG_PAUSE : SVG_PLAY;
    btnPlay.innerHTML = icon;
    const bigBtn = document.getElementById('play-release-btn');
    if(bigBtn) bigBtn.innerHTML = `${icon} ${isPlaying ? 'Pause' : 'Play'}`;
}

function togglePlay() {
    if (!audio.src && releases.length > 0) {
        const firstExclusive = releases.find(r => r.exclusive !== false);
        if(firstExclusive) {
            playRelease(firstExclusive);
        }
        return;
    }
    isPlaying ? audio.pause() : audio.play();
    isPlaying = !isPlaying;
    updatePlayBtn();
    
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }
}

function playNext() {
    if (!releases.length) return;
    let nextIndex = (currentIndex + 1) % releases.length;
    
    while (releases[nextIndex].exclusive === false && nextIndex !== currentIndex) {
        nextIndex = (nextIndex + 1) % releases.length;
    }
    
    if (releases[nextIndex].exclusive !== false) {
        playRelease(releases[nextIndex]);
    }
}
function playPrev() {
    if (!releases.length) return;
    let prevIndex = (currentIndex - 1 + releases.length) % releases.length;

    while (releases[prevIndex].exclusive === false && prevIndex !== currentIndex) {
        prevIndex = (prevIndex - 1 + releases.length) % releases.length;
    }
    
    if (releases[prevIndex].exclusive !== false) {
        playRelease(releases[prevIndex]);
    }
}

function updateSliderBackground(pct) {
    const percent = pct !== undefined ? pct : seek.value || 0;
    seek.style.background = `linear-gradient(to right, ${paperColor} ${percent}%, ${trackColor} ${percent}%)`;
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
  
  updateSliderBackground(0);

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