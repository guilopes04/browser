// Destrói o webContents da aba: sem view, sem renderer, sem memória.
import type { TabId } from '@shared/types'
import type { MainContext } from '../context'
import { resetViewState } from '../web-guard'
import { getLiveContents } from './get-live-contents'
import { hideTabView } from './show-tab-view'

export function destroyTabView(ctx: MainContext, tabId: TabId): void {
  // o estado de uma navegação em andamento morre junto com a view
  ctx.httpFallbacks.delete(tabId)
  ctx.pendingScroll.delete(tabId)
  resetViewState(ctx.guard, tabId)
  const view = ctx.views.get(tabId)
  if (!view) return
  if (ctx.attached.view === view) hideTabView(ctx)
  ctx.views.delete(tabId)
  // já destruído pela própria página: não há mais o que fechar
  getLiveContents(view)?.close()
}
