// Geometria inicial da janela: sessão salva, depois --abas, depois as flags (cada uma vence a anterior).
import type { Rect } from '@shared/types'
import type { Flags } from '../flags'
import { DEFAULT_BOUNDS } from '../store/defaults'
import { clampOrigin } from './clamp-origin'
import { isVisibleOnSomeDisplay } from './is-visible-on-some-display'

export interface ResolvedBounds {
  bounds: Rect
  // tamanho pedido por flag ou por --abas: vale exato, mesmo acima da área útil (o Dock tira
  // cerca de 80 pt e o macOS encolheria a janela). Sem pedido, o macOS ajusta sozinho.
  sizeExplicit: boolean
}

export function resolveWindowBounds(
  saved: Rect | null,
  fromTabsFile: Partial<Rect>,
  flags: Flags
): ResolvedBounds {
  const base = saved && isVisibleOnSomeDisplay(saved) ? saved : DEFAULT_BOUNDS
  const asked = { ...fromTabsFile, ...flags.window }
  const sizeExplicit = asked.width !== undefined || asked.height !== undefined
  const requested: Rect = { ...base, ...asked }
  return {
    bounds: sizeExplicit ? clampOrigin(requested) : requested,
    sizeExplicit
  }
}
