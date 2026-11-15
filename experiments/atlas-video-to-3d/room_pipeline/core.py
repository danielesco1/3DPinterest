"""Small durable state helpers; never store credentials or raw provider errors."""
import hashlib
import json
import os
from pathlib import Path
from contextlib import contextmanager


def read(path):
    return json.loads(Path(path).read_text())


def write(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + '.tmp')
    with tmp.open('w') as f:
        json.dump(value, f, indent=2, allow_nan=False)
        f.write('\n'); f.flush(); os.fsync(f.fileno())
    os.replace(tmp, path)


def sha256(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as f:
        for chunk in iter(lambda: f.read(1024*1024), b''): h.update(chunk)
    return h.hexdigest()


@contextmanager
def lock(directory):
    directory.mkdir(parents=True, exist_ok=True)
    p = directory / '.run.lock'
    fd = os.open(p, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    try:
        os.write(fd, str(os.getpid()).encode()); os.close(fd)
        yield
    finally:
        p.unlink()


def safe_operation(value):
    """Drop signed URLs, account metadata and remote paths from portable output."""
    if isinstance(value, list): return [safe_operation(x) for x in value]
    if isinstance(value, dict):
        return {k:safe_operation(v) for k,v in value.items()
                if k not in {'url','readUrl','uploadUrl','ownerId','name','metadata','error'}
                and not k.lower().endswith(('token','key'))}
    if isinstance(value,str) and value.startswith(('http://','https://')): return None
    return value


def run_cad_stage(evidence, root, take_id):
    """Resume verified CAD unchanged; never overwrite a revised or edited model."""
    from .cad import build_cad
    import tempfile
    root, evidence = Path(root), Path(evidence)
    if read(evidence).get('source_take_id') != take_id:
        raise ValueError('CAD evidence belongs to another take')
    checkpoint = root/'private'/'cad-state.json'
    digest = sha256(evidence)
    dest = root/'cad'
    if checkpoint.exists():
        saved = read(checkpoint)
        if saved['evidence_sha256'] != digest:
            raise ValueError('Evidence changed; use a new take revision')
        for name, expected in saved['files'].items():
            if sha256(dest/name) != expected:
                raise ValueError('CAD artifact changed; preserve edits and use a new revision')
        return {name:str(dest/name) for name in saved['files']}
    if dest.exists():
        recovery=dest/'.cad-checkpoint.json'
        if recovery.exists():
            write(checkpoint,read(recovery))
            return run_cad_stage(evidence,root,take_id)
        raise FileExistsError('Uncheckpointed CAD output preserved; use a new revision')
    root.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.cad-build-', dir=root) as staging:
        stage = Path(staging)/'cad'
        files = build_cad(evidence, stage)
        saved = {'evidence_sha256':digest,'files':{name:sha256(path) for name,path in files.items()}}
        # The complete checkpoint travels with the atomic directory rename, allowing
        # recovery if interrupted before writing the private resume record.
        write(stage/'.cad-checkpoint.json',saved)
        stage.rename(dest)
    write(checkpoint,saved)
    return {name:str(dest/name) for name in saved['files']}
