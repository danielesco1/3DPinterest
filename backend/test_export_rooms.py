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


def test_doors_from_source_places_entry_door_on_south_wall():
    from export_rooms import doors_from_source
    source = {
        'plan_basis': {'u': [0.8483723447998737, 0.0, -0.5294000043244845],
                       'v': [0.5294000043244845, 0.0, 0.8483723447998737],
                       'origin_u': -1.420458171004781, 'origin_v': -1.7202908260958882},
        'openings': {'width': 3.069350471265588, 'depth': 3.7283524650252793, 'openings': [
            {'id': 'D1', 'width': 0.8694733531233484, 'bottom': -0.0009171157742617897,
             'corners': [[1.423146785744303, -0.0009171157742617897, 1.4788880875703299],
                         [2.1607839330745664, -0.0009171157742617897, 1.018588890666805],
                         [2.1607839330745664, 2.596417880944416, 1.018588890666805],
                         [1.423146785744303, 2.596417880944416, 1.4788880875703299]]},
            {'id': 'W1', 'width': 1.29, 'bottom': 1.0, 'corners': [[0, 1, 0], [1, 1, 0]]}]}}
    doors = doors_from_source(source)
    assert len(doors) == 1
    assert doors[0]['wall'] == 'S' and doors[0]['source_id'] == 'D1'
    assert 0.7 < doors[0]['pos'] < 0.78
