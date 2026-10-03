import {
  CYLINDER_LIMITS, validateCylinder, decodeGLB, decodeGLTF, interpretCylinderGLTF,
} from '../cylinder/index.js';

/** Read local bytes only. The glTF decoder deliberately refuses external buffers. */
export async function readCylinderFile(file) {
  if (file.size > CYLINDER_LIMITS.maxFileBytes) {
    throw new Error('Choose a cylinder smaller than 35 MB.');
  }
  const extension = file.name.split('.').pop().toLowerCase();
  let spec;
  let meshes = null;
  let mode = null;
  let detail;

  if (extension === 'json') {
    spec = validateCylinder(JSON.parse(await file.text()));
    detail = `Built ${spec.notes.length} 3D pins from your note definition.`;
  } else if (extension === 'glb' || extension === 'gltf') {
    const decoded = extension === 'glb'
      ? decodeGLB(await file.arrayBuffer())
      : decodeGLTF(await file.text());
    const result = interpretCylinderGLTF(decoded, file.name);
    ({ spec, meshes, mode } = result);
    detail = `${spec.notes.length} pins read from your 3D model.`;
    if (result.assumedDuration) {
      detail += ' Assumed 30 s/turn; adjust One revolution for the intended tempo.';
    }
  } else {
    throw new Error('Use a .glb, embedded .gltf or cylinder .json file.');
  }

  if (!spec.notes.length) detail += ' This cylinder is silent until you add pins.';
  return { spec, meshes, mode, detail };
}

/** Stable JSON interchange format; MIDI is recovered from the tuning table. */
export function serializeCylinder(spec) {
  return JSON.stringify({
    format: spec.format,
    version: 1,
    title: spec.title,
    composer: spec.composer,
    duration: spec.duration,
    tuning: spec.tuning,
    notes: spec.notes.map(note => ({
      time: +note.time.toFixed(6),
      tooth: note.tooth,
      velocity: note.velocity,
    })),
  }, null, 2);
}
