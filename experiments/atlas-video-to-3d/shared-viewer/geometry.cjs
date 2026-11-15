/* Atlas camera-to-world XYZW quaternion; intrinsics are pixel units. */
(function(root){
function rotate(v,q){const [x,y,z]=v,[qx,qy,qz,qw]=q;const tx=2*(qy*z-qz*y),ty=2*(qz*x-qx*z),tz=2*(qx*y-qy*x);return [x+qw*tx+qy*tz-qz*ty,y+qw*ty+qz*tx-qx*tz,z+qw*tz+qx*ty-qy*tx];}
function ray(u,v,d,camera){const k=camera.intrinsics,e=camera.extrinsics;let p=[(u-k.cx)/k.fx*d,(v-k.cy)/k.fy*d,d];if(e.coordinateSystem==='rub')p=[p[0],-p[1],-p[2]];else if(e.coordinateSystem!=='rdf')throw Error('Unknown camera convention');return rotate(p,e.quaternion).map((x,i)=>x+e.position[i]);}
function corners(c,d){const k=c.intrinsics;return [[0,0],[k.width,0],[k.width,k.height],[0,k.height]].map(p=>ray(...p,d,c));}
const api={rotate,ray,corners};if(typeof module!=='undefined')module.exports=api;else root.poseGeometry=api;
})(typeof window==='undefined'?globalThis:window);
