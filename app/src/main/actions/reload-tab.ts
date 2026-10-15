import type { MainContext } from '../context'
import { getActiveContents } from '../functions/get-active-contents'
import { markUserNavigation } from '../functions/user-intent'

// sempre na aba ativa
export function reloadTab(ctx: MainContext): void {
  const wc = getActiveContents(ctx)
  if (!wc || !ctx.attached.tabId) return
  markUserNavigation(ctx, ctx.attached.tabId)
  wc.reload()
}
