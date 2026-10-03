import { defineConfig } from 'vite';

export default defineConfig({
  // Deploy dist/ at the root of a site or under a project subdirectory.
  base: './',
  server: { host: '127.0.0.1', port: 5173 },
  preview: { host: '127.0.0.1', port: 4173 },
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
