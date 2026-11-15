import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from room_pipeline.workflow import load_config, build_command, main


class WorkflowTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name).resolve()
        self.path = self.root / 'take.json'
        self.data = {'schema_version': 1, 'video': 'input.mov', 'space': 'hotel', 'take': 'take-001'}
        self.save()
    def tearDown(self): self.tmp.cleanup()
    def save(self): self.path.write_text(json.dumps(self.data))
    def test_paths_relative_to_config(self):
        config = load_config(self.path)
        self.assertEqual(config['video'], str(self.root / 'input.mov'))
        self.assertEqual(config['output_root'], str(self.root / 'runs'))
    def test_default_never_executes(self):
        with patch('room_pipeline.workflow.subprocess.run') as run, patch('builtins.print'):
            self.assertEqual(main([str(self.path)]), 0)
            run.assert_not_called()
    def test_permissions_not_persisted(self):
        for key in ('allow_paid', 'allow_upload', 'api_key', 'astra_command'):
            with self.subTest(key=key):
                self.path.write_text(json.dumps({**self.data, key: True}))
                with self.assertRaises(ValueError): load_config(self.path)
    def test_pose_does_not_request_splat(self):
        command = build_command(load_config(self.path), 'pose', allow_paid=True, max_credits=120)
        self.assertIn('--atlas', command)
        self.assertNotIn('--pose-reviewed', command)
    def test_splat_review_required(self):
        with self.assertRaises(ValueError): build_command(load_config(self.path), 'splat')
    def test_resume_has_no_paid_gate_by_default(self):
        command = build_command(load_config(self.path), 'splat', pose_reviewed=True)
        self.assertNotIn('--allow-paid', command)
        self.assertNotIn('--allow-upload', command)
    def test_astra_prepares_only(self):
        command = build_command(load_config(self.path), 'astra', allow_paid=True)
        self.assertIn('--astra', command)
        self.assertNotIn('--allow-agent', command)
        self.assertNotIn('--allow-paid', command)
    def test_export_requires_evidence(self):
        with self.assertRaises(ValueError): build_command(load_config(self.path), 'export')
    def test_publish_requires_destination(self):
        config = {**load_config(self.path), 'cad_evidence': '/tmp/reviewed.json'}
        with self.assertRaises(ValueError): build_command(config, 'publish')
    def test_publish_does_not_approve_by_config(self):
        config = {**load_config(self.path), 'cad_evidence': '/tmp/reviewed.json', 'drive_root': 'abc'}
        command = build_command(config, 'publish')
        self.assertIn('--package', command)
        self.assertNotIn('--allow-drive-upload', command)
    def test_reject_invalid_inputs(self):
        for key, value in [('space', '../bad'), ('interval', float('nan')), ('max_frames', True),
                           ('grid', [123, 456]), ('video', 'https://example.com/video'), ('take', '')]:
            with self.subTest(key=key):
                self.path.write_text(json.dumps({**self.data, key: value}))
                with self.assertRaises(ValueError): load_config(self.path)
    def test_run_explicit_and_no_shell(self):
        (self.root / 'input.mov').write_bytes(b'test')
        with patch('room_pipeline.workflow.subprocess.run') as run, patch('builtins.print'):
            run.return_value.returncode = 0
            self.assertEqual(main([str(self.path), '--run']), 0)
            self.assertIsInstance(run.call_args.args[0], list)
            self.assertFalse(run.call_args.kwargs.get('shell', False))

if __name__ == '__main__': unittest.main()
