// "Site em tela cheia. Esc para sair": a página que ocupa a janela inteira poderia imitar a barra
// de endereço, a sidebar ou uma tela do sistema. Por 3 s a shell aparece por cima, só na faixa do
// aviso (o resto da página segue recebendo cliques), e desce sozinha.
import { FULLSCREEN_NOTICE_MS } from '@shared/tokens'
import type { MainContext } from '../context'
import { applyLayout } from './apply-layout'

const timers = new WeakMap<MainContext, NodeJS.Timeout>()

export function hideFullscreenNotice(ctx: MainContext): void {
  const timer = timers.get(ctx)
  if (timer) clearTimeout(timer)
  timers.delete(ctx)
  if (ctx.store.setOverlay('notice', false)) applyLayout(ctx)
}

export function showFullscreenNotice(ctx: MainContext): void {
  if (!ctx.store.state.fullscreen) return
  const previous = timers.get(ctx)
  if (previous) clearTimeout(previous)
  ctx.store.setOverlay('notice', true)
  applyLayout(ctx)
  const timer = setTimeout(
    () => hideFullscreenNotice(ctx),
    FULLSCREEN_NOTICE_MS
  )
  timer.unref()
  timers.set(ctx, timer)
}
