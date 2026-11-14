import unittest
from pipeline import observations, link_views, slack_url

class Pipeline(unittest.TestCase):
    def manifest(self):
        return {'sha256':'abc','duration_seconds':10,'frames':[{'id':'frame-0000','requested_timestamp_seconds':0},{'id':'frame-0001','requested_timestamp_seconds':5}]}
    def test_timing_not_location(self):
        item = observations(self.manifest(), {'segments':[{'start':4,'end':6,'text':'wood wall'}]})['observations'][0]
        self.assertEqual(item['candidate_frame_id'], 'frame-0001')
        self.assertIsNone(item['spatial_anchor'])
    def test_bad_time(self):
        with self.assertRaises(ValueError): observations(self.manifest(), {'segments':[{'start':-1,'end':2,'text':'bad'}]})
    def test_empty_transcript(self):
        self.assertEqual(observations(self.manifest(), {})['observations'], [])
    def test_mapping_preserves_bundle(self):
        pose = {'done':True,'id':'op','response':{'frames':[{'camera':{},'depth':{'confidenceAsset':{'assetId':'c'}}}]}}
        out = link_views(self.manifest(), ['frame-0001'], pose)
        self.assertEqual(out['views'][0]['posed_view'], pose['response']['frames'][0])
    def test_count_mismatch(self):
        with self.assertRaises(ValueError): link_views(self.manifest(), [], {'done':True,'response':{'frames':[{}]}})
    def test_url_restriction(self):
        for url in ['http://files.slack.com/a','https://evil.com/a','https://files.slack.com.evil.com/a','https://user@files.slack.com/a']:
            with self.assertRaises(ValueError): slack_url(url)
        self.assertEqual(slack_url('https://files.slack.com/a'), 'https://files.slack.com/a')
if __name__ == '__main__': unittest.main()
