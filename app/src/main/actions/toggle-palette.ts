// ⌘K alterna a paleta.
import type { MainContext } from '../context'
import { closePalette } from './close-palette'
import { isPaletteOpen } from '../functions/is-palette-open'
import { openPalette } from './open-palette'

export function togglePalette(ctx: MainContext): void {
  if (isPaletteOpen(ctx)) closePalette(ctx)
  else openPalette(ctx)
}
