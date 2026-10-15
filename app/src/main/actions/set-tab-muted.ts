import type { TabId } from '@shared/types'
import type { MainContext } from '../context'
import { getLiveContents } from '../functions/get-live-contents'

export function setTabMuted(
  ctx: MainContext,
  tabId: TabId,
  muted: boolean
): void {
  getLiveContents(ctx.views.get(tabId))?.setAudioMuted(muted)
  ctx.store.patchTab(tabId, { muted })
}
