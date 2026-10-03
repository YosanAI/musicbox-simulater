import { DEFAULT_TUNING, TOOTH_COUNT, CYLINDER_LIMITS } from './constants.js';
/**
 * Normalize either a JSON definition or a geometry-derived score.
 * Times are sorted; coincident duplicate pins are removed, as in the original.
 * @param {object} raw
 * @returns {import('./types.js').CylinderSpec}
 */
export function validateCylinder(raw) {
  if (!raw || typeof raw !== 'object') {
    throw Error('This file does not contain a cylinder definition.');
  }
  const duration = Number(raw.duration ?? raw.secondsPerTurn ?? 30);
  if (!Number.isFinite(duration) || duration < CYLINDER_LIMITS.minDuration || duration > CYLINDER_LIMITS.maxDuration) {
    throw Error('One revolution must take between 2 and 600 seconds.');
  }
  const tuning = raw.tuning ?? raw.midiMap ?? DEFAULT_TUNING;
  if (!Array.isArray(tuning) || tuning.length !== TOOTH_COUNT || tuning.some(value => !Number.isInteger(value) || value < 0 || value > 127)) {
    throw Error('The tuning table must contain exactly 72 integer MIDI note numbers (0–127).');
  }
  if (!Array.isArray(raw.notes) || raw.notes.length > CYLINDER_LIMITS.maxPins) {
    throw Error('A cylinder needs a notes array, with at most 6,000 pins.');
  }
  let dropped = 0;
  let notes = raw.notes.map((note, index) => {
    let midi = note.midi ?? note.note;
    let tooth = note.tooth ?? tuning.indexOf(midi);
    let time = Number(note.time ?? note.t);
    let velocity = Number(note.velocity ?? .75);
    if (!Number.isInteger(tooth) || tooth < 0 || tooth >= TOOTH_COUNT || !Number.isFinite(time) || time < 0 || time >= duration || !Number.isFinite(velocity) || velocity <= 0 || velocity > 1) {
      throw Error('Invalid pin ' + (index + 1) + ': check time, tooth / MIDI note, and velocity (0–1).');
    }
    return {
      tooth,
      midi: tuning[tooth],
      time,
      velocity
    };
  }).sort((a, b) => a.time - b.time || a.tooth - b.tooth);
  let seen = new Set();
  notes = notes.filter(note => {
    let key = note.tooth + ':' + Math.round(note.time * 100000);
    if (seen.has(key)) {
      dropped++;
      return false;
    }
    seen.add(key);
    return true;
  });
  return {
    format: 'crescendo-cylinder',
    version: 1,
    title: String(raw.title || 'Untitled cylinder').slice(0, 100),
    composer: String(raw.composer || 'Custom arrangement').slice(0, 150),
    duration,
    tuning: [...tuning],
    notes,
    source: raw.source || 'Generated pins',
    dropped
  };
}
