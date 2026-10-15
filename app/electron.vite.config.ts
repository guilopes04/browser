import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'

const alias = { '@shared': resolve('src/shared') }

export default defineConfig({
  main: {
    resolve: { alias }
  },
  preload: {
    resolve: { alias }
  },
  renderer: {
    root: resolve('src/renderer'),
    base: './',
    resolve: { alias },
    build: {
      minify: 'oxc',
      rollupOptions: { input: resolve('src/renderer/index.html') }
    }
  }
})
