// O pop-up (window.open, target=_blank) só abre com gesto recente do usuário na aba que o pediu, e
// um gesto libera no máximo 3. Pura: recebe o relógio, o gesto e o saldo, devolve o veredito e o
// saldo novo.
import type { PopupBudget } from '../web-guard'
import { GESTURE_WINDOW_MS } from './user-gesture'

export const MAX_POPUPS_PER_GESTURE = 3

export interface PopupVerdict {
  allow: boolean
  reason: 'ok' | 'no-gesture' | 'limit'
  // o saldo a guardar (o mesmo que veio, quando o pop-up é bloqueado)
  budget: PopupBudget | undefined
}

export function decidePopup(
  now: number,
  gestureAt: number | undefined,
  budget: PopupBudget | undefined
): PopupVerdict {
  if (
    gestureAt === undefined ||
    now < gestureAt ||
    now - gestureAt > GESTURE_WINDOW_MS
  )
    return { allow: false, reason: 'no-gesture', budget }
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
