// Pede ao Chromium a busca do estado atual na aba (webContents.findInPage). O resultado volta em
// found-in-page (functions/attach-find-events.ts). Sem texto, limpa os destaques.
import { beginFindRequest } from '@shared/find-state'
import { getFindRequest, type FindDirection } from '@shared/find-request'
import type { MainContext } from '../context'
import { pushFindState } from './push-find-state'

export function runFind(ctx: MainContext, direction: FindDirection): void {
  const session = ctx.find
  if (!session) return
  const wc = ctx.views.get(session.tabId)?.webContents
  if (!wc || wc.isDestroyed()) return

  const request = getFindRequest(session.state, direction)
  if (!request) {
    // findInPage('') lança erro: sem texto só se limpa
    wc.stopFindInPage('clearSelection')
  } else {
    try {
      const requestId = wc.findInPage(request.text, request.options)
      session.state = beginFindRequest(session.state, requestId)
    } catch (error) {
      console.error('[Find][runFind] findInPage falhou', error)
    }
  }
  pushFindState(ctx)
}
