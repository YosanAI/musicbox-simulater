import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listSampleFiles } from '../../scripts/sample-library-plugin.js';
import { loadSampleLibrary } from '../../src/io/sampleLibrary.js';
import { validateCylinder, exportCylinderGLB } from '../../src/cylinder/index.js';

const score = title => validateCylinder({ title, duration: 8, notes: [{ midi: 60, time: 1 }] });
function responses(files) {
  const calls = [];
  return {
    calls,
    fetchFile: async url => {
      calls.push(url);
      const filename = decodeURIComponent(url.slice('/samples/'.length));
      return Object.hasOwn(files, filename) ? new Response(files[filename]) : new Response(null, { status: 404 });
    },
  };
}

test('filesystem discovery includes new and nested files without requiring catalogue registration', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'sample-library-'));
  try {
    await mkdir(join(directory, 'nested'));
    await Promise.all([
      writeFile(join(directory, 'new.json'), JSON.stringify(score('New'))),
      writeFile(join(directory, 'new.glb'), exportCylinderGLB(score('New'))),
      writeFile(join(directory, 'first.glb'), exportCylinderGLB(score('First'))),
      writeFile(join(directory, 'nested', 'another.GLTF'), '{}'),
      writeFile(join(directory, 'readme.txt'), 'Ignored'),
      writeFile(join(directory, 'collection.json'), JSON.stringify([{ glb: 'first.glb' }])),
    ]);
    assert.deepEqual(await listSampleFiles(directory), ['first.glb', 'nested/another.GLTF', 'new.glb', 'new.json']);
    await writeFile(join(directory, 'added.json'), JSON.stringify(score('Added later')));
    assert((await listSampleFiles(directory)).includes('added.json'));
    await rm(join(directory, 'new.json'));
    assert(!(await listSampleFiles(directory)).includes('new.json'));
    await writeFile(join(directory, 'collection.json'), 'invalid metadata');
    assert.equal((await listSampleFiles(directory)).length, 4);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('JSON/GLB pairs appear once, prefer JSON and preserve index ordering', async () => {
  const source = responses({
    'pair.json': JSON.stringify(score('JSON score')),
    'pair.glb': exportCylinderGLB(score('GLB counterpart')),
    'next.json': JSON.stringify(score('Next')),
  });
  const result = await loadSampleLibrary(['pair.glb', 'next.json', 'pair.json'], '/samples/', source);
  assert.deepEqual(result.entries.map(entry => entry.spec.title), ['JSON score', 'Next']);
  assert.equal(result.entries[0].meshes, null);
  assert(!source.calls.includes('/samples/pair.glb'));
  assert.deepEqual(result.errors, []);
});

test('GLB-only samples and invalid JSON pairs use playable geometry', async () => {
  const source = responses({
    'only.glb': exportCylinderGLB(score('GLB only')),
    'fallback.json': '{invalid',
    'fallback.glb': exportCylinderGLB(score('Recovered')),
  });
  const result = await loadSampleLibrary(['only.glb', 'fallback.json', 'fallback.glb'], '/samples/', source);
  assert.deepEqual(result.entries.map(entry => entry.spec.title), ['GLB only', 'Recovered']);
  assert(result.entries.every(entry => entry.meshes.length > 0 && entry.spec.notes.length === 1));
  assert.deepEqual(result.errors, []);
});

test('metadata is ignored and broken samples cannot prevent valid cylinders from loading', async () => {
  const source = responses({
    'metadata.json': JSON.stringify([{ title: 'An index' }]),
    'broken.json': JSON.stringify({ notes: null }),
    'valid.json': JSON.stringify(score('Playable')),
  });
  const result = await loadSampleLibrary(['metadata.json', 'broken.json', 'missing.glb', 'valid.json'], '/samples/', source);
  assert.deepEqual(result.entries.map(entry => entry.spec.title), ['Playable']);
  assert.deepEqual(result.errors.map(error => error.filename), ['broken.json', 'missing.glb']);
  assert.equal(result.errors[1].message, 'HTTP 404');
});

test('sample URLs encode nested paths and filenames containing URL punctuation', async () => {
  const source = responses({ 'folder/a #?.JSON': JSON.stringify(score('Encoded name')) });
  const result = await loadSampleLibrary(['folder/a #?.JSON'], '/samples/', source);
  assert.equal(result.entries[0].spec.title, 'Encoded name');
  assert.deepEqual(source.calls, ['/samples/folder/a%20%23%3F.JSON']);
});

test('aborting startup propagates cancellation instead of skipping every sample', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(loadSampleLibrary(['cancelled.json'], '/samples/', {
    signal: controller.signal,
    fetchFile: async () => { controller.signal.throwIfAborted(); },
  }), { name: 'AbortError' });
});

test('the repository sample folder loads the catalogue and all additional playable cylinders', async () => {
  const directory = new URL('../../public/samples/', import.meta.url);
  const files = await listSampleFiles(fileURLToPath(directory));
  const result = await loadSampleLibrary(files, '/samples/', {
    fetchFile: async url => new Response(await readFile(new URL(url.slice('/samples/'.length), directory))),
  });
  assert.match(result.entries[0].spec.title, /^Für Elise/);
  assert(result.entries.some(entry => entry.spec.title.startsWith('Three classics')));
  assert(result.entries.some(entry => entry.spec.title === 'Clockwork garden'));
  assert.deepEqual(result.errors, []);
});
