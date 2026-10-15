// Ativa uma aba: troca de espaço se preciso, acorda se dormente e a põe na janela.
import type { TabId } from '@shared/types'
import type { MainContext } from '../context'
import { getLiveContents } from '../functions/get-live-contents'
import { closeKeyGate, openKeyGate } from '../functions/key-gate'
import { hideTabView, showTabView } from '../functions/show-tab-view'
import { applyWindowBackground } from '../functions/window-background'
import { closePalette } from './close-palette'
import { wakeTab } from './wake-tab'

export function activateTab(ctx: MainContext, tabId: TabId): void {
  const { store } = ctx
  const tab = store.getTab(tabId)
  if (!tab) return

  // escolher uma aba (pela paleta, por exemplo) encerra a paleta; o foco vai para a aba, abaixo
  closePalette(ctx, false)
  // as teclas que esperavam a Nova aba anterior não são mais de ninguém
  closeKeyGate(ctx)

  const previous = store.getActiveTab()
  if (previous && previous.id !== tabId) store.touchTab(previous.id)

  if (tab.spaceId !== store.state.window.spaceId)
    store.setCurrentSpace(tab.spaceId)
  store.setActiveTab(tab.spaceId, tabId)
  store.touchTab(tabId)
  // a aba está à vista: o marcador de diálogo descartado cumpriu o papel
  if (tab.dialogBlocked) store.patchTab(tabId, { dialogBlocked: false })

  const view = wakeTab(ctx, tabId)
  if (view) {
    showTabView(ctx, tabId, view)
    getLiveContents(view)?.focus()
  } else {
    // Nova aba: a shell desenha a página e recebe o foco. O campo de busca só existe depois do
    // primeiro quadro dela; até lá, as teclas passam pelo main e a shell as recebe em ordem
    hideTabView(ctx)
    ctx.shell.webContents.focus()
    // (reativar a Nova aba que já está na tela não muda o foco do campo dela)
    if (ctx.shellReady && previous?.id !== tabId)
      openKeyGate(ctx, { kind: 'new-tab', tabId })
  }
  applyWindowBackground(ctx)
}
