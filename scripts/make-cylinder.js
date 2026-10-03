#!/usr/bin/env node
import { readFile, writeFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateCylinder, exportCylinderGLB, CYLINDER_LIMITS } from '../src/cylinder/index.js';

try {
  const [input, output] = process.argv.slice(2);
  if (!input) throw new Error('Usage: npm run cylinder -- score.json [output.glb]');
  const inputPath = resolve(input);
  const outputPath = resolve(output || `${inputPath.replace(/\.json$/i, '')}.glb`);
  if (inputPath === outputPath) throw new Error('Output must differ from the input score.');
  if ((await stat(inputPath)).size > CYLINDER_LIMITS.maxFileBytes) {
    throw new Error('Input is larger than 35 MB.');
  }
  const spec = validateCylinder(JSON.parse(await readFile(inputPath, 'utf8')));
  await writeFile(outputPath, exportCylinderGLB(spec));
  console.log(`Wrote ${outputPath}: ${spec.notes.length} pins, ${spec.duration} seconds per turn.`);
} catch (error) {
  console.error(error.message || String(error));
  process.exitCode = 1;
}
