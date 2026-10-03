import { readCylinderFile } from './cylinderFiles.js';

/** Load one cylinder per basename, preferring JSON and retaining GLB-only meshes. */
export async function loadSampleLibrary(filenames, baseUrl, { signal, fetchFile = fetch } = {}) {
  const groups = new Map();
  const priority = { json: 0, glb: 1, gltf: 2 };
  for (const filename of filenames) {
    const match = /\.(json|glb|gltf)$/i.exec(filename);
    if (!match) continue;
    const name = filename.slice(0, -match[0].length);
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push({ filename, extension: match[1].toLowerCase() });
  }

  const results = await Promise.all([...groups.values()].map(async files => {
    const errors = [];
    files.sort((a, b) => priority[a.extension] - priority[b.extension]);
    for (const { filename, extension } of files) {
      try {
        const url = baseUrl + filename.split('/').map(encodeURIComponent).join('/');
        const response = await fetchFile(url, { signal, cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const file = new File([await response.blob()], filename.split('/').pop());
        if (extension === 'json') {
          const raw = JSON.parse(await file.text());
          if (!raw || Array.isArray(raw) || !Object.hasOwn(raw, 'notes')) continue;
        }
        const { spec, meshes } = await readCylinderFile(file);
        return { entry: { spec, meshes }, errors: [] };
      } catch (error) {
        if (signal?.aborted) throw error;
        errors.push({ filename, message: error.message });
      }
    }
    return { entry: null, errors };
  }));
  return {
    entries: results.flatMap(result => result.entry ? [result.entry] : []),
    errors: results.flatMap(result => result.errors),
  };
}
