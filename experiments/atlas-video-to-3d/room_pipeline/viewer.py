"""Build a local-only Spark viewer from native-coordinate CAD and SPZ assets."""
import json
import math
import shutil
from pathlib import Path
from .gallery import atomic_json

VENDOR_FILES = ('three.module.js','three.core.js','OrbitControls.js','Pass.js','spark.module.js')


def edges(shell):
    vertices = shell['vertices']
    result = set()
    for face in shell['faces']:
        if len(face) < 3 or any(type(i) is not int or not 0 <= i < len(vertices) for i in face):
            raise ValueError('Invalid shell face')
        for a,b in zip(face, face[1:]+face[:1]):
            result.add(tuple(sorted((a,b))))
    return [[vertices[a],vertices[b]] for a,b in sorted(result)]


def build_viewer(run_dir, vendor_dir):
    run_dir, vendor_dir = Path(run_dir).resolve(), Path(vendor_dir).resolve()
    spzs = sorted((run_dir/'atlas').rglob('*.spz'))
    if len(spzs) != 1:
        raise ValueError('Viewer requires exactly one selected SPZ in atlas/')
    source = run_dir/'cad'/'room-source.json'
    cad = json.loads(source.read_text())
    if any(not (vendor_dir/name).is_file() for name in VENDOR_FILES):
        raise ValueError('Missing local Spark/Three vendor files; no network fallback')
    points = cad['shell']['vertices']
    if not points or any(len(p)!=3 or any(not math.isfinite(v) for v in p) for p in points):
        raise ValueError('Invalid shell vertices')
    out = run_dir/'viewer'; (out/'vendor').mkdir(parents=True, exist_ok=True)
    for name in VENDOR_FILES:
        shutil.copyfile(vendor_dir/name, out/'vendor'/name)
    data = {'spz':'../'+spzs[0].relative_to(run_dir).as_posix(), 'edges':edges(cad['shell']),
            'vertices':points,'up':cad['frame']['up'], 'scale':cad['scale'],
            'openings':[{'id':x['id'],'kind':x['kind'],'corners':x['corners']} for x in cad.get('openings',[])],
            'take_id':cad['source_take_id']}
    atomic_json(out/'scene.json',data)
    shutil.copyfile(Path(__file__).with_name('viewer.html'),out/'index.html')
    return out
