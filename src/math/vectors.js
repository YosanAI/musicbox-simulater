/** Small array-based vector operations for the CPU-side geometry tools. */
export const vec3 = {
  add(a, b) {
    return a.map((value, index) => value + b[index]);
  },
  subtract(a, b) {
    return a.map((value, index) => value - b[index]);
  },
  multiplyScalar(vector, scalar) {
    return vector.map(value => value * scalar);
  },
  dot(a, b) {
    return a.reduce((sum, value, index) => sum + value * b[index], 0);
  },
  cross(a, b) {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
  },
  length(vector) {
    return Math.hypot(...vector);
  },
  normalize(vector) {
    const length = Math.hypot(...vector) || 1;
    return vector.map(value => value / length);
  },
  lerp(a, b, amount) {
    return a.map((value, index) => value + (b[index] - value) * amount);
  },
};
