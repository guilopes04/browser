// Suspende abas vivas paradas há tempo demais. Nunca a ativa e, com neverSuspendAudible (o
// padrão), nunca uma com áudio.
import type { MainContext } from '../context'
import { closeDeadTab } from '../actions/close-dead-tab'
import { suspendTab } from '../actions/suspend-tab'
import { getLiveContents } from '../functions/get-live-contents'
import { logError } from '../functions/log-error'

const MAX_TICK_MS = 60_000
const MIN_TICK_MS = 250

// --suspender-apos vale só nesta execução e tem prioridade; sem a flag, vale a configuração salva
export function getSuspendLimitMs(ctx: MainContext): number {
  return (
    ctx.flags.suspendAfterMs ?? ctx.store.state.settings.suspendAfterSec * 1000
  )
}

export function getTickInterval(suspendAfterMs: number): number {
  return Math.max(MIN_TICK_MS, Math.min(MAX_TICK_MS, suspendAfterMs / 2))
}

// suspender lê a rolagem da página antes (assíncrono): o tick só dispara; devolve quantas disparou
export function runSuspensionTick(ctx: MainContext, now = Date.now()): number {
  const { store } = ctx
  const limitMs = getSuspendLimitMs(ctx)
  const keepAudible = store.state.settings.neverSuspendAudible
  let suspended = 0

  // uma cópia: tirar uma aba morta da lista no meio do laço não pode pular a vizinha
  for (const tab of [...store.state.tabs]) {
    const view = ctx.views.get(tab.id)
    if (!view) continue
    const wc = getLiveContents(view)
    if (!wc) {
      // view de uma página que já morreu e cujo evento se perdeu: sai da sidebar, sem exceção
      closeDeadTab(ctx, tab.id, view)
      continue
    }
    // aba com áudio conta como em uso, mesmo silenciada
    if (keepAudible && tab.audible) {
      store.touchTab(tab.id, now)
      continue
    }
    if (limitMs <= 0) continue
    if (ctx.attached.tabId === tab.id) continue
    if (keepAudible && wc.isCurrentlyAudible()) continue
    if (now - tab.lastActiveAt >= limitMs && !ctx.suspending.has(tab.id)) {
      void suspendTab(ctx, tab.id)
      suspended++
    }
  }
  return suspended
}

// 0 = nunca suspende, mas o timer segue para manter lastActiveAt das abas com áudio
export function startSuspensionTimer(ctx: MainContext): () => void {
  const limitMs = getSuspendLimitMs(ctx)
  const interval = limitMs > 0 ? getTickInterval(limitMs) : MAX_TICK_MS
  const timer = setInterval(() => {
    // um erro num tick não pode derrubar o app nem repetir um diálogo a cada intervalo
    try {
      runSuspensionTick(ctx)
    } catch (error) {
      logError('[Suspension][tick]', 'falha no tick', error)
    }
  }, interval)
  return () => clearInterval(timer)
}
