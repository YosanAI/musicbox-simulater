import { mat4 } from '../math/matrices.js';
import { vec3 } from '../math/vectors.js';
import { TAU, clamp } from '../math/scalars.js';
/**
 * CPU-side meshes preserve the original vertex order, bevels and UVs.
 * They are converted to THREE.BufferGeometry only at the rendering boundary.
 * This also lets the GLB tools and tests run in Node without a graphics context.
 * @see ./types.js
 */
export const geometryBuilders = {
  box(w, h, d, bevel = 0) {
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];
    const half = [w / 2, h / 2, d / 2];
    const faces = [
      [[1, 0, 0], [0, 0, -1], [0, 1, 0]],
      [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
      [[0, 1, 0], [1, 0, 0], [0, 0, -1]],
      [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
      [[0, 0, 1], [1, 0, 0], [0, 1, 0]],
      [[0, 0, -1], [-1, 0, 0], [0, 1, 0]]
    ];
    for (const [normal, U, W] of faces) {
      let ax = normal.findIndex(v => v);
      let ua = U.findIndex(v => v);
      let va = W.findIndex(v => v);
      let hu = half[ua];
      let hv = half[va];
      const us = bevel ? [-hu, -hu + bevel, hu - bevel, hu] : [-hu, hu];
      const vs = bevel ? [-hv, -hv + bevel, hv - bevel, hv] : [-hv, hv];
      const start = positions.length / 3;
      for (let j = 0; j < vs.length; j++) {
        for (let i = 0; i < us.length; i++) {
          let P = normal.map((v, k) => v * half[ax] + U[k] * us[i] + W[k] * vs[j]);
          let N = normal;
          if (bevel) {
            let core = P.map((v, k) => clamp(v, -half[k] + bevel, half[k] - bevel));
            N = vec3.normalize(vec3.subtract(P, core));
            P = vec3.add(core, vec3.multiplyScalar(N, bevel));
          }
          positions.push(...P);
          normals.push(...N);
          uvs.push((us[i] / hu + 1) / 2, (vs[j] / hv + 1) / 2);
        }
      }
      for (let j = 0; j < vs.length - 1; j++) {
        for (let i = 0; i < us.length - 1; i++) {
          let a = start + j * us.length + i;
          let b = a + 1;
          let c = a + us.length;
          let e = c + 1;
          indices.push(a, b, e, a, e, c);
        }
      }
    }
    return {
      positions: positions,
      normals: normals,
      uvs: uvs,
      indices: indices
    };
  },
  cylinder(r, h, segments = 48, rTop = r) {
    let positions = [];
    let normals = [];
    let uvs = [];
    let indices = [];
    for (let j = 0; j < 2; j++) {
      for (let i = 0; i <= segments; i++) {
        let a = i / segments * TAU;
        let s = Math.sin(a);
        let c = Math.cos(a);
        positions.push((j ? rTop : r) * c, (j - .5) * h, (j ? rTop : r) * s);
        normals.push(...vec3.normalize([c, (r - rTop) / h, s]));
        uvs.push(i / segments, j);
      }
    }
    for (let i = 0; i < segments; i++) {
      let a = i;
      let b = i + 1;
      let c = segments + 1 + i;
      let d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
    for (let cap = 0; cap < 2; cap++) {
      let start = positions.length / 3;
      let rr = cap ? rTop : r;
      positions.push(0, (cap - .5) * h, 0);
      normals.push(0, cap ? 1 : -1, 0);
      uvs.push(.5, .5);
      for (let i = 0; i <= segments; i++) {
        let a = i / segments * TAU;
        positions.push(rr * Math.cos(a), (cap - .5) * h, rr * Math.sin(a));
        normals.push(0, cap ? 1 : -1, 0);
        uvs.push(.5 + .5 * Math.cos(a), .5 + .5 * Math.sin(a));
      }
      for (let i = 0; i < segments; i++) {
        cap ? indices.push(start, start + i + 2, start + i + 1) : indices.push(start, start + i + 1, start + i + 2);
      }
    }
    return {
      positions: positions,
      normals: normals,
      uvs: uvs,
      indices: indices
    };
  },
  torus(R, r, seg = 64, tube = 8) {
    let positions = [];
    let normals = [];
    let uvs = [];
    let indices = [];
    for (let j = 0; j <= seg; j++) {
      for (let i = 0; i <= tube; i++) {
        let a = j / seg * TAU;
        let b = i / tube * TAU;
        let cb = Math.cos(b);
        positions.push((R + r * cb) * Math.cos(a), r * Math.sin(b), (R + r * cb) * Math.sin(a));
        normals.push(cb * Math.cos(a), Math.sin(b), cb * Math.sin(a));
        uvs.push(j / seg, i / tube);
      }
    }
    for (let j = 0; j < seg; j++) {
      for (let i = 0; i < tube; i++) {
        let a = j * (tube + 1) + i;
        let b = a + 1;
        let c = a + tube + 1;
        let d = c + 1;
        indices.push(a, b, c, b, d, c);
      }
    }
    return {
      positions: positions,
      normals: normals,
      uvs: uvs,
      indices: indices
    };
  },
  polygon(points, h) {
    let positions = [];
    let normals = [];
    let uvs = [];
    let indices = [];
    for (let cap = 0; cap < 2; cap++) {
      let st = positions.length / 3;
      for (let pt of points) {
        positions.push(pt[0], (cap - .5) * h, pt[1]);
        normals.push(0, cap ? 1 : -1, 0);
        uvs.push(pt[0] * 10, pt[1] * 10);
      }
      for (let i = 1; i < points.length - 1; i++) {
        cap ? indices.push(st, st + i + 1, st + i) : indices.push(st, st + i, st + i + 1);
      }
    }
    for (let i = 0; i < points.length; i++) {
      let a = points[i];
      let b = points[(i + 1) % points.length];
      let N = vec3.normalize([b[1] - a[1], 0, a[0] - b[0]]);
      let st = positions.length / 3;
      for (let [x, y, z] of [[a[0], -h / 2, a[1]], [b[0], -h / 2, b[1]], [b[0], h / 2, b[1]], [a[0], h / 2, a[1]]]) {
        positions.push(x, y, z);
        normals.push(...N);
        uvs.push(x * 10, z * 10);
      }
      indices.push(st, st + 1, st + 2, st, st + 2, st + 3);
    }
    return {
      positions: positions,
      normals: normals,
      uvs: uvs,
      indices: indices
    };
  },
  gear(r, h, teeth = 36) {
    let pts = [];
    for (let i = 0; i < teeth; i++) {
      for (let [q, s] of [[0, .88], [.18, .88], [.29, 1], [.71, 1], [.82, .88]]) {
        let a = (i + q) / teeth * TAU;
        pts.push([Math.cos(a) * r * s, Math.sin(a) * r * s]);
      }
    }
    return this.polygon(pts, h);
  },
  merge(items) {
    let positions = [];
    let normals = [];
    let uvs = [];
    let indices = [];
    for (let item of items) {
      let meshGeometry = item.geometry || item;
      let transform = item.transform || mat4.identity();
      let base = positions.length / 3;
      for (let i = 0; i < meshGeometry.positions.length; i += 3) {
        positions.push(...mat4.transformPoint(transform, meshGeometry.positions.slice(i, i + 3)));
        normals.push(...mat4.transformDirection(transform, meshGeometry.normals.slice(i, i + 3)));
      }
      for (let v of meshGeometry.uvs) {
        uvs.push(v);
      }
      for (let x of meshGeometry.indices) {
        indices.push(x + base);
      }
    }
    return {
      positions: positions,
      normals: normals,
      uvs: uvs,
      indices: indices
    };
  }
};
