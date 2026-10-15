// Fecha a busca: limpa os destaques da página, tira a barra da janela e a destrói. Sem efeito se
// já estava fechada. Esc e o botão devolvem o foco à página; trocar de aba não (a aba nova tem o
// foco dela).
import type { MainContext } from '../context'
import { removeFindHighlightStyle } from '../functions/find-highlight-style'
import { getActiveContents } from '../functions/get-active-contents'
import { getLiveContents } from '../functions/get-live-contents'
import { closeKeyGate } from '../functions/key-gate'

export function closeFind(ctx: MainContext, restoreFocus = true): void {
  const session = ctx.find
  if (!session) return
  ctx.find = null
  closeKeyGate(ctx, 'find')
  // o "Aa" fica para a próxima busca
  ctx.findMatchCase = session.state.matchCase

  const contents = getLiveContents(ctx.views.get(session.tabId))
  if (contents) {
    contents.stopFindInPage('clearSelection')
    if (session.cssKey) removeFindHighlightStyle(contents, session.cssKey)
  }

  if (!ctx.win.isDestroyed()) ctx.win.contentView.removeChildView(session.view)
  getLiveContents(session.view)?.close()

  if (restoreFocus) getActiveContents(ctx)?.focus()
}
