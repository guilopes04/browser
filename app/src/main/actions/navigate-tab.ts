// Barra de endereço: texto cru vira URL ou busca e carrega na aba.
import type { TabId } from '@shared/types'
import { resolveTyped } from '@shared/resolve-input'
import type { MainContext } from '../context'
import { getLiveContents } from '../functions/get-live-contents'
import { activateTab } from './activate-tab'

export function navigateTab(
  ctx: MainContext,
  tabId: TabId,
  input: string
): void {
  const { store } = ctx
  const tab = store.getTab(tabId)
  if (!tab) return
  const { url, httpFallback } = resolveTyped(
    input,
    store.state.settings.searchUrl
  )
  if (!url) return
  // domínio sem esquema: https primeiro; se o servidor só fala http, attach-tab-events tenta http
  if (httpFallback)
    ctx.httpFallbacks.set(tabId, { from: url, to: httpFallback })
  else ctx.httpFallbacks.delete(tabId)

  const wc = getLiveContents(ctx.views.get(tabId))
  if (wc) {
    void wc.loadURL(url).catch(() => {})
    store.patchTab(tabId, { url })
    return
  }

  // Nova aba ou dormente: a navegação nova descarta o histórico guardado
  ctx.stash.delete(tabId)
  store.patchTab(tabId, { url, title: '', favicon: null, dormant: true })
  if (
    store.getActiveTabId(tab.spaceId) === tabId &&
    tab.spaceId === store.state.window.spaceId
  ) {
    activateTab(ctx, tabId)
  }
}
