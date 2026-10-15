// Botão vermelho no macOS: a janela some mas o app fica no Dock, com a sessão inteira. A página
// sai da árvore da janela, então o timer de suspensão passa a tratá-la como qualquer aba de
// fundo (suspende depois do tempo parada, e áudio em reprodução segue vivo).
import type { MainContext } from '../context'
import { hideTabView } from '../functions/show-tab-view'
import { closePalette } from './close-palette'

export function hideWindow(ctx: MainContext): void {
  const { win, store } = ctx
  if (win.isDestroyed()) return

  closePalette(ctx, false)
  const activeId = store.getActiveTabId()
  // a contagem de inatividade da aba que estava na tela começa agora
  if (activeId) store.touchTab(activeId)
  hideTabView(ctx)

  // sair da tela cheia antes: esconder a janela em tela cheia deixa um espaço vazio no macOS
  if (win.isFullScreen()) {
    win.once('leave-full-screen', () => win.hide())
    win.setFullScreen(false)
  } else {
    win.hide()
  }
}
