/* ---------- Scanned rooms: read rooms/index.json and add each room to SPACES before the app boots.
   If the files are missing or unreadable, the sample rooms stay exactly as they were. ---------- */
const ROOMS_URL='https://storage.googleapis.com/roomboard-demo-rooms/rooms/';
function loadRooms(){
 return fetch(ROOMS_URL+'index.json',{cache:'no-cache'})
  .then(r=>{if(!r.ok)throw new Error('index '+r.status);return r.json()})
  .then(idx=>Promise.all((idx.rooms||[]).map(e=>Promise.all([
    fetch(ROOMS_URL+e.folder+'/space.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null).catch(()=>null),
    fetch(ROOMS_URL+e.folder+'/tags.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null).catch(()=>null)])
   .then(([sp,tg])=>sp&&{...sp,anchors:(tg&&tg.anchors)||[]}))))
  .then(list=>{list.filter(Boolean).forEach(s=>{
    if(SPACES.some(x=>x.id===s.id))return;
    SPACES.unshift({...s,scanned:true,thumb:s.thumb?(/^https:\/\//.test(s.thumb)?s.thumb:ROOMS_URL+s.id+'/'+s.thumb):null,saved:s.saved||'Scanned',keywords:s.keywords||[],
      project:proj(s.project)?s.project:PROJECTS[0].id});
    // Scanned rooms that name a project start out saved in it (like the built-in places).
    if(proj(s.project)&&MEM[s.project])MEM[s.project].add(s.id);
  })})
  .catch(()=>{})
  .then(loadPlaceTags);
}
/* Photo-only places with narration: keywords come from rooms/<tagsFolder>/tags.json (same format as scans). */
function loadPlaceTags(){
 return Promise.all(SPACES.filter(s=>s.tagsFolder).map(s=>fetch(ROOMS_URL+s.tagsFolder+'/tags.json',{cache:'no-cache'})
  .then(r=>r.ok?r.json():null).then(tg=>{if(!tg)return;const k=[];(tg.anchors||[]).forEach(a=>(a.tags||[]).forEach(x=>{if(!k.includes(x))k.push(x)}));
   s.keywords=k;s.anchors=tg.anchors||[]}).catch(()=>{})));
}

/* Scanned rooms: the hero image becomes the 3D splat viewer, and keywords with an anchor fly the camera there. */
const anchorFor=(s,k)=>(s.anchors||[]).find(a=>Array.isArray(a.position)&&a.position.length===3&&a.position.every(Number.isFinite)&&(a.tags||[]).includes(k));
function kwItem(s,k){const a=s.scanned&&anchorFor(s,k);
 return a?`<li role="button" tabindex="0" data-fly="${a.position.join(',')}" title="Show in 3D" style="cursor:pointer">${esc(k)} ↗</li>`:`<li>${esc(k)}</li>`}
// Reject executable URLs while retaining same-origin and external HTTPS viewers.
function viewerURL(s){
 const fallback='viewer.html?room='+encodeURIComponent(s.id);
 try{const url=new URL(s.viewer||fallback,location.href);
  return ['http:','https:'].includes(url.protocol)?url.href:new URL(fallback,location.href).href;
 }catch{return new URL(fallback,location.href).href}
}
function heroPane(s){if(!s.scanned)return `<div class="hero" style="${photo(s)}"></div>`;
 return `<div class="hero" style="position:relative;overflow:hidden;background:#111"><iframe id="scanview" src="${esc(viewerURL(s))}" title="3D scan of ${esc(s.name)}" style="position:absolute;inset:0;width:100%;height:100%;border:0" allow="fullscreen"></iframe></div>`}
function flyFrom(el){const f=document.getElementById('scanview');if(!f||!f.contentWindow)return;
 const position=el.dataset.fly.split(',').map(Number);
 if(position.length!==3||!position.every(Number.isFinite))return;
 f.contentWindow.postMessage({type:'fly',position},new URL(f.src,location.href).origin)}
document.addEventListener('click',e=>{const el=e.target.closest('[data-fly]');if(el)flyFrom(el)});
document.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){const el=e.target.closest&&e.target.closest('[data-fly]');if(el){e.preventDefault();flyFrom(el)}}});
