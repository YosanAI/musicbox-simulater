/**
 * @typedef {object} GeometryData
 * @property {number[]} positions Flat XYZ positions in metres.
 * @property {number[]} normals Flat XYZ vertex normals.
 * @property {number[]} uvs Flat UV pairs.
 * @property {number[]} indices Triangle vertex indices.
 *
 * @typedef {object} TransformedGeometry
 * @property {GeometryData} geometry
 * @property {Float32Array} [transform] Column-major local-to-parent matrix.
 */
export {};
