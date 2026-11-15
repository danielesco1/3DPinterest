import * as THREE from 'three';import {OrbitControls} from './vendor/OrbitControls.js';import {SparkRenderer,SplatMesh,SplatEdit,SplatEditSdf,SplatEditSdfType} from '@sparkjsdev/spark';
const $=id=>document.getElementById(id),stage=$('stage');
const config=await(await fetch('./scene.json')).json();
$('sceneTitle').textContent=config.title;
$('geometryNotes').textContent=config.notes;
$('diagnostics').hidden=config.adapter==='astra-shell'||config.diagnostics===false;
for(const item of config.scenes){const option=new Option(item.title,item.url);option.selected=item.id===config.id;$('scenePicker').add(option)}
$('scenePicker').onchange=e=>location.assign(e.target.value);
const data=await(await fetch('./viewer-data.json')).json(),frames=data.frames;
$('scrub').max=frames.length-1;
const scene=new THREE.Scene(),overlay=new THREE.Scene(),cadScene=new THREE.Scene();const renderer=new THREE.WebGLRenderer({antialias:false});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0xdedfe1);renderer.autoClear=false;stage.prepend(renderer.domElement);
const camera=new THREE.PerspectiveCamera(60,1,.01,1000),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;const spark=new SparkRenderer({renderer});scene.add(spark);
let loaded=false,frame=0,capture=false,showOverlay=true,playing=false,start=0,startFrame=0;const splat=new SplatMesh({url:'./reconstruction.spz',onLoad:mesh=>{loaded=true;$('status').textContent=`Loaded ${mesh.numSplats.toLocaleString()} Gaussians · Spark 2.4.0`;}});scene.add(splat);splat.initialized.catch(e=>{$('status').textContent='Could not load SPZ: '+e.message});


const shellGroups={};const partialGroup=new THREE.Group();cadScene.add(partialGroup);
const evidence=await(await fetch('./partial-sample-points.json')).json();
const navigationPoints=frames.map(f=>new THREE.Vector3(...f.camera.extrinsics.position));
for(const [name,g]of Object.entries(evidence.groups)){const pts=g.native_world_points.map(p=>new THREE.Vector3(...p));navigationPoints.push(...pts);const geo=new THREE.BufferGeometry().setFromPoints(pts);const color=name.startsWith('floor')?0xffa14a:name.startsWith('ceiling')?0xbc80ff:0x46cde5;partialGroup.add(new THREE.Points(geo,new THREE.PointsMaterial({color,size:3,sizeAttenuation:false,depthTest:false})));}
$('partial').onchange=e=>partialGroup.visible=e.target.checked;
const outlineGroup=new THREE.Group();cadScene.add(outlineGroup);const outlineData=await(await fetch('./provisional-outlines.json')).json();for(const item of outlineData.items){const pts=item.corners.map(p=>new THREE.Vector3(...p));pts.push(pts[0].clone());const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineDashedMaterial({color:0xffa14a,dashSize:.16,gapSize:.1,depthTest:false}));line.computeLineDistances();outlineGroup.add(line)}$('outlines').onchange=e=>outlineGroup.visible=e.target.checked;
outlineGroup.visible=false;partialGroup.visible=false;
const coreData=await(await fetch('./core-envelope.json')).json(),coreGroup=new THREE.Group();cadScene.add(coreGroup);
for(const [set,color,dashed]of [[coreData.supported_direction_edges,0x3e9bd8,false],[coreData.inferred_edges,0xffa14a,true]]){for(const e of set){const geo=new THREE.BufferGeometry().setFromPoints(e.map(i=>new THREE.Vector3(...coreData.vertices[i])));const line=new THREE.Line(geo,dashed?new THREE.LineDashedMaterial({color,dashSize:.28,gapSize:.14,depthTest:false}):new THREE.LineBasicMaterial({color,depthTest:false}));line.computeLineDistances();coreGroup.add(line)}}

// RGB-supported provisional opening overlays; retain full wall mesh.
for(const op of coreData.opening_outlines||[]){for(let i=0;i<op.vertices.length;i++){const points=[op.vertices[i],op.vertices[(i+1)%op.vertices.length]].map(p=>new THREE.Vector3(...p));const uncertain=op.uncertain_edges.includes(i);const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),uncertain?new THREE.LineDashedMaterial({color:0x05d2e8,dashSize:.15,gapSize:.1,depthTest:false}):new THREE.LineBasicMaterial({color:0x05d2e8,depthTest:false}));line.computeLineDistances();coreGroup.add(line)}}
for(const op of coreData.opening_outlines||[]){const canvas=document.createElement('canvas');canvas.width=384;canvas.height=64;const ctx=canvas.getContext('2d');ctx.fillStyle='#10212cee';ctx.fillRect(0,0,384,64);ctx.fillStyle='#65dcff';ctx.font='bold 25px sans-serif';ctx.fillText(op.tag+' '+op.label+' (approx.)',8,42);const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas),depthTest:false}));const top=op.vertices.reduce((a,b)=>a[1]>b[1]?a:b);sprite.position.set(...top);sprite.position.y+=.13;sprite.scale.set(2.4*(config.labelScale||1),.4*(config.labelScale||1),1);coreGroup.add(sprite)}
for(const dim of coreData.dimensions||[]){const a=new THREE.Vector3(...dim.endpoints[0]),b=new THREE.Vector3(...dim.endpoints[1]),off=new THREE.Vector3(0,-.4,0);const aa=a.clone().add(off),bb=b.clone().add(off);for(const pts of [[a,aa],[aa,bb],[bb,b]])coreGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0x665533,depthTest:false})));const canvas=document.createElement('canvas');canvas.width=512;canvas.height=72;const ctx=canvas.getContext('2d');ctx.fillStyle='rgba(255,255,255,.9)';ctx.fillRect(0,0,512,72);ctx.fillStyle='#443';ctx.font='28px sans-serif';ctx.fillText(dim.display_label+' ASSUMED',8,44);const label=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas),depthTest:false}));label.position.copy(aa.clone().add(bb).multiplyScalar(.5));label.scale.set(4*(config.labelScale||1),.56*(config.labelScale||1),1);coreGroup.add(label)}

// A prepared surface mesh contains actual opening cuts. Core faces still define crop planes.
const triangles=[];
const surface=coreData.surface_mesh;
if(surface){
  for(const indices of surface.triangles){
    if(indices.length!==3)throw Error('Surface mesh requires triangles');
    for(const index of indices){
      const point=surface.vertices[index];
      if(!point||point.length!==3||!point.every(Number.isFinite))throw Error('Invalid surface mesh vertex');
      triangles.push(...point);
    }
  }
  $('geometryNotes').textContent=coreData.surface_mesh_notes||surface.status||
    'Provisional surface mesh with inferred opening cuts. Core envelope still controls display crop. Dimensions remain uncalibrated; no survey accuracy is claimed.';
}else{
  for(const face of coreData.faces)for(let i=1;i<face.length-1;i++)
    triangles.push(...coreData.vertices[face[0]],...coreData.vertices[face[i]],...coreData.vertices[face[i+1]]);
}
if(config.cadNotes)$('geometryNotes').textContent=config.cadNotes;
const faceGeo=new THREE.BufferGeometry();faceGeo.setAttribute('position',new THREE.Float32BufferAttribute(triangles,3));const coreFaces=new THREE.Mesh(faceGeo,new THREE.MeshBasicMaterial({color:0x78bbdf,transparent:true,opacity:surface ? .35 : .08,side:THREE.DoubleSide,depthWrite:false,depthTest:false}));coreGroup.add(coreFaces);$('core').onchange=e=>coreGroup.visible=e.target.checked;$('coreFaces').onchange=e=>coreFaces.visible=e.target.checked;


// Restore the previous room-plus-margin filter. The Hotel envelope is not
// orthogonal, so six offset face half-spaces replace the former box SDF.
const cropSupported=coreData.crop_supported!==false;
if(!cropSupported){
  $('coreHeading').textContent=config.cadHeading||'Inferred conceptual volume';
  $('core').parentElement.lastChild.textContent=' Show inferred conceptual volume';
  $('diagnostics').hidden=true;
  for(const id of ['crop','margin','cropBounds'])$(id).disabled=true;
  $('crop').checked=false;$('cropBounds').checked=false;
  $('crop').parentElement.title='Convex crop is unavailable for this scene geometry';
}
const trimCenter=coreData.vertices.reduce((a,p)=>a.add(new THREE.Vector3(...p)),new THREE.Vector3()).multiplyScalar(1/coreData.vertices.length);
const trimPlanes=(cropSupported?coreData.faces:[]).map(face=>{const a=new THREE.Vector3(...coreData.vertices[face[0]]),b=new THREE.Vector3(...coreData.vertices[face[1]]),c=new THREE.Vector3(...coreData.vertices[face[2]]);const n=b.clone().sub(a).cross(c.clone().sub(a)).normalize();if(n.dot(trimCenter.clone().sub(a))>0)n.negate();const edit=new SplatEdit({name:'Reversible room exterior crop',invert:true,softEdge:0.03}),shape=new SplatEditSdf({type:SplatEditSdfType.PLANE,opacity:0});shape.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),n);edit.add(shape);return{face,n,d:n.dot(a),edit,shape};});
const trimWire=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0x80ff80,depthTest:false}));cadScene.add(trimWire);
function expandedTrimVertex(index,margin){const ps=trimPlanes.filter(p=>p.face.includes(index));if(ps.length!==3)throw Error('Expected three faces per core vertex');const [a,b,c]=ps,bc=b.n.clone().cross(c.n),ca=c.n.clone().cross(a.n),ab=a.n.clone().cross(b.n),det=a.n.dot(bc);if(Math.abs(det)<1e-8)throw Error('Degenerate core crop');return bc.multiplyScalar(a.d+margin).add(ca.multiplyScalar(b.d+margin)).add(ab.multiplyScalar(c.d+margin)).divideScalar(det);}
function updateCrop(){if(!cropSupported){trimWire.visible=false;return;}const margin=+$('margin').value;$('marginValue').textContent=margin.toFixed(2);for(const p of trimPlanes){p.shape.position.copy(p.n).multiplyScalar(p.d+margin);if($('crop').checked&&!p.edit.parent)splat.add(p.edit);if(!$('crop').checked&&p.edit.parent)splat.remove(p.edit);}const v=coreData.vertices.map((_,i)=>expandedTrimVertex(i,margin)),edges=new Set(),points=[];for(const face of coreData.faces)for(let j=0;j<face.length;j++){const a=face[j],b=face[(j+1)%face.length],key=[a,b].sort((x,y)=>x-y).join(',');if(!edges.has(key)){edges.add(key);points.push(v[a],v[b]);}}trimWire.geometry.dispose();trimWire.geometry=new THREE.BufferGeometry().setFromPoints(points);trimWire.visible=$('cropBounds').checked;splat.updateVersion();}
['crop','margin','cropBounds'].forEach(id=>$(id).oninput=updateCrop);updateCrop();

const navBox=new THREE.Box3().setFromPoints(navigationPoints),navCenter=navBox.getCenter(new THREE.Vector3()),navHalf=navBox.getSize(new THREE.Vector3()).multiplyScalar(.5);const cropBox={center:navCenter.toArray(),half:navHalf.toArray(),axes:[[1,0,0],[0,1,0],[0,0,1]]};
const sectionScene=new THREE.Scene(),sectionEdit=new SplatEdit({name:'Reversible section plane',invert:true,softEdge:0}),sectionShape=new SplatEditSdf({type:SplatEditSdfType.PLANE,opacity:0});sectionEdit.add(sectionShape);
const sectionOutline=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(1,1)),new THREE.LineBasicMaterial({color:0xff649e,depthTest:false}));sectionScene.add(sectionOutline);let sectionClip=null;
const sectionArrow=new THREE.ArrowHelper(new THREE.Vector3(0,1,0),new THREE.Vector3(),.65,0xff649e,.14,.08);sectionScene.add(sectionArrow);
const gumball=$('sectionGumball');let sectionDrag=null;
function projectSectionPoint(v){const q=v.clone().project(camera),w=stage.clientWidth,h=stage.clientHeight;let vw=w,vh=h;if(capture){const k=frames[frame].camera.intrinsics,scale=Math.min(w/k.width,h/k.height);vw=k.width*scale;vh=k.height*scale}return{x:w/2+q.x*vw/2,y:h/2-q.y*vh/2,z:q.z,vh}}
function updateGumball(){const enabled=$('sectionEnabled').checked;gumball.hidden=!enabled;sectionArrow.visible=enabled;if(!enabled)return;const d=sectionState(),point=new THREE.Vector3(...d.point),axis=new THREE.Vector3(...cropBox.axes[+$('sectionAxis').value]);sectionArrow.position.copy(point);sectionArrow.setDirection(axis);const q=projectSectionPoint(point);gumball.hidden=q.z< -1||q.z>1;gumball.style.left=q.x+'px';gumball.style.top=q.y+'px'}
gumball.onpointerdown=e=>{if(e.button!==0||sectionDrag)return;e.preventDefault();e.stopPropagation();stop();const d=sectionState(),p=new THREE.Vector3(...d.point),a=new THREE.Vector3(...cropBox.axes[+$('sectionAxis').value]),q=projectSectionPoint(p),r=projectSectionPoint(p.clone().add(a));const pixels=q.vh/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*Math.max(.1,camera.position.distanceTo(p)));sectionDrag={id:e.pointerId,x:e.clientX,y:e.clientY,value:+$('sectionPosition').value,sx:r.x-q.x,sy:r.y-q.y,pixels,enabled:controls.enabled};controls.enabled=false;gumball.setPointerCapture(e.pointerId)};
gumball.onpointermove=e=>{const d=sectionDrag;if(!d||e.pointerId!==d.id)return;e.preventDefault();const slider=$('sectionPosition');slider.value=Math.max(+slider.min,Math.min(+slider.max,d.value+roomSection.dragOffset(e.clientX-d.x,e.clientY-d.y,d.sx,d.sy,d.pixels)));updateSection()};
function finishSectionDrag(e){if(!sectionDrag||e.pointerId!==sectionDrag.id)return;controls.enabled=sectionDrag.enabled;sectionDrag=null;if(gumball.hasPointerCapture(e.pointerId))gumball.releasePointerCapture(e.pointerId)}gumball.onpointerup=finishSectionDrag;gumball.onpointercancel=finishSectionDrag;gumball.onlostpointercapture=finishSectionDrag;

function sectionState(){return roomSection.plane(cropBox,+$('sectionAxis').value,+$('sectionPosition').value,$('sectionFlip').checked)}
function updateSection(){if(!cropBox)return;const d=sectionState(),enabled=$('sectionEnabled').checked,n=new THREE.Vector3(...d.normal),point=new THREE.Vector3(...d.point);sectionShape.position.copy(point);sectionShape.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),n);sectionOutline.position.copy(point);sectionOutline.quaternion.copy(sectionShape.quaternion);const size=Math.max(...cropBox.half)*2+1.2;sectionOutline.scale.set(size,size,1);sectionOutline.visible=enabled&&$('sectionGuide').checked;sectionClip=enabled?new THREE.Plane(n.clone().negate(),n.dot(point)):null;if(enabled&&!sectionEdit.parent)splat.add(sectionEdit);if(!enabled&&sectionEdit.parent)splat.remove(sectionEdit);$('sectionValue').textContent=(+$('sectionPosition').value).toFixed(2)+' u';splat.updateVersion()}
function resetSection(){const axis=+$('sectionAxis').value,half=cropBox.half[axis];$('sectionPosition').min=-half-.6;$('sectionPosition').max=half+.6;$('sectionPosition').value=0;$('sectionFlip').checked=false;updateSection()}
['sectionEnabled','sectionPosition','sectionFlip','sectionOverlays','sectionGuide'].forEach(id=>$(id).oninput=updateSection);$('sectionAxis').onchange=resetSection;$('sectionReset').onclick=()=>{$('sectionAxis').value='1';$('sectionEnabled').checked=false;resetSection()};resetSection();
$('sectionView').onclick=()=>{if(!cropBox)return;capture=false;stop();controls.enabled=true;const d=sectionState(),n=new THREE.Vector3(...d.normal),point=new THREE.Vector3(...d.point);camera.up.set(...cropBox.axes[+$('sectionAxis').value===1?2:1]);camera.position.copy(point).addScaledVector(n,Math.max(...cropBox.half)*4);controls.target.copy(point);camera.lookAt(point);camera.fov=45;resize();$('capture').textContent='Capture view'};
const positions=frames.map(f=>new THREE.Vector3(...f.camera.extrinsics.position)),box=new THREE.Box3().setFromPoints(positions),center=box.getCenter(new THREE.Vector3()),extent=box.getSize(new THREE.Vector3()).length();
const path=new THREE.Line(new THREE.BufferGeometry().setFromPoints(positions),new THREE.LineBasicMaterial({color:0x53dfc3,depthTest:false}));overlay.add(path);const cams=new THREE.Group();overlay.add(cams);
function drawFrustums(){while(cams.children.length){let x=cams.children[0];x.geometry.dispose();x.material.dispose();cams.remove(x)}frames.forEach((f,i)=>{const p=f.camera.extrinsics.position,c=poseGeometry.corners(f.camera,+$('size').value),v=[];for(let j=0;j<4;j++)v.push(...p,...c[j],...c[j],...c[(j+1)%4]);const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(v,3));cams.add(new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:i===frame?0xffcd63:0x689baf,depthTest:false,transparent:true,opacity:i===frame?1:.5})))})}
function resize(){renderer.setSize(stage.clientWidth,stage.clientHeight);if(!capture){camera.aspect=stage.clientWidth/stage.clientHeight;camera.updateProjectionMatrix()}}
// Roomboard anchors use the unchanged native RUB scene coordinates.
let flight=null;
function validFlyMessage(event){
 return event.source===window.parent&&
  (event.origin===location.origin||event.origin==='https://danielesco1.github.io')&&
  event.data?.type==='fly'&&Array.isArray(event.data.position)&&
  event.data.position.length===3&&event.data.position.every(Number.isFinite)&&
  (event.data.camera==null||(Array.isArray(event.data.camera)&&event.data.camera.length===3&&event.data.camera.every(Number.isFinite)));
}
function cancelFlight(){flight=null}
function flyTo(position,cameraAt){
 if(sectionDrag)return;
 stop();
 // Capture mode has a custom projection and stale orbit target; restore orbit first.
 if(capture)fit();
 capture=false;controls.enabled=true;camera.up.set(0,1,0);camera.fov=60;resize();
 const target=new THREE.Vector3(...position),offset=camera.position.clone().sub(controls.target);
 if(offset.lengthSq()<1e-12)offset.set(1,.5,1);
 offset.setLength(Math.max(.1,Math.min(offset.length(),Math.max(extent*.25,.1))));
 // Flush residual orbit damping before starting the deterministic transition.
 const damping=controls.enableDamping;controls.enableDamping=false;controls.update();controls.enableDamping=damping;
 // With a camera position (the narrator's filmed view) fly there; otherwise keep the current viewing direction.
 flight={start:performance.now(),from:camera.position.clone(),targetFrom:controls.target.clone(),
  to:cameraAt?new THREE.Vector3(...cameraAt):target.clone().add(offset),target};
 $('capture').textContent='Capture view';
}
function updateFlight(now){
 if(!flight)return;
 const t=Math.min(1,Math.max(0,(now-flight.start)/900)),ease=t*t*(3-2*t);
 camera.position.lerpVectors(flight.from,flight.to,ease);
 controls.target.lerpVectors(flight.targetFrom,flight.target,ease);
 camera.lookAt(controls.target);
 if(t===1)flight=null;
}
addEventListener('message',event=>{if(validFlyMessage(event))flyTo(event.data.position,event.data.camera)});
controls.addEventListener('start',cancelFlight);
// Direct manipulation and existing buttons/sliders always take precedence.
document.addEventListener('pointerdown',cancelFlight,true);
document.addEventListener('keydown',cancelFlight,true);
function fit(){cancelFlight();capture=false;controls.enabled=true;camera.up.set(0,1,0);camera.fov=60;camera.position.copy(center).add(new THREE.Vector3(extent*.9,extent*.6,extent*.9));controls.target.copy(center);camera.lookAt(center);resize();$('capture').textContent='Capture view'}
function pose(){const c=frames[frame].camera,e=c.extrinsics,k=c.intrinsics;camera.position.fromArray(e.position);camera.quaternion.fromArray(e.quaternion);const n=.01;camera.projectionMatrix.makePerspective(-k.cx/k.fx*n,(k.width-k.cx)/k.fx*n,k.cy/k.fy*n,-(k.height-k.cy)/k.fy*n,n,1000);camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();camera.updateMatrixWorld()}
function select(i){frame=i;$('scrub').value=i;const f=frames[i],c=f.camera;$('title').textContent=`Frame ${i+1} / ${frames.length}`;$('preview').src=f.thumbnail;$('time').textContent=f.source_time_seconds.toFixed(2)+'s';$('details').textContent=`Position: ${c.extrinsics.position.map(n=>n.toFixed(2)).join(', ')}\nGrid: ${c.intrinsics.width} × ${c.intrinsics.height}\nRUB · camera → world`;drawFrustums();if(capture)pose()}
function stop(){playing=false;$('play').textContent='Play'}$('play').onclick=()=>{if(playing)return stop();if(frame===frames.length-1)select(0);playing=true;start=performance.now();startFrame=frame;$('play').textContent='Pause'};$('scrub').oninput=e=>{stop();select(+e.target.value)};$('fit').onclick=fit;$('capture').onclick=()=>{capture=true;controls.enabled=false;pose();$('capture').textContent='Capture view active'};$('overlay').onclick=()=>{showOverlay=!showOverlay;$('overlay').textContent='Cameras: '+(showOverlay?'on':'off')};$('splat').onclick=()=>{splat.visible=!splat.visible;$('splat').textContent='Splat: '+(splat.visible?'on':'off')};$('size').oninput=drawFrustums;addEventListener('resize',resize);
fit();select(0);
// Roomboard embed (?embed=1): no diagnostic overlays, room crop on, start inside the room at the
// narrator's mid-walk camera, looking where they looked. Keyword flights then start from this view.
if(document.documentElement.classList.contains('embed')){
 if(showOverlay)$('overlay').click();
 $('core').checked=false;coreGroup.visible=false;
 // Open on a real filmed view: the frame whose camera looks most directly into the room (towards the path
 // centre, weighted by distance), so the splat is seen from where it was captured and looks sharpest.
 let best=0,bestScore=-Infinity;
 frames.forEach((f,i)=>{const e=f.camera.extrinsics,p=new THREE.Vector3(...e.position),fw=new THREE.Vector3(0,0,-1).applyQuaternion(new THREE.Quaternion(...e.quaternion));
  const to=center.clone().sub(p);const d=to.length();if(d<1e-6)return;const score=fw.dot(to.normalize())*Math.min(d,extent);if(score>bestScore){bestScore=score;best=i}});
 const be=frames[best].camera.extrinsics,bp=new THREE.Vector3(...be.position),bf=new THREE.Vector3(0,0,-1).applyQuaternion(new THREE.Quaternion(...be.quaternion));
 camera.position.copy(bp);controls.target.copy(bp).addScaledVector(bf,2);camera.lookAt(controls.target);
 // Keep visitors near the filmed viewpoints, where the reconstruction holds up.
 controls.minDistance=.15;controls.maxDistance=3.5;controls.update();
 // Tighter room crop to drop floaters along the walls (convex rooms only).
 $('margin').value='0.25';updateCrop();
}
renderer.setAnimationLoop(now=>{updateFlight(now);if(playing){const t=frames[startFrame].source_time_seconds+(now-start)/1000;let next=frame;while(next<frames.length-1&&frames[next+1].source_time_seconds<=t)next++;if(next!==frame)select(next);if(frame===frames.length-1)stop()}if(!capture&&!sectionDrag&&!flight)controls.update();const w=stage.clientWidth,h=stage.clientHeight;renderer.setScissorTest(false);renderer.setViewport(0,0,w,h);renderer.clear();if(capture){const k=frames[frame].camera.intrinsics,scale=Math.min(w/k.width,h/k.height),vw=k.width*scale,vh=k.height*scale;renderer.setViewport((w-vw)/2,(h-vh)/2,vw,vh)}renderer.clippingPlanes=[];renderer.render(scene,camera);renderer.clippingPlanes=$('sectionOverlays').checked&&sectionClip?[sectionClip]:[];renderer.clearDepth();renderer.render(cadScene,camera);if(showOverlay){renderer.clearDepth();renderer.render(overlay,camera)}renderer.clippingPlanes=[];renderer.clearDepth();renderer.render(sectionScene,camera);updateGumball()});window.viewerState=()=>({loaded,frame,capture,numSplats:splat.numSplats,showOverlay,shells:Object.fromEntries(Object.entries(shellGroups).map(([k,v])=>[k,v.group.visible]))});
