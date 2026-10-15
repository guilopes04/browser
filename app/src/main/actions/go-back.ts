import type { MainContext } from '../context'
import { getActiveContents } from '../functions/get-active-contents'
import { markUserNavigation } from '../functions/user-intent'

export function goBack(ctx: MainContext): void {
  const wc = getActiveContents(ctx)
  if (!wc?.navigationHistory.canGoBack() || !ctx.attached.tabId) return
  markUserNavigation(ctx, ctx.attached.tabId)
  wc.navigationHistory.goBack()
}
