// Menu de contexto da aba (nativo nesta fase).
import { Menu } from 'electron'
import type { TabId } from '@shared/types'
import type { MainContext } from '../context'
import { closeTab } from './close-tab'
import { moveTabToSpace } from './move-tab-to-space'
import { setTabMuted } from './set-tab-muted'
import { suspendTab } from './suspend-tab'

export function showTabMenu(ctx: MainContext, tabId: TabId): void {
  const { store } = ctx
  const tab = store.getTab(tabId)
  if (!tab) return
  const isLive = ctx.views.has(tabId)
  const isShown = ctx.attached.tabId === tabId

  const menu = Menu.buildFromTemplate([
    {
      label: tab.muted ? 'Reativar o som da aba' : 'Silenciar aba',
      enabled: isLive,
      click: () => setTabMuted(ctx, tabId, !tab.muted)
    },
    {
      label: 'Suspender aba',
      enabled: isLive && !isShown,
      click: () => void suspendTab(ctx, tabId)
    },
    {
      label: 'Mover para espaço',
      submenu: store.state.spaces
        .filter(space => space.id !== tab.spaceId)
        .map(space => ({
          label: space.name,
          click: () => moveTabToSpace(ctx, tabId, space.id)
        }))
    },
    { type: 'separator' },
    { label: 'Fechar aba', click: () => closeTab(ctx, tabId) }
  ])
  menu.popup({ window: ctx.win })
}
