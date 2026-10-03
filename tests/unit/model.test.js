import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MusicBoxBuilder } from '../../src/scene/MusicBoxBuilder.js';
import { createRecordingRenderer, summarizeModel } from '../helpers/geometry.js';

const baseline = JSON.parse(readFileSync(new URL('../fixtures/original-model.json', import.meta.url)));

test('all 93 original parts retain geometry, transforms, material groups and shadow participation', () => {
  const names = ['brass', 'gold', 'edge', 'steel', 'darkSteel', 'black',
    'wood', 'woodDark', 'label', 'barrelLabel'];
  const palette = Object.fromEntries(names.map(name => [name, { name }]));
  const renderer = createRecordingRenderer();
  const model = new MusicBoxBuilder(renderer, palette).build();
  assert.equal(model.teeth.length, 72);
  assert.equal(renderer.nodes.length, 93);
  assert.deepEqual(summarizeModel(renderer), baseline);
});
