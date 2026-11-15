import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock
from room_pipeline.atlas import Atlas
from room_pipeline.core import read,write,safe_operation,lock

class SafetyTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(); self.root=Path(self.tmp.name)
    def tearDown(self): self.tmp.cleanup()
    def adapter(self,**kw):
        a=Atlas(self.root,Path('unused'),**kw); a.call=Mock(); return a
    def test_upload_requires_permission(self):
        a=self.adapter()
        with self.assertRaises(PermissionError): a.upload_frames({'frames':[{'sha256':'x'}]})
        a.call.assert_not_called()
    def test_paid_requires_permission(self):
        a=self.adapter()
        with self.assertRaises(PermissionError): a.job('pose','task',{},2)
        a.call.assert_not_called()
    def test_budget_is_cumulative(self):
        a=self.adapter(allow_paid=True,budget=1)
        with self.assertRaises(PermissionError): a.job('pose','task',{},2)
        a.call.assert_not_called()
    def test_ambiguous_submission_never_repeated(self):
        a=self.adapter(allow_paid=True,budget=6000); a.call.side_effect=RuntimeError()
        with self.assertRaises(RuntimeError): a.job('pose','task',{},2)
        self.assertEqual(a.state['jobs']['pose']['status'],'submitting')
        b=self.adapter(allow_paid=True,budget=6000)
        with self.assertRaises(RuntimeError): b.job('pose','task',{},2)
        b.call.assert_not_called()
    def test_saved_operation_resumes_wait(self):
        a=self.adapter(); write(a.private/'pose-request.json',{})
        a.state['jobs']['pose']={'operation_id':'op','credits_reserved':2,'status':'submitted'}
        a.call.side_effect=RuntimeError()
        with self.assertRaises(RuntimeError): a.job('pose','task',{},2)
        self.assertEqual(a.call.call_args.args[:3],('operations','wait','op'))
    def test_changed_request_rejected(self):
        a=self.adapter(); write(a.private/'pose-request.json',{})
        a.state['jobs']['pose']={'operation_id':'op'}
        with self.assertRaises(ValueError): a.job('pose','task',{'changed':True},2)
        a.call.assert_not_called()
    def test_lock_prevents_parallel_jobs(self):
        with lock(self.root):
            with self.assertRaises(FileExistsError):
                with lock(self.root): pass
    def test_sanitize(self):
        self.assertEqual(safe_operation({'url':'https://secret','apiKey':'secret','frames':[{'path':'x'}]}),{'frames':[{'path':'x'}]})

if __name__=='__main__':unittest.main()
