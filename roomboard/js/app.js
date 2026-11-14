/* ---------- Roomboard app: cards for the three view modes, similar-spaces feed, screens, boot ---------- */
setModeAttr();
function renderNav(){const nav=$('#nav');nav.innerHTML='<button class="chip" data-go="feed">Inspiration</button>'+PROJECTS.map(p=>`<button class="chip" data-go="p:${p.id}" style="--pc:${p.color}"><i></i>${p.name}</button>`).join('')+'<button class="chip vault" data-go="vault">Vault<span class="vc">'+PROJECTS.length+'</span></button><button class="chip add" data-go="capture">+ Capture</button>';
 nav.querySelectorAll('[data-go]').forEach(a=>a.classList.toggle('on',a.dataset.go===CUR||(CUR.startsWith('v:')&&a.dataset.go==='vault')))}
renderNav();
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
const VIEWS={
 feed(m){m.innerHTML=`<p class="intro">Find a room to build around.</p><p class="lede">Rooms people loved, with their real size, height and doors. Filter by type or size, switch views, or keep scrolling.</p>${filterBar()}${ihead}<div class="feed" id="g"></div>`;filteredFeed($('#g'),ALL(),card)},
 project(m,p){const ss=inProject(p.id);m.innerHTML=`<p class="intro"><span class="pdot" style="background:${p.color}"></span>${p.name}</p><p class="lede">${p.note?p.note+' ':''}${ss.length} spaces, ${totalArea(ss)} collected.</p><div class="btns" style="margin:4px 0 6px"><button class="btn" data-go="v:${p.id}">Open in Vault →</button></div>${filterBar()}${ihead}<div class="feed" id="g"></div>`;filteredFeed($('#g'),ss,card)},
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
