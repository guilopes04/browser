// Põe a view da barra de busca no canto do painel da página (junto com o resto do layout).
import type { Rect } from '@shared/types'
import type { MainContext } from '../context'
import { computeFindBounds } from './compute-find-bounds'
import { getLiveContents } from './get-live-contents'

export function layoutFind(ctx: MainContext, page: Rect): void {
  const session = ctx.find
  if (!session || !getLiveContents(session.view)) return
  session.view.setBounds(computeFindBounds(page))
}
