"""Export one scanned room into the Roomboard data folder.

Writes roomboard/rooms/<id>/space.json and tags.json, then adds the room to
roomboard/rooms/index.json. Standard library only.

Usage:
    python3 export_rooms.py --space room.json --tags tags.json --out ../roomboard/rooms
"""
import argparse
import json
from pathlib import Path

FORMAT_VERSION = 1


def read_json(path):
    return json.loads(Path(path).read_text())


def doors_from_source(source):
    """Map the scan's door openings onto the app's {wall, pos, w} plan format.

    Uses room-source.json plan_basis (u runs left to right, v runs top to bottom in the
    plan; window side at top, entry at bottom). Only openings labelled as doors are used.
    """
    basis = source.get('plan_basis')
    room = source.get('openings', {})
    if not basis:
        return []
    width, depth = room.get('width'), room.get('depth')
    u_axis, v_axis = basis['u'], basis['v']
    dot = lambda p, a: p[0] * a[0] + p[1] * a[1] + p[2] * a[2]
    doors = []
    for op in room.get('openings', []):
        if not op.get('id', '').startswith('D'):
            continue
        floor = [c for c in op['corners'] if abs(c[1] - op['bottom']) < 1e-6] or op['corners'][:2]
        us = [dot(c, u_axis) - basis['origin_u'] for c in floor]
        vs = [dot(c, v_axis) - basis['origin_v'] for c in floor]
        u_mid, v_mid = sum(us) / len(us), sum(vs) / len(vs)
        # Pick the wall the opening sits on: nearest plan edge.
        edges = {'N': v_mid, 'S': depth - v_mid, 'W': u_mid, 'E': width - u_mid}
        wall = min(edges, key=edges.get)
        pos = (u_mid / width) if wall in 'NS' else (v_mid / depth)
        doors.append({'wall': wall, 'pos': round(pos, 3), 'w': round(op['width'], 3), 'source_id': op['id']})
    return doors


def space_record(space, tags):
    """Build the space.json the frontend reads. Sizes stay uncalibrated until measured."""
    keywords = []
    for anchor in tags.get('anchors', []):
        for tag in anchor.get('tags', []):
            if tag not in keywords:
                keywords.append(tag)
    return {
        'format_version': FORMAT_VERSION,
        'id': space['id'],
        'name': space['name'],
        'place': space.get('place', ''),
        'project': space.get('project'),
        'tag': space.get('tag', 'room'),
        'w': float(space['w']),
        'd': float(space['d']),
        'h': float(space['h']),
        'calibrated': bool(space.get('calibrated', False)),
        'units': space.get('units', 'metres'),
        'doors': space.get('doors', []),
        'keywords': keywords,
        'hue': space.get('hue', 200),
        'saved': space.get('saved', ''),
        'thumb': space.get('thumb'),  # photo file in the room folder, e.g. thumb.jpg (a frame from the scan video)
        'source': {'tags_file': 'tags.json', 'splat': space.get('splat')},
    }


def update_index(root, record):
    """Add or replace this room in index.json, keeping one entry per id."""
    index_path = root / 'index.json'
    rooms = []
    if index_path.exists():
        rooms = json.loads(index_path.read_text()).get('rooms', [])
    entry = {'id': record['id'], 'name': record['name'], 'place': record['place'],
             'folder': record['id'], 'calibrated': record['calibrated']}
    rooms = [r for r in rooms if r.get('id') != record['id']] + [entry]
    rooms.sort(key=lambda r: r['id'])
    index_path.write_text(json.dumps({'format_version': FORMAT_VERSION, 'rooms': rooms}, indent=2) + '\n')


def export(space_path, tags_path, out_root, source_path=None):
    space = read_json(space_path)
    if source_path:
        space = {**space, 'doors': doors_from_source(read_json(source_path))}
    tags = read_json(tags_path)
    record = space_record(space, tags)
    folder = Path(out_root) / record['id']
    folder.mkdir(parents=True, exist_ok=True)
    (folder / 'space.json').write_text(json.dumps(record, indent=2) + '\n')
    (folder / 'tags.json').write_text(json.dumps(tags, indent=2) + '\n')
    update_index(Path(out_root), record)
    return folder


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--space', required=True, type=Path)
    parser.add_argument('--tags', required=True, type=Path)
    parser.add_argument('--out', required=True, type=Path)
    parser.add_argument('--source', type=Path, help='room-source.json from the scan; fills in doors')
    args = parser.parse_args()
    folder = export(args.space, args.tags, args.out, args.source)
    print(f'wrote {folder}')


if __name__ == '__main__':
    main()
