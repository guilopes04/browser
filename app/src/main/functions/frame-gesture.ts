// O que o preload das abas reporta do gesto do usuário, por quadro (o main vê o gesto pela aba, mas
// só o preload sabe em qual quadro caiu; e o main nem vê o clique dado dentro de um iframe de outra
// origem, que o Chromium entrega direto ao renderer dele). Dois relatos: o gesto em si, e o clique
// do usuário num link (o endereço dele), que é o que prova de quem é um pop-up de link sem referrer.
import type { TabId } from '@shared/types'
import type { WebGuard } from '../web-guard'
import type { FrameGesture } from './frame-activation'
import { GESTURE_WINDOW_MS, markGesture } from './user-gesture'

// quantos quadros guardam gesto por aba (o resto é descartado, o mais antigo primeiro)
export const MAX_FRAME_GESTURES = 16
// o clique no link e o pedido de pop-up que ele causa saem na mesma tarefa: um segundo basta
export const LINK_CLICK_WINDOW_MS = 1500
const MAX_URL = 2048

export function markFrameGesture(
  guard: WebGuard,
  tabId: TabId,
  frame: { key: string; origin: string },
  now = Date.now()
): void {
  const kept = (guard.frameGestures.get(tabId) ?? []).filter(
    gesture =>
      gesture.key !== frame.key && now - gesture.at <= GESTURE_WINDOW_MS
  )
  const next: FrameGesture[] = [
    ...kept,
    { at: now, key: frame.key, origin: frame.origin }
  ]
  guard.frameGestures.set(tabId, next.slice(-MAX_FRAME_GESTURES))
  // também é o gesto da aba: o clique dentro de um iframe (o botão de entrar com o Google, o
  // player embutido) só chega ao main por aqui
  markGesture(guard, tabId, now)
}

// o endereço chega do renderer da página: só texto, e curto
export function readLinkUrl(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null
  const { url } = payload as Record<string, unknown>
  return typeof url === 'string' && url !== '' ? url.slice(0, MAX_URL) : null
}

export function markLinkClick(
  guard: WebGuard,
  tabId: TabId,
  url: string,
  now = Date.now()
): void {
  guard.linkClicks.set(tabId, { url, at: now })
}

// o usuário clicou, agora há pouco, num link para esta URL (o pedido de abrir é desse clique)
export function hasLinkClick(
  guard: WebGuard,
  tabId: TabId,
  url: string,
  now = Date.now()
): boolean {
  const click = guard.linkClicks.get(tabId)
  return (
    click !== undefined &&
    click.url === url &&
    now >= click.at &&
    now - click.at <= LINK_CLICK_WINDOW_MS
  )
}
