"""Optional local Whisper transcription and temporal (not spatial) alignment."""
import math
import subprocess
import tempfile
from pathlib import Path
from .core import read, write, sha256


def align(media, transcript):
    frames=media['frames']; result=[]
    offset=float(media['audio_offset_seconds'])
    if not math.isfinite(offset): raise ValueError('Invalid audio/video timing offset')
    for i,s in enumerate(transcript.get('segments',[])):
        start,end=float(s['start']),float(s['end'])
        if not all(math.isfinite(t) for t in (start,end)) or not 0<=start<=end<=media.get('audio_duration_seconds',media['duration_seconds'])+1:
            raise ValueError('Transcript segment outside audio duration')
        audio_start,audio_end=start,end
        start,end=start+offset,end+offset
        overlaps=end>=0 and start<=media['duration_seconds']
        midpoint=(max(0,start)+min(media['duration_seconds'],end))/2
        nearest=min(frames,key=lambda f:abs(f['timestamp_seconds']-midpoint)) if frames and overlaps else None
        words=[dict(w,audio_start_seconds=w['start'],audio_end_seconds=w['end'],
                    start=float(w['start'])+offset,end=float(w['end'])+offset) for w in s.get('words',[])]
        result.append({'id':f'observation-{i:04d}','start_seconds':start,'end_seconds':end,
                       'audio_start_seconds':audio_start,'audio_end_seconds':audio_end,
                       'text':s['text'],'words':words,'review_status':'unreviewed',
                       'candidate_frame_id':nearest['id'] if nearest else None,
                       'spatial_anchor':None,'spatial_status':'unlocalized'})
    return {'schema_version':1,'source_video_sha256':media['source']['sha256'],'audio_offset_seconds':offset,
            'limitations':['Temporal association identifies a camera view, not the object described.','Transcription requires human review.'],
            'observations':result}


def transcribe(root, media, python, model='base', model_dir=None, language=None):
    """Only use an existing local model. Never silently download model weights."""
    root=Path(root)
    if not media.get('audio'): return {'status':'no_audio'}
    if not model.replace('-','').replace('.','').isalnum(): raise ValueError('Invalid model name')
    cache=Path(model_dir).expanduser() if model_dir else Path.home()/'.cache'/'whisper'
    if not (cache/(model+'.pt')).is_file():
        raise FileNotFoundError('Whisper model weights must be installed locally first')
    audio=root/'media'/media['audio']
    identity={'audio_sha256':sha256(audio),'model':model,'language':language,'audio_offset_seconds':media['audio_offset_seconds']}
    dest=root/'transcription'; checkpoint=dest/'checkpoint.json'
    if checkpoint.exists():
        state=read(checkpoint)
        if state['input']!=identity: raise ValueError('Transcription settings changed; use a new take revision')
        for name,digest in state['files'].items():
            if sha256(dest/name)!=digest: raise ValueError('Transcript changed; preserve edited copy')
        return {'status':'complete','path':str(dest)}
    if dest.exists(): raise FileExistsError('Incomplete transcription preserved; move aside before retry')
    # Import check has no external calls. Whisper runs only in selected local Python.
    check = ("import whisper,hashlib,pathlib,sys; "
             "p=pathlib.Path(sys.argv[1]); model=sys.argv[2]; "
             "expected=whisper._MODELS[model].split('/')[-2]; "
             "actual=hashlib.sha256(p.read_bytes()).hexdigest(); "
             "sys.exit(0 if actual==expected else 2)")
    subprocess.run([str(python),'-c',check,str(cache/(model+'.pt')),model],check=True,capture_output=True)
    with tempfile.TemporaryDirectory(prefix='.transcript-build-',dir=root) as tmp:
        stage=Path(tmp)/'transcription';stage.mkdir()
        args=[str(python),'-m','whisper',str(audio),'--model',model,'--model_dir',str(cache),
              '--output_dir',str(stage),'--output_format','json','--word_timestamps','True','--verbose','False']
        if language: args+=['--language',language]
        subprocess.run(args,check=True,capture_output=True)
        source=stage/(audio.stem+'.json')
        transcript=read(source)
        write(stage/'observations.json',align(media,transcript))
        write(stage/'checkpoint.json',{'input':identity,'files':{p.name:sha256(p) for p in stage.iterdir() if p.is_file()}})
        stage.rename(dest)
    return {'status':'complete','path':str(dest)}
