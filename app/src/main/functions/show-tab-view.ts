// Põe a view da aba ativa na árvore da janela (acima da shell) e tira a anterior.
import type { WebContentsView } from 'electron'
import type { TabId } from '@shared/types'
import type { MainContext } from '../context'
import { applyLayout } from './apply-layout'
import { exitVideoFullscreen } from './exit-video-fullscreen'
import { getLiveContents } from './get-live-contents'
import { logError } from './log-error'
import { notifyTabShown } from './restore-scroll'

// as outras abas vivas saem da árvore e continuam rodando; nada de setVisible(false)
export function hideTabView(ctx: MainContext): void {
  exitVideoFullscreen(ctx)
  const { view } = ctx.attached
  if (view && !ctx.win.isDestroyed()) {
    try {
      ctx.win.contentView.removeChildView(view)
    } catch (error) {
      // view de uma página que já se fechou: não há o que tirar da árvore
      logError('[Tab][hideTabView]', 'falha ao tirar a view', error)
    }
  }
  ctx.attached.tabId = null
  ctx.attached.view = null
}

export function showTabView(
  ctx: MainContext,
  tabId: TabId,
  view: WebContentsView
): void {
  if (ctx.attached.view !== view) {
    hideTabView(ctx)
    ctx.win.contentView.addChildView(view)
    ctx.attached.tabId = tabId
    ctx.attached.view = view
    // a página entrou no topo: se há overlay, a shell volta por cima dela
    ctx.shellRaised = false
  }
  applyLayout(ctx)
  const wc = getLiveContents(view)
  if (wc) notifyTabShown(ctx, tabId, wc)
}
