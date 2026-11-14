/* ---------- Scanned rooms: read rooms/index.json and add each room to SPACES before the app boots.
   If the files are missing or unreadable, the sample rooms stay exactly as they were. ---------- */
const ROOMS_URL='rooms/';
function loadRooms(){
 return fetch(ROOMS_URL+'index.json',{cache:'no-cache'})
  .then(r=>{if(!r.ok)throw new Error('index '+r.status);return r.json()})
  .then(idx=>Promise.all((idx.rooms||[]).map(e=>fetch(ROOMS_URL+e.folder+'/space.json',{cache:'no-cache'})
    .then(r=>r.ok?r.json():null).catch(()=>null))))
  .then(list=>{list.filter(Boolean).forEach(s=>{
    if(SPACES.some(x=>x.id===s.id))return;
    SPACES.unshift({...s,scanned:true,saved:s.saved||'Scanned',keywords:s.keywords||[],
      project:proj(s.project)?s.project:PROJECTS[0].id});
  })})
  .catch(()=>{});
}
