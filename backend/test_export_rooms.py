import json

from export_rooms import export, space_record


SPACE = {'id': 'hiroto-space', 'name': 'Hiroto space', 'place': 'Brooklyn, NY', 'project': 'living',
         'tag': 'room', 'w': 3.069, 'd': 3.728, 'h': 2.733,
         'doors': [{'wall': 'S', 'pos': .5, 'w': .9}], 'hue': 30}
TAGS = {'anchors': [{'id': 'window', 'tags': ['window-view', 'natural-light']},
                    {'id': 'room-center', 'tags': ['meeting-room', 'window-view']}]}


def write(path, value):
    path.write_text(json.dumps(value))
    return path


def test_space_record_is_uncalibrated_by_default_and_dedupes_keywords(tmp_path):
    record = space_record(SPACE, TAGS)
    assert record['calibrated'] is False
    assert record['keywords'] == ['window-view', 'natural-light', 'meeting-room']
    assert record['format_version'] == 1


def test_export_writes_room_folder_and_index(tmp_path):
    space = write(tmp_path / 'space.json', SPACE)
    tags = write(tmp_path / 'tags.json', TAGS)
    out = tmp_path / 'rooms'
    folder = export(space, tags, out)
    assert json.loads((folder / 'space.json').read_text())['name'] == 'Hiroto space'
    assert json.loads((folder / 'tags.json').read_text()) == TAGS
    index = json.loads((out / 'index.json').read_text())
    assert [r['id'] for r in index['rooms']] == ['hiroto-space']


def test_reexport_replaces_index_entry_instead_of_duplicating(tmp_path):
    space = write(tmp_path / 'space.json', SPACE)
    tags = write(tmp_path / 'tags.json', TAGS)
    out = tmp_path / 'rooms'
    export(space, tags, out)
    export(space, tags, out)
    index = json.loads((out / 'index.json').read_text())
    assert len(index['rooms']) == 1
