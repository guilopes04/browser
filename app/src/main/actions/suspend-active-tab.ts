// "Suspender aba" da paleta: a aba ativa nunca é suspensa enquanto está na janela, então vai-se
// para a aba usada por último no espaço (ou uma Nova aba) e a anterior dorme.
import type { MainContext } from '../context'
import { activateTab } from './activate-tab'
import { createTab } from './create-tab'
import { suspendTab } from './suspend-tab'

export function suspendActiveTab(ctx: MainContext): void {
  const { store } = ctx
  const tab = store.getActiveTab()
  if (!tab || !ctx.views.has(tab.id)) return

  const others = store
    .getTabsOfSpace(tab.spaceId)
    .filter(other => other.id !== tab.id)
    .sort((a, b) => b.lastActiveAt - a.lastActiveAt)
  if (others.length > 0) activateTab(ctx, others[0].id)
  else createTab(ctx, { spaceId: tab.spaceId })
  void suspendTab(ctx, tab.id)
}
