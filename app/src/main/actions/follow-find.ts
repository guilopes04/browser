// Anda para o resultado seguinte (forward) ou anterior da busca aberta. Sem texto não há o que
// seguir.
import type { MainContext } from '../context'
import { runFind } from '../functions/run-find'

export function followFind(ctx: MainContext, forward: boolean): void {
  const session = ctx.find
  if (!session || session.state.text === '') return
  runFind(ctx, forward ? 'next' : 'previous')
}
