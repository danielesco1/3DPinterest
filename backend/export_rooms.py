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


def export(space_path, tags_path, out_root):
    space = read_json(space_path)
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
    args = parser.parse_args()
    folder = export(args.space, args.tags, args.out)
    print(f'wrote {folder}')


if __name__ == '__main__':
    main()
