import { CYLINDER_LIMITS } from '../constants.js';
import { mat4 } from '../../math/matrices.js';
import { vec3 } from '../../math/vectors.js';
import { geometryBuilders } from '../../geometry/primitives.js';
/**
 * Decode accessors and flatten node transforms into CPU-side geometry.
 * Retains the original limits and accepted subset (triangles, uncompressed,
 * embedded buffers). This stays independent of WebGL, DOM and Three.js.
 */
export function parseGLTFGeometry({ json: gltf, buffers }) {
  if ((gltf.extensionsRequired || []).some(x => /draco|meshopt|quantization/i.test(x))) {
    throw Error('Export uncompressed glTF / GLB. Draco, Meshopt and quantization extensions are not supported.');
  }
  let vertexBudget = 0;
  let entries = [];
  let meta = null;
  const readAccessor = (id) => {
    let definition = gltf.accessors?.[id];
    if (!definition || definition.sparse) {
      throw Error('Missing or sparse geometry accessor. Export an uncompressed mesh.');
    }
    let bufferView = gltf.bufferViews[definition.bufferView];
    let data = buffers[bufferView?.buffer];
    if (!data) {
      throw Error('Missing embedded geometry buffer.');
    }
    let count = definition.count;
    let componentCount = {
      SCALAR: 1,
      VEC2: 2,
      VEC3: 3,
      VEC4: 4
    }[definition.type];
    let componentByteSizes = {
      5120: 1,
      5121: 1,
      5122: 2,
      5123: 2,
      5125: 4,
      5126: 4
    };
    let componentReaders = {
      5120: 'getInt8',
      5121: 'getUint8',
      5122: 'getInt16',
      5123: 'getUint16',
      5125: 'getUint32',
      5126: 'getFloat32'
    };
    let componentSize = componentByteSizes[definition.componentType];
    if (!componentCount || !componentSize || !Number.isInteger(count) || count < 0 || count > 1500000) {
      throw Error('Unsupported or oversized mesh accessor.');
    }
    let stride = bufferView.byteStride || componentSize * componentCount;
    let base = (bufferView.byteOffset || 0) + (definition.byteOffset || 0);
    let dataView = new DataView(data);
    let values = [];
    if (base + (Math.max(0, count - 1)) * stride + componentCount * componentSize > dataView.byteLength) {
      throw Error('Geometry accessor exceeds its buffer.');
    }
    for (let i = 0; i < count; i++) {
      for (let k = 0; k < componentCount; k++) {
        let value = dataView[componentReaders[definition.componentType]](base + i * stride + k * componentSize, true);
        if (definition.normalized && definition.componentType !== 5126) {
          let maximumValue = ({
            5120: 127,
            5121: 255,
            5122: 32767,
            5123: 65535,
            5125: 4294967295
          })[definition.componentType];
          value = Math.max(-1, value / maximumValue);
        }
        if (!Number.isFinite(value)) {
          throw Error('The mesh contains non-finite coordinates.');
        }
        values.push(value);
      }
    }
    return values;
  };
  let activeNodePath = new Set();
  function walk(id, parent, depth = 0) {
    if (depth > 80 || activeNodePath.has(id)) {
      throw Error('Cyclic or excessively deep glTF node hierarchy.');
    }
    activeNodePath.add(id);
    let node = gltf.nodes?.[id];
    if (!node) {
      throw Error('Invalid scene node.');
    }
    let localTransform = node.matrix ? new Float32Array(node.matrix) : mat4.compose(node.translation, node.rotation, node.scale);
    let worldTransform = mat4.multiply(parent, localTransform);
    if (node.extras?.musicBox) {
      meta = node.extras.musicBox;
    }
    if (node.mesh !== undefined) {
      let mesh = gltf.meshes?.[node.mesh];
      if (!mesh) {
        throw Error('Invalid mesh reference.');
      }
      for (let primitive of mesh.primitives || []) {
        if (primitive.mode !== undefined && primitive.mode !== 4) {
          continue;
        }
        if (primitive.extensions?.KHR_draco_mesh_compression) {
          throw Error('Draco-compressed meshes are not supported.');
        }
        let positions = readAccessor(primitive.attributes.POSITION);
        let normals = primitive.attributes.NORMAL !== undefined ? readAccessor(primitive.attributes.NORMAL) : [];
        let uvs = primitive.attributes.TEXCOORD_0 !== undefined ? readAccessor(primitive.attributes.TEXCOORD_0) : new Array(positions.length / 3 * 2).fill(0);
        let indices = primitive.indices !== undefined ? readAccessor(primitive.indices) : Array.from({ length: positions.length / 3 }, (_, i) => i);
        vertexBudget += positions.length / 3;
        if (vertexBudget > CYLINDER_LIMITS.maxVertices) {
          throw Error('The model is too dense. Keep it below 700,000 vertices.');
        }
        if (indices.length % 3 || indices.some(x => !Number.isInteger(x) || x < 0 || x >= positions.length / 3)) {
          throw Error('Invalid triangle indices.');
        }
        if (!normals.length) {
          normals = new Array(positions.length).fill(0);
          for (let i = 0; i < indices.length; i += 3) {
            let triangleIndices = indices.slice(i, i + 3);
            let trianglePositions = triangleIndices.map(k => positions.slice(k * 3, k * 3 + 3));
            let faceNormal = vec3.cross(vec3.subtract(trianglePositions[1], trianglePositions[0]), vec3.subtract(trianglePositions[2], trianglePositions[0]));
            for (let id of triangleIndices) {
              for (let k = 0; k < 3; k++) {
                normals[id * 3 + k] += faceNormal[k];
              }
            }
          }
          for (let i = 0; i < normals.length; i += 3) {
            let faceNormal = vec3.normalize(normals.slice(i, i + 3));
            normals.splice(i, 3, ...faceNormal);
          }
        }
        let meshGeometry = geometryBuilders.merge([
          {
            geometry: {
              positions: positions,
              normals: normals,
              uvs: uvs,
              indices: indices
            },
            transform: worldTransform
          }
        ]);
        entries.push({
          name: node.name || mesh.name || '',
          geometry: meshGeometry,
          extras: node.extras || {},
          material: gltf.materials?.[primitive.material]
        });
      }
    }
    for (let child of node.children || []) {
      walk(child, worldTransform, depth + 1);
    }
    activeNodePath.delete(id);
  }
  let scene = gltf.scenes?.[gltf.scene ?? 0];
  if (!scene) {
    throw Error('No glTF scene was found.');
  }
  if (scene.extras?.musicBox) {
    meta = scene.extras.musicBox;
  }
  for (let node of scene.nodes || []) {
    walk(node, mat4.identity());
  }
  if (!entries.length) {
    throw Error('This file contains no triangle meshes.');
  }
  return { entries, meta };
}
