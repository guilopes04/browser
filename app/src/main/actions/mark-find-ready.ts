// A caixa da barra já está na tela e com o foco (find:ready): o main deixa de repassar as teclas
// e manda o estado (com o que foi digitado até agora).
import type { MainContext } from '../context'
import { markKeyGateReady } from '../functions/key-gate'
import { pushFindState } from '../functions/push-find-state'

export function markFindReady(ctx: MainContext): void {
  const session = ctx.find
  if (!session) return
  session.ready = true
  markKeyGateReady(ctx, { kind: 'find' })
  pushFindState(ctx)
}
