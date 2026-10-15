// Eventos da página que a busca acompanha: o resultado do Chromium (found-in-page), a navegação
// (a página nova não tem os resultados da antiga) e o fim do carregamento (a busca recomeça nela).
import type { WebContents } from 'electron'
import { applyFindResult, resetFindResults } from '@shared/find-state'
import type { TabId } from '@shared/types'
import type { MainContext } from '../context'
import { applyFindHighlight } from './apply-find-highlight'
import { pushFindState } from './push-find-state'
import { runFind } from './run-find'

export function attachFindEvents(
  ctx: MainContext,
  tabId: TabId,
  wc: WebContents
): void {
  const finding = () => (ctx.find?.tabId === tabId ? ctx.find : null)

  wc.on('found-in-page', (_event, result) => {
    const session = finding()
    if (!session) return
    const next = applyFindResult(session.state, result)
    if (next === session.state) return
    session.state = next
    pushFindState(ctx)
  })

  // a barra continua aberta numa página nova; a busca recomeça quando ela terminar de carregar, e
  // as cores dos resultados entram no documento novo (o CSS inserido no anterior foi com ele)
  wc.on('did-navigate', () => {
    const session = finding()
    if (!session) return
    session.state = resetFindResults(session.state)
    session.refreshOnLoad = true
    session.cssKey = null
    applyFindHighlight(ctx, session, wc)
    pushFindState(ctx)
  })

  // só recomeça quando a página mudou ou ainda carregava ao abrir a barra: recomeçar a cada fim de
  // carregamento (um iframe que termina tarde) levaria o destaque ativo para outro resultado
  wc.on('did-stop-loading', () => {
    const session = finding()
    if (!session || !session.refreshOnLoad) return
    session.refreshOnLoad = false
    runFind(ctx, 'reload')
  })
}
