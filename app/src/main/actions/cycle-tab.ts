// ⌃Tab e ⌃⇧Tab: próxima ou anterior na ordem da sidebar, dentro do espaço atual.
import type { MainContext } from '../context'
import { activateTab } from './activate-tab'

export function cycleTab(ctx: MainContext, direction: 1 | -1): void {
  const tabs = ctx.store.getTabsOfSpace(ctx.store.state.window.spaceId)
  if (tabs.length < 2) return
  const current = tabs.findIndex(tab => tab.id === ctx.store.getActiveTabId())
  const next = tabs[(current + direction + tabs.length) % tabs.length]
  activateTab(ctx, next.id)
}
