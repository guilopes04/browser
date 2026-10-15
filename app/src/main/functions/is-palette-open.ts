import type { MainContext } from '../context'

export function isPaletteOpen(ctx: MainContext): boolean {
  return ctx.store.state.overlay.includes('palette')
}
