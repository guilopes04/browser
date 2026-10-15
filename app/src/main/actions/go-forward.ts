import type { MainContext } from '../context'
import { getActiveContents } from '../functions/get-active-contents'

export function goForward(ctx: MainContext): void {
  const wc = getActiveContents(ctx)
  if (wc?.navigationHistory.canGoForward()) wc.navigationHistory.goForward()
}
