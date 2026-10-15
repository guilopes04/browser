// ⌘F: a barra de busca abre no canto da página da aba ativa, com o foco no campo. Acorda a aba se
// ela estiver dormente. Com a barra já aberta, foca o campo e seleciona o texto. Se há texto
// selecionado na página, ele vira a busca (a barra abre e a busca roda assim que a seleção chega).
import { createFindState, focusFind, replaceFindText } from '@shared/find-state'
import type { TabId } from '@shared/types'
import type { FindSession, MainContext } from '../context'
import { getLayout } from '../functions/apply-layout'
import { createFindView } from '../functions/create-find-view'
import { insertFindHighlightStyle } from '../functions/find-highlight-style'
import { getActiveContents } from '../functions/get-active-contents'
import { openKeyGate } from '../functions/key-gate'
import { layoutFind } from '../functions/layout-find'
import { pushFindState } from '../functions/push-find-state'
import { readPageSelection } from '../functions/read-page-selection'
import { runFind } from '../functions/run-find'
import { activateTab } from './activate-tab'
import { closeFind } from './close-find'

function startSession(ctx: MainContext, tabId: TabId): void {
  closeFind(ctx, false)
  const contents = getActiveContents(ctx)
  if (!contents) return

  const view = createFindView(ctx)
  const session: FindSession = {
    tabId,
    view,
    state: createFindState(ctx.findMatchCase),
    ready: false,
    cssKey: null,
    refreshOnLoad: ctx.store.getTab(tabId)?.loading ?? false,
    lastSent: ''
  }
  ctx.find = session
  // por cima da página, no canto; as teclas digitadas até a caixa existir ficam com o main
  ctx.win.contentView.addChildView(view)
  layoutFind(ctx, getLayout(ctx).page)
  openKeyGate(ctx, { kind: 'find' })

  void insertFindHighlightStyle(contents).then(key => {
    if (!key) return
    if (ctx.find === session) session.cssKey = key
    else contents.removeInsertedCSS(key).catch(() => {})
  })
}

export function openFind(ctx: MainContext): void {
  const { store } = ctx
  // com o vídeo em tela cheia a página ocupa a janela e não há onde pôr a barra
  if (store.state.fullscreen) return
  const tab = store.getActiveTab()
  // Nova aba e página de erro são desenhadas pela shell: não há página para buscar
  if (!tab || tab.url === '' || tab.error) return
  // aba dormente (ou que não está na janela): acorda e entra antes
  if (ctx.attached.tabId !== tab.id) activateTab(ctx, tab.id)
  const contents = getActiveContents(ctx)
  if (!contents || ctx.attached.tabId !== tab.id) return

  const reopened = ctx.find?.tabId === tab.id
  if (!reopened) startSession(ctx, tab.id)
  const session = ctx.find
  if (!session) return

  if (reopened) {
    session.state = focusFind(session.state)
    pushFindState(ctx)
  }
  session.view.webContents.focus()

  void readPageSelection(contents).then(selected => {
    if (ctx.find !== session || selected === '') return
    // quem já digitou na barra (teclas repassadas durante a abertura) não perde o texto
    if (!reopened && session.state.text !== '') return
    session.state = focusFind(replaceFindText(session.state, selected))
    runFind(ctx, 'restart')
  })
}
