import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from room_pipeline.core import write
from room_pipeline.transcription import align,transcribe

class TranscriptionTests(unittest.TestCase):
    def media(self):return {'source':{'sha256':'video'},'audio':'audio.wav','audio_offset_seconds':0,'duration_seconds':3,'frames':[{'id':'a','timestamp_seconds':0},{'id':'b','timestamp_seconds':2}]}
    def test_alignment_preserves_unlocalized_status(self):
        out=align(self.media(),{'segments':[{'start':1,'end':2,'text':'window'}]})
        self.assertEqual(out['observations'][0]['candidate_frame_id'],'b')
        self.assertIsNone(out['observations'][0]['spatial_anchor'])
    def test_late_audio_offsets_segments_and_words(self):
        media=self.media();media['audio_offset_seconds']=2
        out=align(media,{'segments':[{'start':0,'end':.5,'text':'window','words':[{'start':0,'end':.5,'word':'window'}]}]})['observations'][0]
        self.assertEqual(out['start_seconds'],2)
        self.assertEqual(out['audio_start_seconds'],0)
        self.assertEqual(out['words'][0]['start'],2)
        self.assertEqual(out['candidate_frame_id'],'b')
    def test_early_audio_outside_video_has_no_candidate(self):
        media=self.media();media['audio_offset_seconds']=-2
        out=align(media,{'segments':[{'start':0,'end':.5,'text':'before video'}]})['observations'][0]
        self.assertIsNone(out['candidate_frame_id'])
        self.assertEqual(out['start_seconds'],-2)
    def test_out_of_range(self):
        with self.assertRaises(ValueError):align(self.media(),{'segments':[{'start':-1,'end':2,'text':'x'}]})
    def test_missing_model_does_not_run(self):
        with tempfile.TemporaryDirectory() as d,patch('room_pipeline.transcription.subprocess.run') as run:
            with self.assertRaises(FileNotFoundError):transcribe(Path(d),self.media(),'python',model_dir=d)
            run.assert_not_called()
    def test_no_audio(self):
        self.assertEqual(transcribe(Path('.'),{'audio':None},'python'),{'status':'no_audio'})
    def test_transcribe_resume_and_failure(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);(root/'media').mkdir();(root/'media/audio.wav').write_bytes(b'audio');(root/'base.pt').write_bytes(b'mock weights')
            def run(args,**kwargs):
                if '-m' in args:write(Path(args[args.index('--output_dir')+1])/'audio.json',{'segments':[{'start':0,'end':1,'text':'hello'}]})
            with patch('room_pipeline.transcription.subprocess.run',side_effect=run) as mock:
                first=transcribe(root,self.media(),'python',model_dir=d)
                self.assertEqual(transcribe(root,self.media(),'python',model_dir=d),first)
                self.assertEqual(mock.call_count,2)
            (root/'transcription/audio.json').write_text('user edit')
            with self.assertRaises(ValueError):transcribe(root,self.media(),'python',model_dir=d)

if __name__=='__main__':unittest.main()
