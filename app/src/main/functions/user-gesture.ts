// Gesto real do usuário na página de uma aba: tecla digitada ou clique, vistos pelo main em
// 'before-input-event' e 'input-event'. A página não consegue forjá-los (um click() de script
// não passa por aqui). Download, pop-up, beforeunload e "abrir em outro app" só valem com um
// gesto recente. Puro: recebe o estado e o relógio.
import type { TabId } from '@shared/types'
import type { WebGuard } from '../web-guard'

// quanto tempo um gesto continua valendo (a janela de ativação do Chromium é parecida)
export const GESTURE_WINDOW_MS = 5000

// modificadores, Esc e teclas sem caractere não ativam nada
const IGNORED_KEYS = new Set([
  'Shift',
  'Control',
  'Alt',
  'Meta',
  'CapsLock',
  'Fn',
  'FnLock',
  'Escape',
  'Dead',
  'Process',
  'Unidentified'
])

export interface GestureKey {
  type: string
  key: string
  meta: boolean
  isAutoRepeat: boolean
}

// ⌘ + tecla é comando do app ou do sistema, não digitação; segurar a tecla repete e não conta
export function isActivationKey(input: GestureKey): boolean {
  return (
    input.type === 'keyDown' &&
    !input.isAutoRepeat &&
    !input.meta &&
    !IGNORED_KEYS.has(input.key)
  )
}

const POINTER_GESTURES = new Set(['mouseDown', 'mouseUp', 'touchEnd'])

// tipos de 'input-event' que contam: pressionar e soltar o botão, tocar
export function isActivationPointer(type: string): boolean {
  return POINTER_GESTURES.has(type)
}

export function markGesture(
  guard: WebGuard,
  tabId: TabId,
  now = Date.now()
): void {
  guard.gestures.set(tabId, now)
}

export function getLastGesture(
  guard: WebGuard,
  tabId: TabId
): number | undefined {
  return guard.gestures.get(tabId)
}

export function hasRecentGesture(
  guard: WebGuard,
  tabId: TabId,
  now = Date.now(),
  windowMs = GESTURE_WINDOW_MS
): boolean {
  const at = guard.gestures.get(tabId)
  return at !== undefined && now - at >= 0 && now - at <= windowMs
}
