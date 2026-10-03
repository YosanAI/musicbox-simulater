/** Axis-aligned bounds of CPU-side geometry. */
export function getGeometryBounds(meshGeometry) {
  let min = [Infinity, Infinity, Infinity];
  let max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < meshGeometry.positions.length; i++) {
    let k = i % 3;
    min[k] = Math.min(min[k], meshGeometry.positions[i]);
    max[k] = Math.max(max[k], meshGeometry.positions[i]);
  }
  return {
    min,
    max,
    center: min.map((v, k) => (v + max[k]) / 2),
    size: min.map((v, k) => max[k] - v)
  };
}
