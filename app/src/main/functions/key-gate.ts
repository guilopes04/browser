// Janela em que a paleta (a Nova aba ou a barra de busca) está abrindo: do pedido até o campo
// avisar que está na tela (keys:ready, find:ready) mais uma folga, para as teclas já repassadas
// chegarem antes das nativas. Tem teto: se o aviso nunca vier, o teclado volta ao normal sozinho.
import { isSameTarget, type KeyGateTarget } from '@shared/early-key'
import type { MainContext } from '../context'

const MAX_MS = 600
// a barra de busca é um renderer novo a cada ⌘F e, com o Mac ocupado, pode passar dos 600 ms. As
// teclas dela ficam no estado da busca (no main), então esperar mais não as prende em lugar
// nenhum: sem o portão, as digitadas entre o teto e a caixa existir se perderiam
const FIND_MAX_MS = 2000
const GRACE_MS = 100

export function openKeyGate(ctx: MainContext, target: KeyGateTarget): void {
  ctx.keyGate = { target, openedAt: Date.now(), readyAt: null }
}

// sem kind, fecha qualquer janela; com kind, só a desse alvo
export function closeKeyGate(
  ctx: MainContext,
  kind?: KeyGateTarget['kind']
): void {
  if (!kind || ctx.keyGate?.target.kind === kind) ctx.keyGate = null
}

// o aviso de outro alvo (uma Nova aba que já estava na tela, por exemplo) não fecha esta janela
export function markKeyGateReady(
  ctx: MainContext,
  target: KeyGateTarget
): void {
  const gate = ctx.keyGate
  if (gate && isSameTarget(gate.target, target)) gate.readyAt = Date.now()
}

export function getOpenKeyGate(
  ctx: MainContext,
  now = Date.now()
): KeyGateTarget | null {
  const gate = ctx.keyGate
  if (!gate) return null
  const max = gate.target.kind === 'find' ? FIND_MAX_MS : MAX_MS
  if (now - gate.openedAt > max) return null
  if (gate.readyAt !== null && now - gate.readyAt > GRACE_MS) return null
  return gate.target
}
