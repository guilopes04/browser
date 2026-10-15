// Tela cheia de vídeo: o Chromium põe a janela em tela cheia nativa, mas a página continuaria
// no painel recuado. Estes eventos ligam o layout de "página ocupa a janela".
import type { WebContents } from 'electron'
import type { TabId } from '@shared/types'
import type { MainContext } from '../context'
import { applyLayout } from './apply-layout'
import {
  hideFullscreenNotice,
  showFullscreenNotice
} from './show-fullscreen-notice'

export function attachFullscreenEvents(
  ctx: MainContext,
  tabId: TabId,
  wc: WebContents
): void {
  wc.on('enter-html-full-screen', () => {
    // só a aba que está na janela pode ocupá-la
    if (ctx.attached.tabId !== tabId) return
    ctx.store.setFullscreen(true)
    applyLayout(ctx)
    showFullscreenNotice(ctx)
  })
  wc.on('leave-html-full-screen', () => {
    if (!ctx.store.state.fullscreen) return
    ctx.store.setFullscreen(false)
    hideFullscreenNotice(ctx)
    applyLayout(ctx)
  })
}
