// Pinta a janela nativa com a cor do espaço atual no tema. O fundo das páginas não muda com o
// tema: ver PAGE_CANVAS em shared/tokens.ts.
import { getSpaceBackground } from '@shared/tokens'
import type { MainContext } from '../context'

export function applyWindowBackground(ctx: MainContext): void {
  const { store } = ctx
  if (ctx.win.isDestroyed()) return
  ctx.win.setBackgroundColor(
    getSpaceBackground(store.getCurrentSpace().color, store.state.theme)
  )
}
