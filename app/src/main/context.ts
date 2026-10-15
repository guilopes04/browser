// Contexto passado explicitamente às ações (como o `client` no backend).
import type { BaseWindow, NavigationEntry, WebContentsView } from 'electron'
import type { KeyGateTarget } from '@shared/early-key'
import type { TabId } from '@shared/types'
import type { Flags } from './flags'
import type { Broadcaster } from './ipc/broadcast'
import type { AppStore } from './store/app-store'
import type { HistoryStore } from './store/history-store'

export interface ScrollPosition {
  x: number
  y: number
}

export interface NavigationStash {
  entries: NavigationEntry[]
  index: number
  // rolagem da página ao suspender (o restore do histórico não a devolve sempre)
  scroll?: ScrollPosition | null
}

// rolagem à espera de ser reaplicada numa aba que acordou (functions/restore-scroll.ts)
export interface PendingScroll {
  scroll: ScrollPosition
  loaded: boolean
  started: boolean
}

export interface HttpFallback {
  from: string
  to: string
}

export interface MainContext {
  store: AppStore
  // histórico de navegação por espaço
  history: HistoryStore
  flags: Flags
  win: BaseWindow
  shell: WebContentsView
  broadcaster: Broadcaster
  // abas vivas (com webContents)
  views: Map<TabId, WebContentsView>
  // histórico de navegação das abas suspensas
  stash: Map<TabId, NavigationStash>
  // abas que acordaram e ainda devem recuperar a rolagem de antes da suspensão
  pendingScroll: Map<TabId, PendingScroll>
  // abas com a suspensão em andamento (ler a rolagem leva um instante)
  suspending: Set<TabId>
  // endereço digitado sem esquema: se o https falhar do jeito de quem só fala http, tenta http
  httpFallbacks: Map<TabId, HttpFallback>
  // view da aba que está na árvore da janela agora
  attached: { tabId: TabId | null; view: WebContentsView | null }
  // a shell está acima da página na árvore (há motivo de overlay: peek, dica)
  shellRaised: boolean
  // a shell já recebeu o primeiro estado
  shellReady: boolean
  // a paleta ou a Nova aba está abrindo: as teclas digitadas agora passam pelo main
  // (functions/key-gate.ts)
  keyGate: {
    target: KeyGateTarget
    openedAt: number
    readyAt: number | null
  } | null
  // resolve quando o preenchimento de título e favicon das abas e favoritos sem eles termina
  metaFilled: Promise<void>
  quitting: boolean
}
