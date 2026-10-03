import { defineConfig } from 'vite';
import { sampleLibraryPlugin } from './scripts/sample-library-plugin.js';

export default defineConfig({
  // Deploy dist/ at the root of a site or under a project subdirectory.
  base: './',
  plugins: [sampleLibraryPlugin()],
  server: { host: '127.0.0.1', port: 3000, strictPort: true },
  preview: { host: '127.0.0.1', port: 3000, strictPort: true },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: { three: ['three'] },
      },
    },
  },
});
