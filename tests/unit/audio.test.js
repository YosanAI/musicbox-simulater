import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { synthesizeTine } from '../../src/audio/tineSynthesis.js';
import { encodeStereoWav, renderCylinderWav } from '../../src/audio/wavExport.js';

const baseline = JSON.parse(readFileSync(new URL('../fixtures/original-audio.json', import.meta.url)));
for (const entry of baseline) {
  test(`MIDI ${entry.midi} at ${entry.sampleRate} Hz matches the original PCM samples`, () => {
    const data = synthesizeTine(entry.midi, entry.sampleRate);
    assert.equal(data.length, entry.length);
    assert.equal(createHash('sha256').update(new Uint8Array(data.buffer)).digest('hex'), entry.sha256);
    assert(data.every(Number.isFinite));
  });
}

test('WAV has a valid stereo PCM header, interleaving and saturation', () => {
  const channels = [new Float32Array([0, 0.5, -1, 2]), new Float32Array([1, -0.5, 0, -2])];
  const bytes = encodeStereoWav({ length: 4, sampleRate: 32000, getChannelData: index => channels[index] });
  const view = new DataView(bytes);
  assert.equal(new TextDecoder().decode(new Uint8Array(bytes, 0, 4)), 'RIFF');
  assert.equal(view.getUint16(22, true), 2);
  assert.equal(view.getUint32(24, true), 32000);
  assert.equal(view.getUint32(40, true), 16);
  assert.equal(view.getInt16(46, true), 32767);
  assert.equal(view.getInt16(56, true), 32767);
  assert.equal(view.getInt16(58, true), -32767);
});

test('oversized offline renders fail before creating an audio context', async () => {
  await assert.rejects(() => renderCylinderWav({ duration: 600, notes: [] }, 1), /three minutes/);
});
