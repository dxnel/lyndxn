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

let state = { releases: [], artists: [], currentProject: null, trackIndex: 0, isPlaying: false, sort: 'date', view: 'grid', grouped: false, exclusiveOnly: false };
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
    spotify: '<i class="fi fi-sr-play-alt"></i>', 
    globe: '<i class="fi fi-sr-globe"></i>',
    instagram: '<i class="fi fi-sr-camera"></i>',       // Faute de logo marque
    youtube: '<i class="fi fi-sr-play-alt"></i>',       // Play alternatif
    soundcloud: '<i class="fi fi-sr-cloud"></i>',       // Nuage
    spotify: '<i class="fi fi-sr-music-note"></i>',     // Note de musique
    website: '<i class="fi fi-sr-globe"></i>',          // Globe
};

const esc = s => s ? s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]) : '';
const fmtTime = s => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
const fmtDate = d => { try { const x = new Date(d); return `${String(x.getDate()).padStart(2,'0')}-${String(x.getMonth()+1).padStart(2,'0')}-${x.getFullYear()}`; } catch { return d; }};
const capitalize = s => s && typeof s === 'string' ? s.charAt(0).toUpperCase() + s.slice(1) : '';
const fmtCreds = c => Array.isArray(c) ? c.join(' & ') : (c || '');
const wait = ms => new Promise(r => setTimeout(r, ms));

function createBadge(item, context = 'default', parent = null) {
    let h = '';
    if (item.explicit) h += `<div class="badge explicit" title="Explicit">${ICONS.explicit}</div>`;
    let showExcl = item.exclusive !== false;
    if (context === 'tracklist' && parent && parent.exclusive === true) showExcl = false;
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
    app.classList.add('page-exit');
    await wait(300);
    fn();
    window.scrollTo(0, 0);
    app.classList.remove('page-exit');
    app.classList.add('page-enter');
    void app.offsetWidth;
    app.classList.remove('page-enter');
}

async function router() {
    if (!state.releases.length) await loadData();
    const hash = window.location.hash;
    transition(() => {
        if (hash.startsWith('#/release/')) renderRelease(decodeURIComponent(hash.split('/')[2]));
        else if (hash.startsWith('#/artist/')) renderArtist(decodeURIComponent(hash.split('/')[2]));
        else if (hash === '#/admin') renderAdmin();
        else renderHome();
    });
}

// --- RENDERERS ---
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
            <div class="library-controls">
                <div class="control-group">
                    <button class="view-btn" id="grp-btn" title="Group">${ICONS.group}</button>
                    <button class="view-btn" id="excl-btn" title="Exclusive">${ICONS.exclusive}</button>
                </div>
                <div class="control-group">
                    <button class="view-btn ${state.view === 'grid' ? 'active' : ''}" data-v="grid">${ICONS.grid}</button>
                    <button class="view-btn ${state.view === 'list' ? 'active' : ''}" data-v="list">${ICONS.list}</button>
                </div>
            </div>
        </div>
        <div class="tabs" id="sort-tabs">
            <button class="tab-btn active" data-s="date">Recent</button>
            <button class="tab-btn" data-s="title">Name (A-Z)</button>
            <button class="tab-btn" data-s="artist">Artist (A-Z)</button>
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
    
    // --- LOGIQUE SOCIALE DYNAMIQUE ---
    const links = artist.links || {};
    let socialBtns = '';

    // 1. Bouton Principal "Listen Now" (clé "main")
    if (links.main) {
        socialBtns += `<a href="${links.main}" target="_blank" class="btn">${ICONS.link} Listen Now</a>`;
    }

    // 2. Mapping des clés JSON vers les icônes
    const socialMap = {
        instagram: { icon: ICONS.instagram, title: 'Instagram' },
        youtube:   { icon: ICONS.youtube, title: 'YouTube' },
        spotify:   { icon: ICONS.spotify, title: 'Spotify' },
        soundcloud:{ icon: ICONS.soundcloud, title: 'SoundCloud' },
        website:   { icon: ICONS.website, title: 'Website' }
    };

    // 3. Génération des petits boutons ronds
    Object.keys(links).forEach(key => {
        // On ignore la clé "main" (déjà traitée) et les valeurs nulles
        if (key === 'main' || !links[key]) return;

        const map = socialMap[key];
        if (map) {
            socialBtns += `<a href="${links[key]}" target="_blank" class="btn secondary icon-only" title="${map.title}">${map.icon}</a>`;
        }
    });
    // ----------------------------------

    let latestHtml = '';
    if (latest) {
        latestHtml = `
        <div class="latest-section">
            <h2>Latest Release</h2> <div class="latest-card-wrapper">
                <div class="card">
                    <a href="#/release/${latest.slug}" class="card-link">
                        <div class="card-image-wrap"><img src="${latest.cover}"></div>
                        <div class="card-text">
                            <div class="card-title-row"><div class="title">${esc(latest.title)}</div>${createBadge(latest)}</div>
                            <div class="meta"><span>${new Date(latest.date).getFullYear()}</span><span class="meta-dot">●</span><span>${esc(latest.type)}</span></div>
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
    const firstPlayable = p.tracks.find(t => t.exclusive !== false && t.audio);
    
    let buttonHtml = '';
    if (p.exclusive === true) {
        if (firstPlayable) {
            buttonHtml = `<button class="btn" id="play-rel-btn">${ICONS.play} Play</button>
            ${p.type === 'single' ? `<a class="btn secondary" href="${firstPlayable.audio}" download="${p.slug}.mp3">Download</a>` : ''}`;
        } else {
            buttonHtml = `<button class="btn" disabled>Not Available</button>`;
        }
    } else {
        const streamUrl = p.tracks[0]?.stream_url || '#';
        buttonHtml = `<a class="btn" href="${streamUrl}" target="_blank">${ICONS.link} Listen Now</a>`;
    }

    const tracksHtml = p.tracks.map((t, i) => {
        const isPlayable = !!(t.exclusive !== false && t.audio);
        const trackButton = isPlayable
          ? `<button class="track-play-button">${ICONS.play}</button>`
          : `<a href="${t.stream_url || '#'}" target="_blank" class="track-play-button">${ICONS.link}</a>`;

        return `
        <div class="track-item" data-idx="${i}" data-playable="${isPlayable}">
            <div class="track-number">${t.track_number}</div>
            <div class="track-meta">
                <div class="track-title"><span>${esc(t.title)}</span>${createBadge(t, 'tracklist', p)}</div>
                <div class="track-credits">${esc(fmtCreds(t.credits))}</div>
            </div>
            <div class="track-controls">${trackButton}</div>
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
            <div class="release-type">${capitalize(p.type)}</div>
            <h1 class="release-title">${esc(p.title)}</h1>
            <div class="release-artist">${esc(mainCredits)}</div>
            <div class="release-year"><span>${esc(p.genre || 'Single')}</span><span class="meta-dot">●</span><span>${new Date(p.date).getFullYear()}</span></div>
            <div class="release-actions">${buttonHtml}</div>
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

    if (firstPlayable && p.exclusive === true) {
        document.getElementById('play-rel-btn').onclick = () => playTrack(firstPlayable, p);
    }
    document.getElementById('track-list').addEventListener('click', (e) => {
        const item = e.target.closest('.track-item');
        if (item && item.dataset.playable === 'true') playTrack(p.tracks[item.dataset.idx], p);
    });
    updateUIState();
}

// --- SECURITY & ADMIN ---
async function verifyPassword(input) {
    if (!input) return false;
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex === "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4";
}

let adminCurrentView = 'releases';

function renderAdmin() {
    const getCurrentJson = () => JSON.stringify(adminCurrentView === 'releases' ? state.releases : state.artists, null, 2);
    const getRepoUrl = () => `https://github.com/dxnel/lyndxn/blob/main/${adminCurrentView}.json`;

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
        <textarea class="jsonedit" id="je">${esc(getCurrentJson())}</textarea>
        <div class="modal-buttons" style="margin-top: 20px;">
            <button class="btn secondary" id="dl-json">Download</button>
            <button class="btn" id="save-json">Apply</button>
        </div>
    </div>`;

    const updateView = (view) => { adminCurrentView = view; renderAdmin(); };
    document.getElementById('tab-releases').onclick = () => updateView('releases');
    document.getElementById('tab-artists').onclick = () => updateView('artists');

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

function updateUIState() {
    const icon = state.isPlaying ? ICONS.pause : ICONS.play;
    playerElements.playBtn.innerHTML = icon;
    const bigBtn = document.getElementById('play-rel-btn');
    if (bigBtn) bigBtn.innerHTML = `${icon} ${state.isPlaying ? 'Pause' : 'Play'}`;
    
    if (state.currentProject && window.location.hash.includes(state.currentProject.slug)) {
        document.querySelectorAll('.track-item').forEach((el, i) => {
            const btn = el.querySelector('.track-play-button');
            if (i === state.trackIndex) {
                el.classList.add('playing');
                if (btn) btn.innerHTML = state.isPlaying ? ICONS.pause : ICONS.play;
            } else {
                el.classList.remove('playing');
                if (btn) btn.innerHTML = ICONS.play;
            }
        });
    }
}

function nextTrack(dir = 1) {
    if (!state.currentProject) return;
    let idx = state.trackIndex + dir;
    while (idx >= 0 && idx < state.currentProject.tracks.length) {
        const t = state.currentProject.tracks[idx];
        if ((t.exclusive !== false && t.audio)) { playTrack(t, state.currentProject); return; }
        idx += dir;
    }
}

function updateSeekBg(pct) {
    playerElements.seek.style.background = `linear-gradient(to right, ${cssVars.paper} ${pct}%, ${cssVars.track} ${pct}%)`;
}

// --- MODAL ---
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



// --- INIT LISTENERS ---
document.getElementById('admin-icon').onclick = async () => {
    const pass = await showModal('Admin Access', 'Enter secured password:', true, '••••');
    if (pass === null) return;
    await wait(200);
    if (await verifyPassword(pass)) window.location.hash = '#/admin';
    else await showModal('Access Denied', 'The password you entered is incorrect.');
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
}

init();