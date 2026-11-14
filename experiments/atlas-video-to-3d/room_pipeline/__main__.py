"""Run with: python3 -m room_pipeline --help."""
import argparse
import re
import sys
from pathlib import Path
from .core import lock, read, write, sha256, run_cad_stage
from .media import extract
from .atlas import Atlas


def main():
    p=argparse.ArgumentParser(description='Video → reviewed Atlas reconstruction → CAD → portable package. No network by default.')
    p.add_argument('video',type=Path)
    p.add_argument('--space',required=True); p.add_argument('--take',required=True)
    p.add_argument('--output-root',type=Path,default=Path('work/runs'))
    p.add_argument('--interval',type=float,default=1); p.add_argument('--max-frames',type=int,default=60)
    p.add_argument('--transcribe',action='store_true'); p.add_argument('--whisper-python',type=Path,default=Path(sys.executable))
    p.add_argument('--whisper-model',default='base'); p.add_argument('--whisper-model-dir',type=Path); p.add_argument('--language')
    p.add_argument('--atlas',action='store_true'); p.add_argument('--allow-upload',action='store_true')
    p.add_argument('--allow-paid',action='store_true'); p.add_argument('--max-credits',type=int,default=0)
    p.add_argument('--pose-reviewed',action='store_true'); p.add_argument('--grid',nargs=2,type=int,default=[720,1280])
    p.add_argument('--viewer-vendor',type=Path)
    p.add_argument('--astra',action='store_true',help='Prepare Atlas evidence for an Astra agent; stop for review')
    p.add_argument('--astra-command',help='JSON argv array for an authorized local agent bridge')
    p.add_argument('--allow-agent',action='store_true',help='Authorize configured bridge invocation; may transmit data or spend credits')
    p.add_argument('--cad-evidence',type=Path); p.add_argument('--package',action='store_true')
    p.add_argument('--drive-root'); p.add_argument('--allow-drive-upload',action='store_true')
    a=p.parse_args()
    if any(not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,79}',v) for v in [a.space,a.take]):
        p.error('Space and take must be safe slug identifiers')
    root=a.output_root.resolve()/a.space/a.take
    try:
        with lock(root):
            video=a.video.resolve(strict=True)
            identity={'space_id':a.space,'take_id':a.take,'video_sha256':sha256(video)}
            identity_path=root/'run.json'
            if identity_path.exists() and read(identity_path)!=identity: raise ValueError('Input changed; choose a new take')
            write(identity_path,identity)
            media=extract(video,root/'media',a.interval,a.max_frames)
            print(f'Prepared {len(media["frames"])} frames. Review coverage before Atlas. Estimated credits: {2*len(media["frames"])+5000}; verify current pricing.')
            if a.transcribe:
                from .transcription import transcribe
                result=transcribe(root,media,a.whisper_python,a.whisper_model,a.whisper_model_dir,a.language)
                print('Transcription: '+result['status'])
            if a.atlas:
                adapter=Atlas(root,Path(__file__).resolve().parents[1]/'worldlabs-local.mjs',a.allow_upload,a.allow_paid,a.max_credits)
                result=adapter.run(media,a.grid,a.pose_reviewed)
                print(result['status'])
                if result['status']!='complete': return
            if a.astra:
                import json
                from .astra import propose
                result=propose(root,a.take,json.loads(a.astra_command) if a.astra_command else None,a.allow_agent)
                print('Astra: '+result['status'])
                if not a.cad_evidence: return
            if a.cad_evidence:
                run_cad_stage(a.cad_evidence,root,a.take)
            if a.viewer_vendor:
                from .viewer import build_viewer
                build_viewer(root,a.viewer_vendor)
            if a.package or a.drive_root:
                from .gallery import build_package
                package=build_package(root,a.space,a.take,video=video)
                print(f'Package: {package}')
                if a.drive_root:
                    from .drive import publish_package
                    publish_package(package,a.drive_root,allow_upload=a.allow_drive_upload)
                    print('Drive publication completed')
    except Exception as e:
        # Error text from dependencies can contain signed URLs/secrets; keep CLI output safe.
        p.exit(1,f'{type(e).__name__}: pipeline stopped. Check stage inputs/state; no automatic paid retry.\n')

if __name__=='__main__': main()
