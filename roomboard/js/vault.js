/* ---------- Projects (boards), Save-to, and the Vault: each project's spaces as true-scale volumes ---------- */
const PCOLORS=['#c2410c','#1d4ed8','#047857','#7c3aed','#b45309','#be185d','#0e7490','#4d7c0f'];
const TAGCOL={corridor:'#64748b',threshold:'#d97706'};
const ls={get(k,d){try{const v=JSON.parse(localStorage.getItem(k));return v==null?d:v}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
ls.get('rb-projects',[]).forEach(p=>{if(p&&p.id&&!PROJECTS.find(q=>q.id===p.id))PROJECTS.push(p)});
const MEM=(()=>{const m=ls.get('rb-mem',null),seed={},out={},gone=id=>/^c\d+$/.test(id);
 PROJECTS.forEach(p=>out[p.id]=new Set((m&&m[p.id]?m[p.id]:SPACES.filter(s=>s.project===p.id).map(s=>s.id).concat(seed[p.id]||[])).filter(id=>!gone(id))));return out})();
function persistMem(){const o={};for(const k in MEM)o[k]=[...MEM[k]];ls.set('rb-mem',o);ls.set('rb-projects',PROJECTS.map(({id,name,note,color})=>({id,name,note,color})))}
function inBoard(pid,sid){return !!(MEM[pid]&&MEM[pid].has(sid))}
function projOf(s){return PROJECTS.find(p=>inBoard(p.id,s.id))||null}
function projsOf(s){return PROJECTS.filter(p=>inBoard(p.id,s.id))}
function inAny(id){return PROJECTS.some(p=>inBoard(p.id,id))}
function addTo(pid,sid){(MEM[pid]||(MEM[pid]=new Set())).add(sid);persistMem()}
/* Projects bar: which projects show as pills (PINNED) and the active one, where saved rooms go (ACTIVE) */
let PINNED=(()=>{const v=ls.get('rb-pinned',null);return Array.isArray(v)?v.filter(id=>proj(id)):PROJECTS.map(p=>p.id)})();
let ACTIVE=(()=>{const v=ls.get('rb-active',null);return proj(v)?v:(PROJECTS[0]||{}).id||null})();
const savePins=()=>{ls.set('rb-pinned',PINNED);ls.set('rb-active',ACTIVE)};
function newProject(name){const id='p'+Date.now().toString(36),p={id,name,note:'',color:PCOLORS[PROJECTS.length%PCOLORS.length]};PROJECTS.push(p);MEM[id]=new Set();PINNED.push(id);savePins();persistMem();renderNav();return p}
const BM_ICON='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5.5 3h9v14l-4.5-3.4L5.5 17z"/></svg>';
/* The card bookmark saves straight into the active project; with no active project it opens Save to */
const bmOn=sid=>ACTIVE&&proj(ACTIVE)?inBoard(ACTIVE,sid):inAny(sid);
const bmLabel=s=>ACTIVE&&proj(ACTIVE)?`Save ${s.name} to ${proj(ACTIVE).name}`:`Save ${s.name} to a project`;
const bm=s=>`<span class="bm" role="button" tabindex="0" data-save="${s.id}" aria-pressed="${bmOn(s.id)}" aria-label="${bmLabel(s)}">${BM_ICON}</span>`;
function refreshBms(){document.querySelectorAll('.bm[data-save]').forEach(el=>{const s=space(el.dataset.save);if(!s)return;el.setAttribute('aria-pressed',bmOn(s.id));el.setAttribute('aria-label',bmLabel(s))})}
function quickSave(sid){const P=proj(ACTIVE),set=MEM[P.id]||(MEM[P.id]=new Set()),on=!set.has(sid);on?set.add(sid):set.delete(sid);persistMem();refreshSaved(sid);toast(on?`Saved to ${P.name}`:`Removed from ${P.name}`)}
function toast(msg){let t=$('#toast');if(!t){t=document.createElement('div');t.id='toast';t.setAttribute('role','status');document.body.append(t)}t.textContent=msg;t.classList.add('on');clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('on'),1800)}
function refreshSaved(sid){document.querySelectorAll(`[data-save="${sid}"]`).forEach(el=>{el.setAttribute('aria-pressed',el.classList.contains('bm')?bmOn(sid):inAny(sid));const l=el.querySelector('.s-lbl');if(l)l.textContent=saveLabel(sid)});
 const pl=$('#inprojects');if(pl&&pl.dataset.sid===sid)pl.innerHTML=projChips(space(sid));renderNav();if(VAULT_API)VAULT_API.sync()}
const saveLabel=sid=>{const n=projsOf(space(sid)).length;return n?`Saved in ${n} project${n>1?'s':''}`:'Save to project'};
const projChips=s=>projsOf(s).map(p=>`<button type="button" class="pchip" data-go="p:${p.id}" style="--pc:${p.color}"><i></i>${p.name}</button>`).join('')||'<span class="hl-src">Not in a project yet</span>';
let POP=null;
function closeSave(){if(POP){POP.remove();POP=null;document.removeEventListener('pointerdown',outside,true)}}
function outside(e){if(POP&&!POP.contains(e.target)&&!e.target.closest('[data-save]'))closeSave()}
function openSave(anchor,sid){closeSave();const pop=document.createElement('div');pop.className='savepop';pop.setAttribute('role','dialog');pop.setAttribute('aria-label','Save to project');
 const draw=()=>{pop.innerHTML=`<div class="sp-h">Save to</div><div class="sp-list">${PROJECTS.map(p=>`<button type="button" class="sp-item" data-pid="${p.id}" aria-pressed="${inBoard(p.id,sid)}"><i style="background:${p.color}"></i><span class="sp-name">${p.name}</span><span class="sp-n">${MEM[p.id]?MEM[p.id].size:0}</span><span class="sp-ck" aria-hidden="true">✓</span></button>`).join('')}</div>
  <form class="sp-new"><input id="sp-new-name" placeholder="New project" maxlength="40" aria-label="New project name" autocomplete="off"><button type="submit">Create</button></form>`};
 draw();document.body.append(pop);POP=pop;
 const r=anchor.getBoundingClientRect(),pw=Math.min(280,innerWidth-24),ph=pop.offsetHeight;let left=Math.min(Math.max(12,r.right-pw),innerWidth-pw-12),top=r.bottom+8;if(top+ph>innerHeight-12)top=Math.max(12,r.top-ph-8);
 Object.assign(pop.style,{left:left+'px',top:top+'px',width:pw+'px'});anim(pop,[{opacity:0,transform:'translateY(-6px) scale(.98)'},{opacity:1,transform:'none'}],{duration:180,easing:'ease-out'});
 pop.addEventListener('click',e=>{const b=e.target.closest('.sp-item');if(!b)return;const pid=b.dataset.pid,set=MEM[pid]||(MEM[pid]=new Set());const on=!set.has(sid);on?set.add(sid):set.delete(sid);persistMem();
  b.setAttribute('aria-pressed',on);b.querySelector('.sp-n').textContent=set.size;refreshSaved(sid);toast(on?`Saved to ${proj(pid).name}`:`Removed from ${proj(pid).name}`)});
 pop.addEventListener('submit',e=>{e.preventDefault();const v=pop.querySelector('input').value.trim();if(!v)return;const p=newProject(v);addTo(p.id,sid);draw();refreshSaved(sid);toast(`Created ${p.name} and saved`)});
 pop.addEventListener('keydown',e=>{if(e.key==='Escape'){closeSave();anchor.focus()}});
 setTimeout(()=>document.addEventListener('pointerdown',outside,true));(pop.querySelector('.sp-item')||pop.querySelector('input')).focus({preventScroll:true})}
document.addEventListener('click',e=>{const b=e.target.closest('[data-save]');if(!b)return;e.preventDefault();e.stopPropagation();if(b.classList.contains('bm')&&ACTIVE&&proj(ACTIVE)){quickSave(b.dataset.save);return}if(POP&&POP._sid===b.dataset.save){closeSave();return}openSave(b,b.dataset.save);POP._sid=b.dataset.save},true);
document.addEventListener('keydown',e=>{const t=e.target;if((e.key==='Enter'||e.key===' ')&&t.dataset&&t.dataset.save&&t.tagName!=='BUTTON'){e.preventDefault();e.stopPropagation();if(t.classList.contains('bm')&&ACTIVE&&proj(ACTIVE)){quickSave(t.dataset.save);return}openSave(t,t.dataset.save);POP._sid=t.dataset.save}},true);
addEventListener('scroll',()=>{if(POP)closeSave()},{passive:true});

const THREE_URL='https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js';
const ORBIT_URL='https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js';
function loadScript(src){return new Promise((res,rej)=>{const ex=document.querySelector(`script[src="${src}"]`);if(ex){ex.dataset.ok?res():ex.addEventListener('load',res);return}
 const s=document.createElement('script');s.src=src;s.onload=()=>{s.dataset.ok=1;res()};s.onerror=rej;document.head.append(s)})}

/* Layouts per project: built-in arrangements plus the user's own, saved */
const VL=ls.get('rb-layouts',{});const saveVL=()=>ls.set('rb-layouts',VL);
const vl=pid=>VL[pid]||(VL[pid]={active:'size',custom:[]});
const BUILTIN=[['size','By size'],['overlay','Overlay'],['type','By type']];
const nextLayoutName=pid=>{const ns=new Set(vl(pid).custom.map(l=>l.name));let i=1;while(ns.has('Layout '+i))i++;return 'Layout '+i};
const layoutName=(pid,id)=>{const b=BUILTIN.find(x=>x[0]===id);return b?b[1]:((vl(pid).custom.find(l=>l.id===id)||{}).name||'Layout')};
function layoutPos(pid){const st=vl(pid),items=inProject(pid),c=st.custom.find(l=>l.id===st.active),auto=arrange(items,c?'size':st.active);if(!c)return auto;const out={};items.forEach(s=>out[s.id]=c.pos[s.id]||auto[s.id]);return out}
let VAULT_API=null,VMOVE='across',VLOOK=ls.get('rb-look','glass');const VCAMS={};
const ROT_ICON='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M15.5 8.5A6 6 0 0 0 4.6 7M4.5 11.5A6 6 0 0 0 15.4 13"/><path d="M4.2 3.6l.4 3.6 3.5-.6M15.8 16.4l-.4-3.6-3.5.6"/></svg>';
const fp=(s,r)=>r%2?[s.d,s.w]:[s.w,s.d];
function arrange(items,kind){const out={};
 if(kind==='overlay'){items.forEach(s=>{const r=s.d>s.w?1:0,[lx,lz]=fp(s,r);out[s.id]={x:lx/2,z:-lz/2,r}});return out}
 if(kind==='size'){let x=0;[...items].sort((a,b)=>b.w*b.d-a.w*a.d).forEach(s=>{const r=s.d>s.w?1:0,[lx,lz]=fp(s,r);out[s.id]={x:x+lx/2,z:-lz/2,r};x+=lx+1.2});const off=x/2;for(const k in out)out[k].x-=off;return out}
 const groups=['room','corridor','threshold'].map(t=>items.filter(s=>s.tag===t)).filter(g=>g.length);let z=0;
 groups.forEach(g=>{let x=0,depth=0;const row=g.map(s=>{const r=s.d>s.w?1:0,[lx,lz]=fp(s,r),o={id:s.id,x:x+lx/2,r};x+=lx+1.5;depth=Math.max(depth,lz);return o});
  row.forEach(o=>out[o.id]={x:o.x-(x-1.5)/2,z:z+depth/2,r:o.r});z+=depth+3});for(const k in out)out[k].z-=(z-3)/2;return out}
/* Top-down plan of a project's current layout, for the project cards */
function boardPlan(pid){const items=inProject(pid),pos=layoutPos(pid),P=proj(pid);if(!items.length)return '<div class="vp-empty">No spaces yet</div>';
 let x0=1e9,z0=1e9,x1=-1e9,z1=-1e9;const rs=items.map(s=>{const p=pos[s.id]||{x:0,z:0,r:0},[lx,lz]=fp(s,p.r||0),r={s,x:p.x-lx/2,z:p.z-lz/2,w:lx,d:lz};x0=Math.min(x0,r.x);z0=Math.min(z0,r.z);x1=Math.max(x1,r.x+lx);z1=Math.max(z1,r.z+lz);return r});
 const pad=1.2,W=x1-x0+2*pad,D=z1-z0+2*pad;
 return `<svg viewBox="0 0 ${W.toFixed(2)} ${D.toFixed(2)}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Plan of ${P.name} layout">${rs.map(r=>`<rect x="${(r.x-x0+pad).toFixed(2)}" y="${(r.z-z0+pad).toFixed(2)}" width="${r.w.toFixed(2)}" height="${r.d.toFixed(2)}" fill="${r.s.tag==='room'?P.color:TAGCOL[r.s.tag]}" fill-opacity=".22" stroke="${r.s.tag==='room'?P.color:TAGCOL[r.s.tag]}" stroke-width="1.3" vector-effect="non-scaling-stroke"/>`).join('')}</svg>`}

async function mountVault(stage,ui,pid){const P=proj(pid);
 stage.insertAdjacentHTML('afterbegin','<div class="vmsg" id="vload">Loading the 3D view…</div>');
 try{await loadScript(THREE_URL);await loadScript(ORBIT_URL)}catch(e){$('#vload').innerHTML=`<div>The 3D view needs a connection to load. Your saved spaces:<div class="vfall">${inProject(pid).map(s=>`<button type="button" class="vbtn" data-go="s:${s.id}">${s.name}</button>`).join('')}</div></div>`;return null}
 if(!stage.isConnected)return null;$('#vload').remove();
 const T=THREE,cs=getComputedStyle(document.documentElement),tok=n=>(cs.getPropertyValue(n)||'').trim(),C=(n,f='#888')=>new T.Color(tok(n)||f);
 const renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));stage.prepend(renderer.domElement);
 const labels=document.createElement('div');labels.className='vlabels';renderer.domElement.after(labels);
 const scene=new T.Scene();scene.background=C('--surface','#fff');
 const camera=new T.PerspectiveCamera(38,1,.1,600);
 const controls=new T.OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.08;controls.maxPolarAngle=Math.PI*.49;controls.minDistance=3;controls.maxDistance=160;
 scene.add(new T.HemisphereLight(0xffffff,C('--line'),.95));const sun=new T.DirectionalLight(0xffffff,.55);sun.position.set(12,24,9);scene.add(sun);
 const step=UNIT==='ft'?1.524:1,grid=new T.GridHelper(step*80,80,C('--line'),C('--line'));grid.material.transparent=true;grid.material.opacity=.7;scene.add(grid);
 const fg=C('--fg','#222'),acc=C('--accent','#c00');
 const person=new T.Group();const pm=new T.MeshLambertMaterial({color:fg});
 const body=new T.Mesh(new T.CylinderGeometry(.19,.16,1.42,16),pm);body.position.y=.71;const head=new T.Mesh(new T.SphereGeometry(.12,16,12),pm);head.position.y=1.61;person.add(body,head);scene.add(person);
 const groups=new Map(),meshes=[];let sel=null,drag=null,rot=null,tween=null,raf=0,lastTap={id:null,t:0},partners=[];
 /* Look: transparent glass volumes, or opaque solids */
 const WHITE=new T.Color(0xffffff);
 const paint=o=>{const on=o.s.id===sel;if(VLOOK==='solid'){o.mat.transparent=false;o.mat.opacity=1;o.mat.depthWrite=true;o.mat.color.copy(o.solidCol);o.foot.visible=false}
  else{o.mat.transparent=true;o.mat.opacity=on?.5:.28;o.mat.depthWrite=false;o.mat.color.copy(o.col);o.foot.visible=true}o.mat.needsUpdate=true};
 function makeVolume(s){const col=new T.Color(s.tag==='room'?P.color:TAGCOL[s.tag]),g=new T.Group();
  const geo=new T.BoxGeometry(s.w,s.h,s.d);geo.translate(0,s.h/2,0);
  const mat=new T.MeshLambertMaterial({color:col,transparent:true,opacity:.28,depthWrite:false});const mesh=new T.Mesh(geo,mat);
  const edges=new T.LineSegments(new T.EdgesGeometry(geo),new T.LineBasicMaterial({color:col}));
  const foot=new T.Mesh(new T.PlaneGeometry(s.w,s.d),new T.MeshBasicMaterial({color:col,transparent:true,opacity:.22,depthWrite:false}));foot.rotation.x=-Math.PI/2;foot.position.y=.012;
  g.add(foot,mesh,edges);
  for(const d of s.doors){const along=d.wall==='N'||d.wall==='S',L=along?s.w:s.d,dw=Math.min(d.w,L*.8),c=Math.max(dw/2,Math.min(L-dw/2,d.pos*L))-L/2,dh=Math.min(2.1,s.h*.85);
   const door=new T.Mesh(new T.PlaneGeometry(dw,dh),new T.MeshBasicMaterial({color:acc,side:T.DoubleSide,transparent:true,opacity:.85}));door.position.y=dh/2;
   if(along){door.position.x=c;door.position.z=(d.wall==='N'?-1:1)*(s.d/2+.012)}else{door.rotation.y=Math.PI/2;door.position.z=c;door.position.x=(d.wall==='W'?-1:1)*(s.w/2+.012)}g.add(door)}
  /* floor shadow, shown when the volume is lifted, so its height reads */
  const sh=new T.Group(),shp=new T.Mesh(new T.PlaneGeometry(s.w,s.d),new T.MeshBasicMaterial({color:fg,transparent:true,opacity:.13,depthWrite:false}));shp.rotation.x=-Math.PI/2;shp.position.y=.006;sh.add(shp);sh.visible=false;scene.add(sh);
  const drop=new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(0,0,0),new T.Vector3(0,1,0)]),new T.LineDashedMaterial({color:fg,dashSize:.15,gapSize:.1}));drop.visible=false;scene.add(drop);
  mesh.userData.id=s.id;meshes.push(mesh);
  const lab=document.createElement('div');lab.className='vlabel';lab.innerHTML=`<b>${s.name}</b><span>${len(Math.max(s.w,s.d))} × ${len(Math.min(s.w,s.d))} · H ${len(s.h)}</span>`;labels.append(lab);
  const o={s,g,mesh,edges,mat,col,lab,sh,drop,foot,solidCol:col.clone().lerp(WHITE,.35),r:0};paint(o);groups.set(s.id,o);scene.add(g);return o}
 const bb=(o,x=o.g.position.x,z=o.g.position.z,y=o.g.position.y)=>{const [lx,lz]=fp(o.s,o.r);return {x0:x-lx/2,x1:x+lx/2,z0:z-lz/2,z1:z+lz/2,y0:y,y1:y+o.s.h}};
 function place(o,p,instant){o.r=p.r||0;if(instant){o.g.position.set(p.x,p.y||0,p.z);o.g.rotation.y=-o.r*Math.PI/2}}
 const currentLayout=()=>layoutPos(pid);
 function frame(instant=false){const box=new T.Box3();groups.forEach(o=>box.expandByObject(o.g));if(box.isEmpty())box.set(new T.Vector3(-5,0,-5),new T.Vector3(5,3,5));
  const c=box.getCenter(new T.Vector3()),sz=box.getSize(new T.Vector3()),R=Math.max(sz.x,sz.z,sz.y*1.6,8)*.95,asp=stage.clientWidth/Math.max(1,stage.clientHeight);
  const dist=R/Math.min(1,asp)*1.15,to=new T.Vector3(c.x+dist*.62,dist*.7,c.z+dist*.85),tg=new T.Vector3(c.x,0,c.z);
  person.position.set(box.min.x-1.4,0,box.max.z+.6);
  if(instant||RM){camera.position.copy(to);controls.target.copy(tg);return}
  const fromP=camera.position.clone(),fromT=controls.target.clone(),t0=performance.now();
  (function stepCam(){const k=Math.min(1,(performance.now()-t0)/700),e=1-Math.pow(1-k,3);camera.position.lerpVectors(fromP,to,e);controls.target.lerpVectors(fromT,tg,e);if(k<1)requestAnimationFrame(stepCam)})()}
 /* turn the short way round to the target quarter turn */
 const nearAngle=(a,t)=>a+((((t-a)%(2*Math.PI))+3*Math.PI)%(2*Math.PI)-Math.PI);
 function moveTo(lay,ms=700){const t0=performance.now(),from=new Map();groups.forEach((o,id)=>{const p=lay[id];if(!p)return;const a=o.g.rotation.y;from.set(id,{x:o.g.position.x,y:o.g.position.y,z:o.g.position.z,a,tx:p.x,ty:p.y||0,tz:p.z,ta:nearAngle(a,-(p.r||0)*Math.PI/2)});o.r=p.r||0});
  tween=()=>{const k=RM?1:Math.min(1,(performance.now()-t0)/ms),e=k<.5?4*k*k*k:1-Math.pow(-2*k+2,3)/2;
   from.forEach((f,id)=>{const g=groups.get(id).g;g.position.x=f.x+(f.tx-f.x)*e;g.position.y=f.y+(f.ty-f.y)*e;g.position.z=f.z+(f.tz-f.z)*e;g.rotation.y=f.a+(f.ta-f.a)*e});if(k>=1)tween=null}}
 const setPartners=list=>{partners.forEach(o=>{if(o.s.id!==sel)o.edges.material.color.copy(o.col)});partners=list;partners.forEach(o=>o.edges.material.color.copy(acc))};
 function select(id){const prev=sel;sel=id&&groups.has(id)?id:null;if(prev){const o=groups.get(prev);if(o){o.edges.material.color.copy(o.col);o.lab.classList.remove('on');paint(o)}}
  if(sel){const o=groups.get(sel);o.edges.material.color.copy(fg);o.lab.classList.add('on');paint(o)}ui.select(sel?groups.get(sel).s:null,sel?groups.get(sel).g.position.y:0)}
 function sync(){const items=inProject(pid),ids=new Set(items.map(s=>s.id));
  groups.forEach((o,id)=>{if(!ids.has(id)){scene.remove(o.g,o.sh,o.drop);o.lab.remove();meshes.splice(meshes.indexOf(o.mesh),1);groups.delete(id);if(sel===id)select(null)}});
  items.forEach(s=>{if(!groups.has(s.id)){const o=makeVolume(s),lay=currentLayout();place(o,lay[s.id],true)}});ui.count(items.length)}
 inProject(pid).forEach(makeVolume);const lay0=currentLayout();groups.forEach((o,id)=>place(o,lay0[id],true));
 /* pointer: drag volumes across the floor or up/down (Ctrl or Shift flips), drag a corner to rotate, tap to select, double-tap to open */
 const ray=new T.Raycaster(),ndc=new T.Vector2(),hit=new T.Vector3(),cv=new T.Vector3();
 const setNdc=e=>{const r=renderer.domElement.getBoundingClientRect();ndc.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(ndc,camera)};
 let downAt=null;const SNAP=.35,snap=v=>Math.round(v/.1)*.1;
 /* Corner handles, like a gumball: the nearest top or bottom corner of any volume within px of the pointer */
 const rotH=document.createElement('div');rotH.className='vrot';rotH.hidden=true;rotH.innerHTML=ROT_ICON+'<span></span>';stage.append(rotH);
 function cornerAt(cx,cy,px){const r=renderer.domElement.getBoundingClientRect(),mx=cx-r.left,my=cy-r.top;let best=null;
  groups.forEach(o=>{const [lx,lz]=fp(o.s,o.r),p=o.g.position;for(const y of [p.y,p.y+o.s.h])for(const [sx,sz] of [[-1,-1],[1,-1],[1,1],[-1,1]]){
   cv.set(p.x+sx*lx/2,y,p.z+sz*lz/2).project(camera);if(cv.z>1)continue;const X=(cv.x+1)/2*r.width,Y=(1-cv.y)/2*r.height,d=Math.hypot(X-mx,Y-my);if(d<px&&(!best||d<best.d))best={o,d,X,Y,y}}});return best}
 const showRot=(x,y,txt='')=>{rotH.hidden=false;rotH.style.transform=`translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-50%)`;rotH.querySelector('span').textContent=txt;rotH.classList.toggle('deg',!!txt)};
 const hideRot=()=>{rotH.hidden=true;stage.classList.remove('rothot')};
 const onHover=e=>{if(drag||rot||e.pointerType!=='mouse'||e.buttons)return;const c=cornerAt(e.clientX,e.clientY,12);if(c){showRot(c.X,c.Y);stage.classList.add('rothot')}else hideRot()};
 const degOf=th=>{const d=Math.round(((-th*180/Math.PI)%360+360)%360);return d===360?0:d};
 const onRot=e=>{if(!rot)return;setNdc(e);if(!ray.ray.intersectPlane(rot.plane,hit))return;const o=rot.o,a=Math.atan2(hit.z-o.g.position.z,hit.x-o.g.position.x);
  let th=rot.base-(a-rot.a0);const q=Math.PI/2,near=Math.round(th/q)*q;if(Math.abs(th-near)<Math.PI/18)th=near;o.g.rotation.y=th;
  const r=renderer.domElement.getBoundingClientRect();showRot(e.clientX-r.left,e.clientY-r.top,degOf(th)+'°')};
 const onRotUp=()=>{window.removeEventListener('pointermove',onRot);stage.classList.remove('rotating');hideRot();if(!rot)return;const o=rot.o,q=Math.PI/2,k=Math.round(-o.g.rotation.y/q),r=((k%4)+4)%4,changed=r!==rot.r0;rot=null;
  const lay={};groups.forEach((x,id)=>lay[id]={x:x.g.position.x,y:x.g.position.y,z:x.g.position.z,r:id===o.s.id?r:x.r});moveTo(lay,220);setTimeout(()=>{if(changed)commitCustom()},240)};
 const onDown=e=>{if(e.button>0||e.target.closest('.vcard'))return;downAt=[e.clientX,e.clientY];setNdc(e);
  const c=cornerAt(e.clientX,e.clientY,e.pointerType==='mouse'?12:22);
  if(c){e.stopPropagation();tween=null;const o=c.o;select(o.s.id);const plane=new T.Plane(new T.Vector3(0,1,0),-c.y);ray.ray.intersectPlane(plane,hit);
   rot={o,plane,a0:Math.atan2(hit.z-o.g.position.z,hit.x-o.g.position.x),base:o.g.rotation.y,r0:o.r};stage.classList.add('rotating');showRot(c.X,c.Y,degOf(o.g.rotation.y)+'°');
   window.addEventListener('pointermove',onRot);window.addEventListener('pointerup',onRotUp,{once:true});return}
  const h=ray.intersectObjects(meshes,false)[0];if(!h)return;
  e.stopPropagation();const o=groups.get(h.object.userData.id),vertical=(VMOVE==='up')!==!!(e.shiftKey||e.ctrlKey||e.metaKey);tween=null;
  let plane;if(vertical){const n=new T.Vector3();camera.getWorldDirection(n);n.y=0;if(n.lengthSq()<1e-6)n.set(0,0,1);n.normalize().negate();plane=new T.Plane().setFromNormalAndCoplanarPoint(n,o.g.position.clone())}
  else plane=new T.Plane(new T.Vector3(0,1,0),-o.g.position.y);
  ray.ray.intersectPlane(plane,hit);drag={o,plane,vertical,dx:o.g.position.x-hit.x,dy:o.g.position.y-hit.y,dz:o.g.position.z-hit.z,moved:false,x:e.clientX,y:e.clientY};
  stage.classList.add('dragging');window.addEventListener('pointermove',onMove);window.addEventListener('pointerup',onUp,{once:true})};
 function snapFloor(o,x,z){const a=bb(o,x,z),others=[...groups.values()].filter(q=>q!==o),hitP=[];let bx=null,bz=null;
  for(const q of others){const b=bb(q);if(a.y1<=b.y0+.01||a.y0>=b.y1-.01){if(Math.abs(a.y0-b.y1)>.05&&Math.abs(a.y1-b.y0)>.05)continue}
   const zNear=a.z0<b.z1+.6&&a.z1>b.z0-.6,xNear=a.x0<b.x1+.6&&a.x1>b.x0-.6;
   if(zNear)for(const d of [b.x1-a.x0,b.x0-a.x1,b.x0-a.x0,b.x1-a.x1])if(Math.abs(d)<SNAP&&(!bx||Math.abs(d)<Math.abs(bx.d)))bx={d,q};
   if(xNear)for(const d of [b.z1-a.z0,b.z0-a.z1,b.z0-a.z0,b.z1-a.z1])if(Math.abs(d)<SNAP&&(!bz||Math.abs(d)<Math.abs(bz.d)))bz={d,q}}
  if(bx){x+=bx.d;hitP.push(bx.q)}if(bz){z+=bz.d;if(!hitP.includes(bz.q))hitP.push(bz.q)}return {x,z,hitP}}
 function snapHeight(o,y){const a=bb(o),cands=[{y:0,q:null}];
  for(const q of groups.values()){if(q===o)continue;const b=bb(q);if(a.x0<b.x1-.05&&a.x1>b.x0+.05&&a.z0<b.z1-.05&&a.z1>b.z0+.05){cands.push({y:b.y1,q});if(b.y0-o.s.h>0)cands.push({y:b.y0-o.s.h,q})}}
  let best=null;for(const c of cands){const d=Math.abs(c.y-y);if(d<SNAP&&(!best||d<best.d))best={...c,d}}return best?{y:best.y,hitP:best.q?[best.q]:[]}:{y:Math.max(0,snap(y)),hitP:[]}}
 const onMove=e=>{if(!drag)return;if(!drag.moved&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>4){drag.moved=true;select(drag.o.s.id)}if(!drag.moved)return;
  setNdc(e);if(!ray.ray.intersectPlane(drag.plane,hit))return;const g=drag.o.g;
  if(drag.vertical){const r=snapHeight(drag.o,Math.max(0,hit.y+drag.dy));g.position.y=r.y;setPartners(r.hitP)}
  else{const r=snapFloor(drag.o,snap(hit.x+drag.dx),snap(hit.z+drag.dz));g.position.x=r.x;g.position.z=r.z;setPartners(r.hitP)}
  ui.lift(drag.o.s,g.position.y)};
 const onUp=()=>{window.removeEventListener('pointermove',onMove);stage.classList.remove('dragging');setPartners([]);if(!drag)return;const o=drag.o;
  if(drag.moved){commitCustom()}else{const now=performance.now();if(lastTap.id===o.s.id&&now-lastTap.t<380){go('s:'+o.s.id);return}lastTap={id:o.s.id,t:now};select(o.s.id)}drag=null};
 const onClickEmpty=e=>{if(!downAt||drag||e.target.closest('.vcard'))return;if(Math.hypot(e.clientX-downAt[0],e.clientY-downAt[1])<5){setNdc(e);if(!ray.intersectObjects(meshes,false).length)select(null)}downAt=null};
 renderer.domElement.addEventListener('dblclick',e=>{setNdc(e);const h=ray.intersectObjects(meshes,false)[0];if(h)go('s:'+h.object.userData.id)});
 const snapshot=()=>{const pos={};groups.forEach((o,id)=>pos[id]={x:+o.g.position.x.toFixed(2),y:+o.g.position.y.toFixed(2),z:+o.g.position.z.toFixed(2),r:o.r});return pos};
 function commitCustom(){const st=vl(pid),c=st.custom.find(l=>l.id===st.active);if(c)c.pos=snapshot();else{const n={id:'l'+Date.now().toString(36),name:nextLayoutName(pid),pos:snapshot()};st.custom.push(n);st.active=n.id;toast(`Saved as ${n.name}`)}saveVL();ui.layouts()}
 stage.addEventListener('pointerdown',onDown,true);stage.addEventListener('pointerup',onClickEmpty);
 stage.addEventListener('pointermove',onHover);stage.addEventListener('pointerleave',()=>{if(!rot)hideRot()});stage.addEventListener('contextmenu',e=>e.preventDefault());
 const ro=new ResizeObserver(()=>{const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/Math.max(1,h);camera.updateProjectionMatrix()});ro.observe(stage);
 const v=new T.Vector3();
 function loop(){raf=requestAnimationFrame(loop);if(tween)tween();controls.update();
  groups.forEach(o=>{const y=o.g.position.y,up=y>.02;o.sh.visible=up;o.drop.visible=up;if(up){o.sh.position.set(o.g.position.x,0,o.g.position.z);o.sh.rotation.y=o.g.rotation.y;
   const [lx,lz]=fp(o.s,o.r);o.drop.position.set(o.g.position.x+lx/2,0,o.g.position.z+lz/2);o.drop.scale.y=y;o.drop.computeLineDistances()}});
  renderer.render(scene,camera);
  const W=stage.clientWidth,H=stage.clientHeight,placed=[],list=[];
  groups.forEach(o=>{v.set(o.g.position.x,o.g.position.y+o.s.h+.35,o.g.position.z);const d=v.distanceTo(camera.position);v.project(camera);
   if(v.z>1||v.x<-1.1||v.x>1.1||v.y<-1.1||v.y>1.1){o.lab.style.display='none';return}list.push({o,x:(v.x+1)/2*W,y:(1-v.y)/2*H,d})});
  list.sort((a,b)=>(b.o.s.id===sel)-(a.o.s.id===sel)||a.d-b.d);
  for(const it of list){const o=it.o;if(!o.lw){o.lab.style.display='';o.lw=o.lab.offsetWidth;o.lh=o.lab.offsetHeight}
   const isSel=o.s.id===sel,w=isSel?o.lab.offsetWidth:o.lw,h=isSel?o.lab.offsetHeight:o.lh,r={l:it.x-w/2-3,r:it.x+w/2+3,t:it.y-h-2,b:it.y+2};
   if(!isSel&&placed.some(p=>r.l<p.r&&r.r>p.l&&r.t<p.b&&r.b>p.t)){o.lab.style.display='none';continue}
   placed.push(r);o.lab.style.display='';o.lab.style.transform=`translate(${it.x.toFixed(1)}px,${it.y.toFixed(1)}px) translate(-50%,-100%)`}}
 const w0=stage.clientWidth,h0=stage.clientHeight;renderer.setSize(w0,h0,false);camera.aspect=w0/Math.max(1,h0);camera.updateProjectionMatrix();
 const VC=VCAMS[pid];if(VC){frame(true);camera.position.fromArray(VC.p);controls.target.fromArray(VC.t)}else frame(true);
 loop();anim(renderer.domElement,[{opacity:0},{opacity:1}],{duration:500});
 ui.count(groups.size);if(VC&&VC.sel&&groups.has(VC.sel))select(VC.sel);
 return {sync,
  look(){groups.forEach(paint)},
  arrange(id){vl(pid).active=id;saveVL();ui.layouts();moveTo(currentLayout());setTimeout(()=>frame(),RM?0:720)},
  newLayout(){const st=vl(pid),n={id:'l'+Date.now().toString(36),name:nextLayoutName(pid),pos:snapshot()};st.custom.push(n);st.active=n.id;saveVL();ui.layouts();toast(`Saved ${n.name}`)},
  rotate(){if(!sel)return;const o=groups.get(sel),r=(o.r+1)%4;tween=null;const lay={};groups.forEach((x,id)=>lay[id]={x:x.g.position.x,y:x.g.position.y,z:x.g.position.z,r:id===sel?r:x.r});moveTo(lay,420);setTimeout(commitCustom,440)},
  floor(){if(!sel)return;const lay={};groups.forEach((x,id)=>lay[id]={x:x.g.position.x,y:id===sel?0:x.g.position.y,z:x.g.position.z,r:x.r});moveTo(lay,420);setTimeout(()=>{commitCustom();ui.lift(groups.get(sel).s,0)},440)},
  frame:()=>frame(),select,
  stop(){VCAMS[pid]={p:camera.position.toArray(),t:controls.target.toArray(),sel};cancelAnimationFrame(raf);ro.disconnect();window.removeEventListener('pointermove',onMove);window.removeEventListener('pointermove',onRot);controls.dispose();renderer.dispose();VAULT_API=null}}}


function vaultView(m){m.innerHTML=`<p class="intro">Board</p><p class="lede">Every project as true-scale volumes. Open one to arrange its spaces in 3D, try the built-in arrangements, or save your own layouts.</p>
 <div class="vprojects">${PROJECTS.map(p=>{const ss=inProject(p.id),st=vl(p.id);return `<a class="vproj card" href="#" data-go="v:${p.id}" style="--pc:${p.color}"><div class="vp-plan">${boardPlan(p.id)}</div>
 <div class="vp-t"><b><i></i>${p.name}</b><span>${ss.length} space${ss.length===1?'':'s'} · ${totalArea(ss)}</span></div>
 <div class="vp-l"><span class="vp-cur">${layoutName(p.id,st.active)}</span>${st.custom.length?`<span>${st.custom.length} saved layout${st.custom.length>1?'s':''}</span>`:''}<span class="vp-go">Open in 3D →</span></div></a>`}).join('')}
 <form class="vproj vnew" id="vnew"><b>New project</b><span>Collect spaces into it with the bookmark on any card.</span><div class="vnew-r"><input id="vnew-name" placeholder="Project name" maxlength="40" aria-label="Project name" autocomplete="off"><button type="submit" class="btn">Create</button></div></form></div>`;
 m.querySelectorAll('.vproj.card').forEach((el,i)=>anim(el,[{opacity:0,transform:'translateY(14px)'},{opacity:1,transform:'none'}],{duration:380,delay:i*60,easing:'cubic-bezier(.2,.8,.2,1)',fill:'backwards'}));
 $('#vnew').addEventListener('submit',e=>{e.preventDefault();const v=$('#vnew-name').value.trim();if(!v)return;const p=newProject(v);toast(`Created ${p.name}`);go('vault',false)})}

function vaultProjectView(m,P){const pid=P.id,items=inProject(pid),unitGrid=UNIT==='ft'?'5 ft':'1 m';
 m.innerHTML=`<button class="back" data-go="vault">← All projects</button><p class="intro"><span class="pdot" style="background:${P.color}"></span>${esc(P.name)}</p><p class="lede">${items.length} spaces · ${totalArea(items)}. Drag to move, hold Ctrl and drag to lift or stack, and drag a corner to rotate. Moving anything on a built-in arrangement saves it as a new layout.</p>
 <div class="vtools"><div class="vseg vlays" role="group" aria-label="Layouts" id="vlays"></div><span class="vlay-acts" id="vlayacts"></span>
 <div class="vseg" role="group" aria-label="Drag moves"><span class="vseg-l">Drag moves</span>${[['across','Across'],['up','Up / down']].map(([k,l])=>`<button type="button" data-move="${k}" aria-pressed="${VMOVE===k}">${l}</button>`).join('')}</div>
 <div class="vseg" role="group" aria-label="Look"><span class="vseg-l">Look</span>${[['glass','Transparent'],['solid','Opaque']].map(([k,l])=>`<button type="button" data-look="${k}" aria-pressed="${VLOOK===k}">${l}</button>`).join('')}</div>
 <button type="button" class="vbtn" data-vact="frame">Reset view</button></div>
 <div class="vstage" id="vstage"><div class="vcard" id="vsel" hidden></div><div class="vhint">Tap a volume for its space · double-tap to open · drag to move · Ctrl-drag lifts · drag a corner to rotate</div></div>
 <div class="vfoot"><div class="vlegend"><span><i style="background:${P.color}"></i>Room</span><span><i style="background:${TAGCOL.corridor}"></i>Corridor</span><span><i style="background:${TAGCOL.threshold}"></i>Threshold</span><span><i class="door"></i>Doors</span></div><span class="vnote"><span id="vcount">${items.length}</span> volumes · grid ${unitGrid} · figure 1.75 m</span></div>`;
 const lays=$('#vlays'),acts=$('#vlayacts'),card=$('#vsel'),hint=m.querySelector('.vhint');let confirmDel=false;
 const ui={count:n=>{const c=$('#vcount');if(c)c.textContent=n},
  layouts(){const st=vl(pid);lays.innerHTML=BUILTIN.map(([k,l])=>`<button type="button" data-lay="${k}" aria-pressed="${st.active===k}">${l}</button>`).join('')+(st.custom.length?'<span class="vsep" aria-hidden="true"></span>':'')+st.custom.map(c=>`<button type="button" data-lay="${c.id}" aria-pressed="${st.active===c.id}">${c.name}</button>`).join('');
   const cur=st.custom.find(c=>c.id===st.active);confirmDel=false;acts.innerHTML=`<button type="button" class="vbtn" data-vact="newlayout">+ New layout</button>${cur?`<button type="button" class="vbtn" data-vact="rename">Rename</button><button type="button" class="vbtn vdel" data-vact="delete">Delete</button>`:''}`;
   const on=lays.querySelector('[aria-pressed="true"]');if(on)on.scrollIntoView({block:'nearest',inline:'nearest'})},
  lift:(s,y)=>{const el=card.querySelector('.vlift');if(el){el.textContent=y>.02?`Lifted ${len(y)}`:'On the floor';el.dataset.up=y>.02}const f=card.querySelector('[data-vact="floor"]');if(f)f.hidden=!(y>.02)},
  select:(s,y=0)=>{if(!s){card.hidden=true;hint.hidden=false;return}hint.hidden=true;const others=projsOf(s).filter(p=>p.id!==pid);
   card.innerHTML=`<div class="vthumb" style="${photo(s)}" role="img" aria-label="Scan of ${s.name}"></div><div class="vtext"><span class="tag">${s.tag}</span><b>${s.name}</b><span class="vplace">${s.place}${others.length?' · also in '+others.map(p=>p.name).join(', '):''}</span><span class="vdims">${dims(s)} · ${area(s)} · <span class="vlift"></span></span></div>
   <div class="vacts"><button type="button" class="btn vopen" data-go="s:${s.id}">Open space →</button><button type="button" class="vbtn" data-vact="rotate">Rotate 90°</button><button type="button" class="vbtn" data-vact="floor" hidden>Drop to floor</button><button type="button" class="vbtn" data-vact="remove" data-sid="${s.id}">Remove from project</button><button type="button" class="vx" data-vact="close" aria-label="Close">×</button></div>`;
   ui.lift(s,y);if(card.hidden){card.hidden=false;anim(card,[{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'none'}],{duration:240,easing:'cubic-bezier(.2,.8,.2,1)'})}}};
 ui.layouts();
 if(!items.length){$('#vstage').insertAdjacentHTML('afterbegin',`<div class="vmsg">No spaces in ${P.name} yet. Tap the bookmark on any space and save it here.</div>`);return}
 m.querySelector('.vtools').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  if(b.dataset.move){VMOVE=b.dataset.move;m.querySelectorAll('[data-move]').forEach(x=>x.setAttribute('aria-pressed',x===b));return}
  if(b.dataset.look){VLOOK=b.dataset.look;ls.set('rb-look',VLOOK);m.querySelectorAll('[data-look]').forEach(x=>x.setAttribute('aria-pressed',x===b));if(VAULT_API)VAULT_API.look();return}
  if(!VAULT_API)return;const a=b.dataset.vact,st=vl(pid);
  if(b.dataset.lay){if(b.dataset.lay!==st.active)VAULT_API.arrange(b.dataset.lay)}
  else if(a==='frame')VAULT_API.frame();
  else if(a==='newlayout')VAULT_API.newLayout();
  else if(a==='delete'){if(!confirmDel){confirmDel=true;b.textContent='Delete layout?';b.classList.add('arm');return}const c=st.custom.find(l=>l.id===st.active);st.custom=st.custom.filter(l=>l!==c);toast(`Deleted ${c.name}`);VAULT_API.arrange('size')}
  else if(a==='rename'){const btn=lays.querySelector(`[data-lay="${st.active}"]`),c=st.custom.find(l=>l.id===st.active);if(!btn||!c)return;
   const inp=document.createElement('input');inp.className='vrename';inp.value=c.name;inp.maxLength=32;inp.setAttribute('aria-label','Layout name');btn.replaceWith(inp);inp.focus();inp.select();
   const done=ok=>{if(ok&&inp.value.trim())c.name=inp.value.trim();saveVL();ui.layouts()};inp.addEventListener('keydown',e=>{if(e.key==='Enter')done(true);if(e.key==='Escape')done(false)});inp.addEventListener('blur',()=>done(true))}});
 card.addEventListener('click',e=>{const b=e.target.closest('[data-vact]');if(!b||!VAULT_API)return;const a=b.dataset.vact;
  if(a==='rotate')VAULT_API.rotate();else if(a==='floor')VAULT_API.floor();else if(a==='close')VAULT_API.select(null);
  else if(a==='remove'){MEM[pid].delete(b.dataset.sid);persistMem();toast(`Removed from ${P.name}`);refreshSaved(b.dataset.sid)}});
 mountVault($('#vstage'),ui,pid).then(api=>{if(api&&CUR==='v:'+pid)VAULT_API=api;else if(api)api.stop()})}
document.head.insertAdjacentHTML('beforeend',`<style>
.bm{position:absolute;top:8px;right:8px;width:32px;height:32px;display:grid;place-items:center;border-radius:var(--chip-radius);background:var(--surface);color:var(--fg);cursor:pointer;box-shadow:0 1px 5px rgba(0,0,0,.18);z-index:1}
.bm svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linejoin:round}
.bm[aria-pressed="true"]{color:var(--accent)}.bm[aria-pressed="true"] svg{fill:currentColor}
.bm:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.row .bm{position:static;box-shadow:none;background:none;width:28px;height:28px}
.rt{display:flex;align-items:center;gap:6px;justify-content:flex-end}
.chip.vault .vc{display:inline-block;min-width:18px;margin-left:6px;padding:1px 5px;border-radius:999px;background:var(--accent);color:var(--on-accent);font-size:11px;text-align:center;font-variant-numeric:tabular-nums}
.chip.vault.on .vc{background:var(--bg);color:var(--fg)}
.vtools{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:12px 0}
.vseg{display:flex;align-items:center;gap:2px;padding:2px;border:1px solid var(--line);border-radius:var(--chip-radius);background:var(--surface);overflow-x:auto;max-width:100%}
.vseg-l{font:11px var(--font-data);color:var(--muted);padding:0 6px 0 8px;white-space:nowrap}
.vseg button,.vbtn{font:500 13px var(--font-body);border:0;background:none;color:var(--fg);padding:7px 12px;border-radius:var(--chip-radius);cursor:pointer;white-space:nowrap}
.vseg button[aria-pressed="true"]{background:var(--accent);color:var(--on-accent)}
.vbtn{border:1px solid var(--line);background:var(--surface)}
.vbtn[data-save]{color:var(--muted)}
.vseg button:focus-visible,.vbtn:focus-visible,.vx:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
.vnote{font:12px var(--font-data);color:var(--muted)}
.vstage{position:relative;height:clamp(420px,66vh,740px);border-radius:var(--radius);border:1px solid var(--line);background:var(--surface);overflow:hidden;touch-action:none;cursor:grab}
.vstage.dragging{cursor:grabbing}
.vstage.rothot,.vstage.rotating{cursor:alias}
.vrot{position:absolute;left:0;top:0;z-index:2;display:flex;align-items:center;gap:4px;height:28px;min-width:28px;padding:0 5px;border-radius:999px;background:var(--surface);color:var(--fg);border:1.5px solid var(--fg);box-shadow:0 2px 8px rgba(0,0,0,.2);pointer-events:none;font:600 11px var(--font-data);font-variant-numeric:tabular-nums}
.vrot svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.vrot span:empty{display:none}.vrot.deg{background:var(--fg);color:var(--bg)}
.vstage canvas{display:block;width:100%;height:100%}
.vmsg{position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:24px;color:var(--muted);font:14px var(--font-body)}
.vlabels{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.vlabel{position:absolute;left:0;top:0;white-space:nowrap;font:600 11px/1.25 var(--font-body);color:var(--fg);background:color-mix(in srgb,var(--surface) 82%,transparent);padding:3px 6px;border-radius:calc(var(--radius) / 3);text-align:center}
.vlabel span{display:none;font:500 10.5px var(--font-data);color:var(--muted)}
.vlabel.on{outline:1.5px solid var(--fg);z-index:2}.vlabel.on span{display:block}
.vhint{position:absolute;left:10px;bottom:8px;right:10px;font:11px var(--font-data);color:var(--muted);pointer-events:none}
.vcard{position:absolute;left:10px;right:10px;bottom:10px;z-index:3;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);box-shadow:0 10px 30px -12px rgba(0,0,0,.35);padding:10px;display:grid;grid-template-columns:72px minmax(0,1fr);gap:8px 12px;align-items:center;cursor:default;touch-action:auto}
.vthumb{width:72px;height:72px;border-radius:calc(var(--radius) / 2);max-width:100%}
.vtext{display:grid;gap:2px;min-width:0}
.vtext .tag{justify-self:start}
.vtext b{font:var(--h-weight,400) 17px/1.2 var(--font-display);text-transform:var(--card-transform,none);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vplace{font-size:12.5px;color:var(--muted)}
.vdims{font:12px var(--font-data);font-variant-numeric:tabular-nums}
.vlift[data-up="true"]{color:var(--accent);font-weight:600}
.vacts{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.vopen{padding:8px 14px;font-size:13.5px}
.vx{margin-left:auto;border:0;background:none;color:var(--muted);font-size:22px;line-height:1;width:32px;height:32px;cursor:pointer;border-radius:var(--chip-radius)}
@media(min-width:720px){.vcard{left:auto;width:min(460px,calc(100% - 20px))}}
.vfoot{display:flex;flex-wrap:wrap;gap:8px 16px;justify-content:space-between;align-items:center;margin-top:10px}
.vprojects{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(300px,100%),1fr));gap:14px;margin-top:14px}
.vproj{background:var(--surface);border-radius:var(--radius);overflow:hidden;display:grid;border-top:5px solid var(--pc,var(--line))}
.vp-plan{height:170px;padding:10px;background:color-mix(in srgb,var(--pc,var(--fg)) 5%,var(--surface));border-bottom:1px solid var(--line)}
.vp-plan svg{width:100%;height:100%;display:block}
.vp-empty{height:100%;display:grid;place-items:center;color:var(--muted);font-size:13px}
.vp-t{display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:12px 14px 4px}
.vp-t b{font:700 17px var(--font-display);letter-spacing:-.01em;display:flex;align-items:center;gap:8px}
.vp-t b i{width:10px;height:10px;border-radius:3px;background:var(--pc)}
.vp-t span{font-size:12.5px;color:var(--muted);white-space:nowrap}
.vp-l{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;padding:4px 14px 14px;font-size:12.5px;color:var(--muted)}
.vp-cur{font-weight:600;color:var(--fg);padding:3px 9px;border-radius:999px;background:var(--hover)}
.vp-go{margin-left:auto;color:var(--fg);font-weight:600}
.vnew{border-top-color:var(--line);border:1px dashed var(--line);border-top:5px solid var(--line);padding:16px;gap:8px;align-content:start}
.vnew b{font:700 17px var(--font-display)}.vnew>span{color:var(--muted);font-size:13px}
.vnew-r{display:flex;gap:8px;margin-top:6px}.vnew-r input{flex:1;min-width:0;font:16px var(--font-body);padding:9px 12px;border:1px solid var(--line);border-radius:var(--field-radius);background:var(--bg);color:var(--fg)}
.pdot{display:inline-block;width:.42em;height:.42em;border-radius:.1em;margin-right:.3em;vertical-align:.12em}
.vlays{max-width:100%}.vsep{width:1px;align-self:stretch;background:var(--line);margin:4px 4px}
.vlay-acts{display:flex;gap:6px;flex-wrap:wrap}
.vdel.arm{border-color:#dc2626;color:#dc2626}
.vrename{font:500 13px var(--font-body);width:9em;padding:6px 10px;border:1px solid var(--accent);border-radius:var(--chip-radius);background:var(--bg);color:var(--fg)}
.savepop{position:fixed;z-index:50;background:var(--surface);border:1px solid var(--line);border-radius:14px;box-shadow:0 18px 40px -16px rgba(0,0,0,.45);padding:10px;display:grid;gap:6px}
.sp-h{font:600 11px var(--font-data);letter-spacing:.1em;text-transform:uppercase;color:var(--muted);padding:2px 6px}
.sp-list{display:grid;gap:2px;max-height:240px;overflow:auto}
.sp-item{display:grid;grid-template-columns:12px minmax(0,1fr) auto 18px;gap:10px;align-items:center;text-align:left;border:0;background:none;color:var(--fg);font:500 14px var(--font-body);padding:9px 8px;border-radius:9px;cursor:pointer}
.sp-item:hover{background:var(--hover)}.sp-item:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
.sp-item i{width:12px;height:12px;border-radius:3px}.sp-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sp-n{font:12px var(--font-data);color:var(--muted)}.sp-ck{opacity:0;font-weight:700;color:var(--fg)}
.sp-item[aria-pressed="true"]{background:var(--hover)}.sp-item[aria-pressed="true"] .sp-ck{opacity:1}
.sp-new{display:flex;gap:6px;border-top:1px solid var(--line);padding-top:8px}
.sp-new input{flex:1;min-width:0;font:15px var(--font-body);padding:8px 10px;border:1px solid var(--line);border-radius:9px;background:var(--bg);color:var(--fg)}
.sp-new button{border:0;border-radius:9px;background:var(--accent);color:var(--on-accent);font:600 13px var(--font-body);padding:0 12px;cursor:pointer}
#toast{position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 22px);transform:translate(-50%,20px);opacity:0;pointer-events:none;z-index:60;background:var(--fg);color:var(--bg);font:500 13.5px var(--font-body);padding:10px 16px;border-radius:999px;transition:opacity .2s,transform .2s;white-space:nowrap}
#toast.on{opacity:1;transform:translate(-50%,0)}
.pchip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);background:var(--bg);color:var(--fg);border-radius:999px;padding:5px 11px;font:500 13px var(--font-body);cursor:pointer}
.pchip i{width:8px;height:8px;border-radius:50%;background:var(--pc)}
.inproj{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.vfall{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-top:12px}
.vlegend{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:12.5px;color:var(--muted)}
.vlegend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:6px;vertical-align:-1px}
.vlegend i.other{background:var(--muted)}.vlegend i.door{background:var(--accent)}
</style>`);
