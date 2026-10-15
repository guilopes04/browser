// O mouse na margem transparente da barra de busca é da página: o main o entrega a ela no mesmo
// ponto (a margem existe só para a sombra). Clicar ali dá o foco à página, como clicar nela.
import type { FindPointer } from '@shared/find-pointer'
import type { MainContext } from '../context'
import { getLayout } from '../functions/apply-layout'
import { getLiveContents } from '../functions/get-live-contents'
import { toPageMouseEvent } from '../functions/to-page-mouse-event'

export function passFindPointer(ctx: MainContext, pointer: FindPointer): void {
  const session = ctx.find
  if (!session || ctx.attached.tabId !== session.tabId) return
  const wc = getLiveContents(ctx.views.get(session.tabId))
  if (!wc || !getLiveContents(session.view)) return
  const event = toPageMouseEvent(
    pointer,
    session.view.getBounds(),
    getLayout(ctx).page
  )
  if (!event) return
  if (event.type === 'mouseDown') wc.focus()
  wc.sendInputEvent(event)
}
