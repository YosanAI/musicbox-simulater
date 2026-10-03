import { mat4 } from '../math/matrices.js';
import { TAU } from '../math/scalars.js';
import { geometryBuilders } from '../geometry/primitives.js';
import { CYLINDER_SHAPE } from './constants.js';
/**
 * A pin's X coordinate selects a comb tooth. Its angle selects event time.
 * Keep this convention identical in the editor, exporter and geometry reader.
 */
export function getPinPosition(note, duration) {
  let angle = CYLINDER_SHAPE.contactAngle - TAU * note.time / duration;
  let radialCenter = CYLINDER_SHAPE.radius + CYLINDER_SHAPE.pinLength / 2;
  return {
    x: CYLINDER_SHAPE.minX + (CYLINDER_SHAPE.maxX - CYLINDER_SHAPE.minX) * note.tooth / 71,
    angle: angle,
    y: radialCenter * Math.cos(angle),
    z: radialCenter * Math.sin(angle)
  };
}
/** Build the original barrel with rolled end rims and real radial pin geometry. */
export function createCylinderGeometry(spec) {
  let body = geometryBuilders.merge([
    {
      geometry: geometryBuilders.cylinder(CYLINDER_SHAPE.radius, CYLINDER_SHAPE.length, 96),
      transform: mat4.rotationZ(-Math.PI / 2)
    },
    {
      geometry: geometryBuilders.cylinder(CYLINDER_SHAPE.radius + .0006, .0015, 96),
      transform: mat4.multiply(mat4.translation(-CYLINDER_SHAPE.length / 2 + .0003, 0, 0), mat4.rotationZ(-Math.PI / 2))
    },
    {
      geometry: geometryBuilders.cylinder(CYLINDER_SHAPE.radius + .0006, .0015, 96),
      transform: mat4.multiply(mat4.translation(CYLINDER_SHAPE.length / 2 - .0003, 0, 0), mat4.rotationZ(-Math.PI / 2))
    }
  ]);
  let pin = geometryBuilders.cylinder(CYLINDER_SHAPE.pinRadius, CYLINDER_SHAPE.pinLength, 6, CYLINDER_SHAPE.pinRadius * .75);
  let parts = spec.notes.map(note => {
    let pinCenter = getPinPosition(note, spec.duration);
    return {
      geometry: pin,
      transform: mat4.multiply(mat4.translation(pinCenter.x, pinCenter.y, pinCenter.z), mat4.rotationX(pinCenter.angle))
    };
  });
  return { body, pins: geometryBuilders.merge(parts) };
}
