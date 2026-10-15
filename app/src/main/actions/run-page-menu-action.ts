// Executa a escolha do menu de clique direito da página.
import { clipboard, type ContextMenuParams, type WebContents } from 'electron'
import type { TabId } from '@shared/types'
import type { MainContext } from '../context'
import {
  isSavableImage,
  type PageMenuAction
} from '../functions/describe-page-menu'
import { createTab } from './create-tab'

export function runPageMenuAction(
  ctx: MainContext,
  tabId: TabId,
  wc: WebContents,
  params: Pick<
    ContextMenuParams,
    'x' | 'y' | 'linkURL' | 'srcURL' | 'selectionText'
  >,
  action: PageMenuAction
): void {
  const { store } = ctx
  // a aba pode ter sumido enquanto o menu estava aberto
  const tab = store.getTab(tabId)
  if (!tab || wc.isDestroyed()) return
  const open = (url: string) => createTab(ctx, { spaceId: tab.spaceId, url })

  switch (action) {
    case 'open-link':
      open(params.linkURL)
      break
    case 'copy-link':
      clipboard.writeText(params.linkURL)
      break
    case 'open-image':
      open(params.srcURL)
      break
    case 'copy-image':
      wc.copyImageAt(params.x, params.y)
      break
    case 'save-image':
      if (!isSavableImage(params.srcURL)) break
      // o download desta imagem mostra o diálogo de salvar (services/downloads.ts)
      ctx.saveAs.add(params.srcURL)
      wc.downloadURL(params.srcURL)
      break
    case 'search-web':
      open(
        store.state.settings.searchUrl.replace(
          '%s',
          encodeURIComponent(params.selectionText.trim())
        )
      )
      break
    case 'cut':
      wc.cut()
      break
    case 'copy':
      wc.copy()
      break
    case 'paste':
      wc.paste()
      break
    case 'select-all':
      wc.selectAll()
      break
    case 'back':
      if (wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack()
      break
    case 'forward':
      if (wc.navigationHistory.canGoForward()) wc.navigationHistory.goForward()
      break
    case 'reload':
      wc.reload()
      break
    case 'inspect':
      wc.inspectElement(params.x, params.y)
      break
  }
}
