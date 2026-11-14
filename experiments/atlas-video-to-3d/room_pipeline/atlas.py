"""CLI adapter with durable operation IDs and fail-closed submission recovery."""
import json
import subprocess
import uuid
from pathlib import Path
from .core import read, write, sha256, safe_operation
from prepare import pose_request, splat_request


class Atlas:
    def __init__(self, run_dir, launcher, allow_upload=False, allow_paid=False, budget=0):
        self.root=Path(run_dir); self.private=self.root/'private'; self.output=self.root/'atlas'
        self.launcher=Path(launcher); self.upload=allow_upload; self.paid=allow_paid; self.budget=budget
        self.private.mkdir(parents=True,exist_ok=True); self.output.mkdir(parents=True,exist_ok=True)
        self.state_path=self.private/'atlas-state.json'
        self.state=read(self.state_path) if self.state_path.exists() else {'uploads':{},'jobs':{}}

    def save(self): write(self.state_path,self.state)

    def call(self,*args):
        result=subprocess.run(['node',str(self.launcher),'--json',*map(str,args)],capture_output=True,text=True)
        if result.returncode: raise RuntimeError('Atlas CLI failed; no automatic resubmission')
        return json.loads(result.stdout)

    def upload_frames(self,media):
        ids=[]
        for f in media['frames']:
            key=f['sha256']
            if key not in self.state['uploads']:
                if not self.upload: raise PermissionError('Frame upload requires --allow-upload')
                response=self.call('assets','upload',self.root/'media'/f['path'])
                ident=response.get('id') or response.get('assetId')
                if not isinstance(ident,str) or not ident: raise ValueError('Missing asset ID')
                self.state['uploads'][key]=ident; self.save()
            ids.append(self.state['uploads'][key])
        return ids

    def job(self,stage,task,request,cost):
        request_path=self.private/(stage+'-request.json')
        previous=self.state['jobs'].get(stage)
        if previous and read(request_path)!=request: raise ValueError('Request changed; use a new take')
        if not previous:
            if not self.paid: raise PermissionError('Submission requires --allow-paid')
            reserved=sum(j['credits_reserved'] for j in self.state['jobs'].values())
            if cost+reserved>self.budget: raise PermissionError('Estimated credits exceed approved budget')
            write(request_path,request)
            previous={'status':'submitting','idempotency_key':str(uuid.uuid4()),'credits_reserved':cost}
            self.state['jobs'][stage]=previous; self.save()
            # Persist before dispatch. An interruption is ambiguous and MUST NOT resubmit.
            response=self.call('tasks','run',task,'--request',request_path,'--idempotency-key',previous['idempotency_key'])
            ident=response.get('id')
            if not isinstance(ident,str) or not ident: raise ValueError('Missing operation ID; reconcile manually')
            previous.update(operation_id=ident,status='submitted'); self.save()
        if not previous.get('operation_id'):
            raise RuntimeError('Submission uncertain. Reconcile saved idempotency key with Atlas before retrying')
        operation=self.call('operations','wait',previous['operation_id'],'--timeout','3600')
        if operation.get('done') is not True or operation.get('error'):
            raise RuntimeError('Atlas operation incomplete or failed; retained original operation ID')
        write(self.private/(stage+'-operation.json'),operation)
        write(self.output/(stage+'-operation.json'),safe_operation(operation))
        dest=self.output/stage
        if previous.get('status')!='downloaded':
            if dest.exists() and any(dest.iterdir()):
                raise RuntimeError('Partial download retained; move aside before retrying download')
            self.call('operations','download',previous['operation_id'],'--out',dest)
            download_manifest=dest/'operation.json'
            if download_manifest.exists(): write(download_manifest,safe_operation(read(download_manifest)))
            previous['files']={str(p.relative_to(dest)):sha256(p) for p in dest.rglob('*') if p.is_file()}
            if not previous['files']: raise ValueError('Atlas returned no downloadable files')
            previous['status']='downloaded'; self.save()
        for name,digest in previous['files'].items():
            if sha256(dest/name)!=digest: raise ValueError('Downloaded artifact changed')
        return operation

    def run(self,media,grid,pose_reviewed=False):
        ids=self.upload_frames(media)
        pose=self.job('pose','images2PosedRGBD',pose_request(ids,grid),len(ids)*2)
        write(self.output/'frame-map.json',{'frames':media['frames'],'pose_operation_id':self.state['jobs']['pose']['operation_id']})
        if not pose_reviewed: return {'status':'pose_review_required','pose':str(self.output/'pose')}
        self.job('splat','posedImages2Splats',splat_request(pose),5000)
        return {'status':'complete','atlas':str(self.output)}
