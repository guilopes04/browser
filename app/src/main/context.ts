// Contexto passado explicitamente às ações (como o `client` no backend).
import type { BaseWindow, NavigationEntry, WebContentsView } from 'electron'
import type { KeyGateTarget } from '@shared/early-key'
import type { FindState } from '@shared/find-state'
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

// a barra de busca na página (⌘F): uma view pequena por cima da página, criada ao abrir e destruída
// ao fechar. O estado da busca fica aqui, no main; a barra só mostra
export interface FindSession {
  // a aba que está sendo buscada (a que estava na janela ao abrir)
  tabId: TabId
  view: WebContentsView
  state: FindState
  // a caixa já está na tela e com o foco (find:ready): daqui em diante a barra recebe o estado
  ready: boolean
  // CSS dos destaques inserido na página (o design pinta os resultados com as cores dele)
  cssKey: string | null
  // a página mudou (ou ainda carregava ao abrir): a busca recomeça quando ela terminar de carregar
  refreshOnLoad: boolean
  // o último estado enviado à barra, para não repetir
  lastSent: string
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
  // endereços de imagem que "Salvar imagem como" pediu: o download deles mostra o diálogo
  saveAs: Set<string>
  // abas que o usuário mandou fechar e que esperam o webContents terminar (o beforeunload da
  // página pode pedir confirmação); o fechamento só vale quando ele é destruído
  closing: Set<TabId>
  // view da aba que está na árvore da janela agora
  attached: { tabId: TabId | null; view: WebContentsView | null }
  // a shell está acima da página na árvore (há motivo de overlay: peek, dica)
  shellRaised: boolean
  // a shell já recebeu o primeiro estado
  shellReady: boolean
  // busca na página aberta, ou null
  find: FindSession | null
  // o "Aa" da última busca: vale para a próxima
  findMatchCase: boolean
  // a paleta, a Nova aba ou a barra de busca está abrindo: as teclas digitadas agora passam pelo
  // main (functions/key-gate.ts)
  keyGate: {
    target: KeyGateTarget
    openedAt: number
    readyAt: number | null
  } | null
  // resolve quando o preenchimento de título e favicon das abas e favoritos sem eles termina
  metaFilled: Promise<void>
  quitting: boolean
}
