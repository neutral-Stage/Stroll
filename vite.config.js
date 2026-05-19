import { defineConfig } from 'vite';

/** GitHub Pages project site: https://neutral-stage.github.io/Stroll/ */
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  base,
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: 'index.html',
    },
  },
  server: {
    port: 5173,
    open: false,
  },
  resolve: {
    alias: {
      'three/addons': 'three/examples/jsm',
    },
  },
});
