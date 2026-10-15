// Tema: o main lê nativeTheme e pinta a janela; a shell só recebe `theme` no snapshot.
import { nativeTheme } from 'electron'
import type { Theme } from '@shared/types'
import type { MainContext } from '../context'
import { applyWindowBackground } from '../functions/window-background'

export function readTheme(): Theme {
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
}

export function watchTheme(ctx: MainContext): void {
  nativeTheme.on('updated', () => {
    ctx.store.setTheme(readTheme())
    applyWindowBackground(ctx)
  })
}
