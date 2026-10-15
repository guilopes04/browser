// O usuário digitou na caixa da barra: a busca recomeça com o texto novo (ao vivo).
import { typeFindText } from '@shared/find-state'
import type { MainContext } from '../context'
import { runFind } from '../functions/run-find'

// o texto digitado atravessa o IPC: nada de texto gigante
export const MAX_FIND_LENGTH = 500

export function setFindText(ctx: MainContext, text: string): void {
  const session = ctx.find
  if (!session) return
  session.state = typeFindText(session.state, text.slice(0, MAX_FIND_LENGTH))
  runFind(ctx, 'restart')
}
