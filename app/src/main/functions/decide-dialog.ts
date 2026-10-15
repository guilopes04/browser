// O que fazer com um alert/confirm/prompt de uma página. Pura.
//
// - só a aba ativa mostra diálogo: o das abas em segundo plano é descartado, com o retorno padrão
//   (alert não devolve nada, confirm devolve false, prompt devolve null) e um marcador na aba;
// - o diálogo precisa de uma janela à vista;
// - depois de 3 diálogos em 10 s, o próximo traz a caixa "Bloquear mais diálogos deste site"; se
//   o usuário marca, a aba não mostra mais nenhum até recarregar.
import type { DialogGuard } from '../web-guard'

export const DIALOG_WINDOW_MS = 10_000
export const DIALOGS_BEFORE_OFFER = 3

export type DialogDecision =
  | { action: 'drop'; reason: 'background' | 'hidden' | 'blocked' }
  | { action: 'show'; offerBlock: boolean }

export interface DialogFacts {
  isActive: boolean
  windowVisible: boolean
  now: number
}

export function decideDialog(
  state: DialogGuard | undefined,
  facts: DialogFacts
): DialogDecision {
  if (state?.blocked) return { action: 'drop', reason: 'blocked' }
  if (!facts.isActive) return { action: 'drop', reason: 'background' }
  if (!facts.windowVisible) return { action: 'drop', reason: 'hidden' }
  const recent = (state?.shownAt ?? []).filter(
    at => facts.now - at >= 0 && facts.now - at <= DIALOG_WINDOW_MS
  ).length
  return { action: 'show', offerBlock: recent >= DIALOGS_BEFORE_OFFER }
}

// anota que um diálogo vai aparecer agora; esquece os que já saíram da janela
export function recordDialogShown(
  state: DialogGuard | undefined,
  now: number
): DialogGuard {
  const shownAt = (state?.shownAt ?? []).filter(
    at => now - at >= 0 && now - at <= DIALOG_WINDOW_MS
  )
  shownAt.push(now)
  return { shownAt, blocked: state?.blocked ?? false }
}
