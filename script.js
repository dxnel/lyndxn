const app = document.getElementById('app');
let releases = [];
let currentIndex = 0;
let audio = new Audio();
let isPlaying = false;

// --- Fetch releases.json from GitHub ---
async function loadReleases() {
  try {
    const res = await fetch('https://raw.githubusercontent.com/dxnel/lyndxn/refs/heads/main/releases.json');
    if (!res.ok) throw new Error('Failed to fetch releases.json');
    releases = await res.json();
    // Sort by date descending
    releases.sort((a, b) => new Date(b.date) - new Date(a.date));
    renderHome(); // render initial page content
  } catch (e) {
    console.error('Error loading releases:', e);
    app.innerHTML = `<p style="color:red">Error loading releases.json: ${e.message}</p>`;
  }
}

// --- Playback functions ---
function play() {
  if (!audio.src) {
    if (releases.length > 0) playIndex(0);
    return;
  }
  audio.play(); 
  isPlaying = true; 
  btnPlay.textContent = '❚❚';
}
function pause() {
  audio.pause(); 
  isPlaying = false; 
  btnPlay.textContent = '▶';
}
function playNext() {
  const next = (currentIndex + 1) % releases.length;
  playIndex(next);
}
function playPrev() {
  const prev = (currentIndex - 1 + releases.length) % releases.length;
  playIndex(prev);
}
function playIndex(idx){
  currentIndex = idx;
  audio.src = releases[idx].audio;
  audio.play();
  isPlaying = true;
  renderHome(); // update UI
}

// --- Admin editor ---
function renderAdmin() {
  const html = `
<section>
<h2>Admin — edits JSON</h2>
<div class="admin-area">
<p>Edit <code>releases.json</code> below. When done, press <strong>Download JSON</strong> and replace the file on your server.</p>
<textarea class="jsonedit" id="json-edit">${escapeHtml(JSON.stringify(releases, null, 2))}</textarea>
<div style="margin-top:12px">
<button class="btn" id="download-json">Download JSON</button>
<button class="btn" id="apply-json">Apply in page</button>
</div>
</div>
</section>
`;
  app.innerHTML = html;
  document.getElementById('download-json').addEventListener('click', () => {
    const text = document.getElementById('json-edit').value;
    downloadFile('releases.json', text);
  });
  document.getElementById('apply-json').addEventListener('click', () => {
    try {
      const json = JSON.parse(document.getElementById('json-edit').value);
      releases = json.sort((a, b) => new Date(b.date) - new Date(a.date));
      renderHome();
      alert('Applied JSON to page (not saved to server). To persist, download and replace releases.json on server.)');
    } catch(e) {
      alert('JSON error: ' + e.message);
    }
  });
}

// --- Helpers ---
function downloadFile(name, text){
  const blob = new Blob([text], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
function escapeHtml(s){ 
  if(!s && s!==0) return ''; 
  return String(s).replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); 
}

// --- Placeholder for rendering the home page ---
function renderHome(){
  // Example: display first release
  if(releases.length === 0) return;
  const r = releases[currentIndex];
  app.innerHTML = `
    <h1>${r.title}</h1>
    <p>${r.description}</p>
    <p>Credits: ${r.credits}</p>
    <audio src="${r.audio}" controls></audio>
  `;
}

// --- Init ---
loadReleases();
