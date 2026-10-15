// Sai da tela cheia de vídeo quando ela deixa de valer: a aba que a pediu deixou a janela (troca,
// fechamento, suspensão) ou a janela saiu da tela cheia pelo botão verde ou pelo menu.
import type { MainContext } from '../context'
import { getLiveContents } from './get-live-contents'

export function exitVideoFullscreen(ctx: MainContext): void {
  if (!ctx.store.state.fullscreen) return
  ctx.store.setFullscreen(false)

  // com BaseWindow o Electron não avisa a página quando a janela sai da tela cheia, e não há API
  // para pedir a saída: a página sai com Esc, que o Electron trata como o próprio navegador faria
  const wc = getLiveContents(ctx.attached.view)
  if (wc) {
    wc.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' })
    wc.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' })
  }
  if (!ctx.win.isDestroyed() && ctx.win.isFullScreen())
    ctx.win.setFullScreen(false)
}
