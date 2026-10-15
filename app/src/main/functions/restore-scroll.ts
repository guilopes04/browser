// Devolve a rolagem de uma aba que acordou da suspensão. O restore do histórico guarda a rolagem,
// mas o Chromium a zera quando a view entra na janela depois de a página carregar (páginas que
// carregam rápido perdem a posição). Por isso a posição é lida ao suspender e reaplicada quando a
// página carregou E a aba está na janela, algumas vezes (o zero chega logo depois de a view
// entrar), e só enquanto o usuário não mexeu na página.
import type { WebContents } from 'electron'
import type { PendingScroll, ScrollPosition } from '../context'
import type { TabId } from '@shared/types'
import type { MainContext } from '../context'

// instantes (ms desde que a página carregou e a aba está na janela) em que a rolagem é conferida
const CHECK_DELAYS_MS = [0, 80, 200, 450, 900, 1600, 2800]
const READ_TIMEOUT_MS = 400

const wait = (ms: number) => new Promise<void>(done => setTimeout(done, ms))

function isScroll(value: unknown): value is ScrollPosition {
  if (typeof value !== 'object' || value === null) return false
  const { x, y } = value as Record<string, unknown>
  return Number.isFinite(x) && Number.isFinite(y)
}

// rolagem da página agora; null se a página não responde a tempo
export async function readScroll(
  wc: WebContents
): Promise<ScrollPosition | null> {
  try {
    const value: unknown = await Promise.race([
      wc.executeJavaScript(
        '({ x: Math.round(window.scrollX), y: Math.round(window.scrollY) })'
      ),
      wait(READ_TIMEOUT_MS).then(() => null)
    ])
    return isScroll(value) ? value : null
  } catch {
    return null
  }
}

// uma conferência dentro da página: aplica se a página não está onde deve. `last` é onde a rolagem
// ficou na conferência anterior; se agora está em outro lugar que não o topo, foi o usuário (ou a
// página) e a restauração termina. Devolve onde a rolagem ficou, ou null para parar
function buildCheckScript(target: ScrollPosition, last: number | null): string {
  return `(() => {
    const target = ${JSON.stringify(target)}, last = ${JSON.stringify(last)}
    const now = window.scrollY
    if (last !== null && now !== last && now !== 0) return null
    if (Math.abs(now - target.y) > 1 || Math.abs(window.scrollX - target.x) > 1)
      window.scrollTo({ left: target.x, top: target.y, behavior: 'instant' })
    return window.scrollY
  })()`
}

async function runChecks(
  wc: WebContents,
  target: ScrollPosition
): Promise<void> {
  let last: number | null = null
  let elapsed = 0
  for (const delay of CHECK_DELAYS_MS) {
    await wait(delay - elapsed)
    elapsed = delay
    if (wc.isDestroyed()) return
    try {
      const where: unknown = await wc.executeJavaScript(
        buildCheckScript(target, last)
      )
      if (typeof where !== 'number') return
      last = where
    } catch {
      return
    }
  }
}

function maybeStart(
  ctx: MainContext,
  tabId: TabId,
  wc: WebContents,
  pending: PendingScroll
): void {
  if (pending.started || !pending.loaded || ctx.attached.tabId !== tabId) return
  pending.started = true
  void runChecks(wc, pending.scroll).finally(() => {
    if (ctx.pendingScroll.get(tabId) === pending)
      ctx.pendingScroll.delete(tabId)
  })
}

// chamada ao acordar a aba, logo depois de pedir o restore
export function planScrollRestore(
  ctx: MainContext,
  tabId: TabId,
  wc: WebContents,
  scroll: ScrollPosition
): void {
  if (scroll.x === 0 && scroll.y === 0) return
  const pending: PendingScroll = { scroll, loaded: false, started: false }
  ctx.pendingScroll.set(tabId, pending)
  const onLoaded = () => {
    pending.loaded = true
    maybeStart(ctx, tabId, wc, pending)
  }
  // dom-ready vem antes das imagens; did-finish-load cobre a página que não o dispara
  wc.once('dom-ready', onLoaded)
  wc.once('did-finish-load', onLoaded)
  // o restore falhou: a próxima página que carregar nesta aba não é a de antes
  wc.once('did-fail-load', (_event, _code, _description, _url, isMainFrame) => {
    if (isMainFrame && ctx.pendingScroll.get(tabId) === pending)
      ctx.pendingScroll.delete(tabId)
  })
}

// chamada quando a view da aba entra na janela
export function notifyTabShown(
  ctx: MainContext,
  tabId: TabId,
  wc: WebContents
): void {
  const pending = ctx.pendingScroll.get(tabId)
  if (pending) maybeStart(ctx, tabId, wc, pending)
}
