// window.open e target=_blank viram aba no mesmo espaço. Usa createWindow para adotar o
// webContents que o Chromium já criou, o que preserva o `opener` dos popups de OAuth.
import type { WebContents } from 'electron'
import type { SpaceId, TabId } from '@shared/types'
import { openPopupAsTab } from '../actions/open-popup-as-tab'
import type { MainContext } from '../context'

const ALLOWED_URL = /^(https?:|about:blank$|blob:)/i

export function installWindowOpenHandler(
  ctx: MainContext,
  spaceId: SpaceId,
  tabId: TabId,
  wc: WebContents
): void {
  wc.setWindowOpenHandler(details => {
    if (!ctx.store.getTab(tabId) || !ALLOWED_URL.test(details.url))
      return { action: 'deny' }
    return {
      action: 'allow',
      createWindow: options => {
        const adopted = (options as { webContents?: WebContents }).webContents
        return openPopupAsTab(
          ctx,
          spaceId,
          details.url,
          adopted,
          details.disposition === 'background-tab'
        )
      }
    }
  })
}
