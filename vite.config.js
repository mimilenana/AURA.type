import { defineConfig } from 'vite';
import glsl from 'vite-plugin-glsl';

export default defineConfig({
  // relative Pfade: die Seite läuft so auch in einem Unterordner, wie bei GitHub Pages (https://name.github.io/projekt/)
  base: './',
  server: {
    port: 8080,
    open: 'index.html',
  },
  publicDir: 'static',
  //lets sketches import .glsl, .vert and .frag files as text
  plugins: [glsl()],
  optimizeDeps: {
    include: ['p5'],
  },
});
