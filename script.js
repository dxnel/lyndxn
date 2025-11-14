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

let releases=[], currentIndex=0, audio=new Audio(), isPlaying=false;

//--- UTIL ---
const escapeHtml=s=>s||s===0?s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]):'';
const formatTime=s=>`${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`;
const downloadFile=(name,text)=>{const blob=new Blob([text],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();};

//--- FETCH ---
async function loadReleases(){
  try{
    const res=await fetch('https://raw.githubusercontent.com/dxnel/lyndxn/refs/heads/main/releases.json?t='+Date.now());
    if(!res.ok)throw new Error(res.status);
    releases=await res.json();
    releases.sort((a,b)=>new Date(b.date)-new Date(a.date));
  }catch(e){console.error(e);app.innerHTML=`<p style="color:red">Error: ${e.message}</p>`;}
}

//--- ROUTER ---
async function router(){
  if(!releases.length)await loadReleases();
  const hash=window.location.hash;
  if(hash.startsWith('#/release/')) renderRelease(hash.split('/')[2]);
  else if(hash==='#/admin') renderAdmin();
  else renderHome();
}

//--- FADE ---
function fadeIn(node){node.style.opacity=0;node.style.transform='translateY(10px)';requestAnimationFrame(()=>{node.style.transition='opacity 0.3s,transform 0.3s';node.style.opacity=1;node.style.transform='translateY(0)';});}

//--- HOME ---
function renderHome(){
  if(!releases.length){app.innerHTML='<p>Loading...</p>';return;}
  app.innerHTML=`<div class="grid">${releases.map(r=>`
    <div class="card"><a href="#/release/${r.slug}">
    <img src="${r.cover}" alt="${r.title}"><div class="title">${r.title}</div><div class="meta">${new Date(r.date).getFullYear()}</div>
    </a></div>`).join('')}</div>`;
  fadeIn(app);
}

//--- RELEASE ---
function renderRelease(slug){
  const r=releases.find(x=>x.slug===slug);
  if(!r){app.innerHTML=`<p>Release not found. <a href="#">Go home</a></p>`;return;}
  const desc=escapeHtml(r.description).replace(/\n/g,'<br>');
  const html=`<section class="release-hero show">
    <img src="${r.cover}" alt="${r.title}">
    <div class="release-details">
      <h1 class="release-title">${escapeHtml(r.title)}</h1>
      <div class="release-artist">${escapeHtml(r.credits)}</div>
      <p class="release-desc">${desc||'...'}</p>
      <button class="btn release-play-button" id="play-release-btn">Play</button>
      <a class="btn" href="${r.audio}" download="${r.slug}.mp3" style="margin-left:8px;">Download</a>
      ${r.lyrics?`<h3 style="margin-top:28px;">Lyrics</h3><p class="release-desc">${r.lyrics.replace(/\n/g,'<br>')}</p>`:''}
    </div>
  </section>`;
  app.innerHTML=html;
  document.getElementById('play-release-btn').addEventListener('click',()=>playRelease(r));
}

//--- ADMIN ---
adminIcon.addEventListener('click',()=>{
  const p=prompt('Enter admin password:');
  if(p!=='1234')return alert('Wrong password!');
  window.location.hash='#/admin';
});
function renderAdmin(){
  app.innerHTML=`<section><h2>Admin — edits JSON</h2><div class="admin-area">
  <p>Edit <code>releases.json</code>. Download to save changes.</p>
  <textarea class="jsonedit" id="json-edit">${escapeHtml(JSON.stringify(releases,null,2))}</textarea>
  <div style="margin-top:12px">
  <button class="btn" id="download-json">Download JSON</button>
  <button class="btn" id="apply-json">Apply in page</button>
  </div></div></section>`;
  document.getElementById('download-json').addEventListener('click',()=>downloadFile('releases.json',document.getElementById('json-edit').value));
  document.getElementById('apply-json').addEventListener('click',()=>{
    try{releases=JSON.parse(document.getElementById('json-edit').value).sort((a,b)=>new Date(b.date)-new Date(a.date));router();alert('Applied in page (download to persist)');}catch(e){alert('JSON error: '+e.message);}
  });
}

//--- PLAYBACK ---
function playRelease(r){
  currentIndex=releases.findIndex(x=>x.slug===r.slug);if(currentIndex===-1)return;
  audio.src=r.audio;audio.play();isPlaying=true;
  dockCover.src=r.cover; dockTitle.textContent=r.title; dockSub.textContent=r.credits;
  downloadLink.href=r.audio; downloadLink.download=`${r.slug}.mp3`;
  playerDock.classList.add('active'); btnPlay.textContent='❚❚';
}
function togglePlay(){if(!audio.src&&releases.length>0){playRelease(releases[0]);return;}isPlaying?audio.pause():audio.play();isPlaying=!isPlaying;btnPlay.textContent=isPlaying?'❚❚':'▶';}
function playNext(){playRelease(releases[(currentIndex+1)%releases.length]);}
function playPrev(){playRelease(releases[(currentIndex-1+releases.length)%releases.length]);}

//--- INIT ---
function init(){
  btnPlay.addEventListener('click',togglePlay);
  btnNext.addEventListener('click',playNext);
  btnPrev.addEventListener('click',playPrev);
  audio.addEventListener('timeupdate',()=>{curTime.textContent=formatTime(audio.currentTime);seek.value=(audio.currentTime/audio.duration*100)||0;});
  audio.addEventListener('loadedmetadata',()=>{durTime.textContent=formatTime(audio.duration);});
  audio.addEventListener('ended',()=>playNext());
  seek.addEventListener('input',()=>{if(!audio.duration)return;audio.currentTime=(seek.value/100)*audio.duration;});
  window.addEventListener('hashchange',router);
  document.getElementById('year').textContent=new Date().getFullYear();
  router();
}
init();
