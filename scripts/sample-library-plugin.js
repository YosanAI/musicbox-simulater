import { readdir, readFile } from 'node:fs/promises';
import { isAbsolute, join, relative } from 'node:path';

const supportedFile = /\.(json|glb|gltf)$/i;

/** Discover files independently of the optional collection's display order. */
export async function listSampleFiles(directory) {
  async function walk(folder, prefix = '') {
    let entries;
    try {
      entries = await readdir(folder, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
    const files = await Promise.all(entries.map(async entry => {
      const name = `${prefix}${entry.name}`;
      if (entry.isDirectory()) return walk(join(folder, entry.name), `${name}/`);
      return entry.isFile() && supportedFile.test(name) && name !== 'collection.json' ? [name] : [];
    }));
    return files.flat();
  }

  const files = await walk(directory);
  let order = [];
  try {
    const collection = JSON.parse(await readFile(join(directory, 'collection.json'), 'utf8'));
    if (Array.isArray(collection)) {
      order = collection.flatMap(entry => [entry?.json, entry?.glb]).filter(name => typeof name === 'string');
    }
  } catch {
    // An absent or invalid ordering file must not hide discovered cylinders.
  }
  const rank = new Map(order.map((name, index) => [name, index]));
  return files.sort((a, b) => (rank.get(a) ?? Infinity) - (rank.get(b) ?? Infinity) || a.localeCompare(b, 'en'));
}

/** Serve a fresh index in development and include the same index in dist/. */
export function sampleLibraryPlugin() {
  let directory;
  let base;
  return {
    name: 'sample-library',
    configResolved(config) {
      directory = join(config.publicDir, 'samples');
      base = config.base.startsWith('/') ? config.base : '/';
    },
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (request.url?.split('?')[0] !== `${base}sample-library.json`) return next();
        try {
          const files = await listSampleFiles(directory);
          response.setHeader('Content-Type', 'application/json');
          response.setHeader('Cache-Control', 'no-store');
          response.end(JSON.stringify(files));
        } catch (error) {
          next(error);
        }
      });

      let reloadTimer;
      const reload = path => {
        const name = relative(directory, path);
        if (isAbsolute(name) || name.startsWith('..') || !supportedFile.test(name)) return;
        clearTimeout(reloadTimer);
        reloadTimer = setTimeout(() => server.ws.send({ type: 'full-reload', path: '*' }), 100);
      };
      server.watcher.on('add', reload);
      server.watcher.on('unlink', reload);
      server.httpServer?.once('close', () => {
        clearTimeout(reloadTimer);
        server.watcher.off('add', reload);
        server.watcher.off('unlink', reload);
      });
    },
    async generateBundle() {
      this.emitFile({
        type: 'asset', fileName: 'sample-library.json',
        source: JSON.stringify(await listSampleFiles(directory), null, 2),
      });
    },
  };
}
