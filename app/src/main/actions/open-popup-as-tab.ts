// window.open e target=_blank: a aba nova adota o webContents que o Chromium criou.
import type { WebContents } from 'electron'
import type { SpaceId, TabId } from '@shared/types'
import type { MainContext } from '../context'
import { createTabView } from '../functions/create-tab-view'
import { createTabRecord } from '../store/create-tab-record'
import { activateTab } from './activate-tab'

export interface PopupInput {
  spaceId: SpaceId
  url: string
  adopted?: WebContents
  // a aba da página que pediu a janela: a nova nasce "aberta por script" (pode se fechar com
  // window.close) e guarda quem a abriu
  openerTabId?: TabId
  background?: boolean
}

export function openPopupAsTab(
  ctx: MainContext,
  input: PopupInput
): WebContents {
  const { spaceId, url, adopted, openerTabId, background = false } = input
  const tab = createTabRecord(spaceId, url)
  tab.dormant = false
  tab.loading = true
  if (openerTabId) {
    ctx.guard.scriptOpened.add(tab.id)
    ctx.guard.openers.set(tab.id, openerTabId)
  }
  ctx.store.addTab(tab, 'top')

  const view = createTabView(ctx, tab, adopted)
  if (!adopted) void view.webContents.loadURL(url).catch(() => {})
  if (!background) activateTab(ctx, tab.id)
  return view.webContents
}
