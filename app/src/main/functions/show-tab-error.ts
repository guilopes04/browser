// Põe a aba na página de erro (da shell) ou a tira dela: a view da página some enquanto a aba tem
// erro. O título vira o host que falhou e o favicon volta ao padrão (letra e cor).
import type { Tab, TabId } from '@shared/types'
import { getHostname } from '@shared/url-parts'
import type { MainContext } from '../context'
import { applyLayout } from './apply-layout'
import { getLiveContents } from './get-live-contents'

export function showTabError(
  ctx: MainContext,
  tabId: TabId,
  error: Tab['error'],
  failedUrl = ''
): void {
  ctx.store.patchTab(tabId, {
    error,
    ...(error
      ? { title: getHostname(failedUrl) || failedUrl, favicon: null }
      : {})
  })
  if (ctx.attached.tabId !== tabId) return
  applyLayout(ctx)
  if (error) ctx.shell.webContents.focus()
  else getLiveContents(ctx.views.get(tabId))?.focus()
}
