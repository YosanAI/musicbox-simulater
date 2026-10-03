import { TAU } from '../math/scalars.js';

// Shared by live playback and WAV export so the mechanical cue has the same level.
export const INDEX_CLICK_GAIN = 0.95;

/** A pawl snap, a metallic body knock and the detent that locks the next track. */
export function synthesizeIndexClick(sampleRate) {
  const data = new Float32Array(Math.ceil(sampleRate * 0.11));
  let seed = 27183;
  for (let index = 0; index < data.length; index++) {
    const seconds = index / sampleRate;
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    const noise = (seed >>> 0) / 4294967296 * 2 - 1;
    const snap = Math.exp(-seconds * 240);
    const detentTime = Math.max(0, seconds - 0.035);
    const detent = seconds >= 0.035 ? Math.exp(-detentTime * 240) * 0.72 : 0;
    const ring = Math.sin(TAU * 2100 * seconds) * Math.exp(-seconds * 75) * 0.23;
    const body = (Math.sin(TAU * 550 * seconds) * 0.35 +
      Math.sin(TAU * 1050 * seconds) * 0.12) * Math.exp(-seconds * 80);
    data[index] = (noise * (snap + detent) + ring + body) * 0.65;
  }
  return data;
}
