"""Dependency-free Atlas sample geometry helpers; no semantic room guessing."""
import itertools
import math
import random


def unproject_rub(pixel, depth, intrinsics, position, quaternion_xyzw):
    """Optical-axis depth → world point, RUB camera-to-world convention only.

    Caller must establish conventions from metadata and filter invalid/glass or
    low-confidence pixels. Units are native scene units, never presumed meters.
    """
    fx,fy,cx,cy=intrinsics
    values=[*pixel,depth,*intrinsics,*position,*quaternion_xyzw]
    if not all(isinstance(x,(int,float)) and not isinstance(x,bool) and math.isfinite(x) for x in values) or depth<=0 or fx<=0 or fy<=0:
        raise ValueError('Invalid camera sample')
    qx,qy,qz,qw=quaternion_xyzw
    norm=math.sqrt(qx*qx+qy*qy+qz*qz+qw*qw)
    if abs(norm-1)>1e-3: raise ValueError('Quaternion must be normalized')
    qx,qy,qz,qw=[x/norm for x in (qx,qy,qz,qw)]
    x,y,z=(pixel[0]-cx)/fx*depth,-(pixel[1]-cy)/fy*depth,-depth
    tx,ty,tz=2*(qy*z-qz*y),2*(qz*x-qx*z),2*(qx*y-qy*x)
    return [x+qw*tx+qy*tz-qz*ty+position[0],y+qw*ty+qz*tx-qx*tz+position[1],z+qw*tz+qx*ty-qy*tx+position[2]]


def fit_plane(points, tolerance, trials=256):
    """Deterministic three-point RANSAC, returning residuals and original indices.

    Requires semantically selected surface samples. Does not choose room walls,
    force perpendicularity or infer occluded boundaries. No least-squares refit.
    """
    if len(points)<3 or not math.isfinite(tolerance) or tolerance<=0 or trials<1:
        raise ValueError('Need at least three samples and positive fit limits')
    if any(len(p)!=3 or any(not math.isfinite(x) for x in p) for p in points):
        raise ValueError('Finite 3D samples required')
    count=math.comb(len(points),3)
    if count<=trials: triples=list(itertools.combinations(range(len(points)),3))
    else:
        rng=random.Random(0); triples=set()
        while len(triples)<trials:triples.add(tuple(sorted(rng.sample(range(len(points)),3))))
        triples=sorted(triples)
    best=None
    for ia,ib,ic in triples:
        a,b,c=points[ia],points[ib],points[ic]
        u=[b[k]-a[k] for k in range(3)]; v=[c[k]-a[k] for k in range(3)]
        n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
        length=math.sqrt(sum(x*x for x in n))
        if length<1e-10:continue
        n=[x/length for x in n]; d=-sum(n[k]*a[k] for k in range(3))
        residuals=[abs(sum(n[k]*p[k] for k in range(3))+d) for p in points]
        inliers=[i for i,r in enumerate(residuals) if r<=tolerance]
        rms=math.sqrt(sum(residuals[i]**2 for i in inliers)/len(inliers))
        score=(len(inliers),-rms)
        if best is None or score>best[0]:best=(score,n,d,inliers,rms,residuals)
    if best is None:raise ValueError('Degenerate or collinear samples')
    _,n,d,inliers,rms,residuals=best
    return dict(normal=n,offset=d,inlier_indices=inliers,residual_scene_units=rms,
                residuals=residuals,method='deterministic three-point RANSAC; no least-squares refit')
