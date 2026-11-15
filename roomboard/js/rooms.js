/* ---------- Scanned rooms: read rooms/index.json and add each room to SPACES before the app boots.
   If the files are missing or unreadable, the sample rooms stay exactly as they were. ---------- */
/* Where scanned rooms are read from. To use your own rooms, set window.ROOMBOARD_DATA_URL in index.html
   (an https folder holding index.json and one folder per room). Defaults to the demo bucket. */
const ROOMS_URL=((typeof window!=='undefined'&&window.ROOMBOARD_DATA_URL)||'https://storage.googleapis.com/roomboard-demo-rooms/rooms/').replace(/\/?$/,'/');
/* Google's edge cache can hold an old copy of a public file for up to an hour; a unique query skips it. */
const fresh=u=>u+(u.includes('?')?'&':'?')+'v='+Date.now();
function loadRooms(){
 return fetch(fresh(ROOMS_URL+'index.json'),{cache:'no-store'})
  .then(r=>{if(!r.ok)throw new Error('index '+r.status);return r.json()})
  .then(idx=>Promise.all((idx.rooms||[]).map(e=>Promise.all([
    fetch(fresh(ROOMS_URL+e.folder+'/space.json'),{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null),
    fetch(fresh(ROOMS_URL+e.folder+'/tags.json'),{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null)])
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
 return Promise.all(SPACES.filter(s=>s.tagsFolder).map(s=>fetch(fresh(ROOMS_URL+s.tagsFolder+'/tags.json'),{cache:'no-store'})
  .then(r=>r.ok?r.json():null).then(tg=>{if(!tg)return;const k=[];(tg.anchors||[]).forEach(a=>(a.tags||[]).forEach(x=>{if(!k.includes(x))k.push(x)}));
   s.keywords=k;s.anchors=tg.anchors||[]}).catch(()=>{})));
}

/* Scanned rooms: the hero image becomes the 3D splat viewer, and keywords with an anchor fly the camera there. */
const anchorFor=(s,k)=>(s.anchors||[]).find(a=>Array.isArray(a.position)&&a.position.length===3&&a.position.every(Number.isFinite)&&(a.tags||[]).includes(k));
function kwItem(s,k){const a=s.scanned&&anchorFor(s,k);
 const cam=a&&Array.isArray(a.camera)&&a.camera.length===3&&a.camera.every(Number.isFinite)?` data-cam="${a.camera.join(',')}"`:'';
 return a?`<li role="button" tabindex="0" data-fly="${a.position.join(',')}"${cam} title="Show in 3D" style="cursor:pointer">${esc(k)} ↗</li>`:`<li>${esc(k)}</li>`}
// Reject executable URLs while retaining same-origin and external HTTPS viewers.
function viewerURL(s){
 const fallback='viewer.html?room='+encodeURIComponent(s.id);
 try{const url=new URL(s.viewer||fallback,location.href);
  if(!['http:','https:'].includes(url.protocol))return new URL(fallback,location.href).href;
  if(s.viewer)url.searchParams.set('embed','1'); // shared viewer: hide its panels inside Roomboard
  return url.href;
 }catch{return new URL(fallback,location.href).href}
}
function heroPane(s){if(!s.scanned)return `<div class="hero" style="${photo(s)}"></div>`;
 return `<div class="hero" style="position:relative;overflow:hidden;background:#111"><iframe id="scanview" src="${esc(viewerURL(s))}" title="3D scan of ${esc(s.name)}" style="position:absolute;inset:0;width:100%;height:100%;border:0" allow="fullscreen"></iframe></div>`}
function flyFrom(el){const f=document.getElementById('scanview');if(!f||!f.contentWindow)return;
 const position=el.dataset.fly.split(',').map(Number);
 if(position.length!==3||!position.every(Number.isFinite))return;
 const cam=el.dataset.cam?el.dataset.cam.split(',').map(Number):null;
 const msg=cam&&cam.length===3&&cam.every(Number.isFinite)?{type:'fly',position,camera:cam}:{type:'fly',position};
 f.contentWindow.postMessage(msg,new URL(f.src,location.href).origin)}
document.addEventListener('click',e=>{const el=e.target.closest('[data-fly]');if(el)flyFrom(el)});
document.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){const el=e.target.closest&&e.target.closest('[data-fly]');if(el){e.preventDefault();flyFrom(el)}}});

/* Scanned rooms show the CAD volume drawing from their scene folder (core-volume.svg next to the viewer).
   Other places keep the drawn box. A space.json can also name volume_svg directly. */
function volumeSrc(s){if(!s.scanned)return null;if(s.volume_svg)return s.volume_svg;
 const v=s.viewer&&/^https:\/\/.+\/index\.html$/.test(s.viewer)?s.viewer:null;return v?v.replace(/index\.html$/,'core-volume.svg'):null}
/* Scanned rooms also show the CAD floor plan (core-plan.svg next to the viewer); others keep the drawn plan. */
function planSrc(s){if(!s.scanned)return null;if(s.plan_svg)return s.plan_svg;
 const v=s.viewer&&/^https:\/\/.+\/index\.html$/.test(s.viewer)?s.viewer:null;return v?v.replace(/index\.html$/,'core-plan.svg'):null}
function planPane(s,fallback){const src=planSrc(s);
 if(!src)return fallback;
 return `<div class="pane"><small>Plan · CAD, est. scale</small><img data-cad src="${esc(src)}" alt="CAD floor plan of ${esc(s.name)}" loading="lazy" style="display:block;width:100%;height:auto;max-height:420px;object-fit:contain"></div>`}
function volumePane(s){const src=volumeSrc(s);
 if(!src)return `<div class="pane"><small>Volume</small>${box3d(s)}</div>`;
 return `<div class="pane"><small>Volume · CAD, est. scale</small><img data-cad src="${esc(src)}" alt="CAD volume drawing of ${esc(s.name)}" loading="lazy" style="display:block;width:100%;height:auto;max-height:420px;object-fit:contain"></div>`}

/* Demo view of the CAD drawings: drop the pipeline's small-print status notes (review flags, scale caveats,
   method notes) and crop to what is left. Dimensions, labels and the legend stay; the pane label keeps "est. scale".
   If anything fails, the original drawing is shown unchanged. */
const CAD_NOTE=/needs review|not surveyed|not a measured|assumed 1|assumes 1|derived from|drawing orientation|opening outlines retained|inferred|dashed|^blue:|upper storey|not for fabrication|door\/window bounds|not to verified scale|scale not calibrated|hypothesis|uncalibrated|provisional/i;
async function cleanCad(img){img.dataset.cad='busy';
 try{const txt=await (await fetch(img.src,{cache:'no-store'})).text(),doc=new DOMParser().parseFromString(txt,'image/svg+xml'),svg=doc.documentElement;
  if(svg.nodeName!=='svg')throw 0;svg.querySelectorAll('script,foreignObject').forEach(n=>n.remove());
  svg.querySelectorAll('text').forEach(n=>{if(CAD_NOTE.test(n.textContent.trim()))n.remove()});
  const W=+svg.getAttribute('width')||0,H=+svg.getAttribute('height')||0,host=document.createElement('div');
  host.style.cssText='position:absolute;left:-99999px;top:0;visibility:hidden';const live=document.importNode(svg,true);host.append(live);document.body.append(host);
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  live.querySelectorAll('path,polygon,polyline,line,rect,circle,ellipse,text').forEach(n=>{if(n.closest('defs,clipPath,mask'))return;
   if(n.nodeName==='rect'&&+n.getAttribute('width')>=W*0.9&&+n.getAttribute('height')>=H*0.9)return;
   let b;try{b=n.getBBox()}catch(e){return}if(!b.width&&!b.height)return;
   x0=Math.min(x0,b.x);y0=Math.min(y0,b.y);x1=Math.max(x1,b.x+b.width);y1=Math.max(y1,b.y+b.height)});
  host.remove();
  if(x1>x0&&y1>y0){const pad=Math.max(x1-x0,y1-y0)*0.04;svg.setAttribute('viewBox',`${x0-pad} ${y0-pad} ${x1-x0+2*pad} ${y1-y0+2*pad}`);svg.removeAttribute('width');svg.removeAttribute('height')}
  const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml'}));img.src=url;img.dataset.cad='clean'}
 catch(e){img.dataset.cad='orig'}}
if(typeof document!=='undefined'&&typeof MutationObserver!=='undefined'&&document.documentElement)new MutationObserver(()=>document.querySelectorAll('img[data-cad=""]').forEach(cleanCad)).observe(document.documentElement,{childList:true,subtree:true});
