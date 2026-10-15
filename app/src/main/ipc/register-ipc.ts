// Controller fino: canal -> valida o payload -> ação. Só aceita mensagens da shell.
import { ipcMain, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron'
import { isKnownCommand } from '@shared/commands'
import type { KeyGateTarget } from '@shared/early-key'
import { COMMAND_CHANNELS, type Commands } from '@shared/ipc'
import { resolveTyped } from '@shared/resolve-input'
import type { CommandId, SpaceId, TabId } from '@shared/types'
import {
  activateTab,
  closePalette,
  closeTab,
  createTab,
  goBack,
  goForward,
  moveTab,
  moveTabToSpace,
  navigateTab,
  openDownloads,
  openNetworkSettings,
  openPalette,
  reloadTab,
  reopenTab,
  runCommand,
  setOverlay,
  setTabMuted,
  showTabMenu,
  suspendTab,
  switchSpace,
  toggleSidebar
} from '../actions'
import type { MainContext } from '../context'
import { isShellUrl } from '../functions/is-shell-url'
import { markKeyGateReady } from '../functions/key-gate'
import { queryPalette } from '../functions/query-palette'
import { getShellUrl } from '../services/app-protocol'

type Handler = (ctx: MainContext, payload: unknown) => void

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readTabId(ctx: MainContext, payload: unknown): TabId | null {
  if (!isRecord(payload) || typeof payload.tabId !== 'string') return null
  return ctx.store.getTab(payload.tabId) ? payload.tabId : null
}

function readSpaceId(ctx: MainContext, value: unknown): SpaceId | null {
  return typeof value === 'string' && ctx.store.getSpace(value) ? value : null
}

function readKeyTarget(ctx: MainContext, value: unknown): KeyGateTarget | null {
  if (!isRecord(value)) return null
  if (value.kind === 'palette') return { kind: 'palette' }
  if (value.kind === 'new-tab') {
    const tabId = readTabId(ctx, value)
    return tabId ? { kind: 'new-tab', tabId } : null
  }
  return null
}

function readCommand(value: unknown): CommandId | null {
  return isKnownCommand(value) ? value : null
}

// a consulta da paleta é digitada: nada de texto gigante atravessando o IPC
const MAX_QUERY_LENGTH = 200

const handlers: { [K in keyof Commands]: Handler } = {
  'tab:activate': (ctx, payload) => {
    const tabId = readTabId(ctx, payload)
    if (tabId) activateTab(ctx, tabId)
  },
  'tab:create': (ctx, payload) => {
    const input = isRecord(payload) ? payload : {}
    // a URL passa pelo mesmo filtro da barra de endereço (só http, https e file viram aba)
    const typed =
      typeof input.url === 'string'
        ? resolveTyped(input.url, ctx.store.state.settings.searchUrl)
        : null
    const tab = createTab(ctx, {
      spaceId: readSpaceId(ctx, input.spaceId) ?? undefined,
      url: typed?.url,
      background: input.background === true
    })
    // domínio sem esquema: https primeiro e, se o servidor só fala http, a aba tenta http
    if (typed?.httpFallback)
      ctx.httpFallbacks.set(tab.id, {
        from: typed.url,
        to: typed.httpFallback
      })
  },
  'tab:close': (ctx, payload) => {
    const tabId = readTabId(ctx, payload)
    if (tabId) closeTab(ctx, tabId)
  },
  'tab:reopen': ctx => reopenTab(ctx),
  'tab:navigate': (ctx, payload) => {
    const tabId = readTabId(ctx, payload)
    if (tabId && isRecord(payload) && typeof payload.input === 'string') {
      navigateTab(ctx, tabId, payload.input)
    }
  },
  'tab:back': ctx => goBack(ctx),
  'tab:forward': ctx => goForward(ctx),
  'tab:reload': ctx => reloadTab(ctx),
  'tab:set-muted': (ctx, payload) => {
    const tabId = readTabId(ctx, payload)
    if (tabId && isRecord(payload) && typeof payload.muted === 'boolean') {
      setTabMuted(ctx, tabId, payload.muted)
    }
  },
  'tab:suspend': (ctx, payload) => {
    const tabId = readTabId(ctx, payload)
    if (tabId) void suspendTab(ctx, tabId)
  },
  'tab:move': (ctx, payload) => {
    const tabId = readTabId(ctx, payload)
    if (tabId && isRecord(payload) && Number.isInteger(payload.toIndex)) {
      moveTab(ctx, tabId, payload.toIndex as number)
    }
  },
  'tab:move-to-space': (ctx, payload) => {
    const tabId = readTabId(ctx, payload)
    const spaceId = isRecord(payload) ? readSpaceId(ctx, payload.spaceId) : null
    if (tabId && spaceId) moveTabToSpace(ctx, tabId, spaceId)
  },
  'tab:context-menu': (ctx, payload) => {
    const tabId = readTabId(ctx, payload)
    if (tabId) showTabMenu(ctx, tabId)
  },
  'space:switch': (ctx, payload) => {
    const spaceId = isRecord(payload) ? readSpaceId(ctx, payload.spaceId) : null
    if (spaceId) switchSpace(ctx, spaceId)
  },
  'sidebar:toggle': ctx => toggleSidebar(ctx),
  'shell:raise': (ctx, payload) => {
    if (!isRecord(payload) || typeof payload.on !== 'boolean') return
    const { reason } = payload
    if (reason === 'peek' || reason === 'tooltip' || reason === 'popover')
      setOverlay(ctx, reason, payload.on)
  },
  'palette:open': (ctx, payload) => {
    const mode =
      isRecord(payload) && payload.mode === 'address' ? 'address' : 'search'
    openPalette(ctx, mode)
  },
  'palette:close': ctx => closePalette(ctx),
  'keys:ready': (ctx, payload) => {
    const target = isRecord(payload) ? readKeyTarget(ctx, payload.target) : null
    if (target) markKeyGateReady(ctx, target)
  },
  'system:open-network-settings': () => openNetworkSettings(),
  'downloads:open': ctx => openDownloads(ctx),
  'command:run': (ctx, payload) => {
    const command = isRecord(payload) ? readCommand(payload.command) : null
    if (command) runCommand(ctx, command)
  }
}

export function registerIpc(ctx: MainContext, onStateServed: () => void): void {
  const shellUrl = getShellUrl()
  // além do webContents, confere o frame: só o documento principal da shell manda comandos
  const isFromShell = (event: IpcMainEvent | IpcMainInvokeEvent) => {
    const frame = event.senderFrame
    return (
      event.sender === ctx.shell.webContents &&
      frame !== null &&
      frame.parent === null &&
      isShellUrl(frame.url, shellUrl)
    )
  }

  for (const channel of COMMAND_CHANNELS) {
    ipcMain.on(channel, (event, payload: unknown) => {
      if (!isFromShell(event)) return
      handlers[channel](ctx, payload)
    })
  }

  ipcMain.handle('palette:query', (event, payload: unknown) => {
    if (!isFromShell(event)) throw new Error('remetente não autorizado')
    const input = isRecord(payload) ? payload : {}
    const text =
      typeof input.text === 'string'
        ? input.text.slice(0, MAX_QUERY_LENGTH)
        : ''
    return queryPalette(
      ctx,
      text,
      input.scope === 'current' ? 'current' : 'all'
    )
  })

  ipcMain.handle('state:get', event => {
    if (!isFromShell(event)) throw new Error('remetente não autorizado')
    ctx.shellReady = true
    onStateServed()
    return ctx.store.state
  })
}
