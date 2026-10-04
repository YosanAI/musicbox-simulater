import { clamp } from '../math/scalars.js';
import { synthesizeTine } from './tineSynthesis.js';
import { INDEX_KNOCK_GAIN, synthesizeIndexKnock } from './indexingSynthesis.js';
import { getCylinderDuration, getNoteTime } from '../cylinder/timing.js';

/** Encode an AudioBuffer as stereo, 16-bit little-endian PCM WAV. */
export function encodeStereoWav(buffer) {
  const frameCount = buffer.length;
  const bytes = new ArrayBuffer(44 + frameCount * 4);
  const view = new DataView(bytes);
  const writeText = (offset, text) => {
    for (let index = 0; index < text.length; index++) {
      view.setUint8(offset + index, text.charCodeAt(index));
    }
  };
  writeText(0, 'RIFF');
  view.setUint32(4, 36 + frameCount * 4, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  writeText(36, 'data');
  view.setUint32(40, frameCount * 4, true);

  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);
  for (let frame = 0; frame < frameCount; frame++) {
    view.setInt16(44 + frame * 4, Math.round(clamp(left[frame], -1, 1) * 32767), true);
    view.setInt16(46 + frame * 4, Math.round(clamp(right[frame], -1, 1) * 32767), true);
  }
  return bytes;
}

/**
 * Render the complete indexed programme plus its decay tail. Dry export:
 * live volume and room resonance are deliberately not part of this render.
 */
export async function renderCylinderWav(spec, speed = 1) {
  const sampleRate = 32000;
  const duration = getCylinderDuration(spec) / speed + 6;
  if (duration > 180) {
    throw new Error('Audio export is limited to three minutes. Shorten the cylinder or increase revolution speed.');
  }
  const context = new OfflineAudioContext(2, Math.ceil(duration * sampleRate), sampleRate);
  const output = context.createGain();
  output.gain.value = 0.36;
  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -14;
  limiter.ratio.value = 4;
  output.connect(limiter).connect(context.destination);
  const cache = new Map();

  for (const note of spec.notes) {
    if (!cache.has(note.midi)) {
      const samples = synthesizeTine(note.midi, sampleRate);
      const buffer = context.createBuffer(1, samples.length, sampleRate);
      buffer.copyToChannel(samples, 0);
      cache.set(note.midi, buffer);
    }
    const source = context.createBufferSource();
    const gain = context.createGain();
    const pan = context.createStereoPanner();
    source.buffer = cache.get(note.midi);
    gain.gain.value = note.velocity * 0.68;
    pan.pan.value = (note.tooth / 71 - 0.5) * 1.25;
    source.connect(gain).connect(pan).connect(output);
    source.start(getNoteTime(note, spec) / speed);
  }
  if ((spec.turns ?? 1) > 1) {
    const samples = synthesizeIndexKnock(sampleRate);
    const buffer = context.createBuffer(1, samples.length, sampleRate);
    buffer.copyToChannel(samples, 0);
    for (let turn = 1; turn < spec.turns; turn++) {
      const source = context.createBufferSource();
      const gain = context.createGain();
      const pan = context.createStereoPanner();
      source.buffer = buffer;
      gain.gain.value = INDEX_KNOCK_GAIN;
      pan.pan.value = 0.25;
      source.connect(gain).connect(pan).connect(output);
      source.start(turn * spec.duration / speed);
    }
  }
  return encodeStereoWav(await context.startRendering());
}
