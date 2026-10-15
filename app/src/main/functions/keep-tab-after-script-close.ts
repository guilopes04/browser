// O pedido de window.close() foi recusado (ver judge-script-close.ts), mas o Chromium já destruiu
// o webContents. A aba continua na sidebar como dormente, com o histórico que o evento 'close'
// guardou, e, se estava na frente, é recarregada. Se a página insiste em se fechar em laço, a
// segunda vez em menos de REVIVE_GAP_MS a aba fica dormente e outra assume.
import type { TabId } from '@shared/types'
import { activateTab } from '../actions/activate-tab'
import { createTab } from '../actions/create-tab'
import type { MainContext } from '../context'
import { resetViewState } from '../web-guard'
import { hideTabView } from './show-tab-view'

export const REVIVE_GAP_MS = 10_000

export function keepTabAfterScriptClose(
  ctx: MainContext,
  tabId: TabId,
  now = Date.now()
): void {
  const { store } = ctx
  const tab = store.getTab(tabId)
  if (!tab) return
  const wasShown = ctx.attached.tabId === tabId
  const index = store.getTabsOfSpace(tab.spaceId).findIndex(t => t.id === tabId)

  ctx.views.delete(tabId)
  if (wasShown) hideTabView(ctx)
  resetViewState(ctx.guard, tabId)
  store.patchTab(tabId, {
    dormant: true,
    loading: false,
    audible: false,
    canGoBack: false,
    canGoForward: false,
    error: null,
    blockedPopups: 0,
    dialogBlocked: false
  })

  const last = ctx.guard.scriptCloseUndoneAt.get(tabId) ?? 0
  ctx.guard.scriptCloseUndoneAt.set(tabId, now)
  if (!wasShown) return
  if (now - last > REVIVE_GAP_MS) {
    activateTab(ctx, tabId)
    return
  }
  // em laço: a aba fica dormente (acorda quando o usuário a abrir) e a vizinha assume
  const siblings = store.getTabsOfSpace(tab.spaceId)
  const next = siblings[index + 1] ?? siblings[index - 1]
  if (next) activateTab(ctx, next.id)
  else createTab(ctx, { spaceId: tab.spaceId })
}
