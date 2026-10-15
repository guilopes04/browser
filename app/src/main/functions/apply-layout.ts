// Aplica a geometria na shell, na aba visível e nos semáforos. Síncrono, sem animação.
import type { MainContext } from '../context'
import { computeLayout, type Layout } from './compute-layout'
import { layoutFind } from './layout-find'
import { syncShellOrder } from './sync-shell-order'

export function getLayout(ctx: MainContext): Layout {
  const [width, height] = ctx.win.getContentSize()
  const { state } = ctx.store
  return computeLayout({
    width,
    height,
    sidebar: state.window.sidebar,
    videoFullscreen: state.fullscreen,
    peek: state.overlay.includes('peek')
  })
}

export function applyLayout(ctx: MainContext): void {
  if (ctx.win.isDestroyed()) return
  const layout = getLayout(ctx)

  // a janela estreita pode mostrar a sidebar compacta; a shell precisa saber qual desenhar
  ctx.store.setEffectiveSidebar(layout.sidebar)
  syncShellOrder(ctx)

  ctx.shell.setBounds(layout.shell)
  layoutFind(ctx, layout.page)
  const { view, tabId } = ctx.attached
  if (view) {
    // com erro de carregamento a shell desenha a página de erro; a view fica escondida
    const failed = tabId !== null && ctx.store.getTab(tabId)?.error != null
    view.setVisible(!failed)
    view.setBounds(layout.page)
    view.setBorderRadius(layout.pageRadius)
  }

  if (process.platform === 'darwin') {
    ctx.win.setWindowButtonVisibility(layout.trafficLights.visible)
    if (layout.trafficLights.visible)
      ctx.win.setWindowButtonPosition(layout.trafficLights.position)
  }
}
