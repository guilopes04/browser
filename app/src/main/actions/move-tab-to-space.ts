// Move a aba para outro espaço. A sessão muda, então a view é recriada e a página recarregada
// quando a aba for aberta de novo.
import type { SpaceId, TabId } from '@shared/types'
import type { MainContext } from '../context'
import { destroyTabView } from '../functions/destroy-tab-view'
import { pickNextTab } from './pick-next-tab'

export function moveTabToSpace(
  ctx: MainContext,
  tabId: TabId,
  spaceId: SpaceId
): void {
  const { store } = ctx
  const tab = store.getTab(tabId)
  if (!tab || tab.spaceId === spaceId || !store.getSpace(spaceId)) return

  const oldSpaceId = tab.spaceId
  const index = store
    .getTabsOfSpace(oldSpaceId)
    .findIndex(other => other.id === tabId)
  const wasActive = store.getActiveTabId(oldSpaceId) === tabId

  destroyTabView(ctx, tabId)
  ctx.stash.delete(tabId)
  store.moveTabToSpace(tabId, spaceId)

  if (wasActive) pickNextTab(ctx, oldSpaceId, index)
}
