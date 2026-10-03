import { mat4 } from '../../math/matrices.js';
import { geometryBuilders } from '../../geometry/primitives.js';
import { CYLINDER_SHAPE } from '../constants.js';
import { validateCylinder } from '../validation.js';
import { getPinPosition } from '../pinGeometry.js';
/**
 * Encode canonical, uncompressed glTF 2.0 binary geometry.
 * Every pin is a separate node sharing one mesh, so moving it in Blender
 * changes the recovered score. All buffer and chunk offsets are 4-byte aligned.
 */
export function exportCylinderGLB(spec) {
  spec = validateCylinder(spec);
  let chunks = [];
  let offset = 0;
  let bufferViews = [];
  let accessors = [];
  function appendBufferView(typed, target) {
    let pad = (4 - offset % 4) % 4;
    if (pad) {
      chunks.push(new Uint8Array(pad));
      offset += pad;
    }
    let bytes = new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength);
    let v = { buffer: 0, byteOffset: offset, byteLength: bytes.byteLength };
    if (target) {
      v.target = target;
    }
    bufferViews.push(v);
    chunks.push(bytes);
    offset += bytes.byteLength;
    return bufferViews.length - 1;
  }
  function appendAccessor(values, componentCount, isIndex = false) {
    let t = isIndex ? new Uint32Array(values) : new Float32Array(values);
    let v = appendBufferView(t, isIndex ? 34963 : 34962);
    let a = {
      bufferView: v,
      componentType: isIndex ? 5125 : 5126,
      count: values.length / componentCount,
      type: { 1: 'SCALAR', 2: 'VEC2', 3: 'VEC3' }[componentCount]
    };
    if (componentCount === 3) {
      a.min = [Infinity, Infinity, Infinity];
      a.max = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < values.length; i++) {
        let j = i % 3;
        a.min[j] = Math.min(a.min[j], values[i]);
        a.max[j] = Math.max(a.max[j], values[i]);
      }
    }
    accessors.push(a);
    return accessors.length - 1;
  }
  function createMeshDefinition(meshGeometry, name) {
    return {
      name,
      primitives: [
        {
          attributes: {
            POSITION: appendAccessor(meshGeometry.positions, 3),
            NORMAL: appendAccessor(meshGeometry.normals, 3),
            TEXCOORD_0: appendAccessor(meshGeometry.uvs, 2)
          },
          indices: appendAccessor(meshGeometry.indices, 1, true),
          material: 0
        }
      ]
    };
  }
  let body = geometryBuilders.merge([
    {
      geometry: geometryBuilders.cylinder(CYLINDER_SHAPE.radius, CYLINDER_SHAPE.length, 96),
      transform: mat4.rotationZ(-Math.PI / 2)
    }
  ]);
  let pin = geometryBuilders.cylinder(CYLINDER_SHAPE.pinRadius, CYLINDER_SHAPE.pinLength, 8, CYLINDER_SHAPE.pinRadius * .75);
  let meshes = [createMeshDefinition(body, 'Brass barrel'), createMeshDefinition(pin, 'Radial music pin')];
  let nodes = [
    {
      name: 'MusicCylinder',
      children: [],
      extras: {
        musicBox: {
          schema: 'crescendo-cylinder/v1',
          title: spec.title,
          composer: spec.composer,
          secondsPerTurn: spec.duration,
          tuning: spec.tuning,
          axis: 'X',
          units: 'metres',
          ...CYLINDER_SHAPE
        }
      }
    },
    { name: 'cylinder_body', mesh: 0 }
  ];
  nodes[0].children.push(1);
  spec.notes.forEach((note, i) => {
    let pinCenter = getPinPosition(note, spec.duration);
    nodes[0].children.push(nodes.length);
    nodes.push({
      name: 'pin_' + String(i).padStart(5, '0'),
      mesh: 1,
      translation: [pinCenter.x, pinCenter.y, pinCenter.z],
      rotation: [Math.sin(pinCenter.angle / 2), 0, 0, Math.cos(pinCenter.angle / 2)],
      extras: { velocity: note.velocity }
    });
  });
  let json = {
    asset: { version: '2.0', generator: 'Crescendo geometry-driven music box' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes,
    meshes,
    materials: [
      {
        name: 'Aged polished brass',
        pbrMetallicRoughness: { baseColorFactor: [.77, .55, .24, 1], metallicFactor: .94, roughnessFactor: .28 },
        doubleSided: true
      }
    ],
    buffers: [{ byteLength: offset }],
    bufferViews,
    accessors
  };
  let jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  let jsonLength = Math.ceil(jsonBytes.length / 4) * 4;
  let binaryLength = Math.ceil(offset / 4) * 4;
  let total = 12 + 8 + jsonLength + 8 + binaryLength;
  let output = new Uint8Array(total);
  let dataView = new DataView(output.buffer);
  dataView.setUint32(0, 0x46546c67, true);
  dataView.setUint32(4, 2, true);
  dataView.setUint32(8, total, true);
  dataView.setUint32(12, jsonLength, true);
  dataView.setUint32(16, 0x4e4f534a, true);
  output.fill(32, 20, 20 + jsonLength);
  output.set(jsonBytes, 20);
  let cursor = 20 + jsonLength;
  dataView.setUint32(cursor, binaryLength, true);
  dataView.setUint32(cursor + 4, 0x004e4942, true);
  cursor += 8;
  for (let b of chunks) {
    output.set(b, cursor);
    cursor += b.length;
  }
  return output;
}
