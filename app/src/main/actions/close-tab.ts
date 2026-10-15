// ⌘W: fecha a aba; se era a última do espaço, abre uma Nova aba. Nunca fecha a janela.
import type { TabId } from '@shared/types'
import type { MainContext } from '../context'
import { destroyTabView } from '../functions/destroy-tab-view'
import { pickNextTab } from './pick-next-tab'

export function closeTab(ctx: MainContext, tabId: TabId): void {
  const { store } = ctx
  const tab = store.getTab(tabId)
  if (!tab) return

  if (tab.url)
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
