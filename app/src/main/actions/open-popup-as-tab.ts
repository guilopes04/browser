// window.open e target=_blank: a aba nova adota o webContents que o Chromium criou.
import type { WebContents } from 'electron'
import type { SpaceId } from '@shared/types'
import type { MainContext } from '../context'
import { createTabView } from '../functions/create-tab-view'
import { createTabRecord } from '../store/create-tab-record'
import { activateTab } from './activate-tab'

export function openPopupAsTab(
  ctx: MainContext,
  spaceId: SpaceId,
  url: string,
  adopted?: WebContents,
  background = false
): WebContents {
  const tab = createTabRecord(spaceId, url)
  tab.dormant = false
  tab.loading = true
  ctx.store.addTab(tab, 'top')

  const view = createTabView(ctx, tab, adopted)
  if (!adopted) void view.webContents.loadURL(url).catch(() => {})
  if (!background) activateTab(ctx, tab.id)
  return view.webContents
}
