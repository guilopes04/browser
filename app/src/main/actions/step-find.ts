// ⌘G, ⇧⌘G, ↵ e ⇧↵: o resultado seguinte ou o anterior. Sem a barra aberta, ⌘G a abre.
import type { MainContext } from '../context'
import { followFind } from './follow-find'
import { openFind } from './open-find'

export function stepFind(ctx: MainContext, forward: boolean): void {
  if (!ctx.find) {
    openFind(ctx)
    return
  }
  followFind(ctx, forward)
}
