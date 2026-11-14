"""Extract ordered RGB frames with actual decoded source timestamps."""
import json
import math
import subprocess
from pathlib import Path
from .core import read, write, sha256


def command(args):
    return subprocess.run(args, check=True, capture_output=True, text=True).stdout


def _extract(video, output, interval=1.0, max_frames=60):
    if not math.isfinite(interval) or interval <= 0 or not 2 <= max_frames <= 512:
        raise ValueError('Use positive interval and 2–512 maximum frames')
    video, output = Path(video).resolve(strict=True), Path(output)
    signature = {'sha256':sha256(video),'interval':interval,'max_frames':max_frames}
    manifest = output/'manifest.json'
    if manifest.exists():
        result=read(manifest)
        if result['source'] != signature: raise ValueError('Media settings changed; choose a new take')
        for item in result['frames']:
            if sha256(output/item['path']) != item['sha256']: raise ValueError('Frame changed')
        return result
    output.mkdir(parents=True,exist_ok=False)
    probe=json.loads(command(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(video)]))
    data=json.loads(command(['ffprobe','-v','error','-select_streams','v:0','-show_frames','-show_entries','frame=best_effort_timestamp_time','-of','json',str(video)]))
    pts=[float(f['best_effort_timestamp_time']) for f in data['frames']]
    if not pts or not all(math.isfinite(t) for t in pts): raise ValueError('Invalid source timestamps')
    candidates=[]; next_time=pts[0]
    for n,t in enumerate(pts):
        if t+1e-7>=next_time: candidates.append(n); next_time=t+interval
    if len(candidates)>max_frames:
        candidates=[candidates[round(i*(len(candidates)-1)/(max_frames-1))] for i in range(max_frames)]
    if len(candidates)<2: raise ValueError('Need at least two sampled frames')
    expression='+'.join(f'eq(n\\,{n})' for n in candidates)
    command(['ffmpeg','-v','error','-nostdin','-i',str(video),'-vf','select='+expression,'-fps_mode','passthrough','-q:v','2',str(output/'frame-%04d.jpg')])
    frames=[{'id':f'frame-{i:04d}','path':f'frame-{i:04d}.jpg','source_frame_index':n,
             'timestamp_seconds':pts[n]-pts[0],'source_pts_seconds':pts[n],
             'sha256':sha256(output/f'frame-{i:04d}.jpg')} for i,n in enumerate(candidates,1)]
    audio=any(s['codec_type']=='audio' for s in probe['streams'])
    if audio: command(['ffmpeg','-v','error','-nostdin','-i',str(video),'-vn','-ac','1','-ar','16000',str(output/'audio.wav')])
    result={'schema_version':1,'source':signature,'frames':frames,'audio':'audio.wav' if audio else None,
            'duration_seconds':float(probe['format']['duration']),'timestamp_origin_source_pts':pts[0],
            'review_status':'unreviewed','sampling':'uniform temporal sampling, not image-quality selection'}
    write(manifest,result)
    return result


def extract(video, output, interval=1.0, max_frames=60):
    """Publish media only after all extraction outputs are complete."""
    import tempfile
    output=Path(output)
    if output.exists():
        if not (output/'manifest.json').exists():
            raise FileExistsError('Incomplete media directory preserved; move it aside before retrying')
        return _extract(video,output,interval,max_frames)
    output.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.media-build-',dir=output.parent) as staging:
        stage=Path(staging)/'media'
        result=_extract(video,stage,interval,max_frames)
        stage.rename(output)
    return result
