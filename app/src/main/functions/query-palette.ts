// Consulta da paleta: junta o estado do app e o histórico e monta as seções.
import type { PaletteScope, PaletteSection } from '@shared/types'
import type { MainContext } from '../context'
import { buildPaletteSections } from './build-palette-sections'

export function queryPalette(
  ctx: MainContext,
  text: string,
  scope: PaletteScope
): PaletteSection[] {
  const { store, history } = ctx
  return buildPaletteSections({
    text,
    scope,
    spaces: store.state.spaces,
    tabs: store.state.tabs,
    currentSpaceId: store.state.window.spaceId,
    activeTabId: store.getActiveTabId(),
    history: spaceId => history.getEntries(spaceId),
    searchUrl: store.state.settings.searchUrl,
    canReopen: store.closed.length > 0
  })
}
