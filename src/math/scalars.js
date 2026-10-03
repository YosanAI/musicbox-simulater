/** A full revolution in radians. */
export const TAU = 2 * Math.PI;

export function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

/** Unlike %, returns a non-negative result when value is negative. */
export function modulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}
