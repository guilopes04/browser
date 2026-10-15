// beforeunload: sem ouvinte, o Electron cancela em silêncio o fechamento (⌘W), a navegação
// (⌘L ↵) e o recarregamento (⌘R) de uma página com rascunho. Aqui o usuário decide.
import type { WebContents } from 'electron'
import type { TabId } from '@shared/types'
import { activateTab } from '../actions/activate-tab'
import type { MainContext } from '../context'
import { confirmLeavePage } from './confirm-leave-page'

export function attachUnloadGuard(
  ctx: MainContext,
  tabId: TabId,
  wc: WebContents
): void {
  wc.on('will-prevent-unload', event => {
    // a pergunta é de uma aba que o usuário pode não estar vendo (fechar pelo menu da sidebar)
    if (ctx.attached.tabId !== tabId && ctx.store.getTab(tabId))
      activateTab(ctx, tabId)

    if (confirmLeavePage(ctx)) {
      // Sair: ignora o beforeunload da página e segue o que estava em andamento
      event.preventDefault()
      return
    }

    // Ficar: o fechamento ou a navegação foi cancelado e a aba segue como estava
    ctx.closing.delete(tabId)
    ctx.httpFallbacks.delete(tabId)
    if (!wc.isDestroyed()) ctx.store.patchTab(tabId, { url: wc.getURL() })
  })
}
