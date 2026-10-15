// A shell só mostra a própria página: nada navega, abre janela ou anexa webview nela, porque
// qualquer página que ganhasse a shell herdaria window.api. Se o renderer cair, a interface
// é recarregada (as abas já têm o mesmo tratamento em attach-tab-events).
import type { MainContext } from '../context'
import { isShellUrl } from './is-shell-url'

const MAX_RELOADS = 5
const RELOAD_WINDOW_MS = 60_000

export function guardShell(ctx: MainContext, shellUrl: string): void {
  const wc = ctx.shell.webContents

  wc.setWindowOpenHandler(() => ({ action: 'deny' }))
  wc.on('will-attach-webview', event => event.preventDefault())
  wc.on('will-navigate', event => {
    if (!isShellUrl(event.url, shellUrl)) event.preventDefault()
  })
  wc.on('will-redirect', event => {
    if (!isShellUrl(event.url, shellUrl)) event.preventDefault()
  })

  const reloads: number[] = []
  wc.on('render-process-gone', (_event, details) => {
    if (details.reason === 'clean-exit' || ctx.quitting || wc.isDestroyed())
      return
    console.error(`[Shell][render-process-gone] ${details.reason}`)

    const now = Date.now()
    while (reloads.length > 0 && now - reloads[0] > RELOAD_WINDOW_MS)
      reloads.shift()
    if (reloads.length >= MAX_RELOADS) {
      console.error('[Shell][render-process-gone] caiu demais; sem recarregar')
      return
    }
    reloads.push(now)
    // a shell nova pede o estado de novo (state:get) e redesenha tudo
    void wc.loadURL(shellUrl).catch(() => {})
  })
}
