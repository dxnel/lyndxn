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

let releases = [], audio = new Audio(), isPlaying = false;
let currentSort = 'date';
let currentView = 'grid';
let isGrouped = false;
let paperColor, trackColor;
// NOUVEAU : Suivi de l'album en cours de lecture
let currentProject = null;
let currentTrackIndex = 0;


// --- ICONS ---
const SVG_PLAY = '<i class="fi fi-sr-play"></i>';
const SVG_PAUSE = '<i class="fi fi-sr-pause"></i>';
const SVG_GRID = '<i class="fi fi-sr-apps"></i>';
const SVG_LIST = '<i class="fi fi-sr-list"></i>';
const SVG_GROUP = '<i class="fi fi-sr-user"></i>';
const SVG_LISTEN = '<i class="fi fi-sr-square-up-right"></i>';
const ICON_EXPLICIT = '<i class="fi fi-sr-square-e"></i>';
const ICON_EXCLUSIVE = '<i class="fi fi-sr-star"></i>';


//--- UTIL ---
// CORRIGÉ : Bug de syntaxe
const escapeHtml = s => s || s === 0 ? s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]) : '';
const formatTime = s => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
const downloadFile = (name, text) => { const blob = new Blob([text], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); };

// NOUVEAU : Formatte les crédits (Array -> String)
const formatCredits = (credits) => {
  if (Array.isArray(credits)) {
    return credits.join(' & ');
  }
  return credits || '';
};

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

const capitalize = (s) => {
  if (typeof s !== 'string' || !s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/// MODIFIÉ : Ajout d'un paramètre 'project' pour gérer le cas "Bonus Track"
function createBadgeHtml(item, context = 'default', project = null) {
  let html = '';
  
  // 1. Badge Explicite (inchangé)
  if (item.explicit) {
    html += ` <div class="badge explicit" title="Explicit">${ICON_EXPLICIT}</div>`;
  }

  // 2. NOUVELLE LOGIQUE pour le badge Exclusif
  let showExclusive = false;
  
  if (item.exclusive !== false) { // Si l'item (projet OU track) est exclusif...
    
    if (context !== 'tracklist') {
      // Cas de la GRID VIEW (context='default')
      // On affiche toujours le badge si le projet est exclusif
      showExclusive = true;
      
    } else {
      // Cas de la TRACK LIST (context='tracklist')
      // On l'affiche SEULEMENT SI le projet parent N'EST PAS exclusif
      // C'est la condition "Bonus Track" !
      if (project && project.exclusive !== true) {
        showExclusive = true;
      }
      // Si le projet parent EST exclusif (ex: "clés"), on ne met pas
      // le badge sur la track, car c'est redondant.
    }
  }
  
  if (showExclusive) {
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
      // MODIFIÉ : Ajout de decodeURIComponent
      if (hash.startsWith('#/release/')) {
          const slug = decodeURIComponent(hash.split('/')[2]);
          renderRelease(slug);
      }
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

// MODIFIÉ : Affiche des PROJETS, pas des morceaux
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
        if (currentSort === 'artist') return formatCredits(a.credits).localeCompare(formatCredits(b.credits));
        return 0;
    };
     
    // r est un PROJET (album/single)
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
                            <span>${escapeHtml(formatCredits(r.credits))}</span>
                            <span class="meta-dot">●</span>
                            <span>${new Date(r.date).getFullYear()}</span>
                        </div>
                        <div class="meta">
                            <span>${capitalize(r.type)}</span>
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
                        ${createBadgeHtml(r)}
                    </div>
                    <div class="meta">${escapeHtml(formatCredits(r.credits))}</div>
                </div>
                <div class="list-date-row">
                    <span>${formatDate(r.date)}</span>
                </div>
            </a>`;
        }
    };

    if (isGrouped) {
        const releasesByArtist = releases.reduce((acc, release) => {
            // Utilise le premier artiste de la liste pour le groupement
            const artist = release.credits[0] || 'Unknown Artist';
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


function renderRelease(slug) {
  const project = releases.find(x => x.slug === slug); // C'est un "projet" (album/single)
  if (!project) { app.innerHTML = `<p>Release not found.</p>`; return; }
  
  const mainCredits = formatCredits(project.credits);
  const desc = escapeHtml(project.description).replace(/\n/g, '<br>');
  
  const firstPlayableTrack = project.tracks.find(t => t.exclusive !== false && t.audio);
  let buttonHtml = '';

  // --- NOUVELLE LOGIQUE ---
  // Si le PROJET lui-même est marqué 'exclusive: true' (ex: "clés demo")
  if (project.exclusive === true) {
      if (firstPlayableTrack) {
          buttonHtml = `
            <button class="btn" id="play-release-btn"><i class="fi fi-sr-play"></i> Play</button>
            ${project.type === 'single' ? `<a class="btn secondary" href="${firstPlayableTrack.audio}" download="${project.slug}.mp3">Download</a>` : ''}
          `;
      } else {
          // Fallback au cas où un projet exclusif n'a pas d'audio
          buttonHtml = `<button class="btn" disabled>Not Available</button>`;
      }
  } 
  // Si le PROJET N'EST PAS exclusif (il est sur les plateformes, comme "RainbOw" ou "meraki")
  // On affiche "Listen Now", MÊME SI un bonus track est jouable.
  else {
      // On cherche un lien de streaming sur la première track (ou l'URL que tu veux)
      const streamUrl = project.tracks[0]?.stream_url || '#';
      buttonHtml = `
        <a class="btn" href="${streamUrl}" target="_blank"><i class="fi fi-sr-square-up-right"></i> Listen Now</a>
      `;
  }
  
  // Génère la liste des morceaux
  const tracksHtml = project.tracks.map((track, index) => {
    const trackCredits = formatCredits(track.credits);
    const isPlayable = track.exclusive !== false && track.audio;
    
    const trackButton = isPlayable
      ? `<button class="track-play-button">${SVG_PLAY}</button>`
      : `<a href="${track.stream_url || '#'}" target="_blank" class="track-play-button">${SVG_LISTEN}</a>`;

    return `
    <div class="track-item" data-track-index="${index}" data-exclusive="${isPlayable}">
      <div class="track-number">${track.track_number}</div>
      <div class="track-meta">
        <div class="track-title">
          <span>${escapeHtml(track.title)} Bonus track </span>
          ${createBadgeHtml(track, 'tracklist', project)}
        </div>
        <div class="track-credits">${escapeHtml(trackCredits)}</div>
      </div>
      <div class="track-controls">
        ${trackButton}
      </div>
    </div>
    `;
  }).join('');
  
 // --- NOUVELLE LOGIQUE POUR LE PIED DE PAGE DE LA LISTE ---
  let totalSeconds = 0;
  project.tracks.forEach(t => {
    if (t.duration_seconds) {
      totalSeconds += t.duration_seconds;
    }
  });
  
  // Utilise Math.round pour obtenir le nombre de minutes (ex: 3.5 -> 4)
  const totalMinutes = Math.round(totalSeconds / 60);
  
  // Texte pour le nombre de morceaux
  const songCountText = project.tracks.length > 1 ? `${project.tracks.length} songs` : `1 song`;
  
  // Combiner le nombre de morceaux et la durée
  let trackListInfo = songCountText;
  if (totalMinutes > 0) {
      trackListInfo += `, ${totalMinutes} ${totalMinutes > 1 ? 'minutes' : 'minute'}`;
  }

  // Préparer les textes pour la date et le copyright
  const copyrightText = project.copyright ? `© ${project.copyright}` : '';
  const dateText = formatDate(project.date);
  // --- FIN DE LA NOUVELLE LOGIQUE ---

  const html = `
  <div class="page-header">
    <a href="#" class="back-link">← Back to releases</a>
  </div>

  <section class="release-hero">
    <img src="${project.cover}" alt="${project.title}">
    <div class="release-details">
      <div class="release-type">${capitalize(project.type)}</div>
      <h1 class="release-title">${escapeHtml(project.title)}</h1>
      <div class="release-artist">${escapeHtml(mainCredits)}</div>
      <div class="release-year"><span>${escapeHtml(project.genre || 'Single')}</span><span class="meta-dot">●</span><span>${new Date(project.date).getFullYear()}</span></div>
      
      <div class="release-actions">
         ${buttonHtml}
      </div>

      <p class="release-desc">${desc || '...'}</p>
      
      <div class="track-list-container">
        <div class="track-list" id="track-list">
          ${tracksHtml}
        </div>
        <div class="track-list-meta">
          <div class="track-list-info">
            ${trackListInfo}
          </div>
          
          <div class="track-list-creds">
            <span class="track-list-date">${dateText}</span>
            ${copyrightText ? `<span class="meta-dot">●</span><span class="track-list-copyright">${copyrightText}</span>` : ''}
          </div>
        </div>
      </div>
      
    </div>
  </section>`;
  
  app.innerHTML = html;
  
  // Écouteur pour le bouton "Play" principal (joue le 1er morceau)
  if (firstPlayableTrack) {
    document.getElementById('play-release-btn').addEventListener('click', () => {
        playTrack(firstPlayableTrack, project);
    });
  }
  
  // Écouteurs pour chaque morceau dans la liste
  document.getElementById('track-list').addEventListener('click', (e) => {
     const trackItem = e.target.closest('.track-item');
     if (trackItem && trackItem.dataset.exclusive === 'true') {
         const trackIndex = parseInt(trackItem.dataset.trackIndex, 10);
         const track = project.tracks[trackIndex];
         playTrack(track, project);
     }
  });
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
function updateMediaSession(track, project) {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: formatCredits(track.credits),
      album: project.title,
      artwork: [
        { src: project.cover, sizes: '512x512', type: 'image/png' },
      ]
    });
  }
}

// MODIFIÉ : Prend un objet 'track' et 'project'
function playTrack(track, project) {
  if (track.exclusive === false) return; 
  
  // Met à jour l'état global
  currentProject = project;
  currentTrackIndex = track.track_number - 1;
  
  const currentSrc = decodeURIComponent(audio.src);
  const isSameTrack = currentSrc.includes(track.audio.split('/').pop());
  
  // Met à jour le player
  dockCover.src = project.cover; 
  dockTitle.textContent = track.title; 
  dockSub.textContent = formatCredits(track.credits);
  downloadLink.href = track.audio; 
  downloadLink.download = `${project.slug}-${track.title}.mp3`;
  updateMediaSession(track, project);
  
  if(!isSameTrack) {
      audio.src = track.audio;
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
  updateTrackListUI(project.slug, currentTrackIndex);
  
  if ('mediaSession' in navigator) {
    navigator.mediaSession.playbackState = 'playing';
  }
}

// Met à jour l'UI (player et liste de morceaux)
function updatePlayBtn() {
    const icon = isPlaying ? SVG_PAUSE : SVG_PLAY;
    btnPlay.innerHTML = icon;
    
    const bigBtn = document.getElementById('play-release-btn');
    if(bigBtn) bigBtn.innerHTML = `${icon} ${isPlaying ? 'Pause' : 'Play'}`;
    
    // Met à jour le bouton play dans la liste de morceaux
    updateTrackListUI(currentProject?.slug, currentTrackIndex);
}

// NOUVEAU : Surligne le morceau en cours
function updateTrackListUI(projectSlug, trackIndex) {
    // S'assure qu'on est sur la bonne page
    if (!window.location.hash.includes(projectSlug)) return;
    
    document.querySelectorAll('.track-item').forEach((item, index) => {
        const playBtn = item.querySelector('.track-play-button');
        if (index === trackIndex) {
            item.classList.toggle('playing', isPlaying);
            if (playBtn) playBtn.innerHTML = isPlaying ? SVG_PAUSE : SVG_PLAY;
        } else {
            item.classList.remove('playing');
            if (playBtn) playBtn.innerHTML = SVG_PLAY;
        }
    });
}

function togglePlay() {
    if (!audio.src && releases.length > 0) {
        // Trouve le premier morceau jouable du premier album
        const firstProject = releases.find(p => p.tracks.some(t => t.exclusive !== false));
        if (firstProject) {
            const firstTrack = firstProject.tracks.find(t => t.exclusive !== false);
            if (firstTrack) {
                playTrack(firstTrack, firstProject);
            }
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

// MODIFIÉ : Navigue dans l'album actuel
function playNext() {
    if (!currentProject) return; // Ne fait rien si aucun album n'est chargé
    
    let nextIndex = (currentTrackIndex + 1);
    
    // Boucle pour trouver le prochain morceau JOUABLE dans l'album
    while (nextIndex < currentProject.tracks.length && currentProject.tracks[nextIndex].exclusive === false) {
        nextIndex++;
    }
    
    if (nextIndex < currentProject.tracks.length) {
        playTrack(currentProject.tracks[nextIndex], currentProject);
    }
}
function playPrev() {
    if (!currentProject) return;
    
    let prevIndex = (currentTrackIndex - 1);

    // Boucle pour trouver le morceau JOUABLE précédent
    while (prevIndex >= 0 && currentProject.tracks[prevIndex].exclusive === false) {
        prevIndex--;
    }
    
    if (prevIndex >= 0) {
        playTrack(currentProject.tracks[prevIndex], currentProject);
    }
}

function updateSliderBackground(pct) {
    const percent = pct !== undefined ? pct : seek.value || 0;
    seek.style.background = `linear-gradient(to right, ${paperColor} ${percent}%, ${trackColor} ${percent}%)`;
}


//--- INIT ---
function init() {
  btnPlay.innerHTML = SVG_PLAY; // Initialise le bouton play
  
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