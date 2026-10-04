import { TAU } from '../math/scalars.js';

// Shared by live playback and WAV export so the mechanical cue has the same level.
export const INDEX_KNOCK_GAIN = 1.2;

/** A rounded, low-pitched impact as the cylinder settles into its next track. */
export function synthesizeIndexKnock(sampleRate) {
  const data = new Float32Array(Math.ceil(sampleRate * 0.16));
  const smoothing = 1 - Math.exp(-TAU * 650 / sampleRate);
  let seed = 27183;
  let filteredNoise = 0;
  for (let index = 0; index < data.length; index++) {
    const seconds = index / sampleRate;
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    const noise = (seed >>> 0) / 4294967296 * 2 - 1;
    filteredNoise += smoothing * (noise - filteredNoise);
    const attack = 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, seconds / 0.003));
    const body = (Math.sin(TAU * 180 * seconds) * 0.62 +
      Math.sin(TAU * 330 * seconds) * 0.28 +
      Math.sin(TAU * 520 * seconds) * 0.10) * Math.exp(-seconds * 55);
    const impact = filteredNoise * Math.exp(-seconds * 110) * 0.24;
    data[index] = (body + impact) * attack * 0.65;
  }
  return data;
}
