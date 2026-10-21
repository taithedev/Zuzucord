import { defineConfig } from 'vite';
import { resolve } from 'node:path';
export default defineConfig({
  base: './',
  build: { outDir: resolve(__dirname, 'dist'), sourcemap: false },
  server: { port: 5174, strictPort: true }
});
