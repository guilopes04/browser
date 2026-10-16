// O pop-up (window.open, target=_blank) só abre com gesto recente do usuário na aba que o pediu, e
// um gesto libera no máximo 3. O gesto também precisa ser de quem pede: o clique dado na página não
// vale para um iframe de outra origem (frame-activation.ts). Pura: recebe o relógio, o gesto, o
// saldo e se o quadro que pede foi ativado, devolve o veredito e o saldo novo.
import type { PopupBudget } from '../web-guard'
import { GESTURE_WINDOW_MS } from './user-gesture'

export const MAX_POPUPS_PER_GESTURE = 3

export interface PopupVerdict {
  allow: boolean
  reason: 'ok' | 'no-gesture' | 'other-frame' | 'limit'
  // o saldo a guardar (o mesmo que veio, quando o pop-up é bloqueado)
  budget: PopupBudget | undefined
}

export function decidePopup(
  now: number,
  gestureAt: number | undefined,
  budget: PopupBudget | undefined,
  // quem pede é o quadro que recebeu o gesto (ou um que ele ativa); false: um iframe de outra origem
  frameActivated = true
): PopupVerdict {
  if (
    gestureAt === undefined ||
    now < gestureAt ||
    now - gestureAt > GESTURE_WINDOW_MS
  )
    return { allow: false, reason: 'no-gesture', budget }
  if (!frameActivated) return { allow: false, reason: 'other-frame', budget }
  // outro gesto, outro saldo
  const current: PopupBudget =
    budget && budget.gestureAt === gestureAt ? budget : { gestureAt, used: 0 }
  if (current.used >= MAX_POPUPS_PER_GESTURE)
    return { allow: false, reason: 'limit', budget: current }
  return {
    allow: true,
    reason: 'ok',
    budget: { gestureAt, used: current.used + 1 }
  }
}
