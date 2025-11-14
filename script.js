const app = document.getElementById('app');
dockSub.textContent = r.credits || '';
downloadLink.href = r.audio;

function play(){
if(!audio.src){
if(releases.length>0) playIndex(0);
return;
}
audio.play(); isPlaying = true; btnPlay.textContent='❚❚';
}
function pause(){audio.pause(); isPlaying=false; btnPlay.textContent='▶'}
function playNext(){
const next = (currentIndex+1) % releases.length;
playIndex(next);
}
function playPrev(){
const prev = (currentIndex-1+releases.length) % releases.length;
playIndex(prev);
}

// Admin: simple JSON editor + download
function renderAdmin(){
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
document.getElementById('download-json').addEventListener('click', ()=>{
const text = document.getElementById('json-edit').value;
downloadFile('releases.json', text);
});
document.getElementById('apply-json').addEventListener('click', ()=>{
try{
const json = JSON.parse(document.getElementById('json-edit').value);
releases = json.sort((a,b)=> new Date(b.date) - new Date(a.date));
renderHome();
alert('Applied JSON to page (not saved to server). To persist, download and replace releases.json on server.)');
}catch(e){ alert('JSON error: '+e.message); }
});
}

function downloadFile(name, text){
const blob = new Blob([text], {type:'application/json'});
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
URL.revokeObjectURL(url);
}

// small helper
function escapeHtml(s){ if(!s && s!==0) return ''; return String(s).replace(/[&<>\"]/g, (c)=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
