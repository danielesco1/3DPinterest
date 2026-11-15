"""Reviewed room envelope to reproducible CAD and vector drawings (no API calls).

Geometry remains in reconstruction coordinates. Semantic/Astra or plane-fitting
proposals are inputs, never implicitly treated as measured or reviewed truth.
"""
from __future__ import annotations

import json
import math
from html import escape
from pathlib import Path

EPS = 1e-8


def _number(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError("Geometry numbers must be finite")
    return float(value)


def _vector(value, size):
    if not isinstance(value, list) or len(value) != size:
        raise ValueError(f"Expected {size}-component vector")
    return [_number(x) for x in value]


def _dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def _cross(a, b):
    return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]


def _orient(a, b, c):
    return (b[0]-a[0])*(c[1]-a[1]) - (b[1]-a[1])*(c[0]-a[0])


def _intersects(a, b, c, d):
    values = [_orient(a,b,c), _orient(a,b,d), _orient(c,d,a), _orient(c,d,b)]
    if values[0]*values[1] < 0 and values[2]*values[3] < 0:
        return True
    for value, p, q, r in [(values[0],a,b,c),(values[1],a,b,d),(values[2],c,d,a),(values[3],c,d,b)]:
        if abs(value) < EPS and all(min(p[k],q[k])-EPS <= r[k] <= max(p[k],q[k])+EPS for k in (0,1)):
            return True
    return False


def validate_evidence(data):
    """Validate explicit review, coordinate frame, simple CCW polygon and openings."""
    if data.get("schema_version") != 1:
        raise ValueError("Expected CAD evidence schema_version 1")
    review = data.get("review", {})
    if review.get("status") != "reviewed" or not review.get("reviewer") or not review.get("notes"):
        raise ValueError("CAD requires a reviewed evidence file with reviewer and notes")
    if not data.get("source_take_id") or not data.get("evidence"):
        raise ValueError("source_take_id and evidence references are required")
    frame = data["frame"]
    for key in ("origin", "u", "v", "up"):
        _vector(frame[key], 3)
    u, v, up = (frame[k] for k in ("u", "v", "up"))
    if any(abs(_dot(a,a)-1) > 1e-5 for a in (u,v,up)) or any(abs(_dot(a,b)) > 1e-5 for a,b in ((u,v),(u,up),(v,up))) or _dot(_cross(u,v),up) < .99999:
        raise ValueError("Frame must be orthonormal and right-handed: u cross v = up")
    points = [_vector(p,2) for p in data["floor_polygon"]]
    n = len(points)
    if n < 3 or any(math.dist(points[i],points[(i+1)%n]) < EPS for i in range(n)):
        raise ValueError("Floor requires at least three distinct consecutive vertices")
    for i in range(n):
        for j in range(i+1,n):
            if j == i+1 or (i == 0 and j == n-1):
                continue
            if _intersects(points[i],points[(i+1)%n],points[j],points[(j+1)%n]):
                raise ValueError("Floor polygon must not self-intersect")
    area = sum(points[i][0]*points[(i+1)%n][1]-points[(i+1)%n][0]*points[i][1] for i in range(n))/2
    if area <= EPS:
        raise ValueError("Floor polygon must be counterclockwise, with positive area")
    height = _number(data["height"])
    if height <= 0:
        raise ValueError("Height must be positive")
    ids = set()
    occupied = {}
    for opening in data.get("openings", []):
        if not opening.get("id") or opening["id"] in ids:
            raise ValueError("Opening IDs must be nonempty and unique")
        ids.add(opening["id"])
        if opening.get("hinge") not in (None,"start","end"):
            raise ValueError("Optional door hinge must be start or end")
        wall = opening["wall_index"]
        if type(wall) is not int or not 0 <= wall < n:
            raise ValueError("Opening wall_index outside floor polygon")
        if opening.get("kind") not in ("door", "window", "glazing") or opening.get("certainty") not in ("observed", "inferred") or not opening.get("evidence"):
            raise ValueError("Opening requires kind, certainty and evidence")
        start,end,bottom,top = (_number(opening[k]) for k in ("start","end","bottom","top"))
        if not 0 <= start < end <= math.dist(points[wall],points[(wall+1)%n]) or not 0 <= bottom < top <= height:
            raise ValueError("Opening lies outside its host wall")
        for other in occupied.get(wall, []):
            if min(end,other[1]) > max(start,other[0])+EPS and min(top,other[3]) > max(bottom,other[2])+EPS:
                raise ValueError("Overlapping openings on the same wall")
        occupied.setdefault(wall, []).append((start,end,bottom,top))
    scale = data.get("scale", {"status":"uncalibrated"})
    if scale.get("status") not in ("uncalibrated", "assumed", "calibrated"):
        raise ValueError("Unknown scale status")
    if scale["status"] != "uncalibrated":
        if _number(scale["meters_per_unit"]) <= 0:
            raise ValueError("Scale must be positive")
        if scale["status"] == "calibrated" and not scale.get("reference_measurement"):
            raise ValueError("Calibrated scale requires a reference measurement")
    return points, area, height, scale


def _dxf(segments):
    # Unitless coordinates: scaling belongs to metadata, never silently to vertices.
    rows = ['0','SECTION','2','HEADER','9','$INSUNITS','70','0','0','ENDSEC','0','SECTION','2','ENTITIES']
    for layer,a,b in segments:
        rows += ['0','LINE','8',layer,'10',str(a[0]),'20',str(a[1]),'30',str(a[2]),'11',str(b[0]),'21',str(b[1]),'31',str(b[2])]
    return '\n'.join(rows + ['0','ENDSEC','0','EOF']) + '\n'


def build_cad(evidence_path: Path, output_dir: Path) -> dict[str, str]:
    """Export reviewed flat-ceiling envelope; refuse to overwrite existing outputs.

    Openings are separate outlines, not boolean wall holes. OBJ uses polygon
    faces (including concave floors); consumers must triangulate when needed.
    """
    data = json.loads(Path(evidence_path).read_text())
    points, area, height, scale = validate_evidence(data)
    frame = data['frame']; n = len(points)
    def world(p):
        return [frame['origin'][k]+p[0]*frame['u'][k]+p[1]*frame['v'][k]+p[2]*frame['up'][k] for k in range(3)]
    local = [[*p, z] for z in (0,height) for p in points]
    vertices = [world(p) for p in local]
    faces = [list(reversed(range(n))),list(range(n,2*n))] + [[i,(i+1)%n,(i+1)%n+n,i+n] for i in range(n)]
    edges = sorted({tuple(sorted((a,b))) for f in faces for a,b in zip(f,f[1:]+f[:1])})
    openings = []
    for item in data.get('openings',[]):
        a,b = points[item['wall_index']],points[(item['wall_index']+1)%n]
        length = math.dist(a,b)
        def at(t,z): return [a[0]+(b[0]-a[0])*t/length,a[1]+(b[1]-a[1])*t/length,z]
        corners = [at(item['start'],item['bottom']),at(item['end'],item['bottom']),at(item['end'],item['top']),at(item['start'],item['top'])]
        openings.append(dict(item,local_corners=corners,corners=[world(p) for p in corners]))
    result = dict(schema_version=1, source_take_id=data['source_take_id'], review=data['review'], evidence=data['evidence'], frame=frame, scale=scale,
                  shell=dict(vertices=vertices,faces=faces,floor_polygon=points,height=height), openings=openings,
                  surface_provenance=data.get('surface_provenance', []), opening_review=data.get('opening_review'),
                  measurements=dict(area_scene_units_squared=area,volume_scene_units_cubed=area*height),
                  limitations=['Reviewed estimate, not surveyed as-built CAD.','Flat ceiling and vertical walls only.','Openings are separate outlines; wall thickness and recesses unknown.','OBJ polygon faces require triangulation for some renderers.'])
    if scale['status'] != 'uncalibrated':
        result['measurements'].update(area_m2=area*scale['meters_per_unit']**2,volume_m3=area*height*scale['meters_per_unit']**3)
    def dimension(length):
        if scale['status'] == 'uncalibrated': return f'{length:.2f} u'
        inches = round(length*scale['meters_per_unit']/0.0254)
        return f'{inches//12}′ {inches%12}″' + (' (assumed)' if scale['status']=='assumed' else '')
    note = 'UNCALIBRATED scene units; no physical dimensions.' if scale['status']=='uncalibrated' else f"{scale['status'].upper()} scale: {scale['meters_per_unit']:g} m/unit. Estimated geometry."
    # Schematic plan cut: merge projected spans before splitting each host wall.
    plan = []
    for i in range(n):
        a,b=points[i],points[(i+1)%n]; length=math.dist(a,b)
        def along(t):return [a[0]+(b[0]-a[0])*t/length,a[1]+(b[1]-a[1])*t/length,0]
        spans=sorted((o['start'],o['end']) for o in openings if o['wall_index']==i)
        cursor=0
        for start,end in spans:
            if start>cursor:plan.append(('ROOM',along(cursor),along(start)))
            cursor=max(cursor,end)
        if cursor<length:plan.append(('ROOM',along(cursor),along(length)))
    for opening in openings:
        a,b=[[*c[:2],0] for c in opening['local_corners'][:2]]
        length=math.dist(a,b); tangent=[(b[k]-a[k])/length for k in range(2)]
        inward=[-tangent[1],tangent[0]] # CCW floor always lies left of its walls.
        for jamb in (a,b):
            plan.append(('JAMB',[jamb[0]-.035*inward[0],jamb[1]-.035*inward[1],0],[jamb[0]+.035*inward[0],jamb[1]+.035*inward[1],0]))
        if opening['kind'] != 'door':
            for sign in (-1,1):plan.append(('GLAZING',[a[0]+sign*.015*inward[0],a[1]+sign*.015*inward[1],0],[b[0]+sign*.015*inward[0],b[1]+sign*.015*inward[1],0]))
        elif opening.get('hinge'):
            hinge=a if opening['hinge']=='start' else b
            direction=tangent if opening['hinge']=='start' else [-x for x in tangent]
            tip=[hinge[0]+length*inward[0],hinge[1]+length*inward[1],0]
            plan.append(('SWING_ESTIMATED',hinge,tip))
            arc=[[hinge[k]+length*(math.cos(t)*direction[k]+math.sin(t)*inward[k]) for k in range(2)]+[0] for t in [j*math.pi/48 for j in range(25)]]
            plan.extend(('SWING_ESTIMATED',a,b) for a,b in zip(arc,arc[1:]))
    def drawing(volume=False):
        project = (lambda p: ((p[0]-p[1])*.8660254,(p[0]+p[1])*.5-p[2])) if volume else (lambda p:(p[0],-p[1]))
        coords=[project(p) for p in local]; xs,ys=zip(*coords)
        factor=min(900/max(max(xs)-min(xs),EPS),650/max(max(ys)-min(ys),EPS))
        def xy(p):
            x,y=project(p); return (110+(x-min(xs))*factor,140+(y-min(ys))*factor)
        def line(a,b,color='#172e40',width=2):
            x,y=xy(a);xx,yy=xy(b)
            return f'<path d="M{x:.3f},{y:.3f} L{xx:.3f},{yy:.3f}" stroke="{color}" stroke-width="{width}" fill="none"/>'
        out=['<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1000" viewBox="0 0 1200 1000">','<rect width="1200" height="1000" fill="white"/>',f'<text x="50" y="50" font-family="sans-serif" font-size="26">{escape(str(data.get("label",data["source_take_id"])))} · {"Volume" if volume else "Plan"}</text>']
        if volume:
            for a,b in edges:out.append(line(local[a],local[b]))
            for opening in openings:
                corners=opening['local_corners']
                for a,b in zip(corners,corners[1:]+corners[:1]):out.append(line(a,b,'#1686d9'))
        else:
            for layer,a,b in plan:
                path=line(a,b,'#172e40' if layer in ('ROOM','JAMB') else '#1686d9',5 if layer=='ROOM' else 1.5)
                if layer=='SWING_ESTIMATED':path=path.replace('<path ','<path class="swing-estimated" stroke-dasharray="6 4" ')
                out.append(path)
        def screenline(a,b):
            return f'<path d="M{a[0]:.3f},{a[1]:.3f} L{b[0]:.3f},{b[1]:.3f}" stroke="#1686d9" stroke-width="1" fill="none"/>'
        def dimension_line(a,b):
            aa,bb=xy(a),xy(b);dx,dy=bb[0]-aa[0],bb[1]-aa[1];length=math.hypot(dx,dy)
            if length<EPS:return
            normal=(-dy/length,dx/length);offset=32
            da=tuple(aa[k]+offset*normal[k] for k in range(2));db=tuple(bb[k]+offset*normal[k] for k in range(2))
            out.append('<g class="endpoint-dimension">')
            for original,shifted in ((aa,da),(bb,db)):
                out.append(screenline(original,tuple(shifted[k]+6*normal[k] for k in range(2))))
                out.append(screenline((shifted[0]-4,shifted[1]+4),(shifted[0]+4,shifted[1]-4)))
            out.append(screenline(da,db))
            x,y=((da[k]+db[k])/2 for k in range(2))
            out.append(f'<text x="{x:.2f}" y="{y-7:.2f}" text-anchor="middle" font-family="sans-serif" font-size="15" fill="#1686d9">{escape(dimension(math.dist(a,b)))}</text></g>')
        for i in range(n):dimension_line(local[i],local[(i+1)%n])
        if volume:dimension_line(local[0],local[n])
        out.append(f'<text x="50" y="900" font-family="sans-serif" font-size="18">Height: {escape(dimension(height))} · Area: {area:.2f} u²</text>')
        out.append(f'<text x="50" y="935" font-family="sans-serif" font-size="16">{escape(note)}</text><text x="50" y="965" font-family="sans-serif" font-size="14">Schematic opening gaps; no wall thickness. Dashed door swings inward, estimated; hinge only if supplied.</text></svg>')
        return ''.join(out)
    volume=[('ROOM',vertices[i],vertices[j]) for i,j in edges]
    for opening in openings:
        for a,b in zip(opening['corners'],opening['corners'][1:]+opening['corners'][:1]):volume.append(('OPENING',a,b))
    files={'room-source.json':json.dumps(result,indent=2)+'\n','room-shell.obj':'# Reviewed envelope; native uncalibrated coordinates\n'+'\n'.join('v '+' '.join(map(str,p)) for p in vertices)+'\n'+'\n'.join('f '+' '.join(str(i+1) for i in face) for face in faces)+'\n',
           'room-plan.svg':drawing(),'room-volume.svg':drawing(True),'room-plan.dxf':_dxf(plan),'room-volume-native.dxf':_dxf(volume)}
    output_dir=Path(output_dir);output_dir.mkdir(parents=True,exist_ok=True)
    if any((output_dir/name).exists() for name in files):raise FileExistsError('CAD outputs exist; use a new output directory')
    for name,content in files.items():
        with (output_dir/name).open('x') as handle:handle.write(content)
    return {name:str(output_dir/name) for name in files}
