// O main troca o texto da busca (teclas da abertura, seleção da página, captura): a caixa da barra
// adota o texto novo e a busca recomeça.
import { replaceFindText } from '@shared/find-state'
import type { MainContext } from '../context'
import { runFind } from '../functions/run-find'
import { MAX_FIND_LENGTH } from './set-find-text'

export function replaceFindTextAndSearch(ctx: MainContext, text: string): void {
  const session = ctx.find
  if (!session) return
  session.state = replaceFindText(session.state, text.slice(0, MAX_FIND_LENGTH))
  runFind(ctx, 'restart')
}
