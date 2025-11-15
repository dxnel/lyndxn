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
let paperColor, trackColor;
// modalResolve est maintenant géré localement dans chaque promesse

// --- ICONS ---
const SVG_PLAY = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
const SVG_PAUSE = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';

//--- UTIL ---
const escapeHtml = s => s || s === 0 ? s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]) : '';
const formatTime = s => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
const downloadFile = (name, text) => { const blob = new Blob([text], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); };

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
      <div class="tabs" id="sort-tabs">
        <button class="tab-btn active" data-sort="date">Recent</button>
        <button class="tab-btn" data-sort="title">Name (A-Z)</button>
        <button class="tab-btn" data-sort="artist">Artist (A-Z)</button>
      </div>
    </div>
    <div class="grid" id="releases-grid">
    </div>`;
    
  document.getElementById('sort-tabs').addEventListener('click', handleSortClick);
  
  currentSort = 'date';
  
  // Animation d'apparition LENTE
  const grid = document.getElementById('releases-grid');
  grid.classList.add('grid-page-enter'); // Utilise l'animation de 0.4s
  renderGrid();
  
  await wait(50);
  
  void grid.offsetWidth;
  grid.classList.remove('grid-page-enter');
}

async function handleSortClick(e) {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    
    const sortBy = btn.dataset.sort;
    if (sortBy === currentSort) return;
    
    currentSort = sortBy;
    
    document.querySelectorAll('#sort-tabs .tab-btn').forEach(b => {
        b.classList.remove('active');
    });
    btn.classList.add('active');
    
    // Animation de tri RAPIDE (horizontale)
    const grid = document.getElementById('releases-grid');
    if (grid) {
        grid.classList.add('grid-sort-exit'); // Animation de sortie (0.2s)
        await wait(200); // Attend 200ms (au lieu de 150 ou 300)
        
        renderGrid(); // Change le contenu
        
        grid.classList.remove('grid-sort-exit');
        grid.classList.add('grid-sort-enter'); // Prépare l'entrée (0.2s)
        
        void grid.offsetWidth;
        grid.classList.remove('grid-sort-enter'); // Animation d'entrée
    }
}

function renderGrid() {
    if (!releases.length) {
        app.innerHTML = '<p>Loading...</p>'; 
        return; 
    }

    const grid = document.getElementById('releases-grid');
    if (!grid) return;

    let sortedReleases = [...releases];
    if (currentSort === 'date') {
        sortedReleases.sort((a, b) => new Date(b.date) - new Date(a.date));
    } else if (currentSort === 'title') {
        sortedReleases.sort((a, b) => a.title.localeCompare(b.title));
    } else if (currentSort === 'artist') {
        sortedReleases.sort((a, b) => a.credits.localeCompare(b.credits));
    }

    grid.innerHTML = sortedReleases.map(r => `
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
    </div>`).join('');
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
         <a class="btn secondary" href="${r.audio}" download="${r.slug}.wav">Download</a>
      </div>

      <p class="release-desc">${desc || '...'}</p>
      
      ${r.lyrics ? `<h3 style="margin-top:40px; font-size:14px; text-transform:uppercase; letter-spacing:1px; color:var(--muted);">Lyrics</h3><p class="release-desc" style="color:var(--muted);">${r.lyrics.replace(/\n/g, '<br>')}</p>` : ''}
      
    </div>
  </section>`;
  
  app.innerHTML = html;
  document.getElementById('play-release-btn').addEventListener('click', () => playRelease(r));
}

//--- FONCTIONS MODAL (Corrigées) ---

// Renvoie une promesse qui se résout à la fin de l'animation de fermeture
function closeModal() {
    return new Promise(resolve => {
        modalOverlay.classList.remove('visible');
        setTimeout(() => {
            modalOverlay.classList.add('hidden');
            resolve(); // La promesse se résout une fois l'animation terminée
        }, 300); // Doit correspondre à la transition CSS
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

    // Crée une promesse qui attend la fermeture
    return new Promise(resolve => {
        // Crée des gestionnaires de clics uniques pour CETTE alerte
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

        // Attache les écouteurs
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
    
    // Ligne de focus auto supprimée

    // Crée une promesse qui attend la fermeture
    return new Promise(resolve => {
        // Crée des gestionnaires de clics uniques
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

        // Attache les écouteurs
        modalSubmit.addEventListener('click', handleSubmit);
        modalCancel.addEventListener('click', handleCancel);
        modalOverlay.addEventListener('click', handleOverlayClick);
        window.addEventListener('keydown', handleKeydown);
    });
}

//--- LOGIQUE ADMIN ---
adminIcon.addEventListener('click', async () => {
  // 1. Attend la RÉPONSE ET la FERMETURE du prompt
  const p = await showCustomPrompt('Admin Login', 'Enter admin password:', 'Password');
  
  if (p === '1234') {
    window.location.hash = '#/admin';
  } else if (p !== null) { // (null signifie 'Cancel')
    // 2. Ouvre l'alerte SEULEMENT APRÈS la fermeture du prompt
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
function playRelease(r) {
  currentIndex = releases.findIndex(x => x.slug === r.slug); if (currentIndex === -1) return;
  
  const isSameTrack = audio.src.includes(r.audio.split('/').pop());
  
  if(!isSameTrack) {
      audio.src = r.audio;
      dockCover.src = r.cover; 
      dockTitle.textContent = r.title; 
      dockSub.textContent = r.credits;
      downloadLink.href = r.audio; 
      downloadLink.download = `${r.slug}.wav`;
      audio.play();
      isPlaying = true;
  } else {
      togglePlay();
  }
  
  playerDock.classList.add('active'); 
  updatePlayBtn();
  updateSliderBackground();
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
}

function playNext() { if(releases.length) playRelease(releases[(currentIndex + 1) % releases.length]); }
function playPrev() { if(releases.length) playRelease(releases[(currentIndex - 1 + releases.length) % releases.length]); }

// Fonction pour mettre à jour l'arrière-plan du slider
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
  
  // Les écouteurs de modal sont maintenant gérés dans les fonctions show...
  
  window.addEventListener('hashchange', router);
  document.getElementById('year').textContent = new Date().getFullYear();
  
  loadReleases().then(router);
}

init();
