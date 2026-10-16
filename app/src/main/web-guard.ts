// Estado das defesas contra páginas hostis (gestos do usuário, pop-ups, diálogos, downloads).
// Fica todo em ctx.guard, para o contexto não ganhar um campo por defesa. As chaves são ids de
// aba: o que vale só para uma view (gestos, diálogos) é zerado quando a view é destruída.
import type { TabId } from '@shared/types'
import type { FrameGesture } from './functions/frame-activation'

// quantos pop-ups o último gesto já liberou
export interface PopupBudget {
  gestureAt: number
  used: number
}

// alert/confirm/prompt de uma aba: quando os últimos apareceram e se o usuário pediu para calar
export interface DialogGuard {
  shownAt: number[]
  blocked: boolean
}

// a resposta já dada ao beforeunload de uma ação do usuário (vale para os quadros seguintes dela)
export interface UnloadAnswer {
  intent: number
  leave: boolean
}

// consentimento de download sem gesto: um diálogo por vez e, depois de uma recusa, um intervalo
export interface DownloadPrompt {
  pending: boolean
  deniedUntil: number
}

// o último clique do usuário num link da aba (endereço já resolvido) e quando
export interface LinkClick {
  url: string
  at: number
}

export interface WebGuard {
  // último gesto real do usuário (tecla ou clique) na página da aba, em epoch ms
  gestures: Map<TabId, number>
  // em que quadro cada gesto caiu (o preload de cada quadro reporta): o clique na página não vale
  // para um iframe de outra origem (functions/frame-activation.ts)
  frameGestures: Map<TabId, FrameGesture[]>
  linkClicks: Map<TabId, LinkClick>
  popupBudget: Map<TabId, PopupBudget>
  // URLs de pop-ups bloqueados por aba (o snapshot só leva a contagem)
  blockedPopups: Map<TabId, string[]>
  // abas que nasceram de window.open ou target=_blank: só elas podem ser fechadas por script
  scriptOpened: Set<TabId>
  // aba que abriu cada aba aberta por script
  openers: Map<TabId, TabId>
  // última ação do usuário que pode descarregar a página (fechar, recarregar, ir a um endereço)
  navIntents: Map<TabId, number>
  unloadAnswers: Map<TabId, UnloadAnswer>
  dialogs: Map<TabId, DialogGuard>
  // downloads em andamento por aba
  downloadsRunning: Map<TabId, number>
  downloadPrompts: Map<TabId, DownloadPrompt>
  // abas com a pergunta "abrir em outro app?" na tela
  externalPending: Set<TabId>
  // quando o app desfez o último fechamento por script de cada aba (evita o laço de recarregar)
  scriptCloseUndoneAt: Map<TabId, number>
}

export function createWebGuard(): WebGuard {
  return {
    gestures: new Map(),
    frameGestures: new Map(),
    linkClicks: new Map(),
    popupBudget: new Map(),
    blockedPopups: new Map(),
    scriptOpened: new Set(),
    openers: new Map(),
    navIntents: new Map(),
    unloadAnswers: new Map(),
    dialogs: new Map(),
    downloadsRunning: new Map(),
    downloadPrompts: new Map(),
    externalPending: new Set(),
    scriptCloseUndoneAt: new Map()
  }
}

// a aba carregou outro documento (navegação entre documentos do quadro principal): o gesto do
// usuário e o saldo de pop-ups eram da página anterior. Sem isto, o clique num link valia para
// o que a página de destino fizesse ao carregar (pop-up, download), e o mesmo para um endereço
// digitado logo depois de um clique
export function resetDocumentState(guard: WebGuard, tabId: TabId): void {
  guard.gestures.delete(tabId)
  guard.frameGestures.delete(tabId)
  guard.linkClicks.delete(tabId)
  guard.popupBudget.delete(tabId)
}

// a view da aba morreu (suspensão, fechamento): o que era dela some; a identidade da aba
// (aberta por script, quem a abriu) continua até a aba sair da sidebar
export function resetViewState(guard: WebGuard, tabId: TabId): void {
  resetDocumentState(guard, tabId)
  guard.blockedPopups.delete(tabId)
  guard.navIntents.delete(tabId)
  guard.unloadAnswers.delete(tabId)
  guard.dialogs.delete(tabId)
  guard.externalPending.delete(tabId)
}

// a aba saiu da sidebar
export function forgetTab(guard: WebGuard, tabId: TabId): void {
  resetViewState(guard, tabId)
  guard.scriptOpened.delete(tabId)
  guard.openers.delete(tabId)
  guard.scriptCloseUndoneAt.delete(tabId)
  guard.downloadPrompts.delete(tabId)
  for (const [child, opener] of guard.openers)
    if (opener === tabId) guard.openers.delete(child)
}
