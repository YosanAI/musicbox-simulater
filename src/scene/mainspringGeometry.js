import { geometryBuilders } from '../geometry/primitives.js';
import { mat4 } from '../math/matrices.js';
import { TAU } from '../math/scalars.js';

/** A coiled, upright steel ribbon, wound around the mainspring arbor. */
export function createMainspringGeometry() {
  const segments = 448;
  const turns = 7;
  const at = index => {
    const fraction = index / segments;
    const angle = fraction * turns * TAU;
    const radius = .004 + fraction * .022;
    return [Math.cos(angle) * radius, Math.sin(angle) * radius];
  };
  const strips = [];
  for (let index = 0; index < segments; index++) {
    const a = at(index);
    const b = at(index + 1);
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    strips.push({
      geometry: geometryBuilders.box(Math.hypot(dx, dz) + .00005, .014, .00055),
      transform: mat4.multiply(mat4.translation((a[0] + b[0]) / 2, 0,
        (a[1] + b[1]) / 2), mat4.rotationY(-Math.atan2(dz, dx))),
    });
  }
  strips.push(geometryBuilders.cylinder(.0032, .020, 28));
  return geometryBuilders.merge(strips);
}
