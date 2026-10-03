import { mkdir, writeFile } from 'node:fs/promises';
import { createDemoCylinders, validateCylinder, exportCylinderGLB } from '../src/cylinder/index.js';

const directory = new URL('../public/samples/', import.meta.url);
await mkdir(directory, { recursive: true });
const examples = createDemoCylinders().map(spec => ({
  spec,
  name: spec.title.normalize('NFKD').replace(/[^a-zA-Z0-9]+/g, '-').replace(/-$/, ''),
}));
examples.push({
  name: 'Four-note-test',
  spec: validateCylinder({
    title: 'Four-note test cylinder', duration: 8,
    notes: [{ time: 0, midi: 60 }, { time: 0.5, midi: 64 }, { time: 1, midi: 67 }, { time: 2, midi: 72 }],
  }),
});
for (const { name, spec } of examples) {
  await writeFile(new URL(`${name}.glb`, directory), exportCylinderGLB(spec));
  await writeFile(new URL(`${name}.json`, directory), JSON.stringify(spec, null, 2));
  console.log(`${name}: ${spec.notes.length} pins, ${spec.duration.toFixed(2)} seconds.`);
}
