import type { TabId } from '@shared/types'
import type { MainContext } from '../context'

export function moveTab(ctx: MainContext, tabId: TabId, toIndex: number): void {
  ctx.store.moveTab(tabId, toIndex)
}
