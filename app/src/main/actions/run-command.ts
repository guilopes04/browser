// Despacha um CommandId (menu e atalhos) para a ação certa.
import type { CommandId } from '@shared/types'
import type { MainContext } from '../context'
import { activateTab } from './activate-tab'
import { closePalette } from './close-palette'
import { closeTab } from './close-tab'
import { createTab } from './create-tab'
import { cycleTab } from './cycle-tab'
import { focusAddress } from './focus-address'
import { goBack } from './go-back'
import { goForward } from './go-forward'
import { reloadTab } from './reload-tab'
import { reopenTab } from './reopen-tab'
import { stepZoom } from './step-zoom'
import { suspendActiveTab } from './suspend-active-tab'
import { switchSpace } from './switch-space'
import { togglePalette } from './toggle-palette'
import { toggleSidebar } from './toggle-sidebar'

const ZOOM_STEP = 0.5

export function runCommand(ctx: MainContext, command: CommandId): void {
  const { store } = ctx

  if (command === 'palette') {
    togglePalette(ctx)
    return
  }
  if (command === 'focus-address') {
    focusAddress(ctx)
    return
  }
  // qualquer outro comando (menu, atalho ou item da paleta) fecha a paleta e devolve o foco à
  // página; os que trocam de aba põem o foco onde precisam
  closePalette(ctx)

  if (command.startsWith('tab-')) {
    const tabs = store.getTabsOfSpace(store.state.window.spaceId)
    const n = Number(command.slice(4))
    const target = n === 9 ? tabs[tabs.length - 1] : tabs[n - 1]
    if (target) activateTab(ctx, target.id)
    return
  }
  if (command.startsWith('space-')) {
    const space = store.state.spaces[Number(command.slice(6)) - 1]
    if (space) switchSpace(ctx, space.id)
    return
  }

  switch (command) {
    case 'new-tab':
      createTab(ctx)
      break
    case 'close-tab': {
      const id = store.getActiveTabId()
      if (id) closeTab(ctx, id)
      break
    }
    case 'reopen-tab':
      reopenTab(ctx)
      break
    case 'reload':
      reloadTab(ctx)
      break
    case 'back':
      goBack(ctx)
      break
    case 'forward':
      goForward(ctx)
      break
    case 'toggle-sidebar':
      toggleSidebar(ctx)
      break
    case 'next-tab':
      cycleTab(ctx, 1)
      break
    case 'prev-tab':
      cycleTab(ctx, -1)
      break
    case 'zoom-in':
      stepZoom(ctx, ZOOM_STEP)
      break
    case 'zoom-out':
      stepZoom(ctx, -ZOOM_STEP)
      break
    case 'zoom-reset':
      stepZoom(ctx, 'reset')
      break
    case 'suspend-tab':
      suspendActiveTab(ctx)
      break
  }
}
