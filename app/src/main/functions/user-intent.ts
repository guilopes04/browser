// A ação do usuário que pode descarregar a página de uma aba (fechar, recarregar, voltar,
// avançar, ir a um endereço, clicar num link). O beforeunload só pergunta por uma ação dessas:
// a página que tenta se manter viva sozinha (script, aba em segundo plano) não ganha diálogo.
import type { TabId } from '@shared/types'
import type { MainContext } from '../context'
import { GESTURE_WINDOW_MS } from './user-gesture'

// o app executou algo que o usuário pediu para esta aba (⌘W, ⌘R, ⌘[, endereço digitado...)
export function markUserNavigation(
  ctx: MainContext,
  tabId: TabId,
  now = Date.now()
): void {
  ctx.guard.navIntents.set(tabId, now)
}

// quando foi a ação do usuário que vale agora para a aba, ou null. Um clique ou tecla na página só
// vale se a aba está na frente; um pedido do app (fechar, recarregar) vale até com a aba ao fundo
export function latestUserIntent(
  ctx: MainContext,
  tabId: TabId,
  now = Date.now()
): number | null {
  const fresh = (at: number | undefined): number | null =>
    at !== undefined && now - at >= 0 && now - at <= GESTURE_WINDOW_MS
      ? at
      : null
  const requested = fresh(ctx.guard.navIntents.get(tabId))
  const clicked =
    ctx.attached.tabId === tabId ? fresh(ctx.guard.gestures.get(tabId)) : null
  if (requested === null) return clicked
  if (clicked === null) return requested
  return Math.max(requested, clicked)
}
