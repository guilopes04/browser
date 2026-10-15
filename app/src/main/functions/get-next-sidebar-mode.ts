// ⌘S: para qual modo a sidebar vai. Pura.
import type { SidebarMode } from '@shared/types'
import { getEffectiveSidebar } from './compute-layout'

// aberta -> estilo escolhido nos Ajustes (oculta ou compacta); qualquer outra -> aberta. Se o
// destino não mudaria nada na tela (janela estreita já mostra a compacta), vai para a oculta
export function getNextSidebarMode(
  current: SidebarMode,
  hiddenStyle: 'hidden' | 'compact',
  windowWidth: number
): SidebarMode {
  const candidate = current === 'open' ? hiddenStyle : 'open'
  const changesScreen =
    getEffectiveSidebar(candidate, windowWidth) !==
    getEffectiveSidebar(current, windowWidth)
  return changesScreen ? candidate : 'hidden'
}
