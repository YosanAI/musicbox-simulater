import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  CYLINDER_SHAPE, DEFAULT_TUNING, createDemoCylinders, validateCylinder,
  exportCylinderGLB, decodeGLB, decodeGLTF, interpretCylinderGLTF,
  createCylinderGeometry, getPinPosition, noteName, midiToFrequency,
} from '../../src/cylinder/index.js';
import { geometryBuilders } from '../../src/geometry/primitives.js';
import { encodeMergedGeometry } from '../helpers/geometry.js';

function fourNotes() {
  return validateCylinder({
    title: 'Test', duration: 8,
    notes: [{ midi: 60, time: 0 }, { midi: 64, time: 0.5 },
      { midi: 67, time: 1 }, { midi: 72, time: 2 }],
  });
}
function decoded(spec = fourNotes()) { return decodeGLB(exportCylinderGLB(spec).buffer); }
function assertScore(actual, expected, tolerance = 0.006) {
  assert.equal(actual.notes.length, expected.notes.length);
  for (const note of expected.notes) {
    assert(actual.notes.some(candidate => candidate.tooth === note.tooth &&
      (Math.abs(candidate.time - note.time) < tolerance ||
        Math.abs(Math.abs(candidate.time - note.time) - expected.duration) < tolerance)),
    `Missing tooth ${note.tooth} at ${note.time} seconds`);
  }
}

test('normalization retains 72-tooth tuning, sort order and coincident-pin deduplication', () => {
  const spec = validateCylinder({ duration: 4, notes: [
    { midi: 64, time: 1 }, { midi: 60, time: 0 }, { midi: 60, time: 0 },
  ] });
  assert.deepEqual(spec.tuning, [...DEFAULT_TUNING]);
  assert.equal(spec.notes[0].tooth, 24);
  assert.equal(spec.notes.length, 2);
  assert.equal(spec.dropped, 1);
});

test('MIDI labels and frequency are unchanged', () => {
  assert.equal(noteName(60), 'C4');
  assert.equal(noteName(61), 'C♯4');
  assert.equal(midiToFrequency(69), 440);
});

for (const [label, value] of [
  ['missing definition', null],
  ['missing notes', { duration: 8 }],
  ['zero duration', { duration: 0, notes: [] }],
  ['non-finite duration', { duration: Infinity, notes: [] }],
  ['short tuning', { tuning: [60], notes: [] }],
  ['out-of-range tooth', { notes: [{ tooth: 72, time: 0 }] }],
  ['out-of-range MIDI', { notes: [{ midi: 200, time: 0 }] }],
  ['negative time', { notes: [{ midi: 60, time: -1 }] }],
  ['end-of-turn time', { duration: 4, notes: [{ midi: 60, time: 4 }] }],
  ['zero velocity', { notes: [{ midi: 60, time: 0, velocity: 0 }] }],
  ['too many pins', { notes: Array(6001).fill({ midi: 60, time: 0 }) }],
]) test(`rejects ${label}`, () => assert.throws(() => validateCylinder(value)));

test('changing duration with proportional note times leaves physical pin positions unchanged', () => {
  const note = fourNotes().notes[2];
  const before = getPinPosition(note, 8);
  const after = getPinPosition({ ...note, time: note.time * 2 }, 16);
  assert.deepEqual(after, before);
});

for (const [index, filename] of ['Canon-in-D', 'Fu-r-Elise', 'Clockwork-garden'].entries()) {
  test(`${filename}: demo GLB bytes remain identical to the original supplied sample`, async () => {
    const spec = createDemoCylinders()[index];
    const original = await readFile(new URL(`../../public/samples/${filename}.glb`, import.meta.url));
    assert.deepEqual(Buffer.from(exportCylinderGLB(spec)), original);
  });
  test(`${filename}: geometry round trip recovers every note`, () => {
    const spec = createDemoCylinders()[index];
    assertScore(interpretCylinderGLTF(decoded(spec)).spec, spec, 0.012);
  });
}

test('moving an actual pin by one lane changes the recovered pitch, not just metadata', () => {
  const file = decoded();
  file.json.nodes[2].translation[0] += (CYLINDER_SHAPE.maxX - CYLINDER_SHAPE.minX) / 71;
  const result = interpretCylinderGLTF(file).spec;
  assert(result.notes.some(note => note.midi === 61));
  assert(!result.notes.some(note => note.midi === 60));
});

test('rotating a physical pin by a quarter turn changes its time', () => {
  const file = decoded();
  const node = file.json.nodes[2];
  const [x, y, z] = node.translation;
  node.translation = [x, -z, y];
  const angle = CYLINDER_SHAPE.contactAngle + Math.PI / 2;
  node.rotation = [Math.sin(angle / 2), 0, 0, Math.cos(angle / 2)];
  const result = interpretCylinderGLTF(file).spec;
  assert(result.notes.some(note => note.midi === 60 && Math.abs(note.time - 6) < 0.005));
});

test('unnamed individual pins still play from their positions', () => {
  const file = decoded();
  for (const node of file.json.nodes) {
    if (!node.name?.startsWith('pin_')) continue;
    node.name = 'small_geometry';
    delete node.extras;
  }
  const result = interpretCylinderGLTF(file);
  assert.equal(result.mode, 'Scanned pin geometry');
  assertScore(result.spec, fourNotes());
});

test('merged mesh radial-tip clustering recovers all notes', () => {
  const spec = fourNotes();
  const geometry = createCylinderGeometry(spec);
  const merged = geometryBuilders.merge([geometry.body, geometry.pins]);
  const metadata = decoded(spec).json.nodes[0].extras.musicBox;
  assertScore(interpretCylinderGLTF(encodeMergedGeometry(merged, metadata)).spec, spec);
});

test('pins between lanes are rejected instead of silently changing pitch', () => {
  const file = decoded();
  file.json.nodes[2].translation[0] += (CYLINDER_SHAPE.maxX - CYLINDER_SHAPE.minX) / 71 / 2;
  assert.throws(() => interpretCylinderGLTF(file), /between comb teeth/);
});

test('a smooth cylinder is not mistaken for an encoded song', () => {
  const file = decoded();
  file.json.nodes[0].children = [1];
  assert.throws(() => interpretCylinderGLTF(file), /No playable pins/);
});

test('embedded glTF has the same musical interpretation as GLB', () => {
  const file = decoded();
  file.json.buffers[0].uri = `data:application/octet-stream;base64,${Buffer.from(file.buffers[0]).toString('base64')}`;
  assertScore(interpretCylinderGLTF(decodeGLTF(JSON.stringify(file.json))).spec, fourNotes());
});

test('external glTF buffers are refused and never fetched', () => {
  assert.throws(() => decodeGLTF(JSON.stringify({
    asset: { version: '2.0' }, buffers: [{ uri: 'https://example.invalid/private.bin' }],
  })), /External files are not fetched/);
});

test('truncated containers and invalid chunk lengths are rejected', () => {
  assert.throws(() => decodeGLB(new ArrayBuffer(20)), /Not a binary/);
  const bytes = exportCylinderGLB(fourNotes());
  assert.throws(() => decodeGLB(bytes.buffer.slice(0, -4)), /truncated/);
  new DataView(bytes.buffer).setUint32(12, 0xffffffff, true);
  assert.throws(() => decodeGLB(bytes.buffer), /chunk length/);
});

test('compressed, sparse and cyclic inputs fail explicitly', () => {
  const compressed = decoded();
  compressed.json.extensionsRequired = ['KHR_draco_mesh_compression'];
  assert.throws(() => interpretCylinderGLTF(compressed), /uncompressed/);
  const sparse = decoded();
  sparse.json.accessors[0].sparse = {};
  assert.throws(() => interpretCylinderGLTF(sparse), /sparse/);
  const cyclic = decoded();
  cyclic.json.nodes[0].children.push(0);
  assert.throws(() => interpretCylinderGLTF(cyclic), /Cyclic/);
});
