// Destrói o webContents da aba: sem view, sem renderer, sem memória.
import type { TabId } from '@shared/types'
import type { MainContext } from '../context'
import { hideTabView } from './show-tab-view'

export function destroyTabView(ctx: MainContext, tabId: TabId): void {
  // o estado de uma navegação em andamento morre junto com a view
  ctx.httpFallbacks.delete(tabId)
  ctx.pendingScroll.delete(tabId)
  const view = ctx.views.get(tabId)
  if (!view) return
  if (ctx.attached.view === view) hideTabView(ctx)
  ctx.views.delete(tabId)
  if (!view.webContents.isDestroyed()) view.webContents.close()
}
