import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'

const alias = { '@shared': resolve('src/shared') }

export default defineConfig({
  main: {
    resolve: { alias }
  },
  preload: {
    resolve: { alias },
    build: {
      // dois preloads, cada um um arquivo só (o de sandbox não carrega pedaços): a shell e as abas
      rollupOptions: {
        input: {
          index: resolve('src/preload/index.ts'),
          'tab-guard': resolve('src/preload/tab-guard.ts')
        }
      }
    }
  },
  renderer: {
    root: resolve('src/renderer'),
    base: './',
    resolve: { alias },
    build: {
      minify: 'oxc',
      // a shell e a barra de busca (view própria, por cima da página)
      rollupOptions: {
        input: {
          index: resolve('src/renderer/index.html'),
          find: resolve('src/renderer/find.html')
        }
      }
    }
  }
})
