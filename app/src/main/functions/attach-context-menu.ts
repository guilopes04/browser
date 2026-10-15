// Clique direito na página: menu nativo em português (links, imagens, texto, campos e navegação).
import { Menu, type ContextMenuParams, type WebContents } from 'electron'
import type { TabId } from '@shared/types'
import { runPageMenuAction } from '../actions/run-page-menu-action'
import type { MainContext } from '../context'
import { describePageMenu } from './describe-page-menu'

export function attachContextMenu(
  ctx: MainContext,
  tabId: TabId,
  wc: WebContents
): void {
  wc.on('context-menu', (_event, params: ContextMenuParams) => {
    const entries = describePageMenu({
      linkURL: params.linkURL,
      srcURL: params.srcURL,
      mediaType: params.mediaType,
      selectionText: params.selectionText,
      isEditable: params.isEditable,
      editFlags: params.editFlags,
      canGoBack: wc.navigationHistory.canGoBack(),
      canGoForward: wc.navigationHistory.canGoForward(),
      dev: ctx.flags.dev
    })
    if (entries.length === 0 || ctx.win.isDestroyed()) return

    const menu = Menu.buildFromTemplate(
      entries.map(entry =>
        entry.kind === 'separator'
          ? { type: 'separator' as const }
          : {
              label: entry.label,
              enabled: entry.enabled,
              click: () =>
                runPageMenuAction(ctx, tabId, wc, params, entry.action)
            }
      )
    )
    // sem x e y: o menu abre onde o ponteiro está
    menu.popup({ window: ctx.win })
  })
}
