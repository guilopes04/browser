// Cria a view da barra de busca: uma página pequena e transparente (find.html) por cima da página
// da aba. Fica numa view própria porque uma shell que cobrisse a página inteira levaria os cliques
// dela (docs/arquitetura.md, seção 1). Nasce ao abrir a busca e morre ao fechar.
import { WebContentsView } from 'electron'
import { join } from 'node:path'
import { closeFind } from '../actions/close-find'
import type { MainContext } from '../context'
import { getFindUrl } from '../services/app-protocol'
import { forwardEarlyKey } from './forward-early-key'
import { handleEarlyShortcut } from './handle-early-shortcut'
import { isShellUrl } from './is-shell-url'

export function createFindView(ctx: MainContext): WebContentsView {
  const view = new WebContentsView({
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  view.setBackgroundColor('#00000000')

  const wc = view.webContents
  const findUrl = getFindUrl()
  // como a shell: só mostra a própria página, porque quem ganhasse esta view herdaria window.api
  wc.setWindowOpenHandler(() => ({ action: 'deny' }))
  wc.on('will-attach-webview', event => event.preventDefault())
  wc.on('will-navigate', event => {
    if (!isShellUrl(event.url, findUrl)) event.preventDefault()
  })
  wc.on('will-redirect', event => {
    if (!isShellUrl(event.url, findUrl)) event.preventDefault()
  })

  // ⌘F, ⌘G e ⇧⌘G (e ⌘K, ⌘L, ⌘T) valem com o foco na barra; as teclas da abertura passam pelo main
  wc.on('before-input-event', (event, input) => {
    if (!handleEarlyShortcut(ctx, event, input))
      forwardEarlyKey(ctx, event, input)
  })
  // a barra sem renderer não tem como funcionar: fecha (o ⌘F abre outra)
  wc.on('render-process-gone', (_event, details) => {
    if (details.reason === 'clean-exit' || ctx.quitting) return
    if (ctx.find?.view === view) closeFind(ctx)
  })

  void wc.loadURL(findUrl).catch(() => {})
  return view
}
