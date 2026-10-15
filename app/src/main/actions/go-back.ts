import type { MainContext } from '../context'
import { getActiveContents } from '../functions/get-active-contents'

export function goBack(ctx: MainContext): void {
  const wc = getActiveContents(ctx)
  if (wc?.navigationHistory.canGoBack()) wc.navigationHistory.goBack()
}
