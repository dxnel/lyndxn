const app = document.getElementById('app');
const playerElements = {
    dock: document.getElementById('player-dock'),
    cover: document.getElementById('dock-cover'),
    title: document.getElementById('dock-title'),
    sub: document.getElementById('dock-sub'),
    playBtn: document.getElementById('btn-play'),
    prevBtn: document.getElementById('btn-prev'),
    nextBtn: document.getElementById('btn-next'),
    curTime: document.getElementById('cur-time'),
    durTime: document.getElementById('dur-time'),
    seek: document.getElementById('seek'),
    dlLink: document.getElementById('download-link'),
    closeBtn: document.getElementById('player-close'),
    leftArea: document.querySelector('.player-left'),
    gradientOverlay: document.getElementById('bottom-gradient-overlay')
};
const modalElements = {
    overlay: document.getElementById('modal-overlay'),
    box: document.getElementById('custom-modal'),
    title: document.getElementById('modal-title'),
    text: document.getElementById('modal-text'),
    input: document.getElementById('modal-input-area'),
    pass: document.getElementById('modal-password'),
    submit: document.getElementById('modal-submit'),
    cancel: document.getElementById('modal-cancel'),
};

let state = { releases: [], artists: [], currentProject: null, trackIndex: 0, countdownInterval: null, isPlaying: false, sort: 'date', view: 'grid', grouped: false, exclusiveOnly: false, isAdmin: false };
const audio = new Audio();
let cssVars = { paper: '#ededed', track: '#444' };

// --- ICONS & HELPERS ---
const ICONS = {
    play: '<i class="fi fi-sr-play"></i>',
    pause: '<i class="fi fi-sr-pause"></i>',
    grid: '<i class="fi fi-sr-apps"></i>',
    list: '<i class="fi fi-sr-list"></i>',
    group: '<i class="fi fi-sr-user"></i>',
    link: '<i class="fi fi-sr-square-up-right"></i>',
    explicit: '<i class="fi fi-sr-square-e"></i>',
    exclusive: '<i class="fi fi-sr-star"></i>',
    lock: '<i class="fi fi-sr-lock"></i>',
    unlock: '<i class="fi fi-sr-unlock"></i>',
    spotify: '<i class="fi fi-sr-play-alt"></i>', 
    globe: '<i class="fi fi-sr-globe"></i>',
    instagram: '<i class="fi fi-sr-camera"></i>',
    youtube: '<i class="fi fi-sr-play-alt"></i>',
    soundcloud: '<i class="fi fi-sr-cloud"></i>',
    website: '<i class="fi fi-sr-globe"></i>',
    clock: '<i class="fi fi-sr-clock"></i>'
};

const ADMIN_HASH = "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4"; // "1234"

// CORRECTION ICI : Utilisation des entités HTML pour éviter les bugs de syntaxe
const esc = s => s ? s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]) : '';
const fmtTime = s => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
const fmtDate = d => { try { const x = new Date(d); return `${String(x.getDate()).padStart(2,'0')}-${String(x.getMonth()+1).padStart(2,'0')}-${x.getFullYear()}`; } catch { return d; }};
const capitalize = s => s && typeof s === 'string' ? s.charAt(0).toUpperCase() + s.slice(1) : '';
const fmtCreds = c => Array.isArray(c) ? c.join(' & ') : (c || '');
const wait = ms => new Promise(r => setTimeout(r, ms));

// Helper: Vérifie si un track est débloqué dans le localStorage
function isTrackUnlocked(slug, trackNumber) {
    const unlocked = JSON.parse(localStorage.getItem('unlocked_tracks') || '[]');
    const id = `${slug}-${trackNumber}`;
    return unlocked.includes(id);
}

// Helper: Sauvegarde le déblocage
function unlockTrackLocal(slug, trackNumber) {
    let unlocked = JSON.parse(localStorage.getItem('unlocked_tracks') || '[]');
    const id = `${slug}-${trackNumber}`;
    if (!unlocked.includes(id)) {
        unlocked.push(id);
        localStorage.setItem('unlocked_tracks', JSON.stringify(unlocked));
    }
}

function createBadge(item, context = 'default', parent = null) {
    let h = '';
    if (item.explicit) h += `<div class="badge explicit" title="Explicit">${ICONS.explicit}</div>`;
    
    let showExcl = item.exclusive !== false;
    if (context === 'tracklist' && parent && parent.exclusive === true) showExcl = false;

    // LOGIQUE UNRELEASED (Prioritaire sur Exclusive)
    if (item.unreleased) {
        h += `<div class="badge unreleased" title="Coming Soon">${ICONS.clock}</div>`;
        showExcl = false; 
    }

    // ... (logique locked existante) ...
    if (context === 'tracklist' && item.password_hash && parent) {
        const unlocked = isTrackUnlocked(parent.slug, item.track_number);
        if (!unlocked) {
             h += `<div class="badge locked" title="Protected">${ICONS.lock}</div>`;
             showExcl = false;
        }
    }

    if (showExcl) h += `<div class="badge exclusive" title="Exclusive">${ICONS.exclusive}</div>`;
    return h ? `<div class="badge-container">${h}</div>` : '';
}

// --- DATA ---
async function loadData() {
    try {
        const [rRes, aRes] = await Promise.all([
            fetch('https://raw.githubusercontent.com/dxnel/lyndxn/refs/heads/main/releases.json?t=' + Date.now()),
            fetch('https://raw.githubusercontent.com/dxnel/lyndxn/refs/heads/main/artists.json?t=' + Date.now())
        ]);
        if (rRes.ok) state.releases = await rRes.json();
        if (aRes.ok) state.artists = await aRes.json();
    } catch (e) { console.error(e); app.innerHTML = `<p>Error loading data.</p>`; }
}

// --- ROUTER & TRANSITIONS ---
async function transition(fn) {
    // STOP LE COUNTDOWN S'IL EXISTE
    if (state.countdownInterval) clearInterval(state.countdownInterval);

    app.classList.add('page-exit');
    await wait(300);
    
    fn();
    
    window.scrollTo({ top: 0, behavior: 'instant' }); 
    document.body.scrollTop = 0; 
    document.documentElement.scrollTop = 0; 
    
    app.classList.remove('page-exit');
    app.classList.add('page-enter');
    void app.offsetWidth;
    app.classList.remove('page-enter');
}

async function router() {
  if (!state.releases.length) await loadData();
  const hash = window.location.hash;
  
  if (hash === '#/admin' && !state.isAdmin) {
      const pass = await showModal('Admin Access', 'Protected area. Enter password:', true, '••••');
      if (!pass || !(await verifyPassword(pass, ADMIN_HASH))) {
          if(pass) await showModal('Access Denied', 'Wrong password.');
          window.location.hash = ''; 
          return;
      }
      state.isAdmin = true;
  }

  transition(() => {
      if (hash.startsWith('#/release/')) {
          const slug = decodeURIComponent(hash.split('/')[2]);
          renderRelease(slug);
      }
      else if (hash.startsWith('#/artist/')) {
          const slug = decodeURIComponent(hash.split('/')[2]);
          renderArtist(slug);
      }
      else if (hash === '#/admin') renderAdmin();
      else renderHome();
  });
}

function renderHome() {
    const artistsHtml = state.artists.map(a => `
        <a href="#/artist/${a.slug}" class="artist-circle-item">
            <div class="artist-img-wrap"><img src="${a.pfp}" alt="${a.name}" loading="lazy"></div>
            <span class="artist-name">${esc(a.name)}</span>
        </a>`).join('');

    app.innerHTML = `
    <div class="section-header"><h2>Artists</h2></div>
    <div class="artists-section"><div class="artists-list">${artistsHtml}</div></div>
    <div class="home-header">
        <div class="header-top-row">
            <h2>Releases</h2>
            <div class="control-group">
                <button class="view-btn ${state.view === 'grid' ? 'active' : ''}" data-v="grid">${ICONS.grid}</button>
                <button class="view-btn ${state.view === 'list' ? 'active' : ''}" data-v="list">${ICONS.list}</button>
            </div>
        </div>
        <div class="header-bottom-row">
            <div class="tabs" id="sort-tabs">
                <button class="tab-btn active" data-s="date">Recent</button>
                <button class="tab-btn" data-s="title">Name</button>
                <button class="tab-btn" data-s="artist">Artist</button>
            </div>
            <div class="control-group">
                <button class="view-btn" id="grp-btn" title="Group">${ICONS.group}</button>
                <button class="view-btn" id="excl-btn" title="Exclusive">${ICONS.exclusive}</button>
            </div>
        </div>
    </div>
    <div class="grid-container" id="grid-ctn"></div>`;

    document.getElementById('sort-tabs').onclick = e => {
        if (!e.target.closest('.tab-btn')) return;
        state.sort = e.target.closest('.tab-btn').dataset.s;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        e.target.closest('.tab-btn').classList.add('active');
        renderGrid();
    };

    const grpBtn = document.getElementById('grp-btn');
    const exclBtn = document.getElementById('excl-btn');
    const viewBtns = document.querySelectorAll('[data-v]');

    grpBtn.onclick = () => { state.grouped = !state.grouped; grpBtn.classList.toggle('active'); renderGrid(); };
    exclBtn.onclick = () => { state.exclusiveOnly = !state.exclusiveOnly; exclBtn.classList.toggle('active'); renderGrid(); };
    viewBtns.forEach(b => b.onclick = () => {
        const val = b.dataset.v;
        if (state.view === val) return;
        state.view = val;
        viewBtns.forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        renderGrid();
    });

    renderGrid();
    const grid = document.getElementById('grid-ctn');
    grid.classList.add('grid-page-enter');
    setTimeout(() => grid.classList.remove('grid-page-enter'), 50);
}

function renderGrid() {
    const ctn = document.getElementById('grid-ctn');
    if (!ctn) return;
    
    let items = state.releases.filter(r => !state.exclusiveOnly || r.exclusive);
    const sortFn = (a, b) => {
        if (state.sort === 'date') return new Date(b.date) - new Date(a.date);
        if (state.sort === 'title') return a.title.localeCompare(b.title);
        return fmtCreds(a.credits).localeCompare(fmtCreds(b.credits));
    };

    const card = (r) => state.view === 'grid' ? `
        <div class="card">
            <a href="#/release/${r.slug}" class="card-link">
                <div class="card-image-wrap"><img src="${r.cover}" loading="lazy"></div>
                <div class="card-text">
                    <div class="card-title-row"><div class="title">${esc(r.title)}</div>${createBadge(r)}</div>
                    <div class="meta"><span>${esc(fmtCreds(r.credits))}</span><span class="meta-dot">●</span><span>${new Date(r.date).getFullYear()}</span></div>
                    <div class="meta"><span>${capitalize(r.type)}</span></div>
                </div>
            </a>
        </div>` : `
        <a href="#/release/${r.slug}" class="list-item">
            <img src="${r.cover}" loading="lazy">
            <div class="list-item-meta">
                <div class="list-title-row"><span class="title">${esc(r.title)}</span>${createBadge(r)}</div>
                <div class="meta">${esc(fmtCreds(r.credits))}</div>
            </div>
            <div class="list-date-row"><span>${fmtDate(r.date)}</span></div>
        </a>`;

    if (state.grouped) {
        const groups = items.reduce((acc, r) => {
            const k = r.credits[0] || 'Unknown';
            (acc[k] = acc[k] || []).push(r);
            return acc;
        }, {});
        
        const listClass = state.view === 'list' ? 'list' : '';
        let html = `<div class="${listClass}">`;
        Object.keys(groups).sort().forEach(artist => {
             html += `<h2 class="artist-group-header">${esc(artist)}</h2>`;
             const tracks = groups[artist].sort(sortFn);
             html += state.view === 'grid' ? `<div class="grid">${tracks.map(card).join('')}</div>` : tracks.map(card).join('');
        });
        html += `</div>`;
        ctn.innerHTML = html;
    } else {
        items.sort(sortFn);
        ctn.innerHTML = `<div class="${state.view === 'grid' ? 'grid' : 'list'}">${items.map(card).join('')}</div>`;
    }
}

function renderArtist(slug) {
    const artist = state.artists.find(a => a.slug === slug);
    if (!artist) return app.innerHTML = `<p>Artist not found.</p>`;

    const rels = state.releases.filter(r => r.credits.includes(artist.slug)).sort((a, b) => new Date(b.date) - new Date(a.date));
    const latest = rels[0];
    const releaseCount = rels.length;
    
    const links = artist.links || {};
    let socialBtns = '';

    if (links.main) {
        socialBtns += `<a href="${links.main}" target="_blank" class="btn">${ICONS.link} Listen Now</a>`;
    }
    const socialMap = {
        instagram: { icon: ICONS.instagram, title: 'Instagram' },
        youtube:   { icon: ICONS.youtube, title: 'YouTube' },
        spotify:   { icon: ICONS.spotify, title: 'Spotify' },
        soundcloud:{ icon: ICONS.soundcloud, title: 'SoundCloud' },
        website:   { icon: ICONS.website, title: 'Website' }
    };
    Object.keys(links).forEach(key => {
        if (key === 'main' || !links[key]) return;
        const map = socialMap[key];
        if (map) {
            socialBtns += `<a href="${links[key]}" target="_blank" class="btn secondary icon-only" title="${map.title}">${map.icon}</a>`;
        }
    });

    let latestHtml = '';
    if (latest) {
        // Logic Texte
        const sectionTitle = latest.unreleased ? 'Upcoming Release' : 'Latest Release';
        const yearText = latest.unreleased 
            ? `Coming ${new Date(latest.date).getFullYear()}` 
            : `${new Date(latest.date).getFullYear()}`;

        latestHtml = `
        <div class="latest-section">
            <h2>${sectionTitle}</h2>
            <div class="latest-card-wrapper">
                <div class="card">
                    <a href="#/release/${latest.slug}" class="card-link">
                        <div class="card-image-wrap"><img src="${latest.cover}"></div>
                        <div class="card-text">
                            <div class="card-title-row"><div class="title">${esc(latest.title)}</div>${createBadge(latest)}</div>
                            <div class="meta"><span>${yearText}</span><span class="meta-dot">●</span><span>${capitalize(latest.type)}</span></div>
                        </div>
                    </a>
                </div>
            </div>
        </div>`;
    }

    const discogHtml = rels.map(r => `
        <div class="card">
            <a href="#/release/${r.slug}" class="card-link">
                <div class="card-image-wrap"><img src="${r.cover}" loading="lazy"></div>
                <div class="card-text">
                    <div class="card-title-row"><div class="title">${esc(r.title)}</div>${createBadge(r)}</div>
                    <div class="meta"><span>${new Date(r.date).getFullYear()}</span><span class="meta-dot">●</span><span>${esc(r.type)}</span></div>
                </div>
            </a>
        </div>`).join('');

    app.innerHTML = `
    <div class="page-header"><a href="#" class="back-link">← Back to home</a></div>
    <div class="artist-profile-header">
        <img src="${artist.pfp}" alt="${artist.name}" class="artist-pfp-large">
        <div class="artist-info">
            <h1 class="artist-name-large">${esc(artist.name)}</h1>
            <p class="artist-bio">${esc(artist.bio || 'No biography available.')}</p>
            <div class="artist-actions">${socialBtns}</div>
        </div>
    </div>
    ${latestHtml}
    <div class="section-header"><h2>Discography</h2></div>
    <div class="grid">${discogHtml}</div>`;
}



function renderRelease(slug) {
    const p = state.releases.find(x => x.slug === slug);
    if (!p) return app.innerHTML = `<p>Release not found.</p>`;

    
    const mainCredits = fmtCreds(p.credits);
    const desc = esc(p.description).replace(/\n/g, '<br>');
    
    // --- LOGIQUE BOUTONS & TYPE ---
    let typeText = capitalize(p.type);
    let yearText = `${new Date(p.date).getFullYear()}`;
    let actionButtonsHtml = '';
    let countdownHtml = '';
    let startCountdownTask = null; // Pour lancer le timer APRES le rendu

    // SI UNRELEASED
    if (p.unreleased) {
        typeText = `Unreleased ${typeText}`;
        yearText = `Coming ${yearText}`;
        
        // Bouton Pre-save
        const link = p.link || '#';
        actionButtonsHtml = `<a class="btn" href="${link}" target="_blank">${ICONS.link} Pre-save</a>`;
        
        // Countdown Logic
        const releaseDate = new Date(p.date).getTime();
        const now = new Date().getTime();
        
        if (releaseDate > now) {
            countdownHtml = `<div id="release-countdown" class="countdown-wrapper">Loading...</div>`;
            // CORRECTION : On prépare la tâche pour plus tard
            startCountdownTask = () => startCountdown(releaseDate);
        }
    } 
    // SI EXCLUSIF (Logique existante)
    else if (p.exclusive === true) {
        const firstPlayable = p.tracks.find(t => t.exclusive !== false && t.audio);
        if (firstPlayable) {
             const isFirstLocked = firstPlayable.password_hash && !isTrackUnlocked(p.slug, firstPlayable.track_number);
             if(isFirstLocked) actionButtonsHtml = `<button class="btn" disabled>${ICONS.lock} Protected</button>`;
             else actionButtonsHtml = `<button class="btn" id="play-rel-btn">${ICONS.play} Play</button>
                ${p.type === 'single' ? `<a class="btn secondary" href="${firstPlayable.audio}" download="${p.slug}.mp3">Download</a>` : ''}`;
        } else {
            actionButtonsHtml = `<button class="btn" disabled>Not Available</button>`;
        }
    } 
    // SI STANDARD
    else {
        const streamUrl = p.link || p.tracks[0]?.stream_url || '#';
        actionButtonsHtml = `<a class="btn" href="${streamUrl}" target="_blank">${ICONS.link} Listen Now</a>`;
    }

    const tracksHtml = p.tracks.map((t, i) => {
        const hasPassword = !!t.password_hash;
        const isUnlocked = isTrackUnlocked(p.slug, t.track_number);
        
        // Un morceau est "Locked" si il a un mdp ET qu'il n'est pas débloqué
        const isLocked = hasPassword && !isUnlocked;
        
        // Un morceau est jouable si : Exclusif + Audio existe + PAS locké
        const isPlayable = (t.exclusive !== false && t.audio) && !isLocked;

        // Quel bouton afficher ?
        let actionButton = '';
        if (isLocked) {
            actionButton = `<button class="track-unlock-button" title="Unlock">${ICONS.lock}</button>`;
        } else if (t.exclusive !== false && t.audio) {
            actionButton = `<button class="track-play-button">${ICONS.play}</button>`;
        } else {
            actionButton = `<a href="${t.stream_url || '#'}" target="_blank" class="track-play-button">${ICONS.link}</a>`;
        }

        // Classes CSS
        let itemClasses = 'track-item';
        if(isLocked) itemClasses += ' locked';

        return `
        <div class="${itemClasses}" data-idx="${i}" data-locked="${isLocked}" data-playable="${isPlayable}">
            <div class="track-number">${t.track_number}</div>
            <div class="track-meta">
                <div class="track-title"><span>${esc(t.title)}</span>${createBadge(t, 'tracklist', p)}</div>
                <div class="track-credits">${esc(fmtCreds(t.credits))}</div>
            </div>
            <div class="track-controls">${actionButton}</div>
        </div>`;
    }).join('');

    let totalSeconds = p.tracks.reduce((acc, t) => acc + (t.duration_seconds || 0), 0);
    const totalMinutes = Math.round(totalSeconds / 60);
    const songCountText = p.tracks.length > 1 ? `${p.tracks.length} songs` : `1 song`;
    let trackListInfo = songCountText;
    if (totalMinutes > 0) trackListInfo += `, ${totalMinutes} ${totalMinutes > 1 ? 'minutes' : 'minute'}`;

    const html = `
    <div class="page-header"><a href="#" class="back-link">← Back to releases</a></div>
    <section class="release-hero">
        <img src="${p.cover}" alt="${p.title}">
        <div class="release-details">
            <div class="release-type">${typeText}</div> <h1 class="release-title">${esc(p.title)}</h1>
            <div class="release-artist">${esc(mainCredits)}</div>
            
            <div class="release-year"><span>${esc(p.genre || 'Single')}</span><span class="meta-dot">●</span><span>${yearText}</span></div>
            
            <div class="release-actions">
                ${actionButtonsHtml}
                ${countdownHtml}
            </div>
            
            <p class="release-desc">${desc}</p>
            <div class="track-list-container">
                <div class="track-list" id="track-list">${tracksHtml}</div>
                <div class="track-list-meta">
                    <div class="track-list-info">${trackListInfo}</div>
                    <div class="track-list-creds">
                        <span class="track-list-date">${fmtDate(p.date)}</span>
                        ${p.copyright ? `<span class="meta-dot">●</span><span class="track-list-copyright">© ${p.copyright}</span>` : ''}
                    </div>
                </div>
            </div>
        </div>
    </section>`;

    app.innerHTML = html;

    // Lancer le countdown maintenant que le HTML existe
    if (startCountdownTask) {
        setTimeout(startCountdownTask, 0);
    }

    // Listener Bouton Principal (Play Album)
    const playBtn = document.getElementById('play-rel-btn');
    if (playBtn) {
        playBtn.onclick = () => {
            // On joue le premier morceau qui est débloqué
            const firstVal = p.tracks.find(t => (t.exclusive!==false && t.audio) && (!t.password_hash || isTrackUnlocked(p.slug, t.track_number)));
            if(firstVal) playTrack(firstVal, p);
        };
    }

    // Listener Tracklist (Play & Unlock)
    document.getElementById('track-list').addEventListener('click', async (e) => {
        // Gestion Unlock Button
        const unlockBtn = e.target.closest('.track-unlock-button');
        if (unlockBtn) {
            const item = unlockBtn.closest('.track-item');
            const t = p.tracks[item.dataset.idx];
            
            // Demande mot de passe pour le morceau
            const pass = await showModal('Protected Track', `Enter password for <b>"${t.title}"</b>:`, true, '••••');
            if (pass) {
                await wait(300); // UX Delay
                if (await verifyPassword(pass, t.password_hash)) {
                    // SUCCÈS : On débloque
                    unlockTrackLocal(p.slug, t.track_number);
                    await showModal('Unlocked', 'Track unlocked successfully.');
                    renderRelease(slug); // Re-render pour enlever le cadenas
                } else {
                    await showModal('Error', 'Incorrect password.');
                }
            }
            return;
        }

        // LIENS
        if (e.target.closest('a')) return;

        // LIGNE (Si Locked, on lance le prompt aussi)
        const item = e.target.closest('.track-item');
        if (!item) return;

        // Si la ligne est LOCKED, on lance le prompt comme le bouton
        if (item.classList.contains('locked')) {
            const t = p.tracks[item.dataset.idx];
            const pass = await showModal('Protected Track', `Enter password for <b>"${t.title}"</b>:`, true, '••••');
            if (pass) {
                await wait(300); 
                if (await verifyPassword(pass, t.password_hash)) {
                    unlockTrackLocal(p.slug, t.track_number);
                    await showModal('Unlocked', 'Track unlocked successfully.');
                    renderRelease(slug); 
                } else {
                    await showModal('Error', 'Incorrect password.');
                }
            }
            return;
        }
        
        // Si Jouable normal
        if (item.dataset.playable === 'true') {
            playTrack(p.tracks[item.dataset.idx], p);
        }
    });
    
    updateUIState();
}

// --- SECURITY & ADMIN ---
// Mise à jour: accepte un hash cible (targetHash)
async function verifyPassword(input, targetHash) {
    if (!input || !targetHash) return false;
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex === targetHash;
}

let adminCurrentView = 'releases';

function renderAdmin() {
    const getCurrentJson = () => JSON.stringify(adminCurrentView === 'releases' ? state.releases : state.artists, null, 2);
    const getRepoUrl = () => `https://github.com/dxnel/lyndxn/blob/main/${adminCurrentView}.json`;
    
    // Compteur de morceaux débloqués (LocalStorage)
    const localUnlockedIds = JSON.parse(localStorage.getItem('unlocked_tracks') || '[]');

    // --- GÉNÉRATION DE LA LISTE DES PROTECTED TRACKS ---
    let protectedListHtml = '';
    
    if (adminCurrentView === 'releases') {
        let protectedTracks = [];
        
        // On scanne tout le JSON pour trouver les passwords
        state.releases.forEach(r => {
            if (r.tracks) {
                r.tracks.forEach(t => {
                    if (t.password_hash) {
                        const id = `${r.slug}-${t.track_number}`;
                        const isUnlocked = localUnlockedIds.includes(id);
                        protectedTracks.push({
                            title: t.title,
                            artist: fmtCreds(t.credits || r.credits), // AJOUT : Nom de l'artiste
                            release: r.title,
                            hash: t.password_hash,
                            unlocked: isUnlocked,
                            trackNum: t.track_number
                        });
                    }
                });
            }
        });

        if (protectedTracks.length > 0) {
            const rows = protectedTracks.map(item => `
                <div style="display: grid; grid-template-columns: 30px 1.5fr 1fr 1fr 80px; gap: 10px; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 12px; align-items: center;">
                    <div style="color: var(--muted);">${item.trackNum}</div>
                    
                    <div style="font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${esc(item.title)} <span style="color:var(--muted); font-size:11px;">(${esc(item.release)})</span>
                    </div>

                    <div style="color: var(--paper); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${esc(item.artist)}
                    </div>

                    <div style="font-family: monospace; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${item.hash}">
                        ${item.hash.substring(0, 8)}...
                    </div>

                    <div style="text-align: right;">
                        ${item.unlocked 
                            ? `<span style="color: #4caf50; background: rgba(76, 175, 80, 0.1); padding: 2px 6px; border-radius: 4px;">Unlocked</span>` 
                            : `<span style="color: var(--muted); background: rgba(255, 255, 255, 0.05); padding: 2px 6px; border-radius: 4px;">Locked</span>`}
                    </div>
                </div>
            `).join('');

            protectedListHtml = `
            <div style="margin-bottom: 24px; background: rgba(0,0,0,0.2); border: 1px solid var(--border); border-radius: 8px; padding: 16px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px; border-bottom: 1px solid var(--border); padding-bottom: 8px;">
                    <h3 style="margin:0; font-size: 14px; font-weight: 600;">Protected Tracks Manager</h3>
                    <button class="btn secondary" id="reset-unlocks" style="font-size:10px; padding:4px 10px; height: auto;">Reset Local Storage</button>
                </div>
                
                <div style="display: grid; grid-template-columns: 30px 1.5fr 1fr 1fr 80px; gap: 10px; font-size: 11px; text-transform: uppercase; color: var(--muted); font-weight: 600; margin-bottom: 8px;">
                    <div>#</div>
                    <div>Track</div>
                    <div>Artist</div> <div>Hash</div>
                    <div style="text-align: right;">Status</div>
                </div>
                
                <div style="max-height: 150px; overflow-y: auto;">
                    ${rows}
                </div>
            </div>`;
        } else {
            protectedListHtml = `<div style="margin-bottom: 20px; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px; font-size: 13px; color: var(--muted); text-align: center;">No protected tracks found in database.</div>`;
        }
    }

    // --- RENDER GLOBAL ---
    app.innerHTML = `
    <div class="page-header"><a href="#" class="back-link">← Back</a></div>
    <div class="section-header" id="database-manager-label"><h2>Database Manager</h2></div>
    <div class="admin-area">
        <div class="admin-controls">
            <div class="admin-tabs">
                <button class="admin-tab-btn ${adminCurrentView === 'releases' ? 'active' : ''}" id="tab-releases">Releases</button>
                <button class="admin-tab-btn ${adminCurrentView === 'artists' ? 'active' : ''}" id="tab-artists">Artists</button>
            </div>
            <a href="${getRepoUrl()}" target="_blank" class="btn secondary" style="padding: 8px 16px; font-size: 12px;">
                ${ICONS.globe} View on GitHub
            </a>
        </div>
        
        ${adminCurrentView === 'releases' ? protectedListHtml : ''}

        <textarea class="jsonedit" id="je">${esc(getCurrentJson())}</textarea>
        <div class="modal-buttons" style="margin-top: 20px;">
            <button class="btn secondary" id="dl-json">Download ${capitalize(adminCurrentView)}.json</button>
            <button class="btn" id="save-json">Test Apply (Memory)</button>
        </div>
    </div>`;

    const updateView = (view) => { adminCurrentView = view; renderAdmin(); };
    document.getElementById('tab-releases').onclick = () => updateView('releases');
    document.getElementById('tab-artists').onclick = () => updateView('artists');

    // Reset Local Storage (Si le bouton existe, donc si on est sur Releases)
    const resetBtn = document.getElementById('reset-unlocks');
    if (resetBtn) {
        resetBtn.onclick = async () => {
            localStorage.removeItem('unlocked_tracks');
            await showModal('Reset', 'All saved passwords/unlocks have been cleared from this device.');
            renderAdmin(); // Rafraîchir la liste
        };
    }

    document.getElementById('dl-json').onclick = () => {
        const content = document.getElementById('je').value;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([content], {type:'application/json'}));
        a.download = `${adminCurrentView}.json`;
        a.click();
    };

    document.getElementById('save-json').onclick = async () => {
        try { 
            const parsed = JSON.parse(document.getElementById('je').value);
            if(adminCurrentView === 'releases') state.releases = parsed;
            else state.artists = parsed;
            await showModal('Success', `Applied to <b>${adminCurrentView}</b> in memory.`);
            renderAdmin(); // Rafraîchir la vue
        } catch (e) { await showModal('JSON Error', e.message); }
    };
}

// --- AUDIO PLAYER ---
function playTrack(track, project) {
    if (!track.audio) return;
    state.currentProject = project;
    state.trackIndex = track.track_number - 1;
    const isSame = decodeURIComponent(audio.src).includes(track.audio.split('/').pop());
    
    playerElements.dock.classList.add('active');
    playerElements.gradientOverlay.classList.add('active');
    playerElements.cover.src = project.cover;
    playerElements.title.textContent = track.title;
    playerElements.sub.textContent = fmtCreds(track.credits);
    playerElements.dlLink.href = track.audio;
    playerElements.dlLink.download = `${project.slug}-${track.title}.mp3`;

    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: track.title, artist: fmtCreds(track.credits), album: project.title,
            artwork: [{ src: project.cover, sizes: '512x512', type: 'image/png' }]
        });
    }

    if (!isSame) {
        audio.src = track.audio;
        playerElements.seek.value = 0;
        updateSeekBg(0);
        audio.play();
        state.isPlaying = true;
    } else togglePlay();
    updateUIState();
}

function togglePlay() {
    if (!audio.src) return;
    state.isPlaying ? audio.pause() : audio.play();
    state.isPlaying = !state.isPlaying;
    updateUIState();
}

function closePlayer() {
    audio.pause();
    audio.src = ''; // Reset total du flux audio
    audio.currentTime = 0;
    state.isPlaying = false;
    state.currentProject = null; // On oublie le projet en cours
    state.trackIndex = 0;
    
    playerElements.dock.classList.remove('active');
    playerElements.gradientOverlay.classList.remove('active');
    updateUIState();
}

function updateUIState() {
    const icon = state.isPlaying ? ICONS.pause : ICONS.play;
    playerElements.playBtn.innerHTML = icon;
    const bigBtn = document.getElementById('play-rel-btn');
    if (bigBtn) bigBtn.innerHTML = `${icon} ${state.isPlaying ? 'Pause' : 'Play'}`;
    
    if (state.currentProject && window.location.hash.includes(state.currentProject.slug)) {
        document.querySelectorAll('.track-item').forEach((el, i) => {
            const btn = el.querySelector('.track-play-button');
            // Si c'est pas le bon morceau, reset icone. Si c'est le bon, icone play/pause
            if (i === state.trackIndex) {
                el.classList.add('playing');
                if (btn && !el.classList.contains('locked')) btn.innerHTML = state.isPlaying ? ICONS.pause : ICONS.play;
            } else {
                el.classList.remove('playing');
                if (btn && !el.classList.contains('locked')) btn.innerHTML = ICONS.play;
            }
        });
    }
}

function nextTrack(dir = 1) {
    if (!state.currentProject) return;
    let idx = state.trackIndex + dir;
    while (idx >= 0 && idx < state.currentProject.tracks.length) {
        const t = state.currentProject.tracks[idx];
        // Check unlocked status
        const unlocked = !t.password_hash || isTrackUnlocked(state.currentProject.slug, t.track_number);
        if ((t.exclusive !== false && t.audio) && unlocked) { 
            playTrack(t, state.currentProject); 
            return; 
        }
        idx += dir;
    }
    if (dir === 1) closePlayer();
}

function updateSeekBg(pct) {
    playerElements.seek.style.background = `linear-gradient(to right, ${cssVars.paper} ${pct}%, ${cssVars.track} ${pct}%)`;
}

// --- MODAL SYSTEM ---
function showModal(title, text, input = false, placeholder = '') {
    modalElements.title.textContent = title;
    modalElements.text.innerHTML = text;
    modalElements.input.classList.toggle('hidden', !input);
    modalElements.cancel.classList.toggle('hidden', !input);
    modalElements.submit.textContent = input ? 'Login' : 'OK';
    
    if(input) {
        modalElements.pass.value = '';
        modalElements.pass.placeholder = placeholder;
        modalElements.pass.focus();
    }
    
    modalElements.overlay.classList.remove('hidden');
    requestAnimationFrame(() => modalElements.overlay.classList.add('visible'));

    return new Promise(resolve => {
        const cleanup = () => {
            modalElements.submit.onclick = null;
            modalElements.cancel.onclick = null;
            modalElements.pass.onkeydown = null;
        };
        const close = (result) => {
            modalElements.overlay.classList.remove('visible');
            setTimeout(() => {
                modalElements.overlay.classList.add('hidden');
                cleanup();
                resolve(result);
            }, 300);
        };
        modalElements.submit.onclick = () => close(input ? modalElements.pass.value : true);
        modalElements.cancel.onclick = () => close(null);
        if(input) {
            modalElements.pass.onkeydown = (e) => { if(e.key === 'Enter') close(modalElements.pass.value); };
        }
    });
}

function startCountdown(targetDate) {
    // Fonction de mise à jour
    const update = () => {
        const now = new Date().getTime();
        const distance = targetDate - now;

        const el = document.getElementById('release-countdown');
        if (!el) return; // Si on a changé de page entre temps

        if (distance < 0) {
            // C'est sorti !
            clearInterval(state.countdownInterval);
            el.style.display = 'none'; // On cache le countdown
            // Optionnel : recharger la page pour afficher "Listen Now" si tu veux
            return;
        }

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        el.innerHTML = `
            <span class="countdown-part">${days}</span><span class="countdown-sep">d</span>
            <span class="countdown-part">${hours}</span><span class="countdown-sep">h</span>
            <span class="countdown-part">${minutes}</span><span class="countdown-sep">m</span>
            <span class="countdown-part">${seconds}</span><span class="countdown-sep">s</span>
        `;
    };

    update(); // Appel immédiat
    state.countdownInterval = setInterval(update, 1000); // Puis chaque seconde
}

// --- INIT LISTENERS ---
document.getElementById('admin-icon').onclick = async () => {
    if (state.isAdmin) {
        window.location.hash = '#/admin';
        return;
    }
    const pass = await showModal('Admin Access', 'Enter secured password:', true, '••••');
    if (pass === null) return;
    await wait(200);
    if (await verifyPassword(pass, ADMIN_HASH)) {
        state.isAdmin = true; 
        window.location.hash = '#/admin';
    } else {
        await showModal('Access Denied', 'The password you entered is incorrect.');
    }
};

// --- INIT ---
function init() {
    const comp = getComputedStyle(document.documentElement);
    cssVars.paper = comp.getPropertyValue('--paper').trim() || '#ededed';
    cssVars.track = comp.getPropertyValue('--border').trim() || '#444';

    playerElements.playBtn.innerHTML = ICONS.play;
    playerElements.playBtn.onclick = togglePlay;
    playerElements.nextBtn.onclick = () => nextTrack(1);
    playerElements.prevBtn.onclick = () => nextTrack(-1);
    
    audio.ontimeupdate = () => {
        playerElements.curTime.textContent = fmtTime(audio.currentTime);
        const pct = (audio.currentTime / audio.duration * 100) || 0;
        playerElements.seek.value = pct;
        updateSeekBg(pct);
    };
    audio.onloadedmetadata = () => playerElements.durTime.textContent = fmtTime(audio.duration);
    audio.onended = () => nextTrack(1);
    
    playerElements.seek.oninput = () => {
        if (audio.duration) audio.currentTime = (playerElements.seek.value / 100) * audio.duration;
        updateSeekBg(playerElements.seek.value);
    };

    if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', togglePlay);
        navigator.mediaSession.setActionHandler('pause', togglePlay);
        navigator.mediaSession.setActionHandler('nexttrack', () => nextTrack(1));
        navigator.mediaSession.setActionHandler('previoustrack', () => nextTrack(-1));
    }

    window.onhashchange = router;
    document.getElementById('year').textContent = new Date().getFullYear();
    document.getElementById('home-link').onclick = (e) => { e.preventDefault(); window.location.hash = ''; };
    
    loadData().then(router);


    // --- PLAYER NAVIGATION (Click Cover/Title) ---
    playerElements.leftArea.onclick = () => {
        if (state.currentProject) {
            // Redirection vers la release en cours
            window.location.hash = `#/release/${state.currentProject.slug}`;
        }
    };

    // --- PLAYER CLOSE (Desktop Button) ---
    if(playerElements.closeBtn) {
        playerElements.closeBtn.onclick = (e) => {
            e.stopPropagation(); // Empêche de cliquer à travers
            closePlayer();
        };
    }

    // --- PLAYER CLOSE (Mobile Swipe Down) ---
    let touchStartY = 0;
    const dock = playerElements.dock;

    dock.addEventListener('touchstart', (e) => {
        touchStartY = e.changedTouches[0].screenY;
    }, {passive: true});

    dock.addEventListener('touchend', (e) => {
        const touchEndY = e.changedTouches[0].screenY;
        const diff = touchEndY - touchStartY;

        // Si on a glissé vers le bas de plus de 50px
        if (diff > 50) {
            closePlayer();
        }
    }, {passive: true});
}

init();