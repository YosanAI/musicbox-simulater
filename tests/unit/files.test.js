import test from 'node:test';
import assert from 'node:assert/strict';
import { readCylinderFile, serializeCylinder } from '../../src/io/cylinderFiles.js';
import { safeFilename } from '../../src/io/download.js';
import { formatTime } from '../../src/ui/formatters.js';
import { validateCylinder, exportCylinderGLB } from '../../src/cylinder/index.js';

const spec = validateCylinder({ title: 'My cylinder', duration: 8, notes: [{ midi: 60, time: 1 }] });

test('local JSON and GLB imports retain the encoded score', async () => {
  const json = await readCylinderFile(new File([serializeCylinder(spec)], 'test.json'));
  assert.deepEqual(json.spec.notes, spec.notes);
  const glb = await readCylinderFile(new File([exportCylinderGLB(spec)], 'test.glb'));
  assert.equal(glb.spec.notes[0].midi, 60);
  assert(Math.abs(glb.spec.notes[0].time - 1) < 0.001);
});

test('oversized local files are rejected before their contents are read', async () => {
  await assert.rejects(() => readCylinderFile({ size: 36 * 1024 ** 2 }), /35 MB/);
});

test('unsupported file types fail with the supported formats', async () => {
  await assert.rejects(() => readCylinderFile(new File(['data'], 'test.obj')), /\.glb/);
});

test('the interchange JSON contains neither generated geometry nor recorded audio', () => {
  const value = JSON.parse(serializeCylinder(spec));
  assert.deepEqual(Object.keys(value), ['format', 'version', 'title', 'composer', 'duration', 'tuning', 'notes']);
  assert.deepEqual(value.notes[0], { time: 1, tooth: 24, velocity: 0.75 });
});

test('indexed JSON and GLB imports preserve tune labels and separate same-angle tracks', async () => {
  const indexed = validateCylinder({ duration: 8, turns: 3,
    tunes: [{ title: 'First air', composer: 'One' }, { title: 'Second air', composer: 'Two' }, { title: 'Third air', composer: 'Three' }],
    notes: [{ midi: 60, time: 1, turn: 0 }, { midi: 60, time: 1, turn: 1 }, { midi: 64, time: 1, turn: 2 }],
  });
  const json = await readCylinderFile(new File([serializeCylinder(indexed)], 'indexed.json'));
  assert.deepEqual(json.spec.notes, indexed.notes);
  assert.deepEqual(json.spec.tunes, indexed.tunes);
  const glb = await readCylinderFile(new File([exportCylinderGLB(indexed)], 'indexed.glb'));
  assert.equal(glb.spec.turns, 3);
  assert.deepEqual(glb.spec.tunes, indexed.tunes);
  assert.deepEqual(glb.spec.notes.map(note => [note.tooth, note.turn]), indexed.notes.map(note => [note.tooth, note.turn]));
});

test('download filenames and elapsed-time labels retain the original format', () => {
  assert.equal(safeFilename('Canon in D'), 'Canon-in-D');
  assert.equal(safeFilename('///'), 'cylinder');
  assert.equal(formatTime(61.9), '1:01');
  assert.equal(formatTime(-1), '0:00');
});
