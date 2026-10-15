// O webContents da aba foi destruído sem o app pedir: a própria página se fechou (window.close,
// popup de login que termina, site que fecha o popup que abriu). A aba sai da sidebar e a
// vizinha assume, como num ⌘W.
import type { WebContentsView } from 'electron'
import type { TabId } from '@shared/types'
import type { MainContext } from '../context'
import { removeTab } from './remove-tab'

// `view` é a view que nasceu com o webContents. Se o registro já aponta para outra (a aba foi
// suspensa e acordou) ou não aponta para nenhuma (o app a fechou), a destruição foi do app
export function closeDeadTab(
  ctx: MainContext,
  tabId: TabId,
  view: WebContentsView
): void {
  if (ctx.views.get(tabId) !== view) return
  // se o usuário pediu o fechamento (⌘W, ×), a aba entra no ⇧⌘T; senão foi a página
  removeTab(ctx, tabId, ctx.closing.has(tabId))
}
