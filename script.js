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

let releases = [], currentIndex = 0, audio = new Audio(), isPlaying = false;
let currentSort = 'date'; // État du tri
let paperColor, trackColor; // Couleurs du slider

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
    // Le tri initial se fera dans renderGrid
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
function renderHome() {
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
  renderGrid();
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
    
    const grid = document.getElementById('releases-grid');
    if (grid) {
        grid.classList.add('fading');
        await wait(150);
        renderGrid();
        grid.classList.remove('fading');
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

//--- ADMIN ---
adminIcon.addEventListener('click', () => {
  const p = prompt('Enter admin password:');
  if (p !== '1234') return alert('Wrong password!');
  window.location.hash = '#/admin';
});

function renderAdmin() {
  app.innerHTML = `<section>
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
    <h2>Database Manager</h2>
    <a href="#" class="btn secondary" style="padding:8px 16px;font-size:12px;">Exit</a>
  </div>
  <div class="admin-area">
  <p style="color:var(--muted); margin-bottom:12px;">Edit standard JSON format.</p>
  <textarea class="jsonedit" id="json-edit">${escapeHtml(JSON.stringify(releases, null, 2))}</textarea>
  <div style="margin-top:20px; display:flex; gap:12px;">
  <button class="btn" id="download-json">Download JSON</button>
  <button class="btn secondary" id="apply-json">Apply Test</button>
  </div></div></section>`;
  
  document.getElementById('download-json').addEventListener('click', () => downloadFile('releases.json', document.getElementById('json-edit').value));
  document.getElementById('apply-json').addEventListener('click', () => {
    try { releases = JSON.parse(document.getElementById('json-edit').value); alert('Applied in memory.'); renderGrid(); } catch (e) { alert('JSON error: ' + e.message); }
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
  updateSliderBackground(); // Initialise le fond du slider dès la lecture
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
    // Utilise les couleurs récupérées en JS
    seek.style.background = `linear-gradient(to right, ${paperColor} ${pct}%, ${trackColor} ${pct}%)`;
}


//--- INIT ---
function init() {
  // Récupère les couleurs du slider UNE SEULE FOIS (et s'assure qu'elles sont bien des chaînes)
  try {
      paperColor = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim();
      trackColor = getComputedStyle(document.documentElement).getPropertyValue('--muted').trim(); // Utilise --muted pour le gris du track, ou #444 si tu préfères un gris fixe
      if (!paperColor) paperColor = '#ededed'; // Fallback
      if (!trackColor) trackColor = '#444'; // Fallback
  } catch (e) {
      console.error("Could not get CSS vars for slider, using fallbacks:", e);
      paperColor = '#ededed';
      trackColor = '#444';
  }
  
  // Initialise l'arrière-plan du slider à 0% avant la lecture
  updateSliderBackground();

  btnPlay.addEventListener('click', togglePlay);
  btnNext.addEventListener('click', playNext);
  btnPrev.addEventListener('click', playPrev);
  
  audio.addEventListener('timeupdate', () => {
      curTime.textContent = formatTime(audio.currentTime);
      const pct = (audio.currentTime / audio.duration * 100) || 0;
      seek.value = pct;
      updateSliderBackground(); // Met à jour pendant la lecture
  });
  
  audio.addEventListener('loadedmetadata', () => { durTime.textContent = formatTime(audio.duration); });
  audio.addEventListener('ended', () => playNext());
  
  seek.addEventListener('input', () => { 
      if (!audio.duration) return; 
      const newTime = (seek.value / 100) * audio.duration;
      audio.currentTime = newTime;
      updateSliderBackground(); // Met à jour pendant le glissement
  });
  
  window.addEventListener('hashchange', router);
  document.getElementById('year').textContent = new Date().getFullYear();
  
  loadReleases().then(router);
}

init();
