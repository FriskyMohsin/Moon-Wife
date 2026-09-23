import assert from 'node:assert/strict';
import { LIVE_VISION_FRAME_INTERVAL_MS, createLiveVisionInput, shouldSampleLiveVision } from '../src/lib/liveVisionProtocol';

assert.equal(LIVE_VISION_FRAME_INTERVAL_MS, 1500);
assert.deepEqual(createLiveVisionInput('frame-data'), { video: { data: 'frame-data', mimeType: 'image/jpeg' } });
assert.equal(shouldSampleLiveVision(true, 1, 1), true);
assert.equal(shouldSampleLiveVision(false, 1, 1), false);
assert.equal(shouldSampleLiveVision(true, 0, 1), false);
console.log('Live vision protocol regression tests passed.');
