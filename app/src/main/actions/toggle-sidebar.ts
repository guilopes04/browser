// ⌘S: alterna entre a sidebar aberta e o estilo escolhido nos Ajustes (oculta com revelação pela
// borda, ou compacta). Oculta, a página ocupa a janela com o mesmo recuo de 8 px.
import type { MainContext } from '../context'
import { applyLayout } from '../functions/apply-layout'
import { getNextSidebarMode } from '../functions/get-next-sidebar-mode'

export function toggleSidebar(ctx: MainContext): void {
  const { store } = ctx
  const [width] = ctx.win.getContentSize()
  store.setSidebar(
    getNextSidebarMode(
      store.state.window.sidebar,
      store.state.settings.hiddenSidebarStyle,
      width
    )
  )
  applyLayout(ctx)
}
