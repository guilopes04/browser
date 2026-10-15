// Dock, segunda instância ou atalho com a janela escondida: a janela volta com a aba ativa do
// espaço atual, acordando-a se ela dormiu.
import type { MainContext } from '../context'
import { applyLayout } from '../functions/apply-layout'
import { activateTab } from './activate-tab'

export function showWindow(ctx: MainContext): void {
  const { win, store } = ctx
  if (win.isDestroyed()) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()

  applyLayout(ctx)
  const activeId = store.getActiveTabId()
  if (activeId && ctx.attached.tabId !== activeId) activateTab(ctx, activeId)
}
