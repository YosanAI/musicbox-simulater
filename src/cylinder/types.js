/**
 * @typedef {object} CylinderNote
 * @property {number} tooth Zero-based comb lane, 0–71.
 * @property {number} midi MIDI pitch from the cylinder's tuning table.
 * @property {number} time Seconds into one revolution: 0 <= time < duration.
 * @property {number} turn Zero-based indexed revolution, default 0.
 * @property {number} velocity Pluck intensity, greater than 0 and at most 1.
 *
 * @typedef {object} CylinderSpec
 * @property {'crescendo-cylinder'} format
 * @property {1} version
 * @property {string} title
 * @property {string} composer
 * @property {number} duration Seconds per revolution, 2–600.
 * @property {number} turns Number of indexed revolutions in the programme, 1–5.
 * @property {Array<{title: string, composer: string}>} [tunes] Optional label for each indexed tune.
 * @property {number[]} tuning Exactly 72 integer MIDI pitches.
 * @property {CylinderNote[]} notes Sorted, normalized physical pin events.
 * @property {string} source Human-readable provenance displayed in the UI.
 * @property {number} dropped Coincident duplicate pins removed in validation.
 *
 * @typedef {object} CylinderEntry
 * @property {CylinderSpec} spec
 * @property {Array<{geometry: import('../geometry/types.js').GeometryData, material?: object}> | null} meshes
 */
export {};
