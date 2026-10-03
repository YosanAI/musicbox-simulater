import { vec3 } from './vectors.js';

/**
 * Column-major Float32 matrices for the geometry import/export boundary.
 * The original arithmetic order is intentional: sample GLB coordinates and
 * procedural meshes remain reproducible. The renderer uses THREE.Matrix4.
 */
export const mat4 = {
  identity() {
    return new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);
  },

  multiply(a, b) {
    const result = new Float32Array(16);
    for (let column = 0; column < 4; column++) {
      for (let row = 0; row < 4; row++) {
        for (let index = 0; index < 4; index++) {
          result[column * 4 + row] += a[index * 4 + row] * b[column * 4 + index];
        }
      }
    }
    return result;
  },

  translation(x = 0, y = 0, z = 0) {
    const matrix = this.identity();
    matrix[12] = x;
    matrix[13] = y;
    matrix[14] = z;
    return matrix;
  },

  scale(x = 1, y = x, z = x) {
    const matrix = this.identity();
    matrix[0] = x;
    matrix[5] = y;
    matrix[10] = z;
    return matrix;
  },

  rotationX(angle) {
    const matrix = this.identity();
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    matrix[5] = cosine;
    matrix[6] = sine;
    matrix[9] = -sine;
    matrix[10] = cosine;
    return matrix;
  },

  rotationY(angle) {
    const matrix = this.identity();
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    matrix[0] = cosine;
    matrix[2] = -sine;
    matrix[8] = sine;
    matrix[10] = cosine;
    return matrix;
  },

  rotationZ(angle) {
    const matrix = this.identity();
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    matrix[0] = cosine;
    matrix[1] = sine;
    matrix[4] = -sine;
    matrix[5] = cosine;
    return matrix;
  },

  fromQuaternion([x, y, z, w]) {
    const xx = x * x;
    const yy = y * y;
    const zz = z * z;
    const xy = x * y;
    const xz = x * z;
    const yz = y * z;
    const wx = w * x;
    const wy = w * y;
    const wz = w * z;
    return new Float32Array([
      1 - 2 * (yy + zz), 2 * (xy + wz), 2 * (xz - wy), 0,
      2 * (xy - wz), 1 - 2 * (xx + zz), 2 * (yz + wx), 0,
      2 * (xz + wy), 2 * (yz - wx), 1 - 2 * (xx + yy), 0,
      0, 0, 0, 1,
    ]);
  },

  compose(translation = [0, 0, 0], rotation = [0, 0, 0, 1], scale = [1, 1, 1]) {
    return this.multiply(
      this.translation(...translation),
      this.multiply(this.fromQuaternion(rotation), this.scale(...scale)),
    );
  },

  transformPoint(matrix, [x, y, z]) {
    const w = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15];
    return [
      (matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12]) / w,
      (matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13]) / w,
      (matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14]) / w,
    ];
  },

  /** Retains the original normalized-direction transform used by the importer. */
  transformDirection(matrix, [x, y, z]) {
    return vec3.normalize([
      matrix[0] * x + matrix[4] * y + matrix[8] * z,
      matrix[1] * x + matrix[5] * y + matrix[9] * z,
      matrix[2] * x + matrix[6] * y + matrix[10] * z,
    ]);
  },
};
