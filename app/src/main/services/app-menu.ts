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
import { clearBrowsingData } from '../actions/clear-browsing-data'
import { runCommand } from '../actions/run-command'
import { showWindow } from '../actions/show-window'
import type { MainContext } from '../context'
import { getActiveContents } from '../functions/get-active-contents'

function toItem(
  ctx: MainContext,
  shortcut: Shortcut
): MenuItemConstructorOptions {
  return {
    label: shortcut.label,
    accelerator: shortcut.accelerator,
    click: () => {
      // janela escondida (botão vermelho): o atalho a traz de volta antes de agir
      if (!ctx.win.isVisible()) showWindow(ctx)
      runCommand(ctx, shortcut.command)
    }
  }
}

// os papéis (role) do Electron trazem os textos em inglês; o rótulo explícito vence
const APP_NAME = 'Gilas Browser'

function appMenu(): MenuItemConstructorOptions {
  return {
    label: APP_NAME,
    submenu: [
      { role: 'about', label: `Sobre o ${APP_NAME}` },
      { type: 'separator' },
      { role: 'services', label: 'Serviços' },
      { type: 'separator' },
      { role: 'hide', label: `Ocultar ${APP_NAME}` },
      { role: 'hideOthers', label: 'Ocultar Outros' },
      { role: 'unhide', label: 'Mostrar Tudo' },
      { type: 'separator' },
      { role: 'quit', label: `Encerrar ${APP_NAME}` }
    ]
  }
}

// os itens da busca na página (⌘F, ⌘G, ⇧⌘G) vêm de shortcuts.ts, depois dos papéis do sistema
function editMenu(
  find: MenuItemConstructorOptions[]
): MenuItemConstructorOptions {
  return {
    label: 'Editar',
    submenu: [
      { role: 'undo', label: 'Desfazer' },
      { role: 'redo', label: 'Refazer' },
      { type: 'separator' },
      { role: 'cut', label: 'Recortar' },
      { role: 'copy', label: 'Copiar' },
      { role: 'paste', label: 'Colar' },
      { role: 'pasteAndMatchStyle', label: 'Colar e Combinar Estilo' },
      { role: 'delete', label: 'Apagar' },
      { role: 'selectAll', label: 'Selecionar Tudo' },
      ...(find.length ? [{ type: 'separator' as const }, ...find] : [])
    ]
  }
}

function windowMenu(): MenuItemConstructorOptions {
  return {
    label: 'Janela',
    role: 'window',
    submenu: [
      { role: 'minimize', label: 'Minimizar' },
      { role: 'zoom', label: 'Zoom' },
      { type: 'separator' },
      { role: 'front', label: 'Trazer Todas para a Frente' }
    ]
  }
}

// separado do Menu do Electron para os testes conferirem os rótulos
export function buildMenuTemplate(
  ctx: MainContext
): MenuItemConstructorOptions[] {
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
    appMenu(),
    {
      label: 'Arquivo',
      submenu: [
        ...group('file'),
        { type: 'separator' },
        // sem atalho: apagar dados não é coisa de tecla solta
        {
          label: 'Limpar dados de navegação…',
          click: () => void clearBrowsingData(ctx)
        }
      ]
    },
    editMenu(group('edit')),
    {
      label: 'Visualizar',
      submenu: [
        ...group('view'),
        zoomInAlias,
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Tela Cheia' },
        ...devTools
      ]
    },
    { label: 'Navegar', submenu: group('navigate') },
    { label: 'Espaços', submenu: group('spaces') },
    windowMenu()
  ]
  return template
}

export function buildAppMenu(ctx: MainContext): void {
  Menu.setApplicationMenu(Menu.buildFromTemplate(buildMenuTemplate(ctx)))
}
