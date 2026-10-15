// Cria a WebContentsView de uma aba na partição do espaço e a registra no contexto.
import { WebContentsView, type WebContents } from 'electron'
import { PAGE_CANVAS, PANEL_RADIUS } from '@shared/tokens'
import type { Tab } from '@shared/types'
import type { MainContext } from '../context'
import { getLayout } from './apply-layout'
import { watchDownloads } from '../services/downloads'
import { attachCloseEvents } from './attach-close-events'
import { attachContextMenu } from './attach-context-menu'
import { attachFullscreenEvents } from './attach-fullscreen-events'
import { attachTabEvents } from './attach-tab-events'
import { attachUnloadGuard } from './attach-unload-guard'
import { getSpaceSession } from './get-space-session'
import { guardTabNavigation } from './guard-tab-navigation'
import { getTabPreloadPath } from './tab-preload-path'
import { installWindowOpenHandler } from './window-open'

export function createTabView(
  ctx: MainContext,
  tab: Tab,
  adopted?: WebContents
): WebContentsView {
  const preload = getTabPreloadPath()
  const view = adopted
    ? new WebContentsView({ webContents: adopted })
    : new WebContentsView({
        webPreferences: {
          session: getSpaceSession(tab.spaceId),
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false,
          // alert/confirm/prompt passam pelo main (preload/tab-guard.ts); os diálogos nativos do
          // Electron, que não mostram a origem nem se calam, ficam desligados
          ...(preload
            ? {
                preload,
                nodeIntegrationInSubFrames: true,
                disableDialogs: true
              }
            : {})
        }
      })
  view.setBackgroundColor(PAGE_CANVAS)
  view.setBorderRadius(PANEL_RADIUS)
  // tamanho certo desde já, mesmo fora da árvore (carregamento em segundo plano)
  view.setBounds(getLayout(ctx).page)
  view.webContents.setAudioMuted(tab.muted)

  ctx.views.set(tab.id, view)
  attachCloseEvents(ctx, tab.id, view)
  attachTabEvents(ctx, tab.id, view.webContents)
  attachUnloadGuard(ctx, tab.id, view.webContents)
  attachContextMenu(ctx, tab.id, view.webContents)
  watchDownloads(ctx, view.webContents.session)
  attachFullscreenEvents(ctx, tab.id, view.webContents)
  guardTabNavigation(view.webContents)
  installWindowOpenHandler(ctx, tab.spaceId, tab.id, view.webContents)
  return view
}
