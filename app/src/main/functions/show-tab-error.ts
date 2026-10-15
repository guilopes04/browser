// Põe a aba na página de erro (da shell) ou a tira dela: a view da página some enquanto a aba tem
// erro. O título vira o host que falhou e o favicon volta ao padrão (letra e cor); quando a página
// volta, o título que o erro tinha trocado volta a ser o dela (o evento de título nem sempre chega
// de novo, como num recarregamento da mesma página).
import type { Tab, TabId } from '@shared/types'
import { getHostname } from '@shared/url-parts'
import { closeFind } from '../actions/close-find'
import type { MainContext } from '../context'
import { applyLayout } from './apply-layout'
import { getLiveContents } from './get-live-contents'
import { pageTitle } from './page-title'

export function showTabError(
  ctx: MainContext,
  tabId: TabId,
  error: Tab['error'],
  failedUrl = ''
): void {
  const wc = getLiveContents(ctx.views.get(tabId))
  ctx.store.patchTab(tabId, {
    error,
    ...(error
      ? { title: getHostname(failedUrl) || failedUrl, favicon: null }
      : wc
        ? { title: pageTitle(wc.getTitle(), wc.getURL()) }
        : {})
  })
  if (ctx.attached.tabId !== tabId) return
  // a página de erro é da shell: a barra de busca não tem mais o que buscar
  if (error && ctx.find?.tabId === tabId) closeFind(ctx, false)
  applyLayout(ctx)
  if (error) ctx.shell.webContents.focus()
  else getLiveContents(ctx.views.get(tabId))?.focus()
}
