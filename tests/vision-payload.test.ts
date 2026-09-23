import assert from 'node:assert/strict';
import { normalizeVisionImageMimeType } from '../src/lib/visionPayload';

assert.equal(normalizeVisionImageMimeType('image/jpeg'), 'image/jpeg');
assert.equal(normalizeVisionImageMimeType('image/png'), 'image/png');
assert.equal(normalizeVisionImageMimeType('image/webp'), 'image/webp');
assert.equal(normalizeVisionImageMimeType('image/gif'), 'image/jpeg');
console.log('Vision payload regression tests passed.');
