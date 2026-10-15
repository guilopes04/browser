// window.open e target=_blank viram aba no mesmo espaço, mas só com gesto recente do usuário na
// aba de origem (bloqueador de pop-ups): sem gesto, o pedido é negado e o aviso "Pop-up bloqueado"
// aparece na barra de endereço, com a opção de abrir. Um gesto libera até 3. A aba nova adota o
// webContents que o Chromium já criou (createWindow), o que preserva o `opener` dos popups de
// OAuth, e sobrevive ao fechamento da aba que a abriu (outlivesOpener). Quando quem abre não é a
// aba ativa, a nova nasce em segundo plano.
import type { WebContents } from 'electron'
import type { SpaceId, TabId } from '@shared/types'
import { openPopupAsTab } from '../actions/open-popup-as-tab'
import type { MainContext } from '../context'
import { recordBlockedPopup } from './blocked-popups'
import { decidePopup } from './decide-popup'
import { getLastGesture } from './user-gesture'

const ALLOWED_URL = /^(https?:|about:blank$|blob:)/i

export function installWindowOpenHandler(
  ctx: MainContext,
  spaceId: SpaceId,
  tabId: TabId,
  wc: WebContents
): void {
  wc.setWindowOpenHandler(details => {
    if (!ctx.store.getTab(tabId) || !ALLOWED_URL.test(details.url))
      return { action: 'deny' }

    const verdict = decidePopup(
      Date.now(),
      getLastGesture(ctx.guard, tabId),
      ctx.guard.popupBudget.get(tabId)
    )
    if (verdict.budget) ctx.guard.popupBudget.set(tabId, verdict.budget)
    if (!verdict.allow) {
      recordBlockedPopup(ctx, tabId, details.url)
      return { action: 'deny' }
    }

    return {
      action: 'allow',
      // fechar a aba que abriu não leva junto os pop-ups (o Electron fecharia todos)
      outlivesOpener: true,
      createWindow: options => {
        const adopted = (options as { webContents?: WebContents }).webContents
        return openPopupAsTab(ctx, {
          spaceId,
          url: details.url,
          adopted,
          openerTabId: tabId,
          // aba em segundo plano não rouba a tela
          background:
            details.disposition === 'background-tab' ||
            ctx.attached.tabId !== tabId
        })
      }
    }
  })
}
