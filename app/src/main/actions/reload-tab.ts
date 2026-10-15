import type { MainContext } from '../context'
import { getActiveContents } from '../functions/get-active-contents'

// sempre na aba ativa
export function reloadTab(ctx: MainContext): void {
  getActiveContents(ctx)?.reload()
}
