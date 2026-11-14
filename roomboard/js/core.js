/* ---------- Spatial Pinterest: shared core (data, units, filter, animated feed, plan, 3D box, router) ---------- */
const PROJECTS=[
 {id:'cafe',name:'Cafe idea',note:'A 40-seat counter cafe. Collecting rooms that feel generous but small.',color:'#c2410c'},
 {id:'living',name:'Living room',note:'Rethinking the apartment around one really good room.',color:'#1d4ed8'},
 {id:'lounge',name:'Hotel lounges',note:'Lobby and lounge spaces for a hospitality proposal.',color:'#047857'}];
const SPACES=[
 {id:'s1',name:'Window counter',place:'Williamsburg, NY',project:'cafe',tag:'room',w:6.2,d:3.4,h:4.1,doors:[{wall:'S',pos:.8,w:1.1}],hue:30,saved:'Nov 12'},
 {id:'s2',name:'Long bar room',place:'Lisbon',project:'cafe',tag:'room',w:9.5,d:4.2,h:3.6,doors:[{wall:'W',pos:.5,w:1.2},{wall:'N',pos:.85,w:.9}],hue:22,saved:'Nov 10'},
 {id:'s3',name:'Courtyard entry',place:'Kyoto',project:'cafe',tag:'threshold',w:2.4,d:3.0,h:2.7,doors:[{wall:'S',pos:.5,w:1.4},{wall:'N',pos:.5,w:1.0}],hue:95,saved:'Nov 8'},
 {id:'s4',name:'Back booth nook',place:'Copenhagen',project:'cafe',tag:'room',w:3.6,d:2.8,h:2.6,doors:[{wall:'E',pos:.3,w:.9}],hue:18,saved:'Nov 6'},
 {id:'s5',name:'Pastry passage',place:'Paris',project:'cafe',tag:'corridor',w:1.6,d:7.2,h:3.2,doors:[{wall:'N',pos:.5,w:1.0},{wall:'S',pos:.5,w:1.0}],hue:40,saved:'Nov 3'},
 {id:'s6',name:'Sunken lounge',place:'Hudson Valley, NY',project:'living',tag:'room',w:5.8,d:5.2,h:3.0,doors:[{wall:'W',pos:.2,w:1.0}],hue:200,saved:'Nov 11'},
 {id:'s7',name:'Library wall',place:'Tribeca, NY',project:'living',tag:'room',w:7.0,d:4.4,h:3.4,doors:[{wall:'S',pos:.15,w:.9},{wall:'E',pos:.6,w:1.2}],hue:215,saved:'Nov 9'},
 {id:'s8',name:'Gallery hall',place:'Brooklyn, NY',project:'living',tag:'corridor',w:1.4,d:8.5,h:2.8,doors:[{wall:'N',pos:.5,w:.9},{wall:'E',pos:.7,w:.9}],hue:190,saved:'Nov 5'},
 {id:'s9',name:'Bedroom suite',place:'Las Vegas',project:'living',tag:'room',w:4.8,d:5.6,h:2.9,doors:[{wall:'N',pos:.8,w:.9},{wall:'W',pos:.75,w:.8}],hue:265,saved:'Nov 1'},
 {id:'s10',name:'Double-height lobby',place:'Mexico City',project:'lounge',tag:'room',w:12.0,d:9.0,h:7.2,doors:[{wall:'S',pos:.5,w:2.4},{wall:'N',pos:.2,w:1.2}],hue:140,saved:'Nov 7'},
 {id:'s11',name:'Fireplace lounge',place:'Stowe, VT',project:'lounge',tag:'room',w:8.4,d:6.0,h:3.8,doors:[{wall:'E',pos:.5,w:1.6}],hue:12,saved:'Nov 4'},
 {id:'s12',name:'Velvet vestibule',place:'London',project:'lounge',tag:'threshold',w:3.2,d:2.2,h:3.0,doors:[{wall:'S',pos:.5,w:1.2},{wall:'N',pos:.5,w:1.6}],hue:330,saved:'Oct 30'}];

/* Inspiration pool: ~240 deterministic sample spaces from other people, so the feed keeps going */
const COMMUNITY=(()=>{let seed=7;const r=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};const pick=a=>a[Math.floor(r()*a.length)];
 const ROOMS=['reading nook','galley kitchen','garden room','tea room','sky lounge','listening bar','glass porch','workshop','breakfast bay','attic study','record shop','studio loft','wine cellar','bath house','map room','sun room','dining hall','gallery room','music room','corner office','kids’ den','guest suite','bakery counter','noodle bar','bookshop','pottery studio','chapel','courtroom','reading room','pool hall'];
 const CORR=['arcade','cloister walk','stair landing','gallery hall','service passage','loggia','colonnade','enfilade','breezeway','long hall'];
 const THR=['vestibule','mud room','porch','foyer','gatehouse','airlock','genkan','courtyard entry','porte-cochère','lobby niche'];
 const ADJ=['Quiet','Sunlit','Narrow','Tall','Low','Corner','Hidden','Vaulted','Timber','Tiled','Whitewashed','Brick','Concrete','Velvet','Garden','North-light','Rooftop','Basement','Old','Round-window'];
 const PL=['Seoul','Oslo','Mexico City','Tokyo','Milan','Chicago','Boston','Hudson, NY','Marfa, TX','Porto','Berlin','Montreal','Kyoto','Lisbon','Copenhagen','Brooklyn, NY','Paris','London','Barcelona','Melbourne','Taipei','Charleston, SC','Santa Fe, NM','Vienna'];
 const out=[];for(let i=0;i<240;i++){const t=r(),tag=t<.7?'room':t<.85?'corridor':'threshold';let a,b,h;
  if(tag==='corridor'){a=1.1+r()*1.4;b=5+r()*9;h=2.5+r()*2}else if(tag==='threshold'){a=1.6+r()*1.6;b=a+r()*2;h=2.4+r()*1.4}else{a=2.4+r()*5;b=a*(1+r()*1.1);b=Math.min(b,15);h=r()<.06?5.5+r()*3:2.4+r()*2.2}
  const swap=r()<.5,w=swap?b:a,d=swap?a:b,base=tag==='room'?pick(ROOMS):tag==='corridor'?pick(CORR):pick(THR);
  const doors=[{wall:pick(['N','E','S','W']),pos:.25+r()*.5,w:.8+r()*.6}];if(r()<.45)doors.push({wall:pick(['N','E','S','W']),pos:.2+r()*.6,w:.8+r()*.4});
  out.push({id:'c'+i,name:pick(ADJ)+' '+base,place:pick(PL),project:null,tag,w:+w.toFixed(1),d:+d.toFixed(1),h:+h.toFixed(1),doors,hue:Math.floor(r()*360),saved:'',by:'community'})}
 return out})();


/* Highlights: keywords spoken during the scan, kept with the record */
const KW={s1:['morning sun','window counter','terrazzo floor','buzzy','tall ceiling'],s2:['long bar','dim and warm','dark timber','marble counter','lively'],
 s3:['courtyard view','gravel threshold','dappled light','quiet','timber screen'],s4:['banquette','low ceiling','intimate','candlelight','plaster walls'],
 s5:['glass display','narrow','warm light','tile floor','smells of butter'],s6:['sunken seating','north light','wool rug','calm','oak floor'],
 s7:['built-in shelves','library ladder','oak floor','quiet','reading light'],s8:['art wall','long view','white plaster','gallery light','echoey'],
 s9:['bay window','soft light','carpet','calm','walk-in closet'],s10:['double height','skylight','stone floor','generous','echoey'],
 s11:['fireplace','timber beams','cozy','wool throws','low light'],s12:['velvet walls','dim and warm','brass details','intimate','arched doorway']};
SPACES.forEach(s=>s.keywords=KW[s.id]||[]);
(()=>{let seed=91;const r=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296},pick=a=>a[Math.floor(r()*a.length)];
 const LW=['morning sun','afternoon sun','dim and warm','candlelight','golden light'],LC=['north light','skylight','soft daylight','clerestory light','even light'],LN=['dappled light','reading light','gallery light','soft light'];
 const MAT=['oak floor','terrazzo floor','exposed brick','plaster walls','polished concrete','tile floor','timber beams','stone floor','marble counter','linen curtains','velvet seating','cork walls','brass details','limewash walls'];
 const BIG=['airy','generous','echoey','lively','grand'],SMALL=['intimate','cozy','quiet','calm','tucked away'];
 const FEAT={reading:'built-in shelves',kitchen:'open shelving',garden:'view to garden',tea:'low table',lounge:'deep sofas',bar:'long bar',porch:'big windows',workshop:'workbench',bay:'bay window',study:'desk by window',shop:'display wall',loft:'high ceiling',cellar:'vaulted ceiling',bath:'tiled bath',map:'map table',sun:'big windows',dining:'long table',gallery:'art wall',music:'piano',office:'corner windows',den:'deep sofas',suite:'bay window',counter:'window counter',noodle:'counter seating',bookshop:'built-in shelves',pottery:'workbench',chapel:'arched windows',courtroom:'wood paneling',pool:'pendant lights',arcade:'columns',cloister:'courtyard view',landing:'stair view',hall:'long view',passage:'narrow',loggia:'open air',colonnade:'columns',enfilade:'aligned doors',breezeway:'cross breeze',vestibule:'double doors',mud:'bench and hooks',foyer:'coat nook',gatehouse:'heavy door',airlock:'double doors',genkan:'step up',entry:'courtyard view',lobby:'seating niche',niche:'seating niche','porte':'canopy'};
 COMMUNITY.forEach(s=>{const set=new Set(),h=s.hue,[L,S]=[Math.max(s.w,s.d),Math.min(s.w,s.d)];
  set.add(pick(h<=55||h>=320?LW:h>=165&&h<=265?LC:LN));const m1=pick(MAT);set.add(m1);if(r()<.6){const m2=pick(MAT.filter(m=>!(m1.includes('floor')&&m.includes('floor'))&&!(m1.includes('walls')&&m.includes('walls'))));set.add(m2)}
  set.add(pick(s.h/S>.9||L*S>45?BIG:SMALL));const k=Object.keys(FEAT).find(k=>s.name.toLowerCase().includes(k));if(k)set.add(FEAT[k]);
  if(s.h>4.5)set.add('high ceiling');else if(s.h<2.6)set.add('low ceiling');s.keywords=[...set].slice(0,5)})})();
const $=(s,el=document)=>el.querySelector(s);
const proj=id=>PROJECTS.find(p=>p.id===id);
const ALL=()=>SPACES.concat(COMMUNITY);
const space=id=>ALL().find(s=>s.id===id);
const inProject=id=>ALL().filter(s=>inBoard(id,s.id));
const savedTxt=s=>s.by?'from the community':'saved '+s.saved;
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
const anim=(el,k,o)=>RM?null:el.animate(k,o);

/* Units. Records are stored in metres; the app displays feet-inches by default. */
let UNIT='ft';const FT=3.28084;
function len(n){if(UNIT==='m')return n.toFixed(1)+' m';const t=Math.round(n*FT*12);return `${Math.floor(t/12)}′-${t%12}″`}
function lenBare(n){return UNIT==='m'?n.toFixed(1):len(n)}
const m=len;
const area=s=>UNIT==='m'?(s.w*s.d).toFixed(1)+' m²':Math.round(s.w*s.d*FT*FT).toLocaleString()+' ft²';
const totalArea=ss=>{const a=ss.reduce((x,s)=>x+s.w*s.d,0);return UNIT==='m'?a.toFixed(0)+' m²':Math.round(a*FT*FT).toLocaleString()+' ft²'};
const volume=s=>UNIT==='m'?(s.w*s.d*s.h).toFixed(0)+' m³':Math.round(s.w*s.d*s.h*FT**3).toLocaleString()+' ft³';
const dims=s=>UNIT==='m'?`${s.w.toFixed(1)} × ${s.d.toFixed(1)} × ${s.h.toFixed(1)} m`:`${len(s.w)} × ${len(s.d)} × ${len(s.h)}`;
const unitWord=()=>UNIT==='m'?'metres':'feet and inches';

/* Filter: type, and long side / short side / height within a tolerance. Long/short ignore orientation. */
const FILT={type:'all',L:'',S:'',H:'',tol:''};
let MODE=(()=>{try{return localStorage.getItem('sp-mode')||'images'}catch(e){return 'images'}})();
const MODES=[['images','Images','<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2.5" y="2.5" width="6.5" height="9" rx="1"/><rect x="11" y="2.5" width="6.5" height="5" rx="1"/><rect x="2.5" y="13.5" width="6.5" height="4" rx="1"/><rect x="11" y="9.5" width="6.5" height="8" rx="1"/></svg>'],['index','Index','<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2.5 4.5h2M7 4.5h10.5M2.5 10h2M7 10h10.5M2.5 15.5h2M7 15.5h10.5"/></svg>'],['plans','Plans','<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2.5 2.5h15v15h-15zM2.5 10h6M12 10h5.5M10 2.5v4"/><path d="M8.5 10a3.5 3.5 0 0 1 3.5-3.5" stroke-dasharray="1.5 1.5"/></svg>']];
function setModeAttr(){document.body.dataset.mode=MODE}
const tolDefault=()=>UNIT==='ft'?2:0.6;
const toM=v=>UNIT==='ft'?v/FT:v;
function sizeActive(){return ['L','S','H'].some(k=>FILT[k]!==''&&!isNaN(+FILT[k]))}
function matches(s){if(FILT.type!=='all'&&s.tag!==FILT.type)return false;
 const tol=toM(FILT.tol!==''&&!isNaN(+FILT.tol)?+FILT.tol:tolDefault()),lo=Math.max(s.w,s.d),sh=Math.min(s.w,s.d);
 for(const [k,v] of [['L',lo],['S',sh],['H',s.h]])if(FILT[k]!==''&&!isNaN(+FILT[k])&&Math.abs(v-toM(+FILT[k]))>tol+1e-6)return false;return true}
function sizeSummary(){const u=UNIT==='ft'?'′':' m',p=[];if(FILT.L!==''||FILT.S!=='')p.push(`${FILT.L||'any'} × ${FILT.S||'any'}${u}`);if(FILT.H!=='')p.push(`H ${FILT.H}${u}`);
 return p.length?p.join(', ')+` ±${FILT.tol||tolDefault()}${u}`:''}
const TYPES=[['all','All types'],['room','Rooms'],['corridor','Corridors'],['threshold','Thresholds']];
function filterBar(){const u=UNIT==='ft'?'ft':'m',ph=UNIT==='ft'?['20','13','10','2']:['6.1','4.0','3.0','0.6'];
 const inp=(k,lbl,i)=>`<label for="f-${k}">${lbl}<span class="in"><input id="f-${k}" data-k="${k}" type="number" inputmode="decimal" step="any" min="0" value="${FILT[k]}" placeholder="${ph[i]}"><span class="u">${u}</span></span></label>`;
 return `<div class="fbar" id="fbar"><div class="frow"><div class="ftypes" role="group" aria-label="Space type">${TYPES.map(([t,l])=>`<button type="button" class="ft" data-type="${t}" aria-pressed="${FILT.type===t}">${l}</button>`).join('')}</div>
 <button type="button" class="fsz" aria-expanded="false" aria-controls="fpanel" data-active="${sizeActive()}">Size<span class="fsum">${sizeActive()?' · '+sizeSummary():''}</span></button><span class="fcount" aria-live="polite"></span><div class="fmode" role="group" aria-label="View">${MODES.map(([k,l,ic])=>`<button type="button" data-mode="${k}" aria-pressed="${MODE===k}" aria-label="${l} view" title="${l}">${ic}</button>`).join('')}</div></div>
 <div class="fpanel" id="fpanel" hidden>${inp('L','Long side',0)}${inp('S','Short side',1)}${inp('H','Height',2)}${inp('tol','Within ±',3)}
 <div class="ftail"><div class="funit" role="group" aria-label="Units"><button type="button" data-unit="ft" aria-pressed="${UNIT==='ft'}">ft</button><button type="button" data-unit="m" aria-pressed="${UNIT==='m'}">m</button></div><button type="button" class="fclear">Clear size</button></div></div></div>`}
function filteredFeed(box,base,card,opts={}){const bar=$('#fbar');const F=feed(box,base.filter(matches),card,opts);
 const count=(n=F.length())=>{bar.querySelector('.fcount').textContent=`${n.toLocaleString()} ${n===1?'space':'spaces'}`;
  const sz=bar.querySelector('.fsz');sz.dataset.active=sizeActive();sz.querySelector('.fsum').textContent=sizeActive()?' · '+sizeSummary():''};
 const apply=()=>{const nl=base.filter(matches);F.set(nl);count(nl.length)};count();
 bar.addEventListener('click',e=>{const t=e.target.closest('button');if(!t)return;
  if(t.dataset.mode){if(t.dataset.mode===MODE)return;MODE=t.dataset.mode;try{localStorage.setItem('sp-mode',MODE)}catch(e){}bar.querySelectorAll('.fmode button').forEach(b=>b.setAttribute('aria-pressed',b===t));F.restyle(()=>setModeAttr())}
  else if(t.dataset.type){FILT.type=t.dataset.type;bar.querySelectorAll('.ft').forEach(b=>b.setAttribute('aria-pressed',b===t));apply()}
  else if(t.classList.contains('fsz')){const p=$('#fpanel'),open=p.hidden;p.hidden=!open;t.setAttribute('aria-expanded',open);if(open){anim(p,[{opacity:0,transform:'translateY(-6px)'},{opacity:1,transform:'none'}],{duration:200,easing:'ease-out'});p.querySelector('input').focus({preventScroll:true})}}
  else if(t.classList.contains('fclear')){FILT.L=FILT.S=FILT.H=FILT.tol='';bar.querySelectorAll('.fpanel input').forEach(i=>i.value='');apply()}
  else if(t.dataset.unit&&t.dataset.unit!==UNIT){const k=t.dataset.unit==='m'?1/FT:FT;
   for(const f of ['L','S','H','tol'])if(FILT[f]!==''&&!isNaN(+FILT[f]))FILT[f]=String(+(+FILT[f]*k).toFixed(1));UNIT=t.dataset.unit;go(CUR,false,{keepPanel:true})}});
 let tm;bar.addEventListener('input',e=>{const k=e.target.dataset.k;if(!k)return;FILT[k]=e.target.value.trim();clearTimeout(tm);tm=setTimeout(apply,280)});
 return F}

/* Animated, endless feed. Loads 8 at a time; on filter change, kept cards glide to their new
   positions, dropped cards fade out, new cards rise in. Cards are keyed by their data-go. */
function feed(box,items,card,{batch=8}={}){let list=items,n=0,gen=0,busy=false;
 const sen=document.createElement('div');sen.className='sentinel';box.after(sen);
 const io=new IntersectionObserver(e=>{if(e[0].isIntersecting)more()},{rootMargin:'500px'});
 const key=el=>el.dataset&&el.dataset.go;
 const rise=(els)=>els.forEach((el,i)=>anim(el,[{opacity:0,transform:'translateY(18px) scale(.98)'},{opacity:1,transform:'none'}],{duration:420,delay:Math.min(i,10)*40,easing:'cubic-bezier(.2,.8,.2,1)',fill:'backwards'}));
 const endTxt=()=>{sen.textContent=!list.length?'No spaces match. Widen the tolerance or clear the size filter.':n>=list.length?'That’s everything that matches.':''};
 function more(){if(busy||!box.isConnected||n>=list.length){endTxt();return}busy=true;const g=gen,k=Math.min(batch,list.length-n),sk=[];
  for(let j=0;j<k;j++){const d=document.createElement('div');d.className='skel';box.append(d);sk.push(d)}
  setTimeout(()=>{sk.forEach(d=>d.remove());busy=false;if(g!==gen||!box.isConnected)return;const start=box.children.length;
   box.insertAdjacentHTML('beforeend',list.slice(n,n+k).map((s,i)=>card(s,n+i)).join(''));n+=k;rise([...box.children].slice(start));endTxt();
   if(n<list.length&&sen.getBoundingClientRect().top<innerHeight+500)more()},n===0?120:420)}
 io.observe(sen);more();
 return {length:()=>list.length,restyle(swap){gen++;busy=false;box.querySelectorAll('.skel').forEach(d=>d.remove());const g=gen;
  const a=anim(box,[{opacity:1,transform:'none'},{opacity:0,transform:'translateY(6px)'}],{duration:150,easing:'ease-in',fill:'forwards'});
  (a?a.finished:Promise.resolve()).then(()=>{if(g!==gen)return;swap&&swap();box.innerHTML=list.slice(0,n).map((s,i)=>card(s,i)).join('');a&&a.cancel();rise([...box.children]);endTxt();if(n<list.length&&sen.getBoundingClientRect().top<innerHeight+500)more()})},
  set(nl){gen++;busy=false;box.querySelectorAll('.skel').forEach(d=>d.remove());
  const old=[...box.children].filter(key),rects=new Map(old.map(el=>[key(el),el.getBoundingClientRect()]));
  const keep=Math.min(nl.length,Math.max(batch,Math.ceil(n/batch)*batch||batch)),nk=new Set(nl.slice(0,keep).map(s=>'s:'+s.id));
  const leaving=old.filter(el=>!nk.has(key(el)));
  const done=Promise.all(leaving.map(el=>{const a=anim(el,[{opacity:1,transform:'scale(1)'},{opacity:0,transform:'scale(.92)'}],{duration:180,easing:'ease-in',fill:'forwards'});return a?a.finished:null}));
  const g=gen;done.then(()=>{if(g!==gen)return;list=nl;n=keep;box.innerHTML=nl.slice(0,n).map((s,i)=>card(s,i)).join('');const fresh=[];
   for(const el of box.children){const r=rects.get(key(el));if(!r){fresh.push(el);continue}const nr=el.getBoundingClientRect(),dx=r.left-nr.left,dy=r.top-nr.top;
    if(Math.abs(dx)+Math.abs(dy)>1)anim(el,[{transform:`translate(${dx}px,${dy}px)`},{transform:'none'}],{duration:520,easing:'cubic-bezier(.2,.8,.2,1)'})}
   rise(fresh);endTxt();if(n<list.length&&sen.getBoundingClientRect().top<innerHeight+500)more()})}}}
const lazy=feed;

/* Placeholder "photo": a lit room in the space's hue (stands in for the scan snapshot) */
function photo(s){const h=s.hue;return `background:linear-gradient(to top,hsl(${h} 18% 26% / .55) 0 26%,transparent 26.5%),radial-gradient(70% 55% at 72% 22%,hsl(${h} 70% 94% / .95),transparent 60%),linear-gradient(165deg,hsl(${h} 32% 74%),hsl(${(h+18)%360} 26% 36%))`}

/* 2D plan from the record: walls, door gaps, door swings, optional dimensions */
function plan(s,{size=120,pad=10,sw=1.5,dims=false}={}){
 const sc=(size-2*pad)/Math.max(s.w,s.d),W=s.w*sc,D=s.d*sc,x0=(size-W)/2,y0=(size-D)/2;
 const walls={N:[x0,y0,1,0,0,1,W],S:[x0,y0+D,1,0,0,-1,W],W:[x0,y0,0,1,1,0,D],E:[x0+W,y0,0,1,-1,0,D]};
 let o=`<svg class="plan" viewBox="0 0 ${size} ${size}" role="img" aria-label="Plan of ${s.name}"><rect x="${x0.toFixed(1)}" y="${y0.toFixed(1)}" width="${W.toFixed(1)}" height="${D.toFixed(1)}" fill="var(--plan-fill,transparent)" stroke="currentColor" stroke-width="${sw}"/>`;
 for(const dr of s.doors){const [sx,sy,ax,ay,ix,iy,ln]=walls[dr.wall];const L=Math.min(dr.w*sc,ln*.8);const a=Math.max(0,Math.min(ln-L,dr.pos*ln-L/2)),b=a+L;
  const P=(u,v)=>[(sx+ax*u+ix*v).toFixed(1),(sy+ay*u+iy*v).toFixed(1)];const [p1x,p1y]=P(a,0),[p2x,p2y]=P(b,0),[lx,ly]=P(a,L);const sweep=(ix*ay-iy*ax)>0?1:0;
  o+=`<line x1="${p1x}" y1="${p1y}" x2="${p2x}" y2="${p2y}" stroke="var(--plan-bg,#fff)" stroke-width="${sw+1.6}"/><line x1="${p1x}" y1="${p1y}" x2="${lx}" y2="${ly}" stroke="var(--door,currentColor)" stroke-width="${(sw*.75).toFixed(2)}"/><path d="M${lx} ${ly}A${L.toFixed(1)} ${L.toFixed(1)} 0 0 ${sweep} ${p2x} ${p2y}" fill="none" stroke="var(--door,currentColor)" stroke-width="${(sw*.5).toFixed(2)}" stroke-dasharray="2 2"/>`}
 if(dims)o+=`<text class="dim" font-size="${(size/16).toFixed(1)}" x="${(size/2).toFixed(1)}" y="${(y0-4).toFixed(1)}" text-anchor="middle">${lenBare(s.w)}</text><text class="dim" font-size="${(size/16).toFixed(1)}" x="${(x0-4).toFixed(1)}" y="${(size/2).toFixed(1)}" text-anchor="middle" transform="rotate(-90 ${(x0-4).toFixed(1)} ${(size/2).toFixed(1)})">${lenBare(s.d)}</text>`;
 return o+'</svg>'}

/* 3D: an open box extruded from the record. Only used on the detail screen. */
function box3d(s){const k=140/Math.max(s.w,s.d,s.h),W=s.w*k,D=s.d*k,H=s.h*k;
 const f=(w,h,t,c='')=>`<div class="face ${c}" style="width:${w.toFixed(1)}px;height:${h.toFixed(1)}px;margin:${(-h/2).toFixed(1)}px 0 0 ${(-w/2).toFixed(1)}px;transform:${t}"></div>`;
 return `<div class="stage" aria-label="3D volume of ${s.name}"><div class="vbox">${f(W,H,`translateZ(${D/2}px)`)}${f(W,H,`rotateY(180deg) translateZ(${D/2}px)`)}${f(D,H,`rotateY(90deg) translateZ(${W/2}px)`)}${f(D,H,`rotateY(-90deg) translateZ(${W/2}px)`)}<div class="face floor" style="width:${W.toFixed(1)}px;height:${D.toFixed(1)}px;margin:${(-D/2).toFixed(1)}px 0 0 ${(-W/2).toFixed(1)}px;background-size:${k.toFixed(1)}px ${k.toFixed(1)}px;transform:rotateX(90deg) translateZ(${(-H/2).toFixed(1)}px)"></div></div></div>`}

/* Capture stub: type what the Measure app gives you, see the plan update live */
function captureForm(){const u=UNIT==='ft'?'ft':'m',v=x=>UNIT==='ft'?(x*FT).toFixed(1):x.toFixed(1);return `<form class="cap" onsubmit="return saveCapture(event)">
<label>Name<input name="name" required placeholder="Corner table, favourite cafe"></label>
<label>Place<input name="place" placeholder="City"></label>
<div class="row3"><label>Width (${u})<input name="w" type="number" step=".1" min=".5" value="${v(4)}"></label><label>Depth (${u})<input name="d" type="number" step=".1" min=".5" value="${v(3.5)}"></label><label>Height (${u})<input name="h" type="number" step=".1" min="2" value="${v(2.8)}"></label></div>
<div class="row3"><label>Door wall<select name="wall"><option>N</option><option>E</option><option selected>S</option><option>W</option></select></label><label>Type<select name="tag"><option>room</option><option>corridor</option><option>threshold</option></select></label><label>Project<select name="project">${PROJECTS.map(p=>`<option value="${p.id}">${p.name}</option>`).join('')}</select></label></div>
<label>Highlights (words from the narration, comma separated)<input name="kw" placeholder="north light, oak floor, quiet"></label>
<div class="cap-preview" id="capPrev"></div>
<button type="submit">Save space</button>
<p class="cap-note">Stub. On a LiDAR phone this is a ten-second scan. Here you type what the Measure app gives you.</p></form>`}
function readCap(f){const v=n=>f.elements[n].value,u=x=>toM(+x);return {id:'u'+Date.now(),name:v('name')||'Untitled space',place:v('place')||'Somewhere',project:v('project'),tag:v('tag'),w:u(v('w'))||3,d:u(v('d'))||3,h:u(v('h'))||2.7,doors:[{wall:v('wall'),pos:.5,w:.9}],hue:Math.floor(Math.random()*360),saved:'just now',keywords:v('kw').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean).slice(0,8)}}
function bindCapture(){const f=$('form.cap'),up=()=>{$('#capPrev').innerHTML=plan(readCap(f),{size:160,pad:22,dims:true})};f.addEventListener('input',up);up()}
function saveCapture(e){e.preventDefault();const s=readCap(e.target);SPACES.unshift(s);if(s.project)addTo(s.project,s.id);go('s:'+s.id);return false}

/* In-page router. Links carry data-go="feed" | "p:<project>" | "s:<space>" | "capture" | "back" */
let CUR='feed';const STACK=[];
function go(t,push=true,o={}){if(t==='back'){t=STACK.pop()||'feed';push=false}else if(push&&t!==CUR)STACK.push(CUR);const same=t===CUR;CUR=t;
 if(typeof VAULT_API!=='undefined'&&VAULT_API){VAULT_API.stop()}
 const [v,id]=t.split(':'),main=$('#main');main.innerHTML='';document.querySelectorAll('.sentinel').forEach(n=>n.remove());if(!same)scrollTo(0,0);
 if(v==='p'&&proj(id))VIEWS.project(main,proj(id));
 else if(v==='s'&&space(id))VIEWS.space(main,space(id));
 else if(v==='capture'){VIEWS.capture(main);bindCapture()}
 else if(v==='vault')VIEWS.vault(main);
 else if(v==='v'&&proj(id))VIEWS.vproject(main,proj(id));
 else VIEWS.feed(main);
 if(o.keepPanel&&$('#fpanel')){$('#fpanel').hidden=false;$('.fsz').setAttribute('aria-expanded','true')}
 if(!same)anim(main,[{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'none'}],{duration:280,easing:'cubic-bezier(.2,.8,.2,1)'});
 document.querySelectorAll('nav [data-go]').forEach(a=>a.classList.toggle('on',a.dataset.go===t||(v==='v'&&a.dataset.go==='vault')));
 document.querySelectorAll('[data-units]').forEach(el=>el.textContent=unitWord())}
document.addEventListener('click',e=>{const a=e.target.closest('[data-go]');if(!a)return;e.preventDefault();go(a.dataset.go)});
document.addEventListener('keydown',e=>{if(e.key==='Enter'){const a=e.target.closest&&e.target.closest('[data-go]');if(a&&a.tagName!=='A'&&a.tagName!=='BUTTON'){e.preventDefault();go(a.dataset.go)}}});
function boot(){go('feed',false)}

document.head.insertAdjacentHTML('beforeend',`<style>
[hidden]{display:none!important}
.plan{display:block;width:100%;height:100%;overflow:visible}.dim{fill:currentColor;opacity:.75}
.stage{height:240px;perspective:800px;display:grid;place-items:center;overflow:hidden}
.vbox{position:relative;width:0;height:0;transform-style:preserve-3d;animation:spin 18s linear infinite}
@keyframes spin{from{transform:rotateX(-22deg) rotateY(20deg)}to{transform:rotateX(-22deg) rotateY(380deg)}}
.face{position:absolute;left:0;top:0;border:1px solid var(--box-line,currentColor);background:var(--box-wall,rgba(255,255,255,.3))}
.face.floor{background-color:var(--box-floor,rgba(0,0,0,.05));background-image:linear-gradient(var(--box-grid,rgba(0,0,0,.14)) 1px,transparent 1px),linear-gradient(90deg,var(--box-grid,rgba(0,0,0,.14)) 1px,transparent 1px)}
.skel{background:linear-gradient(90deg,var(--sk1,#0000000d) 30%,var(--sk2,#0000001a) 50%,var(--sk1,#0000000d) 70%);background-size:300% 100%;animation:sh 1.1s linear infinite}
@keyframes sh{from{background-position:100% 0}to{background-position:0 0}}
.fbar{position:sticky;top:var(--fbar-top,env(safe-area-inset-top,0px));z-index:4;background:var(--fb-bg);padding-block:10px;margin-bottom:12px;display:grid;gap:10px;font-family:var(--fb-font,inherit)}
.frow{display:flex;gap:8px;align-items:center;min-width:0}
.ftypes{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;min-width:0;flex:0 1 auto}
.ftypes::-webkit-scrollbar{display:none}
.ft,.fsz,.funit button,.fclear{font:inherit;font-size:13px;font-weight:500;border:1px solid var(--fb-line);background:var(--fb-card);color:var(--fb-fg);border-radius:var(--fb-radius,999px);padding:7px 12px;cursor:pointer;white-space:nowrap;flex:none;transition:background .2s,color .2s,border-color .2s}
.ft[aria-pressed="true"],.funit button[aria-pressed="true"]{background:var(--fb-accent);border-color:var(--fb-accent);color:var(--fb-on)}
.fsz[data-active="true"]{border-color:var(--fb-accent);color:var(--fb-accent)}
.ft:focus-visible,.fsz:focus-visible,.funit button:focus-visible,.fclear:focus-visible,.fpanel .in:focus-within{outline:2px solid var(--fb-accent);outline-offset:2px}
.fcount{margin-left:auto;font-size:12px;color:var(--fb-muted);font-variant-numeric:tabular-nums;white-space:nowrap;padding-left:4px}
.fpanel{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;align-items:end}
@media(max-width:560px){.fpanel{grid-template-columns:repeat(2,minmax(0,1fr))}.frow{flex-wrap:wrap}.ftypes{flex:1 1 100%}.fcount{margin-left:auto}}
.fpanel label{display:grid;gap:4px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--fb-muted)}
.fpanel .in{display:flex;align-items:center;gap:4px;border:1px solid var(--fb-line);background:var(--fb-card);border-radius:var(--fb-field-radius,10px);padding:0 10px}
.fpanel input{font:inherit;font-size:16px;letter-spacing:0;text-transform:none;border:0;background:transparent;color:var(--fb-fg);width:100%;padding:9px 0;min-width:0;outline:none;-moz-appearance:textfield;appearance:textfield}
.fpanel input::-webkit-inner-spin-button,.fpanel input::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
.fpanel .u{color:var(--fb-muted);font-size:12px;text-transform:none;letter-spacing:0}
.ftail{grid-column:1/-1;display:flex;gap:8px;justify-content:space-between;align-items:center}
.funit{display:flex;gap:4px}
.fmode{display:flex;border:1px solid var(--fb-line);border-radius:var(--fb-radius,999px);background:var(--fb-card);padding:2px;gap:2px;flex:none}
.fmode button{display:grid;place-items:center;width:34px;height:30px;border:0;background:none;color:var(--fb-muted);border-radius:var(--fb-radius,999px);cursor:pointer;transition:background .2s,color .2s}
.fmode button svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.4;stroke-linecap:round;stroke-linejoin:round}
.fmode button[aria-pressed="true"]{background:var(--fb-accent);color:var(--fb-on)}
.fmode button:focus-visible{outline:2px solid var(--fb-accent);outline-offset:1px}
@media(prefers-reduced-motion:reduce){.vbox,.skel{animation:none}}
</style>`);
