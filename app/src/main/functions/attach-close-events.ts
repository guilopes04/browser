// Liga o fim do webContents à sidebar. Sem isto, uma página que fecha a si mesma deixava a aba
// na sidebar como viva, apontando para uma view sem webContents.
import type { WebContentsView } from 'electron'
import type { TabId } from '@shared/types'
import { closeDeadTab } from '../actions/close-dead-tab'
import type { MainContext } from '../context'
import { readNavigation } from './stash-navigation'

export function attachCloseEvents(
  ctx: MainContext,
  tabId: TabId,
  view: WebContentsView
): void {
  const wc = view.webContents
  // 'close' (do Electron, fora da documentação) vem de window.close() e do fechamento pedido pelo
  // app, um instante antes de o webContents ser destruído. Se foi a página (o app não pediu), o
  // histórico de voltar/avançar fica guardado: se a aba tiver de sobreviver (judge-script-close),
  // volta como numa suspensão
  ;(wc as unknown as NodeJS.EventEmitter).on('close', () => {
    if (ctx.views.get(tabId) !== view || ctx.closing.has(tabId)) return
    try {
      if (!wc.isDestroyed()) ctx.stash.set(tabId, readNavigation(wc))
    } catch (error) {
      console.error('[Tab][close] não deu para guardar o histórico', error)
    }
  })

  // 'destroyed' vem de qualquer fim: window.close da página, fechamento pedido pelo app ou
  // suspensão. closeDeadTab separa os casos pelo registro de views
  wc.once('destroyed', () => {
    try {
      closeDeadTab(ctx, tabId, view)
    } catch (error) {
      console.error('[Tab][destroyed] falha ao remover a aba', tabId, error)
    }
  })
}
