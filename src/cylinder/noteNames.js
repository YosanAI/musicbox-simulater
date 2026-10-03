import { modulo } from '../math/scalars.js';
const PITCH_CLASSES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
/** @param {number} midi MIDI note number. */
export function noteName(midi) {
  return PITCH_CLASSES[modulo(midi, 12)] + (Math.floor(midi / 12) - 1);
}
export function midiToFrequency(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}
