import { BufferGeometry, Float32BufferAttribute, Uint32BufferAttribute } from 'three';

/** @param {import('../geometry/types.js').GeometryData} data */
export function toBufferGeometry(data) {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(data.positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(data.normals, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(data.uvs, 2));
  geometry.setIndex(new Uint32BufferAttribute(data.indices, 1));
  geometry.computeBoundingSphere();
  return geometry;
}
