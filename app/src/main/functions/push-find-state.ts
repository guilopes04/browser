// Manda o estado da busca à barra (find:state). Só depois de a caixa estar pronta e só quando algo
// que ela mostra mudou.
import { toFindViewState } from '@shared/find-state'
import { SPACE_TOKENS } from '@shared/tokens'
import type { MainContext } from '../context'
import { getLiveContents } from './get-live-contents'

export function pushFindState(ctx: MainContext): void {
  const session = ctx.find
  if (!session || !session.ready) return
  const wc = getLiveContents(session.view)
  if (!wc) return

  const { theme } = ctx.store.state
  const accent = SPACE_TOKENS[ctx.store.getCurrentSpace().color][theme].accent
  const payload = toFindViewState(session.state, theme, accent)
  const serialized = JSON.stringify(payload)
  if (serialized === session.lastSent) return
  session.lastSent = serialized
  wc.send('find:state', payload)
}
