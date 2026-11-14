/* ---------- Roomboard app: cards for the three view modes, similar-spaces feed, screens, boot ---------- */
setModeAttr();
/* Projects bar: pulldown of every project (tick which show as pills), the pills, and Create.
   Tap a pill to make it the active project (saved rooms go there). Double-tap to open it. */
const CHEV='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5.5 8l4.5 4.5L14.5 8"/></svg>';
const roomsN=id=>MEM[id]?MEM[id].size:0;
function pillsHTML(){const ps=PINNED.map(proj).filter(Boolean);
 return ps.length?ps.map(p=>`<button type="button" class="chip pill" data-pid="${p.id}" aria-pressed="${p.id===ACTIVE}" style="--pc:${p.color}" title="Tap to save rooms here. Double-tap to see its rooms."><i></i>${esc(p.name)}<span class="pn">${roomsN(p.id)}</span></button>`).join(''):'<span class="pempty">No projects shown. Tick some under Projects.</span>'}
function initNav(){$('#nav').innerHTML=`<button type="button" class="pdrop" aria-haspopup="dialog" aria-expanded="false">Projects${CHEV}</button><div class="pills" id="pills" role="group" aria-label="Shown projects"></div><button type="button" class="pcreate" aria-haspopup="dialog">+ Create</button>`;renderNav();
 let last={pid:null,t:0};
 $('#nav').addEventListener('click',e=>{const pill=e.target.closest('.pill');
  if(pill){const pid=pill.dataset.pid,now=performance.now();if(last.pid===pid&&now-last.t<400){last={pid:null,t:0};go('p:'+pid);return}last={pid,t:now};if(pid!==ACTIVE)setActive(pid);return}
  const d=e.target.closest('.pdrop'),c=e.target.closest('.pcreate');if(d)openProjList(d);else if(c)openCreate(c)})}
function renderNav(){const pl=$('#pills');if(!pl)return;const sl=pl.scrollLeft;pl.innerHTML=pillsHTML();pl.scrollLeft=sl;const vc=$('.vaultbtn .vc');if(vc)vc.textContent=PROJECTS.length;hintTxt();markNav()}
function hintTxt(){const h=$('#phint'),p=proj(ACTIVE);if(!h)return;h.innerHTML=p?`Rooms you save go to <b style="--pc:${p.color}"><i></i>${esc(p.name)}</b>. Tap a project to switch, double-tap to see its rooms.`:'Create a project to start saving rooms.'}
function markNav(){const [v,id]=CUR.split(':'),vb=$('.vaultbtn');if(vb)vb.classList.toggle('on',v==='vault'||v==='v');document.querySelectorAll('.pill').forEach(b=>b.classList.toggle('open',v==='p'&&b.dataset.pid===id))}
function setActive(pid){ACTIVE=pid;savePins();document.querySelectorAll('.pill').forEach(b=>b.setAttribute('aria-pressed',b.dataset.pid===pid));hintTxt();refreshBms();const sel=$('form.cap select[name="project"]');if(sel)sel.value=pid}
/* Small popovers anchored under a bar button; they scroll with the page */
let NPOP=null;
function closeNPop(){if(!NPOP)return;NPOP.a.setAttribute('aria-expanded','false');NPOP.el.remove();NPOP=null;document.removeEventListener('pointerdown',npOut,true)}
function npOut(e){if(NPOP&&!NPOP.el.contains(e.target)&&!NPOP.a.contains(e.target))closeNPop()}
function openNPop(a,cls,label,html,bind){const was=NPOP&&NPOP.a===a;closeNPop();if(was)return;closeSave();
 const el=document.createElement('div');el.className='savepop npop '+cls;el.setAttribute('role','dialog');el.setAttribute('aria-label',label);el.innerHTML=html;document.body.append(el);NPOP={el,a};a.setAttribute('aria-expanded','true');
 const r=a.getBoundingClientRect(),pw=Math.min(300,innerWidth-24),left=Math.min(Math.max(12,r.left),innerWidth-pw-12);
 Object.assign(el.style,{left:(left+scrollX)+'px',top:(r.bottom+8+scrollY)+'px',width:pw+'px'});anim(el,[{opacity:0,transform:'translateY(-6px) scale(.98)'},{opacity:1,transform:'none'}],{duration:180,easing:'ease-out'});
 el.addEventListener('keydown',e=>{if(e.key==='Escape'){closeNPop();a.focus()}});bind(el);setTimeout(()=>document.addEventListener('pointerdown',npOut,true))}
function openProjList(a){openNPop(a,'plist','Your projects',`<div class="sp-h">Show on the landing page</div><div class="sp-list">${PROJECTS.map(p=>`<div class="pl-row"><label class="pl-item"><input type="checkbox" data-pin="${p.id}" ${PINNED.includes(p.id)?'checked':''}><i style="background:${p.color}"></i><span class="sp-name">${esc(p.name)}${p.id===ACTIVE?' <em>active</em>':''}</span><span class="sp-n">${roomsN(p.id)}</span></label><button type="button" class="pl-open" data-open="${p.id}">Open</button></div>`).join('')}</div><div class="pl-foot"><button type="button" data-all="1">Show all</button><button type="button" data-all="0">Hide all</button></div>`,el=>{
 el.addEventListener('change',e=>{const id=e.target.dataset.pin;if(!id)return;PINNED=e.target.checked?PROJECTS.map(p=>p.id).filter(x=>x===id||PINNED.includes(x)):PINNED.filter(x=>x!==id);savePins();renderNav()});
 el.addEventListener('click',e=>{const o=e.target.closest('[data-open]');if(o){closeNPop();setActive(o.dataset.open);go('p:'+o.dataset.open);return}
  const al=e.target.closest('[data-all]');if(al){const on=al.dataset.all==='1';PINNED=on?PROJECTS.map(p=>p.id):[];savePins();el.querySelectorAll('[data-pin]').forEach(c=>c.checked=on);renderNav()}});
 const f=el.querySelector('input');if(f)f.focus({preventScroll:true})})}
function openCreate(a){openNPop(a,'pnew','Create a project',`<div class="sp-h">New project</div><form class="sp-new"><input placeholder="Project name" maxlength="40" aria-label="Project name" autocomplete="off"><button type="submit">Create</button></form><p class="pl-note">It becomes the active project, so the rooms you save next go here.</p>`,el=>{
 const i=el.querySelector('input');i.focus({preventScroll:true});
 el.addEventListener('submit',e=>{e.preventDefault();const v=i.value.trim();if(!v){i.focus();return}const p=newProject(v);closeNPop();setActive(p.id);toast(`Created ${p.name}`);const b=$(`.pill[data-pid="${p.id}"]`);if(b)b.scrollIntoView({block:'nearest',inline:'nearest'})})})}
initNav();
const pcol=s=>{const p=projOf(s);return p?`--pc:${p.color}`:''};
const sheetNo=s=>{const p=projOf(s);if(!p)return s.by?'X-'+(101+COMMUNITY.indexOf(s)):'U-101';return p.name.trim()[0].toUpperCase()+'-'+(101+inProject(p.id).indexOf(s))};
const scaleTxt=s=>{const x=Math.max(s.w,s.d);return x<4?'1:50':x<8?'1:100':'1:200'};
const whyTag=w=>w?`<span class="why">${w}</span>`:'';
const pin=(s,w)=>`<a class="card pin" href="#" data-go="s:${s.id}" style="${pcol(s)}"><div class="ph" style="aspect-ratio:${Math.min(1.5,Math.max(.7,s.d/s.w)).toFixed(2)};${photo(s)}"><div class="mini">${plan(s,{size:40,pad:4,sw:1.4})}</div>${bm(s)}</div><div class="cap"><b>${s.name}</b><span class="meta">${s.place} · ${area(s)}</span>${w?whyTag(w):`<span class="tag">${s.tag}</span>`}</div></a>`;
const row=(s,i,w)=>`<a class="card row" href="#" data-go="s:${s.id}"><span class="n">${String(i+1).padStart(3,'0')}</span><span class="th">${plan(s,{size:44,pad:4,sw:1.2})}</span><span><b>${s.name}</b><span class="sub">${s.place} · ${area(s)}</span>${whyTag(w)}</span><span class="w">${s.place}</span><span class="w d">${lenBare(s.w)} × ${lenBare(s.d)} × ${lenBare(s.h)}</span><span class="w d">${area(s)}</span><span class="rt"><span class="tag">${s.tag}</span>${bm(s)}</span></a>`;
const sheet=(s,w)=>`<a class="card sheet" href="#" data-go="s:${s.id}"><div class="draw">${plan(s,{size:120,pad:16,sw:1.3,dims:true})}<div class="ph" style="${photo(s)}"></div><span class="scale">${scaleTxt(s)} · H ${lenBare(s.h)}</span>${bm(s)}</div><div class="tb"><div><b>${s.name}</b><span>${s.place} · ${area(s)}</span>${whyTag(w)}</div><div><span class="no">${sheetNo(s)}</span></div></div></a>`;
const card=(s,i,w)=>MODE==='index'?row(s,i,w):MODE==='plans'?sheet(s,w):pin(s,w);
const ihead=`<div class="ihead"><span>No.</span><span>Plan</span><span>Space</span><span class="w">Place</span><span class="w">W × D × H</span><span class="w">Area</span><span>Type</span></div>`;

/* More like this: similar size (long, short, height) or similar feel (light, colour, proportion, type) */
const lg=Math.log,dims3=s=>[Math.max(s.w,s.d),Math.min(s.w,s.d),s.h];
function sizeScore(a,b){const [L1,S1,H1]=dims3(a),[L2,S2,H2]=dims3(b);return Math.abs(lg(L1/L2))+Math.abs(lg(S1/S2))+.6*Math.abs(lg(H1/H2))+(a.tag===b.tag?0:.15)}
const warmth=h=>h<=55||h>=320?'warm':h>=165&&h<=265?'cool':'neutral';
const shape=s=>{const [L,S,H]=dims3(s),r=L/S,t=H/S;return [r>1.7?'long':r<1.2?'square':'',t>.95?'tall':t<.5?'low':''].filter(Boolean)};
const shared=(a,b)=>(a.keywords||[]).filter(k=>(b.keywords||[]).includes(k));
const jac=(a,b)=>{const u=new Set([...(a.keywords||[]),...(b.keywords||[])]);return u.size?shared(a,b).length/u.size:0};
function feelScore(a,b){const dh=Math.min(Math.abs(a.hue-b.hue),360-Math.abs(a.hue-b.hue))/180,[L1,S1,H1]=dims3(a),[L2,S2,H2]=dims3(b);
 return .55*dh+.3*Math.abs(lg((L1/S1)/(L2/S2)))+.25*Math.abs(lg((H1/S1)/(H2/S2)))+(a.tag===b.tag?0:.25)-.6*jac(a,b)}
function similar(s,kind){const pool=ALL().filter(x=>x.id!==s.id),f=kind==='size'?sizeScore:feelScore;
 return pool.map(x=>({x,d:f(s,x)})).sort((a,b)=>a.d-b.d).slice(0,48)}
function whyText(s,x,d,kind){const pct=Math.max(1,Math.round(100*Math.exp(-d*(kind==='size'?1.6:2.2))));
 if(kind==='size')return `${pct}% size match · ${lenBare(Math.max(x.w,x.d))} × ${lenBare(Math.min(x.w,x.d))}`;
 const sh=shared(s,x);if(sh.length)return `${Math.min(99,pct)}% feel match · both: ${sh.slice(0,2).join(', ')}`;const words=[warmth(x.hue)==='neutral'?'':warmth(x.hue)+' light',...shape(x)].filter(Boolean);return `${Math.min(99,pct)}% feel match${words.length?' · '+words.slice(0,2).join(', '):''}`}
let SIMKIND='size';
const moreLike=s=>`<section class="more" aria-label="More like this"><div class="more-h"><h3>More like this</h3><div class="more-c"><div class="mtabs" role="group" aria-label="Match by">
 <button type="button" data-sim="size" aria-pressed="${SIMKIND==='size'}">Similar size</button><button type="button" data-sim="feel" aria-pressed="${SIMKIND==='feel'}">Similar feel</button></div>
 <div class="fmode" role="group" aria-label="View">${MODES.map(([k,l,ic])=>`<button type="button" data-mode="${k}" aria-pressed="${MODE===k}" aria-label="${l} view" title="${l}">${ic}</button>`).join('')}</div></div></div>
 <p class="more-note" id="simnote"></p>${ihead}<div class="feed" id="sim"></div></section>`;
function bindMore(s){const sec=$('.more'),note=$('#simnote');let WHY=new Map();
 const list=k=>{const r=similar(s,k);WHY=new Map(r.map(({x,d})=>[x.id,whyText(s,x,d,k)]));return r.map(o=>o.x)};
 const noteTxt=k=>{note.textContent=k==='size'?`Spaces closest to ${lenBare(Math.max(s.w,s.d))} × ${lenBare(Math.min(s.w,s.d))} with a ${len(s.h)} ceiling, ranked by long side, short side and height.`:'Spaces with shared highlights from the narration, similar light and colour in the scan, similar proportions, and the same type.'};
 noteTxt(SIMKIND);const F=feed($('#sim'),list(SIMKIND),(x,i)=>card(x,i,WHY.get(x.id)));
 sec.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  if(b.dataset.sim&&b.dataset.sim!==SIMKIND){SIMKIND=b.dataset.sim;sec.querySelectorAll('[data-sim]').forEach(x=>x.setAttribute('aria-pressed',x===b));noteTxt(SIMKIND);F.set(list(SIMKIND))}
  else if(b.dataset.mode&&b.dataset.mode!==MODE){MODE=b.dataset.mode;try{localStorage.setItem('sp-mode',MODE)}catch(e){}sec.querySelectorAll('.fmode button').forEach(x=>x.setAttribute('aria-pressed',x===b));F.restyle(()=>setModeAttr())}})}
/* Search: free text over name, place, type and highlights, plus keyword and place tokens picked from Browse */
const MOODS=new Set(['airy','generous','echoey','lively','grand','intimate','cozy','quiet','calm','tucked away','buzzy','smells of butter']);
const MAT_RE=/floor|walls|brick|concrete|timber|tile|marble|oak|plaster|velvet|linen|cork|brass|limewash|stone|terrazzo|rug|carpet|wool|wood/;
const kwCat=k=>/\b(sun|light)$|candle|dim and|daylight|skylight/.test(k)?'light':MAT_RE.test(k)?'materials':MOODS.has(k)?'mood':'features';
const CATS=[['light','Light'],['materials','Materials'],['mood','Mood'],['features','Features'],['places','Places']];
let BCAT=null;
const countBy=f=>{const m=new Map();ALL().forEach(s=>[].concat(f(s)).forEach(k=>m.set(k,(m.get(k)||0)+1)));return [...m].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))};
function chipsFor(cat){return cat==='places'?countBy(s=>s.place).map(([v,n])=>({k:'place',v,n})):countBy(s=>s.keywords||[]).filter(([k])=>kwCat(k)===cat).map(([v,n])=>({k:'kw',v,n}))}
function suggest(q){q=q.toLowerCase();return countBy(s=>s.keywords||[]).filter(([k])=>k.includes(q)).slice(0,12).map(([v,n])=>({k:'kw',v,n})).concat(countBy(s=>s.place).filter(([p])=>p.toLowerCase().includes(q)).slice(0,4).map(([v,n])=>({k:'place',v,n})))}
const hasTok=(k,v)=>FILT.toks.some(t=>t.k===k&&t.v===v);
function searchMatch(s){for(const t of FILT.toks){if(t.k==='kw'&&!(s.keywords||[]).includes(t.v))return false;if(t.k==='place'&&s.place!==t.v)return false}
 const q=FILT.q.trim().toLowerCase();if(!q)return true;const hay=[s.name,s.place,s.tag,...(s.keywords||[])].join(' · ').toLowerCase();
 return q.split(/\s+/).every(w=>hay.includes(w)||(w.length>3&&w.endsWith('s')&&hay.includes(w.slice(0,-1))))}
const MAG='<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5"/><path d="M12.6 12.6l4.4 4.4"/></svg>';
const SCAN='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 7V4.5A1.5 1.5 0 0 1 4.5 3H7M13 3h2.5A1.5 1.5 0 0 1 17 4.5V7M17 13v2.5a1.5 1.5 0 0 1-1.5 1.5H13M7 17H4.5A1.5 1.5 0 0 1 3 15.5V13"/><path d="M6.5 7.5h7v5h-7z"/></svg>';
const toksHTML=()=>FILT.toks.map((t,i)=>`<button type="button" class="tok" data-rm="${i}" aria-label="Remove ${esc(t.v)}">${t.k==='place'?'in ':''}${esc(t.v)}<span aria-hidden="true">×</span></button>`).join('');
const kwChip=c=>`<button type="button" class="kwc" data-tk="${c.k}" data-tv="${esc(c.v)}" aria-pressed="${hasTok(c.k,c.v)}">${esc(c.v)}<span>${c.n}</span></button>`;
function findBar(){return `<div class="find"><div class="frow2"><div class="search" id="search" role="search">${MAG}<span class="toks" id="toks"></span><input id="q" type="search" enterkeyhint="search" value="${esc(FILT.q)}" aria-label="Search spaces" autocomplete="off"><button type="button" class="sclear" aria-label="Clear search">×</button></div>
 <button type="button" class="btn capbtn" data-go="capture">${SCAN}Capture a room</button></div>
 <div class="browse"><span class="b-l">Browse</span><div class="bcats" role="group" aria-label="Browse by category">${CATS.map(([k,l])=>`<button type="button" class="bcat" data-cat="${k}" aria-pressed="false">${l}</button>`).join('')}</div></div><div class="bkw" id="bkw" hidden></div></div>`}
function bindFind(F){const box=$('.find'),q=$('#q'),bkw=$('#bkw');let tm;
 const draw=()=>{$('#toks').innerHTML=toksHTML();q.placeholder=FILT.toks.length?'Add another keyword':'Search keywords, places, types';box.querySelector('.sclear').hidden=!(FILT.q||FILT.toks.length);
  const typed=FILT.q.trim(),list=typed?suggest(typed):BCAT?chipsFor(BCAT):null;bkw.hidden=!list;
  if(list)bkw.innerHTML=(typed?'<span class="bk-l">Matching</span>':'')+(list.length?list.map(kwChip).join(''):'<span class="bk-none">No keyword matches. The text search still applies.</span>');
  box.querySelectorAll('.bcat').forEach(b=>b.setAttribute('aria-pressed',!typed&&b.dataset.cat===BCAT))};
 const run=()=>{clearTimeout(tm);F.apply()};
 draw();
 q.addEventListener('input',()=>{FILT.q=q.value;draw();clearTimeout(tm);tm=setTimeout(F.apply,250)});
 q.addEventListener('keydown',e=>{if(e.key==='Backspace'&&!q.value&&FILT.toks.length){FILT.toks.pop();draw();run()}else if(e.key==='Enter'){e.preventDefault();run()}else if(e.key==='Escape'&&q.value){FILT.q='';q.value='';draw();run()}});
 box.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  if(b.dataset.cat){const typed=FILT.q.trim();BCAT=BCAT===b.dataset.cat&&!typed?null:b.dataset.cat;if(typed){FILT.q='';q.value='';run()}draw()}
  else if(b.dataset.tk){const k=b.dataset.tk,v=b.dataset.tv;if(hasTok(k,v))FILT.toks=FILT.toks.filter(t=>!(t.k===k&&t.v===v));else{if(k==='place')FILT.toks=FILT.toks.filter(t=>t.k!=='place');FILT.toks.push({k,v})}
   if(FILT.q.trim()){FILT.q='';q.value=''}draw();run()}
  else if(b.dataset.rm!=null){FILT.toks.splice(+b.dataset.rm,1);draw();run();q.focus()}
  else if(b.classList.contains('sclear')){FILT.q='';FILT.toks=[];q.value='';draw();run();q.focus()}});
 $('#search').addEventListener('click',e=>{if(!e.target.closest('button'))q.focus()})}
const VIEWS={
 feed(m){m.innerHTML=`<p class="intro">Find a room to build around.</p><p class="lede">Rooms people loved, with their real size, height and doors. Search by keyword, browse by category, or capture one of your own.</p>${findBar()}${filterBar()}${ihead}<div class="feed" id="g"></div>`;bindFind(filteredFeed($('#g'),ALL(),card,{search:true}))},
 project(m,p){const ss=inProject(p.id);m.innerHTML=`<button class="back" data-go="feed">← Find a room</button><p class="intro"><span class="pdot" style="background:${p.color}"></span>${esc(p.name)}</p><p class="lede">${p.note?p.note+' ':''}${ss.length} spaces, ${totalArea(ss)} collected.</p><div class="btns" style="margin:4px 0 6px"><button class="btn" data-go="v:${p.id}">Open in Vault →</button></div>${filterBar()}${ihead}<div class="feed" id="g"></div>`;filteredFeed($('#g'),ss,card)},
 space(m,s){m.innerHTML=`<button class="back" data-go="back">← Back</button><div class="detail"><div class="hero" style="${photo(s)}"></div>
 <div class="info"><span class="eyebrow">${s.tag} · sheet ${sheetNo(s)}</span><h2>${s.name}</h2><p class="meta">${s.place} · ${savedTxt(s)}</p>
 <dl class="facts"><div><dt>Width</dt><dd>${len(s.w)}</dd></div><div><dt>Depth</dt><dd>${len(s.d)}</dd></div><div><dt>Height</dt><dd>${len(s.h)}</dd></div><div><dt>Floor area</dt><dd>${area(s)}</dd></div><div><dt>Volume</dt><dd>${volume(s)}</dd></div><div><dt>Doors</dt><dd>${s.doors.length}</dd></div></dl>
 ${s.keywords&&s.keywords.length?`<div class="hl"><div class="hl-h"><span class="eyebrow">Highlights</span><span class="hl-src">From the scan narration</span></div><ul class="kw">${s.keywords.map(k=>`<li>${k}</li>`).join('')}</ul></div>`:''}
 <div class="hl"><div class="hl-h"><span class="eyebrow">In projects</span></div><div class="inproj" id="inprojects" data-sid="${s.id}">${projChips(s)}</div></div>
 <div class="btns"><button class="btn" data-save="${s.id}" aria-pressed="${inAny(s.id)}" aria-haspopup="dialog"><span class="s-lbl">${saveLabel(s.id)}</span></button></div></div>
 <div class="pane"><small>Plan · ${scaleTxt(s)}</small><div class="planbig">${plan(s,{size:200,pad:26,dims:true})}</div></div><div class="pane"><small>Volume</small>${box3d(s)}</div></div>${moreLike(s)}`;bindMore(s)},
 vault(m){vaultView(m)},
 vproject(m,p){vaultProjectView(m,p)},
 capture(m){m.innerHTML=`<button class="back" data-go="back">← Back</button><p class="intro">Capture a space</p>${captureForm()}`}};

boot();
