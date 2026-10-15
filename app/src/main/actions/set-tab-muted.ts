import type { TabId } from '@shared/types'
import type { MainContext } from '../context'

export function setTabMuted(
  ctx: MainContext,
  tabId: TabId,
  muted: boolean
): void {
  ctx.views.get(tabId)?.webContents.setAudioMuted(muted)
  ctx.store.patchTab(tabId, { muted })
}
