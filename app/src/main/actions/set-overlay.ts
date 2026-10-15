// A shell sobe por cima da página (revelação da sidebar oculta, dicas do compacto) e desce quando
// o último motivo sai. Todo motivo tem saída garantida: o renderer pede on:false ao sair do
// ponteiro ou com esc, e o store descarta o motivo que perde o sentido (troca de modo da sidebar).
import type { OverlayReason } from '@shared/types'
import type { MainContext } from '../context'
import { applyLayout } from '../functions/apply-layout'
import { getActiveContents } from '../functions/get-active-contents'

type RaiseReason = Exclude<OverlayReason, 'palette'>

function canRaise(ctx: MainContext, reason: RaiseReason): boolean {
  const { state } = ctx.store
  if (state.fullscreen) return false
  if (reason === 'peek') return state.effectiveSidebar === 'hidden'
  if (reason === 'tooltip') return state.effectiveSidebar === 'compact'
  return true
}

export function setOverlay(
  ctx: MainContext,
  reason: RaiseReason,
  on: boolean
): void {
  if (on && !canRaise(ctx, reason)) return
  if (!ctx.store.setOverlay(reason, on)) return
  // sobe/desce a shell e ajusta os semáforos (dentro da sidebar flutuante, no peek)
  applyLayout(ctx)

  if (reason !== 'peek') return
  // a sidebar flutuante recebe o teclado (esc fecha); ao fechar, o foco volta para a página
  if (on) ctx.shell.webContents.focus()
  else (getActiveContents(ctx) ?? ctx.shell.webContents).focus()
}
