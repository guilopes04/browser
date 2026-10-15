// Estado em memória e único dono dele. Quem muda algo chama um método daqui;
// quem precisa reagir (shell, sessão) assina com subscribe.
import type {
  AppSnapshot,
  OverlayReason,
  Rect,
  SidebarMode,
  Space,
  SpaceId,
  Tab,
  TabId,
  Theme
} from '@shared/types'
import { getHostname } from '@shared/url-parts'

export type StoreChange =
  // abas, espaços, janela: a shell recebe o snapshot e a sessão é gravada
  | { kind: 'structure' }
  // só o que a shell mostra e o arquivo não guarda (tema, tela cheia, sidebar efetiva, overlay)
  | { kind: 'view' }
  | { kind: 'tab'; tabId: TabId; patch: Partial<Tab> }
  // muda só o que vai para o session.json (a shell não precisa saber)
  | { kind: 'dirty' }

type Listener = (change: StoreChange) => void

const MAX_CLOSED = 20

export class AppStore {
  private listeners = new Set<Listener>()
  readonly state: AppSnapshot
  // pilha do ⇧⌘T
  closed: { spaceId: SpaceId; url: string; title: string }[]

  constructor(initial: AppSnapshot, closed: AppStore['closed'] = []) {
    this.state = initial
    this.closed = closed
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(change: StoreChange): void {
    for (const listener of this.listeners) listener(change)
  }

  // ---- leitura ----

  getTab(tabId: TabId): Tab | undefined {
    return this.state.tabs.find(tab => tab.id === tabId)
  }

  getSpace(spaceId: SpaceId): Space | undefined {
    return this.state.spaces.find(space => space.id === spaceId)
  }

  getCurrentSpace(): Space {
    return this.getSpace(this.state.window.spaceId) ?? this.state.spaces[0]
  }

  getTabsOfSpace(spaceId: SpaceId): Tab[] {
    return this.state.tabs.filter(tab => tab.spaceId === spaceId)
  }

  getActiveTabId(spaceId: SpaceId = this.state.window.spaceId): TabId | null {
    return this.state.window.activeTabBySpace[spaceId] ?? null
  }

  getActiveTab(spaceId: SpaceId = this.state.window.spaceId): Tab | undefined {
    const id = this.getActiveTabId(spaceId)
    return id ? this.getTab(id) : undefined
  }

  // ---- escrita ----

  // topo da lista do espaço (⌘T) ou no fim (abertura da sessão)
  addTab(tab: Tab, position: 'top' | 'end' = 'top'): void {
    if (position === 'top') {
      const first = this.state.tabs.findIndex(
        other => other.spaceId === tab.spaceId
      )
      if (first === -1) this.state.tabs.push(tab)
      else this.state.tabs.splice(first, 0, tab)
    } else {
      this.state.tabs.push(tab)
    }
    this.emit({ kind: 'structure' })
  }

  removeTab(tabId: TabId): void {
    const index = this.state.tabs.findIndex(tab => tab.id === tabId)
    if (index === -1) return
    this.state.tabs.splice(index, 1)
    this.emit({ kind: 'structure' })
  }

  // a aba muda de espaço e vai para o topo da lista dele. A sessão muda, então tudo o que
  // dependia da página viva zera (a aba volta dormente e recarrega quando for aberta)
  moveTabToSpace(tabId: TabId, spaceId: SpaceId): void {
    const tab = this.getTab(tabId)
    if (!tab) return
    this.state.tabs.splice(this.state.tabs.indexOf(tab), 1)
    Object.assign(tab, {
      spaceId,
      dormant: tab.url !== '',
      audible: false,
      loading: false,
      canGoBack: false,
      canGoForward: false,
      error: null
    })
    this.addTab(tab, 'top')
  }

  patchTab(tabId: TabId, patch: Partial<Tab>): void {
    const tab = this.getTab(tabId)
    if (!tab) return
    const changed: Partial<Tab> = {}
    for (const key of Object.keys(patch) as (keyof Tab)[]) {
      if (tab[key] !== patch[key]) {
        ;(changed as Record<string, unknown>)[key] = patch[key]
      }
    }
    if (Object.keys(changed).length === 0) return
    Object.assign(tab, changed)
    this.emit({ kind: 'tab', tabId, patch: changed })
  }

  // favicon descoberto depois (favoritos nascem sem ele): a shell recebe o snapshot e a sessão grava
  setFavoriteFavicon(
    spaceId: SpaceId,
    favoriteId: string,
    favicon: string
  ): void {
    const favorite = this.getSpace(spaceId)?.favorites.find(
      other => other.id === favoriteId
    )
    if (!favorite || favorite.favicon === favicon) return
    favorite.favicon = favicon
    this.emit({ kind: 'structure' })
  }

  // um favorito sem favicon (nunca carregou) ganha o do site quando uma aba do mesmo site o
  // descobre; os que já têm o seu ficam como estão
  fillFavoriteFavicons(url: string, favicon: string): void {
    const host = getHostname(url)
    if (!host) return
    let changed = false
    for (const space of this.state.spaces)
      for (const favorite of space.favorites)
        if (favorite.favicon === null && getHostname(favorite.url) === host) {
          favorite.favicon = favicon
          changed = true
        }
    if (changed) this.emit({ kind: 'structure' })
  }

  // atualiza lastActiveAt sem avisar a shell (a sidebar não mostra esse dado),
  // mas a sessão precisa gravar o valor novo
  touchTab(tabId: TabId, now = Date.now()): void {
    const tab = this.getTab(tabId)
    if (!tab) return
    tab.lastActiveAt = now
    this.emit({ kind: 'dirty' })
  }

  // reordena dentro do espaço: toIndex é a posição entre as abas do espaço
  moveTab(tabId: TabId, toIndex: number): void {
    const tab = this.getTab(tabId)
    if (!tab) return
    const siblings = this.getTabsOfSpace(tab.spaceId)
    const from = siblings.indexOf(tab)
    const target = Math.max(0, Math.min(toIndex, siblings.length - 1))
    if (from === target) return
    const slots = siblings.map(sibling => this.state.tabs.indexOf(sibling))
    const reordered = siblings.slice()
    reordered.splice(from, 1)
    reordered.splice(target, 0, tab)
    slots.forEach((slot, i) => {
      this.state.tabs[slot] = reordered[i]
    })
    this.emit({ kind: 'structure' })
  }

  setActiveTab(spaceId: SpaceId, tabId: TabId | null): void {
    this.state.window.activeTabBySpace[spaceId] = tabId
    this.emit({ kind: 'structure' })
  }

  setCurrentSpace(spaceId: SpaceId): void {
    this.state.window.spaceId = spaceId
    this.emit({ kind: 'structure' })
  }

  setSidebar(mode: SidebarMode): void {
    this.state.window.sidebar = mode
    // a revelação pela borda só existe com a sidebar oculta
    if (mode !== 'hidden') this.removeOverlay('peek')
    this.emit({ kind: 'structure' })
  }

  // o modo mostrado (a janela estreita pode forçar o compacto). Só avisa quando muda
  setEffectiveSidebar(mode: SidebarMode): void {
    if (this.state.effectiveSidebar === mode) return
    this.state.effectiveSidebar = mode
    // as dicas do compacto não fazem sentido em outro modo
    if (mode !== 'compact') this.removeOverlay('tooltip')
    this.emit({ kind: 'view' })
  }

  // motivos pelos quais a shell fica por cima da página. Devolve se algo mudou
  setOverlay(reason: OverlayReason, on: boolean): boolean {
    const { overlay } = this.state
    if (overlay.includes(reason) === on) return false
    if (on) overlay.push(reason)
    else this.removeOverlay(reason)
    this.emit({ kind: 'view' })
    return true
  }

  private removeOverlay(reason: OverlayReason): void {
    const index = this.state.overlay.indexOf(reason)
    if (index !== -1) this.state.overlay.splice(index, 1)
  }

  // tela cheia de vídeo (requestFullscreen): a página ocupa a janela inteira
  setFullscreen(on: boolean): void {
    if (this.state.fullscreen === on) return
    this.state.fullscreen = on
    this.emit({ kind: 'view' })
  }

  setTheme(theme: Theme): void {
    this.state.theme = theme
    this.emit({ kind: 'view' })
  }

  setBounds(bounds: Rect): void {
    this.state.window.bounds = bounds
    this.emit({ kind: 'dirty' })
  }

  pushClosed(entry: AppStore['closed'][number]): void {
    this.closed.push(entry)
    if (this.closed.length > MAX_CLOSED) this.closed.shift()
  }

  popClosed(): AppStore['closed'][number] | undefined {
    return this.closed.pop()
  }
}
