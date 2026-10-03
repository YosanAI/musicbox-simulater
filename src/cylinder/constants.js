/** Cylinder coordinates are in metres; timing is seconds per revolution. */
export const TOOTH_COUNT = 72;
export const CYLINDER_SHAPE = Object.freeze({
  length: 0.214,
  radius: 0.024,
  minX: -0.099,
  maxX: 0.099,
  pinLength: 0.0015,
  pinRadius: 0.00023,
  contactAngle: 2.0,
});
/** Interleaved axial tracks; translation brings one track at a time to the comb. */
export const CYLINDER_INDEXING = Object.freeze({
  step: 0.00055,
  transitionSeconds: 0.16,
});
/** Demonstration tuning, not a verified Reuge factory tuning. */
export const DEFAULT_TUNING = Object.freeze(Array.from({ length: TOOTH_COUNT }, (_, index) => index + 36));
export const CYLINDER_LIMITS = Object.freeze({
  minDuration: 2,
  maxDuration: 600,
  maxTurns: 5,
  maxPins: 6000,
  maxFileBytes: 35 * 1024 * 1024,
  maxVertices: 700000
});
