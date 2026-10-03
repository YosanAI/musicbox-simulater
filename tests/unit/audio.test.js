import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { synthesizeTine } from '../../src/audio/tineSynthesis.js';
import { synthesizeIndexClick } from '../../src/audio/indexingSynthesis.js';
import { SoundEngine } from '../../src/audio/SoundEngine.js';
import { encodeStereoWav, renderCylinderWav } from '../../src/audio/wavExport.js';
import { validateCylinder } from '../../src/cylinder/validation.js';

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
  await assert.rejects(() => renderCylinderWav({ duration: 60, turns: 3, notes: [] }, 1), /three minutes/);
});

test('indexing click is deterministic, finite and decays after its detent', () => {
  const samples = synthesizeIndexClick(32000);
  assert.equal(samples.length, 3520);
  assert(samples.every(Number.isFinite));
  assert.deepEqual(synthesizeIndexClick(32000), samples);
  const energy = segment => segment.reduce((sum, value) => sum + value * value, 0) / segment.length;
  assert(energy(samples.subarray(0, 640)) > energy(samples.subarray(2880)) * 100);
});

test('spring cancellation releases future notes and clicks while retaining active decays', () => {
  const sound = new SoundEngine();
  sound.context = { currentTime: 1 };
  const voice = when => {
    const calls = [];
    return { when, calls,
      source: { onended() {}, stop(at) { calls.push(['stop', at]); }, disconnect() { calls.push('source'); } },
      gain: { disconnect() { calls.push('gain'); } }, pan: { disconnect() { calls.push('pan'); } },
    };
  };
  const ringing = voice(0.5);
  const due = voice(1);
  const futureNote = voice(1.055);
  const futureClick = voice(1.075);
  sound.active = new Set([ringing, due, futureNote, futureClick]);
  sound.cancelScheduled();
  assert.deepEqual([...sound.active], [ringing, due]);
  assert.deepEqual(ringing.calls, []);
  assert.deepEqual(due.calls, []);
  for (const future of [futureNote, futureClick]) {
    assert.deepEqual(future.calls, [['stop', 1], 'source', 'gain', 'pan']);
    assert.equal(future.source.onended, null);
  }
});

test('WAV schedules the full indexed programme and its clicks at the selected revolution speed', async t => {
  const previous = globalThis.OfflineAudioContext;
  let rendered;
  class OfflineContext {
    constructor(channels, length, sampleRate) {
      Object.assign(this, { channels, length, sampleRate, starts: [], destination: {} });
      rendered = this;
    }
    node() {
      return { gain: {}, pan: {}, threshold: {}, ratio: {}, connect(target) { return target; } };
    }
    createGain() { return this.node(); }
    createDynamicsCompressor() { return this.node(); }
    createStereoPanner() { return this.node(); }
    createBuffer(channels, length) { return { length, copyToChannel() {} }; }
    createBufferSource() {
      const node = this.node();
      node.start = when => this.starts.push({ when, length: node.buffer.length });
      return node;
    }
    async startRendering() {
      return { length: this.length, sampleRate: this.sampleRate, getChannelData: () => new Float32Array(this.length) };
    }
  }
  globalThis.OfflineAudioContext = OfflineContext;
  t.after(() => {
    if (previous === undefined) delete globalThis.OfflineAudioContext;
    else globalThis.OfflineAudioContext = previous;
  });
  const spec = validateCylinder({ duration: 8, turns: 3, notes: [{ midi: 60, time: 1, turn: 2 }] });
  const bytes = await renderCylinderWav(spec, 2);
  assert.equal(rendered.length, 18 * 32000);
  assert.deepEqual(rendered.starts.map(start => start.when).sort((a, b) => a - b), [4, 8, 8.5]);
  assert.equal(rendered.starts.filter(start => start.length === 3520).length, 2);
  assert.equal(new DataView(bytes).getUint32(40, true), rendered.length * 4);
});
