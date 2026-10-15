// Liga o fim do webContents à sidebar. Sem isto, uma página que fecha a si mesma deixava a aba
// na sidebar como viva, apontando para uma view sem webContents.
import type { WebContentsView } from 'electron'
import type { TabId } from '@shared/types'
import { closeDeadTab } from '../actions/close-dead-tab'
import type { MainContext } from '../context'

export function attachCloseEvents(
  ctx: MainContext,
  tabId: TabId,
  view: WebContentsView
): void {
  // 'destroyed' vem de qualquer fim: window.close da página, fechamento pedido pelo app ou
  // suspensão. closeDeadTab separa os casos pelo registro de views
  view.webContents.once('destroyed', () => {
    try {
      closeDeadTab(ctx, tabId, view)
    } catch (error) {
      console.error('[Tab][destroyed] falha ao remover a aba', tabId, error)
    }
  })
}
