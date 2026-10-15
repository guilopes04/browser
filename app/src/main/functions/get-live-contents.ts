// webContents vivo de uma view, ou null. Depois de destruído (a página fechou a si mesma com
// window.close, por exemplo) a WebContentsView perde a propriedade `webContents` (fica undefined),
// então qualquer acesso direto a view.webContents.* lança TypeError. Todo código que pega uma
// view de ctx.views ou ctx.attached passa por aqui.
import type { WebContents, WebContentsView } from 'electron'

export function getLiveContents(
  view: WebContentsView | null | undefined
): WebContents | null {
  const wc = view?.webContents as WebContents | undefined
  return wc && !wc.isDestroyed() ? wc : null
}
