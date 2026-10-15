// ⌘W: fecha a aba; se era a última do espaço, abre uma Nova aba. Nunca fecha a janela.
// Aba viva fecha pelo webContents, esperando o beforeunload da página (se ela quiser perguntar
// "Sair desta página?", a aba só some quando o usuário confirma). Dormente e Nova aba fecham já.
import type { TabId } from '@shared/types'
import type { MainContext } from '../context'
import { getLiveContents } from '../functions/get-live-contents'
import { markUserNavigation } from '../functions/user-intent'
import { removeTab } from './remove-tab'

// se a página não responde ao fechamento (renderer travado, sem diálogo na tela), a aba é
// removida à força depois deste tempo, para o ⌘W nunca ficar mudo
const FORCE_CLOSE_MS = 3000

export function closeTab(ctx: MainContext, tabId: TabId): void {
  if (!ctx.store.getTab(tabId) || ctx.closing.has(tabId)) return

  const view = ctx.views.get(tabId)
  const wc = getLiveContents(view)
  if (!view || !wc) {
    removeTab(ctx, tabId, true)
    return
  }

  ctx.closing.add(tabId)
  // o beforeunload da página pode perguntar: é uma ação do usuário
  markUserNavigation(ctx, tabId)
  wc.close({ waitForBeforeUnload: true })
  const timer = setTimeout(() => {
    // o diálogo "Ficar" tira a aba de closing; destruída, o evento já a removeu
    if (!ctx.closing.has(tabId) || ctx.views.get(tabId) !== view) return
    removeTab(ctx, tabId, true)
  }, FORCE_CLOSE_MS)
  timer.unref()
}
