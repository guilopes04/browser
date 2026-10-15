// Fecha a paleta: a shell desce para baixo da página e o foco volta para ela. Sem efeito se já
// estava fechada, então quem fecha depois de executar um comando não precisa conferir.
import type { MainContext } from '../context'
import { applyLayout } from '../functions/apply-layout'
import { getActiveContents } from '../functions/get-active-contents'
import { closeKeyGate } from '../functions/key-gate'

export function closePalette(ctx: MainContext, restoreFocus = true): void {
  // fechada: o que se digitar daqui em diante não é mais da paleta
  closeKeyGate(ctx, 'palette')
  if (!ctx.store.setOverlay('palette', false)) return
  applyLayout(ctx)
  ctx.broadcaster.send('palette:hide', {})
  // em Nova aba (ou com erro) a página é da shell e o foco fica nela
  if (restoreFocus) (getActiveContents(ctx) ?? ctx.shell.webContents).focus()
}
