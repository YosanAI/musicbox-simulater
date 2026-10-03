import { mat4 } from '../../math/matrices.js';
import { vec3 } from '../../math/vectors.js';
import { geometryBuilders } from '../../geometry/primitives.js';
import { TAU, modulo } from '../../math/scalars.js';
import { getGeometryBounds } from '../../geometry/bounds.js';
import { CYLINDER_SHAPE, CYLINDER_INDEXING, DEFAULT_TUNING, CYLINDER_LIMITS } from '../constants.js';
import { validateCylinder } from '../validation.js';
import { parseGLTFGeometry } from './parseGeometry.js';
/**
 * Read music from pin positions, never from a filename or attached audio.
 * Recognition order: named pin nodes → small separate meshes → connected tips.
 * The imported cylinder is fitted to the movement after its score is decoded.
 */
export function interpretCylinderGLTF(decoded, name = 'Imported cylinder') {
  let { entries, meta } = parseGLTFGeometry(decoded);
  const hasMeta = meta?.schema === 'crescendo-cylinder/v1';
  let bodyEntry = entries.find(entry => /cylinder_body|barrel|drum_body/i.test(entry.name));
  if (!bodyEntry) {
    bodyEntry = entries.filter(entry => !/^pin[_\s.-]/i.test(entry.name)).sort((left, right) => {
      const leftSize = getGeometryBounds(left.geometry).size;
      const rightSize = getGeometryBounds(right.geometry).size;
      return vec3.length(rightSize) - vec3.length(leftSize);
    })[0];
  }
  if (!bodyEntry) {
    throw Error('Could not locate the cylinder body. Name it cylinder_body.');
  }
  let bounds = getGeometryBounds(bodyEntry.geometry);
  let axis = hasMeta ? (meta.axis || 'X') : ['X', 'Y', 'Z'][bounds.size.indexOf(Math.max(...bounds.size))];
  let turn = axis === 'Y' ? mat4.rotationZ(-Math.PI / 2) : axis === 'Z' ? mat4.rotationY(Math.PI / 2) : mat4.identity();
  let origin = hasMeta ? [0, 0, 0] : bounds.center;
  let center = mat4.translation(...origin.map(x => -x));
  let orientation = mat4.multiply(turn, center);
  let bodyAligned = geometryBuilders.merge([{ geometry: bodyEntry.geometry, transform: orientation }]);
  let alignedBounds = getGeometryBounds(bodyAligned);
  let length = hasMeta ? Number(meta.length) : alignedBounds.size[0];
  let radius = hasMeta ? Number(meta.radius) : (alignedBounds.size[1] + alignedBounds.size[2]) / 4;
  if (!Number.isFinite(length) || !Number.isFinite(radius) || length <= 0 || radius <= 0 || length / radius < 2) {
    throw Error('The object does not look like an axis-aligned music cylinder. Use the supplied GLB template.');
  }
  let xMin = hasMeta ? Number(meta.minX) : (-length / 2 + length * .0374);
  let xMax = hasMeta ? Number(meta.maxX) : (length / 2 - length * .0374);
  let duration = Number(meta?.secondsPerTurn || 30);
  let turns = Number(meta?.turns ?? 1);
  if (!Number.isInteger(turns) || turns < 1 || turns > CYLINDER_LIMITS.maxTurns) {
    throw Error('A cylinder programme must contain between 1 and 5 indexed revolutions.');
  }
  let tuning = meta?.tuning || DEFAULT_TUNING;
  let contact = Number(meta?.contactAngle ?? CYLINDER_SHAPE.contactAngle);
  if (!Number.isFinite(xMin) || !Number.isFinite(xMax) || xMax <= xMin || !Number.isFinite(contact)) {
    throw Error('Invalid cylinder dimensions in musicBox metadata.');
  }
  let xScale = (CYLINDER_SHAPE.maxX - CYLINDER_SHAPE.minX) / (xMax - xMin);
  const indexStep = Number(meta?.indexStep ?? CYLINDER_INDEXING.step / xScale);
  // The canonical fitting transform must also preserve the relative track spacing.
  if (turns > 1 && (!Number.isFinite(indexStep) || Math.abs(indexStep * xScale - CYLINDER_INDEXING.step) > 1e-6)) {
    throw Error('Indexed pin tracks must use the supplied axial spacing.');
  }
  let radialScale = CYLINDER_SHAPE.radius / radius;
  let fit = mat4.multiply(mat4.rotationX(CYLINDER_SHAPE.contactAngle - contact), mat4.multiply(mat4.scale(xScale, radialScale, radialScale), mat4.multiply(mat4.translation(-(xMax + xMin) / 2, 0, 0), orientation)));
  const candidates = [];
  let named = entries.filter(entry => /^pin(?:[_\s.-]|\d|$)/i.test(entry.name));
  const extract = entry => {
    let meshGeometry = geometryBuilders.merge([{ geometry: entry.geometry, transform: orientation }]);
    let center = [0, 0, 0];
    let count = meshGeometry.positions.length / 3;
    for (let i = 0; i < meshGeometry.positions.length; i++) {
      center[i % 3] += meshGeometry.positions[i] / count;
    }
    return { center, velocity: entry.extras.velocity ?? .75, geometry: meshGeometry };
  };
  if (named.length) {
    for (let entry of named) {
      candidates.push(extract(entry));
    }
  }
  else {
    // Separate tiny meshes can be recognized without names.
    for (let entry of entries) {
      if (entry === bodyEntry) {
        continue;
      }
      let meshGeometry = geometryBuilders.merge([{ geometry: entry.geometry, transform: orientation }]);
      let bounds = getGeometryBounds(meshGeometry);
      let r = Math.hypot(bounds.center[1], bounds.center[2]);
      if (r > radius * .98 && r < radius * 1.3 && Math.max(...bounds.size) < radius * .45) {
        candidates.push({ center: bounds.center, velocity: .75, geometry: meshGeometry });
      }
    }
    // For a merged mesh, cluster connected vertices outside the barrel surface.
    if (!candidates.length) {
      let all = geometryBuilders.merge(entries.map(entry => ({ geometry: entry.geometry, transform: orientation })));
      let parent = new Int32Array(all.positions.length / 3).fill(-1);
      let positions = new Map();
      let weldTolerance = radius * .0005;
      const findRoot = vertexIndex => {
        while (parent[vertexIndex] !== vertexIndex) {
          parent[vertexIndex] = parent[parent[vertexIndex]];
          vertexIndex = parent[vertexIndex];
        }
        return vertexIndex;
      };
      const join = (left, right) => {
        left = findRoot(left);
        right = findRoot(right);
        if (left !== right)
          parent[right] = left;
      };
      for (let i = 0; i < parent.length; i++) {
        let x = all.positions[i * 3];
        let y = all.positions[i * 3 + 1];
        let z = all.positions[i * 3 + 2];
        let r = Math.hypot(y, z);
        if (r <= radius * 1.012 || r > radius * 1.25 || x < xMin - .001 || x > xMax + (turns - 1) * indexStep + .001) {
          continue;
        }
        parent[i] = i;
        let key = [x, y, z].map(v => Math.round(v / weldTolerance)).join(',');
        if (positions.has(key)) {
          join(i, positions.get(key));
        }
        else {
          positions.set(key, i);
        }
      }
      for (let i = 0; i < all.indices.length; i += 3) {
        let ids = all.indices.slice(i, i + 3).filter(k => parent[k] >= 0);
        for (let j = 1; j < ids.length; j++) {
          join(ids[0], ids[j]);
        }
      }
      let components = new Map();
      for (let i = 0; i < parent.length; i++) {
        if (parent[i] >= 0) {
          let id = findRoot(i);
          if (!components.has(id)) {
            components.set(id, []);
          }
          components.get(id).push(i);
        }
      }
      for (let ids of components.values()) {
        if (ids.length < 3) {
          continue;
        }
        let min = [Infinity, Infinity, Infinity];
        let max = [-Infinity, -Infinity, -Infinity];
        for (let i of ids) {
          for (let k = 0; k < 3; k++) {
            min[k] = Math.min(min[k], all.positions[i * 3 + k]);
            max[k] = Math.max(max[k], all.positions[i * 3 + k]);
          }
        }
        if (max[0] - min[0] > (xMax - xMin) / 71 * .7) {
          continue;
        }
        candidates.push({ center: min.map((v, k) => (v + max[k]) / 2), velocity: .75 });
      }
    }
  }
  if (!candidates.length) {
    throw Error('No playable pins were found. Use separate radial pin meshes named pin_00001, or the included template. A smooth cylinder contains no music.');
  }
  if (candidates.length > CYLINDER_LIMITS.maxPins) {
    throw Error('More than 6,000 pins were detected. Simplify the cylinder.');
  }
  let notes = [];
  let invalidPinCount = 0;
  for (let pin of candidates) {
    let [x, y, z] = pin.center;
    let toothCoordinate = (x - xMin) / (xMax - xMin) * 71;
    let tooth = Math.round(toothCoordinate);
    let pinTurn = 0;
    let aligned = tooth >= 0 && tooth <= 71 && Math.abs(toothCoordinate - tooth) <= .38;
    if (turns > 1) {
      // Recover both coordinates from physical X, without a hidden per-pin score.
      // Track offsets may cross a tooth midpoint, so search each track separately.
      let bestError = Infinity;
      for (let track = 0; track < turns; track++) {
        const laneCoordinate = (x - xMin - track * indexStep) / (xMax - xMin) * 71;
        const lane = Math.round(laneCoordinate);
        const error = Math.abs(x - (xMin + lane * (xMax - xMin) / 71 + track * indexStep));
        if (lane >= 0 && lane < 72 && error < bestError) {
          tooth = lane;
          pinTurn = track;
          bestError = error;
        }
      }
      aligned = bestError <= indexStep * .35;
    }
    if (!aligned) {
      invalidPinCount++;
      continue;
    }
    let angle = Math.atan2(z, y);
    let phase = modulo(contact - angle, TAU) / TAU;
    if (phase > 1 - 1e-6) {
      phase = 0;
    }
    notes.push({ tooth, turn: pinTurn, time: phase * duration, velocity: Number(pin.velocity) });
  }
  if (invalidPinCount) {
    throw Error(`${invalidPinCount} pin${invalidPinCount > 1 ? 's are' : ' is'} between comb teeth or outside the 72-note span. Align the pin X positions to the supplied template.`);
  }
  let spec = validateCylinder({
    title: meta?.title || name.replace(/\.[^.]+$/, ''),
    composer: meta?.composer || 'Imported 3D cylinder',
    duration,
    turns,
    ...(meta?.tunes ? { tunes: meta.tunes } : {}),
    tuning,
    notes,
    source: 'Read from 3D pin geometry'
  });
  const meshes = entries.map(entry => ({
    geometry: geometryBuilders.merge([{ geometry: entry.geometry, transform: fit }]),
    material: entry.material
  }));
  return {
    spec,
    meshes,
    mode: named.length ? 'Named radial pins' : 'Scanned pin geometry',
    assumedDuration: !meta?.secondsPerTurn
  };
}
