// ⌃1…⌃n: troca de espaço. A janela inteira muda de cor; cada espaço tem suas abas.
import type { SpaceId } from '@shared/types'
import type { MainContext } from '../context'
import { createTabRecord } from '../store/create-tab-record'
import { activateTab } from './activate-tab'

export function switchSpace(ctx: MainContext, spaceId: SpaceId): void {
  const { store } = ctx
  if (!store.getSpace(spaceId) || spaceId === store.state.window.spaceId) return

  let target = store.getActiveTab(spaceId) ?? store.getTabsOfSpace(spaceId)[0]
  if (!target) {
    target = createTabRecord(spaceId, '')
    store.addTab(target, 'top')
  }
  activateTab(ctx, target.id)
}
