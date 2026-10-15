// "Aa": diferenciar maiúsculas. A busca recomeça com a regra nova.
import { setFindMatchCase } from '@shared/find-state'
import type { MainContext } from '../context'
import { runFind } from '../functions/run-find'

export function setFindCase(ctx: MainContext, matchCase: boolean): void {
  const session = ctx.find
  if (!session) return
  const next = setFindMatchCase(session.state, matchCase)
  if (next === session.state) return
  session.state = next
  ctx.findMatchCase = matchCase
  runFind(ctx, 'restart')
}
