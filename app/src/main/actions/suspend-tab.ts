// Suspende uma aba: guarda o histórico e a rolagem, destrói o webContents e marca como dormente.
import type { TabId } from '@shared/types'
import type { MainContext } from '../context'
import { destroyTabView } from '../functions/destroy-tab-view'
import { getLiveContents } from '../functions/get-live-contents'
import { readScroll } from '../functions/restore-scroll'
import { readNavigation } from '../functions/stash-navigation'

export async function suspendTab(
  ctx: MainContext,
  tabId: TabId
): Promise<boolean> {
  const view = ctx.views.get(tabId)
  const wc = getLiveContents(view)
  if (!view || !wc) return false
  // a aba exibida nunca é suspensa
  if (ctx.attached.tabId === tabId) return false
  if (ctx.suspending.has(tabId)) return false

  ctx.suspending.add(tabId)
  try {
    // acordou há pouco e a rolagem ainda não voltou: vale a de antes, não a de agora (topo)
    const scroll =
      ctx.pendingScroll.get(tabId)?.scroll ?? (await readScroll(wc))
    // enquanto a página respondia, a aba pode ter sido exibida, fechada ou ter morrido
    if (
      ctx.views.get(tabId) !== view ||
      wc.isDestroyed() ||
      ctx.attached.tabId === tabId
    )
      return false

    ctx.stash.set(tabId, { ...readNavigation(wc), scroll })
    destroyTabView(ctx, tabId)
    ctx.store.patchTab(tabId, {
      dormant: true,
      loading: false,
      audible: false,
      canGoBack: false,
      canGoForward: false,
      error: null
    })
    return true
  } finally {
    ctx.suspending.delete(tabId)
  }
}
