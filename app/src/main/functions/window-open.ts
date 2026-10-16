// window.open e target=_blank viram aba no mesmo espaço, mas só com gesto recente do usuário na
// aba de origem (bloqueador de pop-ups): sem gesto, o pedido é negado e o aviso "Pop-up bloqueado"
// aparece na barra de endereço, com a opção de abrir. Um gesto libera até 3. A aba nova adota o
// webContents que o Chromium já criou (createWindow), o que preserva o `opener` dos popups de
// OAuth, e sobrevive ao fechamento da aba que a abriu (outlivesOpener). Quando quem abre não é a
// aba ativa, a nova nasce em segundo plano.
//
// O gesto tem de ser de quem pede: um iframe de outra origem (um anúncio) não herda o clique dado na
// página principal. Quem pede vem do referrer do pedido (o Chromium o calcula a partir do quadro de
// origem; a página não o forja). Sem referrer (rel=noreferrer, Referrer-Policy: no-referrer) o
// pedido só vale se nenhum quadro da aba ficou sem o gesto, ou se o usuário acabou de clicar num
// link para exatamente aquela URL (o preload reporta o clique).
//
// A aba criada aqui tem as mesmas webPreferences de qualquer aba (tab-web-preferences.ts): o preload
// da guarda em todos os quadros e os diálogos nativos desligados. O pop-up passa pelo mesmo
// tratamento de diálogos (origem no texto, limite de 3 em 10 s, só na aba ativa).
import type { WebContents } from 'electron'
import type { SpaceId, TabId } from '@shared/types'
import { openPopupAsTab } from '../actions/open-popup-as-tab'
import type { MainContext } from '../context'
import { recordBlockedPopup } from './blocked-popups'
import { decidePopup } from './decide-popup'
import { originOfUrl } from './frame-activation'
import { hasLinkClick } from './frame-gesture'
import { judgeRequester } from './judge-requester'
import { getPagePreferences } from './tab-web-preferences'
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

    const now = Date.now()
    const fromUserClick = hasLinkClick(ctx.guard, tabId, details.url, now)
    const activation = fromUserClick
      ? 'activated'
      : judgeRequester(ctx, tabId, wc, originOfUrl(details.referrer?.url), now)
    const verdict = decidePopup(
      now,
      getLastGesture(ctx.guard, tabId),
      ctx.guard.popupBudget.get(tabId),
      activation !== 'foreign'
    )
    if (verdict.budget) ctx.guard.popupBudget.set(tabId, verdict.budget)
    if (!verdict.allow) {
      recordBlockedPopup(ctx, tabId, details.url, verdict.reason)
      return { action: 'deny' }
    }

    return {
      action: 'allow',
      // fechar a aba que abriu não leva junto os pop-ups (o Electron fecharia todos)
      outlivesOpener: true,
      // as mesmas webPreferences das outras abas: o Electron só herda do opener as preferências
      // seguras e deixava de fora o preload nos iframes e o desligamento do alert nativo
      overrideBrowserWindowOptions: { webPreferences: getPagePreferences() },
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
