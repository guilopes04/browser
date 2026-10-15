// O webContents da aba foi destruído sem o app pedir: a própria página se fechou (window.close,
// popup de login que termina, site que fecha o popup que abriu). Só vale para aba aberta por
// script e que não tem abas abertas por ela (judge-script-close.ts); nesse caso a aba sai da
// sidebar como num ⌘W e a vizinha assume. As outras ficam, dormentes, e o app avisa no log.
// Com o app encerrando, o fim dos webContents é só o desmonte: nada se remove nem se recria.
import type { WebContentsView } from 'electron'
import type { TabId } from '@shared/types'
import type { MainContext } from '../context'
import { judgeScriptClose } from '../functions/judge-script-close'
import { keepTabAfterScriptClose } from '../functions/keep-tab-after-script-close'
import { removeTab } from './remove-tab'

// `view` é a view que nasceu com o webContents. Se o registro já aponta para outra (a aba foi
// suspensa e acordou) ou não aponta para nenhuma (o app a fechou), a destruição foi do app
export function closeDeadTab(
  ctx: MainContext,
  tabId: TabId,
  view: WebContentsView
): void {
  // ⌘Q e SIGTERM destroem todas as views: reativar a aba (keepTabAfterScriptClose) criaria uma
  // view nova no meio do desmonte, e o Chromium cai (SIGTRAP) ao encerrar
  if (ctx.quitting) return
  if (ctx.views.get(tabId) !== view) return
  // o usuário pediu o fechamento (⌘W, ×)
  if (ctx.closing.has(tabId)) {
    removeTab(ctx, tabId, true)
    return
  }
  const verdict = judgeScriptClose(ctx, tabId)
  if (verdict !== 'allow') {
    console.warn(
      `[Tab][window.close] pedido ignorado na aba ${tabId} (${verdict})`
    )
    keepTabAfterScriptClose(ctx, tabId)
    return
  }
  // fechada por script: também entra no ⇧⌘T, para o usuário recuperar o que um site fechou
  removeTab(ctx, tabId, true)
}
