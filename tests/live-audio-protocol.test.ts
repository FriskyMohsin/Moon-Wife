import assert from 'node:assert/strict';
import { createRealtimeAudioInput, decodedBase64ByteLength, extractModelAudioChunks } from '../src/lib/liveAudioProtocol';

assert.deepEqual(createRealtimeAudioInput('AQIDBA=='), {
  audio: { data: 'AQIDBA==', mimeType: 'audio/pcm;rate=16000' },
});
assert.equal(decodedBase64ByteLength('AQIDBA=='), 4);
assert.deepEqual(extractModelAudioChunks({ serverContent: { modelTurn: { parts: [
  { text: 'ignored' },
  { inlineData: { mimeType: 'audio/pcm;rate=24000', data: 'AQIDBA==' } },
] } } }), [{ data: 'AQIDBA==', mimeType: 'audio/pcm;rate=24000' }]);
console.log('Live audio protocol regression tests passed.');
