// ⌘+ ⌘− ⌘0: zoom da aba ativa, em passos de meio nível.
import type { MainContext } from '../context'
import { getActiveContents } from '../functions/get-active-contents'

const ZOOM_LIMIT = 5

export function stepZoom(ctx: MainContext, delta: number | 'reset'): void {
  const wc = getActiveContents(ctx)
  if (!wc) return
  if (delta === 'reset') {
    wc.setZoomLevel(0)
    return
  }
  const next = Math.max(
    -ZOOM_LIMIT,
    Math.min(ZOOM_LIMIT, wc.getZoomLevel() + delta)
  )
  wc.setZoomLevel(next)
}
