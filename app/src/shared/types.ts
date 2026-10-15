// Tipos compartilhados entre main e renderer. Sem Electron e sem DOM.

export type SpaceId = string
export type TabId = string
export type Theme = 'light' | 'dark'
export type SidebarMode = 'open' | 'compact' | 'hidden'
export type SpaceColor = 'indigo' | 'amber'
// 'notice': aviso de tela cheia ("Site em tela cheia. Esc para sair"), só o main liga
export type OverlayReason =
  'palette' | 'peek' | 'tooltip' | 'popover' | 'notice'

export interface Point {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface Favorite {
  id: string
  title: string
  url: string
  favicon: string | null
  essential: boolean
  // tile quando não há favicon (cor e letra definidas no design de cada favorito)
  tile: string
  letter?: string
}

export interface Space {
  id: SpaceId
  name: string
  color: SpaceColor
  favorites: Favorite[]
}

// falha ao carregar a página principal (código de rede do Chromium e o nome dele)
export interface LoadError {
  code: number
  description: string
}

export interface Tab {
  id: TabId
  spaceId: SpaceId
  // '' = Nova aba, desenhada pela shell, sem webContents
  url: string
  title: string
  // data URL PNG de 32 px; null = letra + cor
  favicon: string | null
  audible: boolean
  muted: boolean
  dormant: boolean
  // epoch ms
  lastActiveAt: number
  // só em memória
  loading: boolean
  canGoBack: boolean
  canGoForward: boolean
  // a shell desenha a página de erro no lugar da página enquanto houver erro
  error: LoadError | null
}

export interface WindowState {
  spaceId: SpaceId
  activeTabBySpace: Record<SpaceId, TabId | null>
  sidebar: SidebarMode
  bounds: Rect
}

export interface Settings {
  // 1800 = 30 min; 0 = nunca. Aceita fração
  suspendAfterSec: number
  neverSuspendAudible: boolean
  hiddenSidebarStyle: 'hidden' | 'compact'
  searchUrl: string
}

// downloads em andamento e o último que terminou (o ícone de Downloads da sidebar mostra isto)
export interface DownloadStatus {
  // quantos baixam agora
  active: number
  // progresso somado dos que baixam, de 0 a 100; null = nenhum tamanho conhecido
  percent: number | null
  // o último que terminou: um clique no ícone abre a pasta dele no Finder
  lastPath: string | null
  lastName: string | null
  lastFailed: boolean
}

// "Limpar dados de navegação" acabou de rodar neste espaço: a sidebar avisa por alguns segundos.
// Só em memória
export interface ClearedData {
  spaceId: SpaceId
  // epoch ms
  at: number
}

export interface AppSnapshot {
  theme: Theme
  spaces: Space[]
  // todos os espaços, na ordem da sidebar
  tabs: Tab[]
  window: WindowState
  // o que a janela mostra agora: igual a window.sidebar, exceto que a sidebar aberta vira
  // compacta em janela estreita (sem gravar). Só em memória
  effectiveSidebar: SidebarMode
  settings: Settings
  overlay: OverlayReason[]
  fullscreen: boolean
  downloads: DownloadStatus
  clearedData: ClearedData | null
}

export type PersistedTab = Pick<
  Tab,
  'id' | 'spaceId' | 'url' | 'title' | 'favicon' | 'muted' | 'lastActiveAt'
>

export interface SessionFile {
  version: 1
  spaces: Space[]
  window: WindowState
  settings: Settings
  tabs: PersistedTab[]
  // pilha do ⇧⌘T, máximo 20
  closed: Pick<Tab, 'spaceId' | 'url' | 'title'>[]
}

export type CommandId =
  | 'new-tab'
  | 'close-tab'
  | 'reopen-tab'
  | 'reload'
  | 'back'
  | 'forward'
  | 'toggle-sidebar'
  | 'focus-address'
  | 'next-tab'
  | 'prev-tab'
  | 'zoom-in'
  | 'zoom-out'
  | 'zoom-reset'
  | 'palette'
  | 'suspend-tab'
  | `tab-${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`
  | `space-${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`

// título e endereço sem acento nem caixa (ver normalizeForMatch)
export interface NormalizedText {
  title: string
  url: string
}

// entrada do histórico de um espaço (history.jsonl), da mais recente para a mais antiga
export interface HistoryEntry {
  url: string
  title: string
  // epoch ms
  visitedAt: number
  // caches em memória, preenchidos sob demanda; nunca vão para o arquivo
  key?: string
  host?: string
  search?: NormalizedText
}

// 'all' = abas, favoritos e histórico de todos os espaços; 'current' = só o espaço atual (⇥)
export type PaletteScope = 'all' | 'current'

// 'search' = ⌘K; 'address' = ⌘L (começa com o endereço da aba, selecionado; ↵ navega nela)
export type PaletteMode = 'search' | 'address'

// o shell resolve ícone e cor pelo snapshot (abas e favoritos já estão lá): o main só manda ids
export type PaletteItem =
  | { kind: 'tab'; tabId: TabId; spaceId: SpaceId; title: string; url: string }
  | {
      kind: 'favorite'
      favoriteId: string
      spaceId: SpaceId
      title: string
      url: string
    }
  | {
      kind: 'history'
      spaceId: SpaceId
      title: string
      url: string
      visitedAt: number
    }
  | { kind: 'action'; command: CommandId; label: string; keys: string }
  // ⌘↵: abre o endereço digitado (ou o site que a consulta sugere)
  | { kind: 'open-url'; url: string; label: string }
  // ⌥↵: busca o texto na web
  | { kind: 'web-search'; text: string; url: string }

export interface PaletteSection {
  id: 'recent' | 'tabs' | 'favorites' | 'history' | 'actions'
  items: PaletteItem[]
}
