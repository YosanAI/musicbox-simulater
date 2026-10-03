import { readdir, readFile, access } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const packages = new Set(Object.keys({ ...packageJson.dependencies, ...packageJson.devDependencies }));
async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(entry => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? walk(path) : path;
  }));
  return files.flat();
}

let count = 0;
const paths = [
  ...await walk(resolve(root, 'src')),
  ...await walk(resolve(root, 'scripts')),
  ...await walk(resolve(root, 'tests')),
  resolve(root, 'vite.config.js'), resolve(root, 'playwright.config.js'),
];
for (const file of paths.filter(file => file.endsWith('.js'))) {
  const checked = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (checked.status !== 0) throw new Error(checked.stderr || `Syntax check failed: ${file}`);
  const text = await readFile(file, 'utf8');
  const importPattern = /(?:\bfrom\s*|\bimport\s*)['"]([^'"]+)['"]/g;
  for (const [, imported] of text.matchAll(importPattern)) {
    const cleanPath = imported.split('?')[0];
    if (cleanPath.startsWith('.')) {
      try { await access(resolve(dirname(file), cleanPath)); }
      catch { throw new Error(`${relative(root, file)} imports missing file ${imported}`); }
    } else if (!cleanPath.startsWith('node:')) {
      const name = cleanPath.startsWith('@') ? cleanPath.split('/').slice(0, 2).join('/') : cleanPath.split('/')[0];
      if (!packages.has(name)) throw new Error(`Undeclared package ${name} in ${file}`);
    }
  }
  count++;
}
console.log(`Checked ${count} JavaScript files: valid syntax, local import paths and declared packages.`);
console.log('This is a source check, not a Vite build, type check or browser rendering test.');
