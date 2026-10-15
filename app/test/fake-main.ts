// Contexto de mentira do main para os testes das ações: store de verdade, janela, shell e views
// falsas que só registram o que recebem. A view falsa imita o Electron: depois de destruída,
// `view.webContents` vira undefined.
import type { WebContents, WebContentsView } from 'electron'
import type { Tab } from '@shared/types'
import type { MainContext } from '../src/main/context'
import { parseFlags } from '../src/main/flags'
import { AppStore } from '../src/main/store/app-store'
import { buildInitialState } from '../src/main/store/build-initial-state'

export interface FakeContents {
  destroyed: boolean
  closeCalls: unknown[]
  focused: number
  url: string
  listeners: Map<string, ((...args: any[]) => void)[]>
  isDestroyed(): boolean
  isCurrentlyAudible(): boolean
  focus(): void
  close(options?: unknown): void
  once(event: string, listener: (...args: any[]) => void): void
  on(event: string, listener: (...args: any[]) => void): void
  emit(event: string, ...args: any[]): void
  getURL(): string
}

export interface FakeView {
  webContents: FakeContents | undefined
  setBounds(): void
  setVisible(): void
  setBorderRadius(): void
  // o que o Electron faz quando a página se fecha sozinha
  destroy(): void
}

export function fakeContents(url = ''): FakeContents {
  const wc: FakeContents = {
    destroyed: false,
    closeCalls: [],
    focused: 0,
    url,
    listeners: new Map(),
    isDestroyed: () => wc.destroyed,
    isCurrentlyAudible: () => false,
    focus: () => void wc.focused++,
    close: options => {
      wc.closeCalls.push(options ?? null)
      // fechar de verdade destrói; o teste chama destroy() quando quer simular a página
    },
    once: (event, listener) => {
      const wrapped = (...args: any[]) => {
        wc.listeners.set(
          event,
          (wc.listeners.get(event) ?? []).filter(l => l !== wrapped)
        )
        listener(...args)
      }
      wc.listeners.set(event, [...(wc.listeners.get(event) ?? []), wrapped])
    },
    on: (event, listener) => {
      wc.listeners.set(event, [...(wc.listeners.get(event) ?? []), listener])
    },
    emit: (event, ...args) => {
      for (const listener of wc.listeners.get(event) ?? []) listener(...args)
    },
    getURL: () => wc.url
  }
  return wc
}

export function fakeView(wc = fakeContents()): FakeView {
  const view: FakeView = {
    webContents: wc,
    setBounds() {},
    setVisible() {},
    setBorderRadius() {},
    destroy() {
      wc.destroyed = true
      view.webContents = undefined
      wc.emit('destroyed')
    }
  }
  return view
}

export function fakeContext(urls: string[] = []) {
  const { state, closed } = buildInitialState({
    theme: 'light',
    session: null,
    tabsFile: { urls, window: {} },
    bounds: { x: 0, y: 0, width: 1300, height: 800 }
  })
  const store = new AppStore(state, closed)
  const sent: { channel: string; payload: unknown }[] = []
  const added: unknown[] = []
  const removed: unknown[] = []
  let visible = true

  const ctx = {
    store,
    history: { record() {}, setTitle() {}, saveNow() {} },
    flags: parseFlags(['--suspender-apos=5']),
    win: {
      isDestroyed: () => false,
      isVisible: () => visible,
      isFullScreen: () => false,
      isMinimized: () => false,
      getContentSize: () => [1300, 800],
      setBackgroundColor() {},
      setWindowButtonVisibility() {},
      setWindowButtonPosition() {},
      hide: () => void (visible = false),
      show: () => void (visible = true),
      focus() {},
      contentView: {
        addChildView: (view: unknown) => void added.push(view),
        removeChildView: (view: unknown) => void removed.push(view)
      }
    },
    shell: {
      setBounds() {},
      webContents: { focus() {}, send() {} }
    },
    broadcaster: {
      send: (channel: string, payload: unknown) =>
        void sent.push({ channel, payload }),
      scheduleSnapshot() {},
      queueTabPatch() {}
    },
    views: new Map<string, WebContentsView>(),
    stash: new Map(),
    pendingScroll: new Map(),
    suspending: new Set<string>(),
    httpFallbacks: new Map(),
    closing: new Set<string>(),
    saveAs: new Set<string>(),
    attached: { tabId: null as string | null, view: null as unknown },
    shellRaised: false,
    shellReady: true,
    keyGate: null,
    metaFilled: Promise.resolve(),
    quitting: false
  } as unknown as MainContext

  // põe uma aba como viva, com uma view falsa registrada
  const makeLive = (tab: Tab, url = tab.url) => {
    const wc = fakeContents(url)
    const view = fakeView(wc)
    ctx.views.set(tab.id, view as unknown as WebContentsView)
    store.patchTab(tab.id, { dormant: false })
    return { wc, view }
  }

  return { ctx, store, sent, added, removed, makeLive }
}

export type { WebContents }
