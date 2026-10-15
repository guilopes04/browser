// Tira a aba da sidebar e passa a ativa para a vizinha (ou abre uma Nova aba se o espaço esvaziou).
import type { TabId } from '@shared/types'
import type { MainContext } from '../context'
import { destroyTabView } from '../functions/destroy-tab-view'
import { pickNextTab } from './pick-next-tab'

// remember: vai para a pilha do ⇧⌘T (fechada pelo usuário). Uma página que fecha a si mesma
// (popup de login com window.close) não deve voltar com ⇧⌘T
export function removeTab(
  ctx: MainContext,
  tabId: TabId,
  remember: boolean
): void {
  const { store } = ctx
  const tab = store.getTab(tabId)
  ctx.closing.delete(tabId)
  if (!tab) return

  if (remember && tab.url)
    store.pushClosed({ spaceId: tab.spaceId, url: tab.url, title: tab.title })

  const index = store
    .getTabsOfSpace(tab.spaceId)
    .findIndex(other => other.id === tabId)
  const wasActive = store.getActiveTabId(tab.spaceId) === tabId

  destroyTabView(ctx, tabId)
  ctx.stash.delete(tabId)
  store.removeTab(tabId)

  if (wasActive) pickNextTab(ctx, tab.spaceId, index)
}
