// ⇧⌘T: reabre a última aba fechada.
import type { MainContext } from '../context'
import { createTab } from './create-tab'

export function reopenTab(ctx: MainContext): void {
  const entry = ctx.store.popClosed()
  if (!entry) return
  createTab(ctx, { spaceId: entry.spaceId, url: entry.url })
}
