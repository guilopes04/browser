// Menu do app, gerado de shared/shortcuts.ts. Os accelerators valem com o foco em qualquer
// view, inclusive dentro da página.
import { Menu, type MenuItemConstructorOptions } from 'electron'
import {
  FIXED_SHORTCUTS,
  getSpaceShortcuts,
  getTabShortcuts,
  type MenuGroup,
  type Shortcut
} from '@shared/shortcuts'
import { runCommand } from '../actions/run-command'
import type { MainContext } from '../context'
import { getActiveContents } from '../functions/get-active-contents'

function toItem(
  ctx: MainContext,
  shortcut: Shortcut
): MenuItemConstructorOptions {
  return {
    label: shortcut.label,
    accelerator: shortcut.accelerator,
    click: () => runCommand(ctx, shortcut.command)
  }
}

export function buildAppMenu(ctx: MainContext): void {
  const all = [
    ...FIXED_SHORTCUTS,
    ...getTabShortcuts(),
    ...getSpaceShortcuts(ctx.store.state.spaces.length)
  ]
  const group = (name: MenuGroup) =>
    all
      .filter(shortcut => shortcut.group === name)
      .map(shortcut => toItem(ctx, shortcut))

  const zoomInAlias: MenuItemConstructorOptions = {
    label: 'Aumentar zoom',
    accelerator: 'CmdOrCtrl+=',
    visible: false,
    click: () => runCommand(ctx, 'zoom-in')
  }

  // ⌥⌘I: ferramentas do desenvolvedor da aba, só com --dev
  const devTools: MenuItemConstructorOptions[] = ctx.flags.dev
    ? [
        { type: 'separator' },
        {
          label: 'Ferramentas do desenvolvedor',
          accelerator: 'Alt+CmdOrCtrl+I',
          click: () => getActiveContents(ctx)?.toggleDevTools()
        }
      ]
    : []

  const template: MenuItemConstructorOptions[] = [
    { role: 'appMenu' },
    { label: 'Arquivo', submenu: group('file') },
    { role: 'editMenu' },
    {
      label: 'Visualizar',
      submenu: [
        ...group('view'),
        zoomInAlias,
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...devTools
      ]
    },
    { label: 'Navegar', submenu: group('navigate') },
    { label: 'Espaços', submenu: group('spaces') },
    { role: 'windowMenu' }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
