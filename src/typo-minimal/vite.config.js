import { defineConfig } from 'vite';
import glsl from 'vite-plugin-glsl';

export default defineConfig({
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
