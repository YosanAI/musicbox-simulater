import { TAU, clamp } from '../math/scalars.js';
/**
 * Deterministic modal synthesis from the original demo, sample for sample.
 * Modes above 45% of sample rate are omitted to reduce aliasing.
 * @param {number} midi
 * @param {number} sampleRate
 * @returns {Float32Array}
 */
export function synthesizeTine(midi, sampleRate) {
  let frequency = 440 * Math.pow(2, (midi - 69) / 12);
  let decayTime = clamp(2.2 * Math.pow(220 / frequency, .32), .35, 3.4);
  let length = Math.ceil(Math.min(9, decayTime * 4.2) * sampleRate);
  let data = new Float32Array(length);
  // Cantilever-like inharmonic modes, deliberately synthesized rather than sampled.
  const modes = [
    [1, 1, decayTime],
    [2.002, .12, decayTime * .43],
    [6.267, .26, decayTime * .2],
    [17.55, .10, decayTime * .075],
    [34.39, .045, decayTime * .04]
  ].filter(m => m[0] * frequency < sampleRate * .45);
  let seed = midi * 157 + 31;
  for (let i = 0; i < length; i++) {
    let seconds = i / sampleRate;
    let attack = 1 - Math.exp(-seconds * 1700);
    let value = 0;
    for (let [ratio, amplitude, decay] of modes) {
      value += amplitude * Math.sin(TAU * frequency * ratio * seconds) * Math.exp(-seconds / decay);
    }
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    let noise = ((seed >>> 0) / 4294967296 - .5) * Math.exp(-seconds * 260) * .18;
    value += .025 * Math.sin(TAU * 390 * seconds) * Math.exp(-seconds * 11);
    data[i] = (value * attack + noise) * .42;
  }
  return data;
}
