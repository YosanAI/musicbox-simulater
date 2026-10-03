import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDemoCylinders, exportCylinderGLB, decodeGLB, interpretCylinderGLTF } from '../../src/cylinder/index.js';

const library = createDemoCylinders();
const samples = ['Fur-Elise-three-parts', 'Strauss-Viennese-waltzes',
  'Bizet-Verdi-opera-airs', 'Mozart-The-Magic-Flute-Andante',
  'Schumann-Schubert-romantic-airs', 'Tchaikovsky-ballet-airs'];

test('researched repertoire defaults to Für Elise and fills three aligned tracks per cylinder', () => {
  assert.equal(library.length, 6);
  assert.match(library[0].title, /^Für Elise/);
  for (const spec of library) {
    assert.equal(spec.turns, 3);
    assert.equal(spec.tunes.length, 3);
    assert.match(spec.source, /independent abridged arrangement/);
    for (let turn = 0; turn < 3; turn++) {
      const notes = spec.notes.filter(note => note.turn === turn);
      assert(notes.length > 100);
      assert(notes.every(note => note.time >= 0.16), 'Pins must wait for axial alignment');
    }
  }
});

for (const [index, filename] of samples.entries()) {
  test(`${filename}: supplied geometry preserves every indexed pin and tune label`, async () => {
    const spec = library[index];
    const bytes = await readFile(new URL(`../../public/samples/${filename}.glb`, import.meta.url));
    assert.deepEqual(bytes, Buffer.from(exportCylinderGLB(spec)), 'Regenerate samples after changing an arrangement');
    const recovered = interpretCylinderGLTF(decodeGLB(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    )).spec;
    assert.equal(recovered.turns, spec.turns);
    assert.deepEqual(recovered.tunes, spec.tunes);
    assert.equal(recovered.notes.length, spec.notes.length);
    for (const note of spec.notes) {
      assert(recovered.notes.some(pin => pin.turn === note.turn && pin.tooth === note.tooth &&
        Math.abs(pin.time - note.time) < 0.001 && pin.velocity === note.velocity),
      `Missing pin on track ${note.turn}, tooth ${note.tooth}, at ${note.time}s`);
    }
  });
}
