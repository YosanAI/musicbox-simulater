import { createHash } from 'node:crypto';

/** Fingerprint GPU-precision buffers, independent of object property ordering. */
export function geometryFingerprint(geometry) {
  const hash = createHash('sha256');
  for (const key of ['positions', 'normals', 'uvs', 'indices']) {
    const array = key === 'indices'
      ? new Uint32Array(geometry[key])
      : new Float32Array(geometry[key]);
    hash.update(new Uint8Array(array.buffer));
  }
  return hash.digest('hex');
}

export function createRecordingRenderer() {
  return {
    nodes: [],
    add(geometry, material, matrix, tag) {
      const part = { geometry, material, matrix, tag, cast: true, visible: true };
      this.nodes.push(part);
      return part;
    },
  };
}

export function summarizeModel(renderer) {
  return renderer.nodes.map(part => ({
    tag: part.tag,
    material: part.material.name || null,
    vertices: part.geometry.positions.length / 3,
    triangles: part.geometry.indices.length / 3,
    geometry: geometryFingerprint(part.geometry),
    matrix: [...part.matrix],
    cast: part.cast,
  }));
}

/** A flattened triangle primitive for testing importer recognition, not a renderer. */
export function encodeMergedGeometry(geometry, metadata) {
  const parts = [];
  const bufferViews = [];
  const accessors = [];
  let offset = 0;
  function accessor(values, componentType, type, components) {
    const array = componentType === 5125 ? new Uint32Array(values) : new Float32Array(values);
    const bytes = new Uint8Array(array.buffer);
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length });
    parts.push(bytes);
    offset += bytes.length;
    accessors.push({
      bufferView: bufferViews.length - 1, componentType,
      count: values.length / components, type,
    });
    return accessors.length - 1;
  }
  const attributes = {
    POSITION: accessor(geometry.positions, 5126, 'VEC3', 3),
    NORMAL: accessor(geometry.normals, 5126, 'VEC3', 3),
    TEXCOORD_0: accessor(geometry.uvs, 5126, 'VEC2', 2),
  };
  const indices = accessor(geometry.indices, 5125, 'SCALAR', 1);
  const bytes = new Uint8Array(offset);
  let cursor = 0;
  for (const part of parts) { bytes.set(part, cursor); cursor += part.length; }
  return {
    json: {
      asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }],
      nodes: [{ name: 'cylinder_body', mesh: 0, extras: { musicBox: metadata } }],
      meshes: [{ primitives: [{ attributes, indices }] }],
      bufferViews, accessors, buffers: [{ byteLength: offset }],
    },
    buffers: [bytes.buffer],
  };
}
