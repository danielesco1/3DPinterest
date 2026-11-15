"""Place narration tags on a room's CAD shell instead of guessing from the timestamp alone.

For each anchor in tags.json, in order of preference:
  1. cad_sample:  a CAD surface sample whose selection_id/label matches the tag. The sample is a pixel on
                  a captured frame; we cast a ray from that frame's camera through the pixel onto the CAD
                  surface mesh. Camera = that frame. (The CAD's own evidence says what and where.)
  2. cad_element: a named CAD element (opening or secondary architecture such as a stair). Target = its
                  centre; camera = the frame (from its source frames) that faces it most directly.
  3. camera_ray:  no CAD match. Cast the narrator's view ray (frame nearest the spoken keyword) onto the
                  CAD surface; target = the hit point. Camera = that frame.
  4. unchanged:   if nothing hits, keep the existing anchor.

Matches are declared in a small JSON file per room (tag_matches/<room>.json) so every choice is reviewable.
Standard library only. Usage:
  python3 match_tags_to_cad.py --tags tags.json --envelope core-envelope.json --viewer-data viewer-data.json \
      --matches tag_matches/bookstore.json --out tags.cad.json
"""
import argparse, json, math
from pathlib import Path


def sub(a, b): return [a[i] - b[i] for i in range(3)]
def add(a, b): return [a[i] + b[i] for i in range(3)]
def mul(a, s): return [x * s for x in a]
def dot(a, b): return sum(a[i] * b[i] for i in range(3))
def cross(a, b): return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]
def norm(a):
    l = math.sqrt(dot(a, a)) or 1.0
    return [x / l for x in a]


def qrot(q, v):
    x, y, z, w = q
    t = [2*(y*v[2]-z*v[1]), 2*(z*v[0]-x*v[2]), 2*(x*v[1]-y*v[0])]
    return [v[0]+w*t[0]+(y*t[2]-z*t[1]), v[1]+w*t[1]+(z*t[0]-x*t[2]), v[2]+w*t[2]+(x*t[1]-y*t[0])]


def pixel_ray(cam, px=None):
    """World-space ray for a pixel (RUB camera: x right, y up, looking down -z). None = image centre."""
    e, k = cam['extrinsics'], cam['intrinsics']
    u, v = px if px else (k['cx'], k['cy'])
    d = [(u - k['cx']) / k['fx'], -(v - k['cy']) / k['fy'], -1.0]
    return e['position'], norm(qrot(e['quaternion'], d))


def mesh_triangles(env):
    m = env.get('surface_mesh') or {}
    if m.get('vertices') and m.get('triangles'):
        V = m['vertices']
        return [(V[a], V[b], V[c]) for a, b, c in m['triangles']]
    V, tris = env['vertices'], []
    for f in env['faces']:
        for i in range(1, len(f) - 1):
            tris.append((V[f[0]], V[f[i]], V[f[i+1]]))
    return tris


def raycast(origin, direction, tris, min_t=0.15):
    best = None
    for a, b, c in tris:
        e1, e2 = sub(b, a), sub(c, a)
        p = cross(direction, e2); det = dot(e1, p)
        if abs(det) < 1e-9: continue
        inv = 1.0 / det; s = sub(origin, a); u = dot(s, p) * inv
        if u < 0 or u > 1: continue
        q = cross(s, e1); v = dot(direction, q) * inv
        if v < 0 or u + v > 1: continue
        t = dot(e2, q) * inv
        if t > min_t and (best is None or t < best): best = t
    return add(origin, mul(direction, best)) if best is not None else None


def frame_index(name):
    # 'frame-0026' (1-based) or 'atlas/pose/frames_25_image.jpg' (0-based) -> 0-based index
    if isinstance(name, int): return name
    if name.startswith('frame-'): return int(name.split('-')[1]) - 1
    return int(name.split('frames_')[1].split('_')[0])


def nearest_frame(frames, t):
    return min(range(len(frames)), key=lambda i: abs(frames[i]['source_time_seconds'] - t))


def best_view(frames, point, candidates=None):
    """Frame whose camera faces the point most directly from a usable distance."""
    best, score = None, -1e9
    for i in (candidates if candidates else range(len(frames))):
        o, d = pixel_ray(frames[i]['camera'])
        to = sub(point, o); dist = math.sqrt(dot(to, to))
        if dist < 0.5: continue
        s = dot(d, norm(to)) - 0.05 * abs(dist - 3.0)
        if s > score: best, score = i, s
    return best


def spoken_time(anchor):
    sp = anchor.get('speech') or []
    return anchor.get('keyword_time', sp[0]['start'] if sp else 0.0)


def place(tags, env, vd, matches):
    frames, tris = vd['frames'], mesh_triangles(env)
    samples = [(s, ev) for ev in env.get('surface_evidence', []) for s in ev.get('samples', [])]
    elements = {o['tag']: o for o in env.get('opening_outlines', [])}
    elements.update({o['id']: o for o in env.get('secondary_architecture', [])})
    report = []
    for a in tags['anchors']:
        m = matches.get(a['anchor_id'], {})
        t = m.get('time', spoken_time(a))
        placed = None
        if m.get('sample_keywords'):
            cands = [(s, ev) for s, ev in samples
                     if any(k in (s.get('selection_id', '') + ' ' + ev.get('label', '')).lower() for k in m['sample_keywords'])
                     and (not m.get('surfaces') or ev['id'] in m['surfaces'])]
            for s, ev in sorted(cands, key=lambda c: abs(c[0].get('timestamp_seconds', 0) - t)):
                i = frame_index(s['frame'])
                hit = raycast(*pixel_ray(frames[i]['camera'], s['pixel']), tris)
                if hit:
                    placed = (hit, i, f"cad_sample: {ev['id']} '{ev.get('label') or ev['kind']}' sample '{s.get('selection_id')}' "
                                      f"at {s.get('timestamp_seconds')}s, ray-cast onto the CAD surface")
                    break
        if not placed and m.get('element') in elements:
            el = elements[m['element']]; vs = el.get('observed_vertices') or el['vertices']
            c = [sum(p[k] for p in vs) / len(vs) for k in range(3)]
            src = el.get('source_frames') or ([el['source_frame']] if 'source_frame' in el else None)
            i = best_view(frames, c, [frame_index(x) for x in src] if src else None)
            placed = (c, i, f"cad_element: {m['element']} '{el.get('label') or el.get('kind')}' centre, viewed from its best source frame")
        if not placed and m.get('ray') in ('up', 'down'):
            i = nearest_frame(frames, t); o = frames[i]['camera']['extrinsics']['position']
            hit = raycast(o, [0, 1 if m['ray'] == 'up' else -1, 0], tris)
            if hit:
                placed = (hit, i, f"cad_surface: straight {m['ray']} from the narrator at {frames[i]['source_time_seconds']:.1f}s onto the CAD {'ceiling' if m['ray']=='up' else 'floor'}")
        if not placed:
            i = nearest_frame(frames, t)
            hit = raycast(*pixel_ray(frames[i]['camera']), tris)
            if hit:
                placed = (hit, i, f"camera_ray: narrator view at {frames[i]['source_time_seconds']:.1f}s (keyword at {t}s) "
                                   f"ray-cast onto the CAD surface")
        if placed:
            p, i, why = placed
            a['position'] = [round(x, 3) for x in p]
            a['camera'] = [round(x, 3) for x in frames[i]['camera']['extrinsics']['position']]
            a['source'] = why + '; estimated, CAD is a reviewed-needed proposal'
            a['placement'] = why.split(':')[0]
        report.append((a['anchor_id'], a.get('placement', 'unchanged'), a['position']))
    tags['placement_note'] = ('Anchors placed by match_tags_to_cad.py: cad_sample and cad_element use the room CAD; '
                              'camera_ray uses the narrator view ray onto the CAD surface.')
    return tags, report


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    for k in ('tags', 'envelope', 'viewer-data', 'matches', 'out'):
        ap.add_argument('--' + k, required=True, type=Path)
    a = ap.parse_args()
    tags, report = place(json.loads(a.tags.read_text()), json.loads(a.envelope.read_text()),
                         json.loads(getattr(a, 'viewer_data').read_text()), json.loads(a.matches.read_text()))
    a.out.write_text(json.dumps(tags, indent=2, ensure_ascii=False) + '\n')
    for r in report: print(f'{r[0]:16} {r[1]:12} {r[2]}')


if __name__ == '__main__':
    main()
